"""WBS 파서 모듈.

wbs.md 파일을 파싱하여 Task 리스트를 반환하고,
파일 변경을 감지하여 콜백을 실행합니다.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import re
from collections.abc import Awaitable, Callable
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from orchay.models import Task, TaskCategory, TaskPriority, TaskStatus

if TYPE_CHECKING:
    from watchdog.observers.api import BaseObserver

logger = logging.getLogger(__name__)

# 정규식 패턴
TASK_HEADER_PATTERN = re.compile(r"^###\s+(TSK-\d+-\d+(?:-\d+)?):\s*(.+)$")
STATUS_PATTERN = re.compile(r"\[([^\]]*)\]")
ATTRIBUTE_PATTERN = re.compile(r"^-\s*(\w+(?:-\w+)?):\s*(.*)$")
METADATA_PATTERN = re.compile(r"^>\s*([\w-]+):\s*(.*)$")


class WbsParseError(Exception):
    """WBS 파싱 오류."""

    def __init__(self, message: str, line_number: int | None = None) -> None:
        self.line_number = line_number
        super().__init__(f"{message} (line {line_number})" if line_number else message)


def extract_status_code(status_line: str) -> str:
    """상태 라인에서 코드 추출.

    Args:
        status_line: 상태가 포함된 라인 (예: '- status: todo [ ]')

    Returns:
        상태 코드 (예: '[ ]', '[im]')
    """
    match = STATUS_PATTERN.search(status_line)
    if match:
        code = match.group(1)
        # 빈 상태 또는 공백만 있는 경우 [ ]로 반환
        if not code.strip():
            return "[ ]"
        return f"[{code}]"
    return "[ ]"


def _parse_status(status_code: str) -> TaskStatus:
    """상태 코드를 TaskStatus enum으로 변환."""
    status_map: dict[str, TaskStatus] = {
        "[ ]": TaskStatus.TODO,
        "[bd]": TaskStatus.BASIC_DESIGN,
        "[dd]": TaskStatus.DETAIL_DESIGN,
        "[an]": TaskStatus.ANALYSIS,
        "[ds]": TaskStatus.DESIGN,
        "[ap]": TaskStatus.APPROVED,
        "[im]": TaskStatus.IMPLEMENT,
        "[fx]": TaskStatus.FIX,
        "[vf]": TaskStatus.VERIFY,
        "[xx]": TaskStatus.DONE,
    }
    return status_map.get(status_code, TaskStatus.TODO)


def _parse_category(category_str: str) -> TaskCategory:
    """카테고리 문자열을 TaskCategory enum으로 변환."""
    category_map: dict[str, TaskCategory] = {
        "development": TaskCategory.DEVELOPMENT,
        "defect": TaskCategory.DEFECT,
        "infrastructure": TaskCategory.INFRASTRUCTURE,
        "simple-dev": TaskCategory.SIMPLE_DEV,
    }
    return category_map.get(category_str.lower(), TaskCategory.DEVELOPMENT)


def _parse_priority(priority_str: str) -> TaskPriority:
    """우선순위 문자열을 TaskPriority enum으로 변환."""
    priority_map: dict[str, TaskPriority] = {
        "critical": TaskPriority.CRITICAL,
        "high": TaskPriority.HIGH,
        "medium": TaskPriority.MEDIUM,
        "low": TaskPriority.LOW,
    }
    return priority_map.get(priority_str.lower(), TaskPriority.MEDIUM)


def _parse_list(value: str) -> list[str]:
    """콤마로 구분된 값을 리스트로 변환."""
    if not value or value == "-":
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


class WbsParser:
    """WBS 파일 파서.

    wbs.md 파일을 파싱하여 Task 리스트를 반환합니다.
    파싱 실패 시 이전 캐시를 반환합니다.
    """

    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)
        self._cache: list[Task] = []
        self._metadata: dict[str, str] = {}
        self._last_parsed: datetime | None = None

    @property
    def project_root(self) -> str | None:
        """project-root 메타데이터 값 반환."""
        return self._metadata.get("project-root")

    @property
    def metadata(self) -> dict[str, str]:
        """전체 메타데이터 반환."""
        return self._metadata.copy()

    async def parse(self) -> list[Task]:
        """wbs.md 파일을 파싱하여 Task 리스트 반환.

        Returns:
            Task 객체 리스트

        Note:
            파싱 실패 시 이전 캐시된 결과를 반환합니다.
        """
        try:
            if not self._path.exists():
                logger.warning(f"WBS 파일이 존재하지 않습니다: {self._path}")
                return [] if not self._cache else self._cache

            content = self._path.read_text(encoding="utf-8")
            self._parse_metadata(content)
            tasks = self._parse_content(content)

            # 파싱 결과가 비어있고 이전 캐시가 있으면 캐시 반환 (BR-01)
            if not tasks and self._cache:
                logger.warning("파싱 결과 없음. 이전 캐시 반환")
                return self._cache

            # 캐시 업데이트
            self._cache = tasks
            self._last_parsed = datetime.now()

            return tasks

        except Exception as e:
            logger.error(f"WBS 파싱 오류: {e}")
            # 캐시 반환
            return self._cache

    def _parse_metadata(self, content: str) -> None:
        """메타데이터 블록 파싱.

        wbs.md 상단의 `> key: value` 형식 메타데이터를 파싱합니다.
        """
        self._metadata.clear()
        for line in content.split("\n"):
            # 빈 줄이나 구분선(---)을 만나면 메타데이터 블록 종료
            stripped = line.strip()
            if stripped.startswith("---"):
                break
            if not stripped:
                continue

            match = METADATA_PATTERN.match(line)
            if match:
                key, value = match.groups()
                self._metadata[key] = value.strip()

    def _parse_content(self, content: str) -> list[Task]:
        """마크다운 콘텐츠를 파싱하여 Task 리스트 반환."""
        tasks: list[Task] = []
        lines = content.split("\n")

        current_task: dict[str, str | list[str]] | None = None
        current_list_key: str | None = None  # 현재 파싱 중인 중첩 리스트 키
        i = 0

        while i < len(lines):
            line = lines[i]

            # Task 헤더 감지 (### TSK-...)
            header_match = TASK_HEADER_PATTERN.match(line)
            if header_match:
                # 이전 Task 저장
                if current_task:
                    task = self._create_task(current_task)
                    if task:
                        tasks.append(task)

                # 새 Task 시작
                current_task = {
                    "id": header_match.group(1),
                    "title": header_match.group(2).strip(),
                }
                current_list_key = None
                i += 1
                continue

            # WP 헤더 감지 (## WP-...) - 현재 Task 저장 후 초기화
            # 이렇게 하면 WP 속성이 Task에 적용되지 않음
            if line.startswith("## "):
                if current_task:
                    task = self._create_task(current_task)
                    if task:
                        tasks.append(task)
                    current_task = None
                current_list_key = None
                i += 1
                continue

            # 속성 파싱 (현재 Task가 있을 때만)
            if current_task:
                # 중첩 리스트 항목 감지 (  - item)
                if line.startswith("  - ") and current_list_key:
                    item = line[4:].strip()
                    if current_list_key not in current_task:
                        current_task[current_list_key] = []
                    list_val = current_task[current_list_key]
                    if isinstance(list_val, list):
                        list_val.append(item)
                    i += 1
                    continue

                attr_match = ATTRIBUTE_PATTERN.match(line)
                if attr_match:
                    key = attr_match.group(1)
                    value = attr_match.group(2).strip()
                    # 중첩 리스트 시작 감지 (value가 비어있으면 다음 줄부터 리스트)
                    if key in ("requirements", "acceptance", "tech-spec", "api-spec", "ui-spec"):
                        if value:
                            # 단일 줄 값
                            current_task[key] = value
                        else:
                            # 빈 값이면 중첩 리스트 시작
                            current_task[key] = []
                        current_list_key = key
                    else:
                        current_task[key] = value
                        current_list_key = None
                else:
                    # 속성이 아닌 줄이면 리스트 파싱 종료
                    if not line.strip().startswith("-") and not line.strip().startswith("#"):
                        current_list_key = None

            i += 1

        # 마지막 Task 저장
        if current_task:
            task = self._create_task(current_task)
            if task:
                tasks.append(task)

        return tasks

    def _create_task(self, data: dict[str, str | list[str]]) -> Task | None:
        """딕셔너리에서 Task 객체 생성."""
        try:
            raw_id = data.get("id", "")
            raw_title = data.get("title", "")
            task_id = raw_id if isinstance(raw_id, str) else ""
            title = raw_title if isinstance(raw_title, str) else ""

            if not task_id or not title:
                return None

            # 문자열 값 가져오기 헬퍼
            def get_str(key: str, default: str = "") -> str:
                val = data.get(key, default)
                return val if isinstance(val, str) else default

            # 리스트 값 가져오기 헬퍼
            def get_list(key: str) -> list[str]:
                val = data.get(key)
                if isinstance(val, list):
                    return val
                if isinstance(val, str) and val:
                    return _parse_list(val)
                return []

            # 상태 코드 추출
            status_line = get_str("status", "[ ]")
            status_code = extract_status_code(f"- status: {status_line}")
            status = _parse_status(status_code)

            # 카테고리
            category_str = get_str("category", "development")
            category = _parse_category(category_str)

            # 우선순위
            priority_str = get_str("priority", "medium")
            priority = _parse_priority(priority_str)

            blocked_by_value = get_str("blocked-by")
            blocked_by: str | None = blocked_by_value if blocked_by_value != "-" else None

            return Task(
                id=task_id,
                title=title,
                category=category,
                domain=get_str("domain", ""),
                status=status,
                priority=priority,
                assignee=get_str("assignee", "-"),
                schedule=get_str("schedule", ""),
                tags=_parse_list(get_str("tags", "")),
                depends=_parse_list(get_str("depends", "")),
                blocked_by=blocked_by,
                workflow=get_str("workflow", "design"),
                # TSK-06-02: 요구사항/기술 스펙 필드
                prd_ref=get_str("prd-ref", ""),
                requirements=get_list("requirements"),
                acceptance=get_list("acceptance"),
                tech_spec=get_list("tech-spec"),
                api_spec=get_list("api-spec"),
                ui_spec=get_list("ui-spec"),
            )
        except Exception as e:
            logger.error(f"Task 생성 오류: {e}")
            return None


async def parse_wbs(path: str | Path) -> list[Task]:
    """wbs.md 파일을 파싱하여 Task 리스트 반환.

    Args:
        path: wbs.md 파일 경로

    Returns:
        Task 객체 리스트

    Example:
        tasks = await parse_wbs(".orchay/projects/orchay/wbs.md")
        for task in tasks:
            print(f"{task.id}: {task.status}")
    """
    parser = WbsParser(path)
    return await parser.parse()


class WbsFileHandler(FileSystemEventHandler):
    """WBS 파일 변경 이벤트 핸들러."""

    def __init__(
        self,
        wbs_path: Path,
        callback: Callable[[list[Task]], Awaitable[None]],
        debounce: float,
        loop: asyncio.AbstractEventLoop,
    ) -> None:
        self._wbs_path = wbs_path
        self._callback = callback
        self._debounce = debounce
        self._loop = loop
        self._pending_task: asyncio.Task[None] | None = None
        self._parser = WbsParser(wbs_path)

    def on_modified(self, event: FileSystemEvent) -> None:
        """파일 수정 이벤트 처리."""
        if event.is_directory:
            return

        src_path = event.src_path
        if isinstance(src_path, bytes):
            src_path = src_path.decode("utf-8")

        event_path = Path(src_path)
        if event_path.name != self._wbs_path.name:
            return

        # 디바운싱: 이전 대기 중인 태스크 취소
        if self._pending_task and not self._pending_task.done():
            self._pending_task.cancel()

        # 새 태스크 예약
        future = asyncio.run_coroutine_threadsafe(self._debounced_callback(), self._loop)
        with contextlib.suppress(Exception):
            self._pending_task = future.result(timeout=1.0)

    async def _debounced_callback(self) -> asyncio.Task[None]:
        """디바운스된 콜백 실행."""

        async def delayed_callback() -> None:
            await asyncio.sleep(self._debounce)
            tasks = await self._parser.parse()
            await self._callback(tasks)

        return asyncio.create_task(delayed_callback())


class WbsWatcher:
    """WBS 파일 감시자.

    wbs.md 파일 변경을 감지하고 콜백을 실행합니다.
    """

    def __init__(
        self,
        path: str | Path,
        callback: Callable[[list[Task]], Awaitable[None]],
        debounce: float = 0.5,
    ) -> None:
        self._path = Path(path)
        self._callback = callback
        self._debounce = debounce
        self._observer: BaseObserver | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

    def start(self) -> None:
        """파일 감시 시작."""
        self._loop = asyncio.get_event_loop()
        handler = WbsFileHandler(
            self._path,
            self._callback,
            self._debounce,
            self._loop,
        )

        self._observer = Observer()
        self._observer.schedule(handler, str(self._path.parent), recursive=False)  # type: ignore[arg-type]
        self._observer.start()

        logger.info(f"WBS 파일 감시 시작: {self._path}")

    async def stop(self) -> None:
        """파일 감시 중지."""
        if self._observer:
            self._observer.stop()
            self._observer.join(timeout=2.0)
            self._observer = None
            logger.info("WBS 파일 감시 중지")


def watch_wbs(
    path: str | Path,
    callback: Callable[[list[Task]], Awaitable[None]],
    debounce: float = 0.5,
) -> WbsWatcher:
    """wbs.md 파일 변경 감지 및 콜백 실행.

    Args:
        path: 감시할 wbs.md 파일 경로
        callback: 변경 시 호출될 async 콜백 (Task 리스트 전달)
        debounce: 디바운스 시간 (초)

    Returns:
        WbsWatcher 인스턴스 (start/stop 메서드 제공)

    Example:
        async def on_change(tasks: list[Task]):
            print(f"Tasks updated: {len(tasks)}")

        watcher = watch_wbs("wbs.md", on_change)
        watcher.start()
        # ... 작업 ...
        await watcher.stop()
    """
    return WbsWatcher(path, callback, debounce)
