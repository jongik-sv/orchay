"""WBS 파서 모듈.

wbs.yaml 파일을 파싱하여 Task 리스트를 반환하고,
파일 변경을 감지하여 콜백을 실행합니다.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

import yaml
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from orchay.models import ExecutionInfo, Task, TaskCategory, TaskPriority, TaskStatus

if TYPE_CHECKING:
    from watchdog.observers.api import BaseObserver

logger = logging.getLogger(__name__)


class WbsParseError(Exception):
    """WBS 파싱 오류."""

    def __init__(self, message: str, line_number: int | None = None) -> None:
        self.line_number = line_number
        super().__init__(f"{message} (line {line_number})" if line_number else message)


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


class WbsParser:
    """WBS 파일 파서.

    wbs.yaml 파일을 파싱하여 Task 리스트를 반환합니다.
    파싱 실패 시 이전 캐시를 반환합니다.
    """

    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)
        self._cache: list[Task] = []
        self._metadata: dict[str, Any] = {}
        self._last_parsed: datetime | None = None

    @property
    def project_root(self) -> str | None:
        """projectRoot 메타데이터 값 반환."""
        wbs_meta = self._metadata.get("wbs", {})
        if isinstance(wbs_meta, dict):
            wbs_dict = cast(dict[str, Any], wbs_meta)
            project_root = wbs_dict.get("projectRoot")
            return str(project_root) if project_root else None
        return None

    @property
    def metadata(self) -> dict[str, Any]:
        """전체 메타데이터 반환."""
        return self._metadata.copy()

    async def parse(self) -> list[Task]:
        """wbs.yaml 파일을 파싱하여 Task 리스트 반환.

        Returns:
            Task 객체 리스트

        Note:
            파싱 실패 시 이전 캐시된 결과를 반환합니다.
            기존 Task 객체가 있으면 WBS 필드만 업데이트하고 런타임 상태는 유지합니다.
        """
        try:
            if not self._path.exists():
                logger.warning(f"WBS 파일이 존재하지 않습니다: {self._path}")
                return [] if not self._cache else self._cache

            content = self._path.read_text(encoding="utf-8")
            data = yaml.safe_load(content)

            if not data:
                logger.warning("YAML 파일이 비어있습니다")
                return self._cache if self._cache else []

            # 메타데이터 저장
            self._metadata = {
                "project": data.get("project", {}),
                "wbs": data.get("wbs", {}),
            }

            new_tasks = self._parse_content(data)

            # 파싱 결과가 비어있고 이전 캐시가 있으면 캐시 반환 (BR-01)
            if not new_tasks and self._cache:
                logger.warning("파싱 결과 없음. 이전 캐시 반환")
                return self._cache

            # 기존 캐시가 있으면 기존 객체 업데이트 (런타임 상태 유지)
            if self._cache:
                existing_map = {t.id: t for t in self._cache}
                result: list[Task] = []
                for new_task in new_tasks:
                    if new_task.id in existing_map:
                        # 기존 객체의 WBS 필드만 업데이트, 런타임 상태 유지
                        existing = existing_map[new_task.id]
                        self._update_task_fields(existing, new_task)
                        result.append(existing)
                    else:
                        # 새 Task 추가
                        result.append(new_task)
                tasks = result
            else:
                tasks = new_tasks

            # 캐시 업데이트
            self._cache = tasks
            self._last_parsed = datetime.now()

            return tasks

        except Exception as e:
            logger.error(f"WBS 파싱 오류: {e}")
            # 캐시 반환
            return self._cache

    def _update_task_fields(self, existing: Task, new: Task) -> None:
        """기존 Task 객체의 WBS 필드만 업데이트.

        런타임 상태(assigned_worker)는 유지합니다.
        """
        # WBS에서 파싱되는 필드만 업데이트
        existing.title = new.title
        existing.category = new.category
        existing.domain = new.domain
        existing.status = new.status
        existing.priority = new.priority
        existing.assignee = new.assignee
        existing.schedule = new.schedule
        existing.tags = new.tags
        existing.depends = new.depends
        existing.blocked_by = new.blocked_by
        existing.workflow = new.workflow
        existing.prd_ref = new.prd_ref
        existing.requirements = new.requirements
        existing.acceptance = new.acceptance
        existing.tech_spec = new.tech_spec
        existing.api_spec = new.api_spec
        existing.ui_spec = new.ui_spec
        existing.raw_content = new.raw_content
        existing.execution = new.execution
        # assigned_worker는 업데이트하지 않음 (런타임 상태)

    def _parse_content(self, data: dict[str, Any]) -> list[Task]:
        """YAML 데이터를 파싱하여 Task 리스트 반환."""
        tasks: list[Task] = []

        work_packages = data.get("workPackages", [])
        if not isinstance(work_packages, list):
            return tasks

        work_packages_list = cast(list[Any], work_packages)
        for wp in work_packages_list:
            if not isinstance(wp, dict):
                continue

            wp_dict = cast(dict[str, Any], wp)
            wp_tasks = wp_dict.get("tasks", [])
            if not isinstance(wp_tasks, list):
                continue

            wp_tasks_list = cast(list[Any], wp_tasks)
            for task_data in wp_tasks_list:
                if not isinstance(task_data, dict):
                    continue

                task_dict = cast(dict[str, Any], task_data)
                task = self._create_task(task_dict)
                if task:
                    tasks.append(task)

        return tasks

    def _create_task(self, data: dict[str, Any]) -> Task | None:
        """딕셔너리에서 Task 객체 생성."""
        try:
            task_id = str(data.get("id", ""))
            title = str(data.get("title", ""))

            if not task_id or not title:
                return None

            # 상태 코드 파싱
            status_code = str(data.get("status", "[ ]"))
            status = _parse_status(status_code)

            # 카테고리
            category_str = str(data.get("category", "development"))
            category = _parse_category(category_str)

            # 우선순위
            priority_str = str(data.get("priority", "medium"))
            priority = _parse_priority(priority_str)

            # depends 처리
            depends_raw = data.get("depends", [])
            depends: list[str] = []
            if isinstance(depends_raw, list):
                depends_list = cast(list[Any], depends_raw)
                depends = [str(d) for d in depends_list if d]
            elif isinstance(depends_raw, str):
                depends = [depends_raw] if depends_raw else []

            # tags 처리
            tags_raw = data.get("tags", [])
            tags: list[str] = []
            if isinstance(tags_raw, list):
                tags_list = cast(list[Any], tags_raw)
                tags = [str(t) for t in tags_list if t]

            # blocked-by
            blocked_by_value: Any = data.get("blocked-by", data.get("blockedBy"))
            blocked_by: str | None = None
            if blocked_by_value and str(blocked_by_value) != "-":
                blocked_by = str(blocked_by_value)

            # requirements 중첩 구조 처리
            requirements_data = data.get("requirements", {})
            prd_ref: str = ""
            requirements: list[str] = []
            acceptance: list[str] = []
            tech_spec: list[str] = []
            api_spec: list[str] = []
            ui_spec: list[str] = []

            if isinstance(requirements_data, dict):
                req_dict = cast(dict[str, Any], requirements_data)
                prd_ref_val = req_dict.get("prdRef", "")
                prd_ref = str(prd_ref_val) if prd_ref_val else ""
                requirements = self._get_list(req_dict, "items")
                acceptance = self._get_list(req_dict, "acceptance")
                tech_spec = self._get_list(req_dict, "techSpec")
                api_spec = self._get_list(req_dict, "apiSpec")
                ui_spec = self._get_list(req_dict, "uiSpec")
            elif isinstance(requirements_data, list):
                req_list = cast(list[Any], requirements_data)
                requirements = [str(r) for r in req_list if r]

            # execution 필드 처리
            execution_data = data.get("execution")
            execution: ExecutionInfo | None = None
            if isinstance(execution_data, dict):
                exec_dict = cast(dict[str, Any], execution_data)
                command_val = exec_dict.get("command", "")
                desc_val = exec_dict.get("description")
                started_val = exec_dict.get("startedAt", "")
                worker_val = exec_dict.get("worker")
                execution = ExecutionInfo(
                    command=str(command_val) if command_val else "",
                    description=str(desc_val) if desc_val else None,
                    startedAt=str(started_val) if started_val else "",
                    worker=int(worker_val) if worker_val is not None else None,
                )

            return Task(
                id=task_id,
                title=title,
                category=category,
                domain=str(data.get("domain", "")),
                status=status,
                priority=priority,
                assignee=str(data.get("assignee", "-")),
                schedule=str(data.get("schedule", "")),
                tags=tags,
                depends=depends,
                blocked_by=blocked_by,
                workflow=str(data.get("workflow", "design")),
                prd_ref=prd_ref,
                requirements=requirements,
                acceptance=acceptance,
                tech_spec=tech_spec,
                api_spec=api_spec,
                ui_spec=ui_spec,
                raw_content="",  # YAML에서는 raw_content 불필요
                execution=execution,
            )
        except Exception as e:
            logger.error(f"Task 생성 오류: {e}")
            return None

    def _get_list(self, data: dict[str, Any], key: str) -> list[str]:
        """딕셔너리에서 리스트 값 추출."""
        value = data.get(key, [])
        if isinstance(value, list):
            value_list = cast(list[Any], value)
            return [str(v) for v in value_list if v]
        if isinstance(value, str):
            return [value] if value else []
        return []


async def parse_wbs(path: str | Path) -> list[Task]:
    """wbs.yaml 파일을 파싱하여 Task 리스트 반환.

    Args:
        path: wbs.yaml 파일 경로

    Returns:
        Task 객체 리스트

    Example:
        tasks = await parse_wbs(".orchay/projects/orchay/wbs.yaml")
        for task in tasks:
            print(f"{task.id}: {task.status}")
    """
    parser = WbsParser(path)
    return await parser.parse()


# 상태 코드 → 상태 이름 매핑 (역방향)
STATUS_CODE_TO_NAME: dict[str, str] = {
    "[ ]": "todo",
    "[bd]": "basic-design",
    "[dd]": "detail-design",
    "[an]": "analysis",
    "[ds]": "design",
    "[ap]": "approve",
    "[im]": "implement",
    "[fx]": "fix",
    "[vf]": "verify",
    "[xx]": "done",
}


def _find_task_in_yaml(
    data: dict[str, Any], task_id: str
) -> tuple[dict[str, Any] | None, int, int]:
    """YAML 데이터에서 Task를 찾아 반환.

    Returns:
        (task_dict, wp_index, task_index) 또는 (None, -1, -1)
    """
    work_packages = data.get("workPackages", [])
    if not isinstance(work_packages, list):
        return None, -1, -1

    work_packages_list = cast(list[Any], work_packages)
    for wp_idx, wp in enumerate(work_packages_list):
        if not isinstance(wp, dict):
            continue
        wp_dict = cast(dict[str, Any], wp)
        tasks = wp_dict.get("tasks", [])
        if not isinstance(tasks, list):
            continue
        tasks_list = cast(list[Any], tasks)
        for task_idx, task in enumerate(tasks_list):
            if isinstance(task, dict):
                task_dict = cast(dict[str, Any], task)
                if task_dict.get("id") == task_id:
                    return task_dict, wp_idx, task_idx

    return None, -1, -1


async def update_task_status(
    wbs_path: Path,
    task_id: str,
    new_status_code: str,
) -> bool:
    """WBS 파일의 Task 상태 코드를 업데이트.

    Args:
        wbs_path: wbs.yaml 파일 경로
        task_id: 업데이트할 Task ID (예: TSK-01-01)
        new_status_code: 새 상태 코드 (예: "[ap]", "[im]")

    Returns:
        성공 여부

    Example:
        success = await update_task_status(
            Path(".orchay/projects/orchay/wbs.yaml"),
            "TSK-01-01",
            "[ap]"
        )
    """
    try:
        if not wbs_path.exists():
            logger.error(f"WBS 파일이 존재하지 않습니다: {wbs_path}")
            return False

        content = wbs_path.read_text(encoding="utf-8")
        data = yaml.safe_load(content)

        if not data:
            logger.error("YAML 파일이 비어있습니다")
            return False

        task, _wp_idx, _task_idx = _find_task_in_yaml(data, task_id)
        if task is None:
            logger.warning(f"[{task_id}] Task를 찾을 수 없습니다")
            return False

        current_code = task.get("status", "[ ]")
        if current_code == new_status_code:
            logger.info(f"[{task_id}] 상태가 이미 {new_status_code}입니다")
            return True

        # 상태 업데이트
        task["status"] = new_status_code
        logger.info(f"[{task_id}] 상태 변경: {current_code} → {new_status_code}")

        # YAML 저장 (원본 포맷 유지를 위해 커스텀 덤프 사용)
        _save_yaml(wbs_path, data)
        return True

    except Exception as e:
        logger.error(f"WBS 상태 업데이트 오류: {e}")
        return False


async def update_task_blocked_by(
    wbs_path: Path,
    task_id: str,
    blocked_by: str | None,
) -> bool:
    """WBS 파일의 Task blocked-by 속성을 업데이트.

    Args:
        wbs_path: wbs.yaml 파일 경로
        task_id: 업데이트할 Task ID (예: TSK-01-01)
        blocked_by: blocked-by 값 (None이면 필드 제거)

    Returns:
        성공 여부

    Example:
        # 스킵
        await update_task_blocked_by(path, "TSK-01-01", "skipped")
        # 복구
        await update_task_blocked_by(path, "TSK-01-01", None)
    """
    try:
        if not wbs_path.exists():
            logger.error(f"WBS 파일이 존재하지 않습니다: {wbs_path}")
            return False

        content = wbs_path.read_text(encoding="utf-8")
        data = yaml.safe_load(content)

        if not data:
            logger.error("YAML 파일이 비어있습니다")
            return False

        task, _wp_idx, _task_idx = _find_task_in_yaml(data, task_id)
        if task is None:
            logger.warning(f"[{task_id}] Task를 찾을 수 없습니다")
            return False

        if blocked_by:
            task["blocked-by"] = blocked_by
            logger.info(f"[{task_id}] blocked-by 설정: {blocked_by}")
        else:
            # blocked-by 필드 제거
            if "blocked-by" in task:
                del task["blocked-by"]
            if "blockedBy" in task:
                del task["blockedBy"]
            logger.info(f"[{task_id}] blocked-by 제거")

        _save_yaml(wbs_path, data)
        return True

    except Exception as e:
        logger.error(f"WBS blocked-by 업데이트 오류: {e}")
        return False


def _save_yaml(path: Path, data: dict[str, Any]) -> None:
    """YAML 파일을 저장 (한글 및 포맷 유지)."""
    # 커스텀 Dumper 설정 (한글 출력 지원)
    yaml_content = yaml.dump(
        data,
        allow_unicode=True,
        default_flow_style=False,
        sort_keys=False,
        indent=2,
        width=120,
    )
    path.write_text(yaml_content, encoding="utf-8")


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

    wbs.yaml 파일 변경을 감지하고 콜백을 실행합니다.
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
    """wbs.yaml 파일 변경 감지 및 콜백 실행.

    Args:
        path: 감시할 wbs.yaml 파일 경로
        callback: 변경 시 호출될 async 콜백 (Task 리스트 전달)
        debounce: 디바운스 시간 (초)

    Returns:
        WbsWatcher 인스턴스 (start/stop 메서드 제공)

    Example:
        async def on_change(tasks: list[Task]):
            print(f"Tasks updated: {len(tasks)}")

        watcher = watch_wbs("wbs.yaml", on_change)
        watcher.start()
        # ... 작업 ...
        await watcher.stop()
    """
    return WbsWatcher(path, callback, debounce)
