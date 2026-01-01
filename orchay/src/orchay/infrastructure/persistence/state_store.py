"""상태 저장소 모듈.

스케줄러 상태와 히스토리를 통합 관리합니다.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, TypedDict


class ActiveStateData(TypedDict):
    """활성 상태 데이터 구조."""

    pausedWorkers: list[int]  # 수동 일시정지된 Worker ID 목록
    schedulerState: str  # running, paused, stopped


@dataclass
class HistoryEntry:
    """히스토리 항목."""

    task_id: str
    command: str
    result: str  # "success" | "error"
    worker_id: int
    timestamp: str
    output: str  # 캡처된 pane 출력


class StateStore:
    """상태 저장소.

    스케줄러의 런타임 상태와 히스토리를 관리합니다.

    Example:
        ```python
        store = StateStore(base_path=Path(".orchay/logs"))

        # 활성 상태
        state = store.load_active_state()
        store.save_active_state(state)

        # 히스토리
        store.append_history(entry)
        entries = store.list_history(limit=10)
        ```
    """

    def __init__(
        self,
        base_path: Path | None = None,
        max_history_entries: int = 1000,
    ) -> None:
        """StateStore를 초기화합니다.

        Args:
            base_path: 저장 경로 (기본: .orchay/logs)
            max_history_entries: 최대 히스토리 항목 수
        """
        if base_path is None:
            base_path = Path.cwd() / ".orchay" / "logs"
        self._base_path = base_path
        self._max_history = max_history_entries

    @property
    def active_state_path(self) -> Path:
        """활성 상태 파일 경로."""
        return self._base_path / "orchay-active.json"

    @property
    def history_path(self) -> Path:
        """히스토리 파일 경로."""
        return self._base_path / "orchay-history.jsonl"

    # === Active State 관리 ===

    def _get_default_state(self) -> ActiveStateData:
        """기본 상태 반환."""
        return {
            "pausedWorkers": [],
            "schedulerState": "running",
        }

    def load_active_state(self) -> ActiveStateData:
        """활성 상태를 로드합니다."""
        if not self.active_state_path.exists():
            return self._get_default_state()

        try:
            with open(self.active_state_path, encoding="utf-8") as f:
                data = json.load(f)
                # 기본값 보장
                if "pausedWorkers" not in data:
                    data["pausedWorkers"] = []
                if "schedulerState" not in data:
                    data["schedulerState"] = "running"
                return data
        except (json.JSONDecodeError, OSError):
            return self._get_default_state()

    def save_active_state(self, data: ActiveStateData) -> None:
        """활성 상태를 저장합니다."""
        self._base_path.mkdir(parents=True, exist_ok=True)

        with open(self.active_state_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    # Worker Pause/Resume 헬퍼

    def pause_worker(self, worker_id: int) -> None:
        """Worker 수동 일시정지.

        Args:
            worker_id: Worker ID (1, 2, 3...)
        """
        data = self.load_active_state()
        paused = data.get("pausedWorkers", [])
        if worker_id not in paused:
            paused.append(worker_id)
            data["pausedWorkers"] = paused
            self.save_active_state(data)

    def resume_worker(self, worker_id: int) -> None:
        """Worker 수동 일시정지 해제.

        Args:
            worker_id: Worker ID (1, 2, 3...)
        """
        data = self.load_active_state()
        paused = data.get("pausedWorkers", [])
        if worker_id in paused:
            paused.remove(worker_id)
            data["pausedWorkers"] = paused
            self.save_active_state(data)

    def is_worker_paused(self, worker_id: int) -> bool:
        """Worker가 수동 일시정지 상태인지 확인.

        Args:
            worker_id: Worker ID

        Returns:
            일시정지 상태 여부
        """
        data = self.load_active_state()
        return worker_id in data.get("pausedWorkers", [])

    def get_paused_workers(self) -> list[int]:
        """수동 일시정지된 Worker ID 목록 반환."""
        data = self.load_active_state()
        return data.get("pausedWorkers", [])

    # Scheduler State 헬퍼

    def set_scheduler_state(self, state: str) -> None:
        """스케줄러 상태 설정.

        Args:
            state: running, paused, stopped 중 하나
        """
        data = self.load_active_state()
        data["schedulerState"] = state
        self.save_active_state(data)

    def get_scheduler_state(self) -> str:
        """스케줄러 상태 반환.

        Returns:
            running, paused, stopped 중 하나
        """
        data = self.load_active_state()
        return data.get("schedulerState", "running")

    # === History 관리 ===

    def append_history(self, entry: HistoryEntry) -> None:
        """히스토리 항목을 추가합니다."""
        self._base_path.mkdir(parents=True, exist_ok=True)

        # 기존 항목 읽기
        entries = self._read_all_history()
        entries.append(asdict(entry))

        # 최대 항목 수 초과 시 오래된 것 삭제
        if len(entries) > self._max_history:
            entries = entries[-self._max_history :]

        # JSON Lines 형식으로 저장
        with open(self.history_path, "w", encoding="utf-8") as f:
            for e in entries:
                f.write(json.dumps(e, ensure_ascii=False) + "\n")

    def list_history(self, limit: int = 10) -> list[dict[str, Any]]:
        """최근 히스토리를 조회합니다.

        Args:
            limit: 반환할 최대 항목 수

        Returns:
            히스토리 항목 리스트 (최신순)
        """
        entries = self._read_all_history()
        return entries[-limit:][::-1]

    def get_task_history(self, task_id: str) -> dict[str, Any] | None:
        """특정 Task의 가장 최근 히스토리를 조회합니다.

        Args:
            task_id: Task ID

        Returns:
            히스토리 항목 또는 None
        """
        entries = self._read_all_history()
        for entry in reversed(entries):
            if entry["task_id"] == task_id:
                return entry
        return None

    def clear_history(self) -> None:
        """히스토리를 삭제합니다."""
        if self.history_path.exists():
            self.history_path.unlink()

    def _read_all_history(self) -> list[dict[str, Any]]:
        """모든 히스토리 항목을 읽습니다."""
        if not self.history_path.exists():
            return []

        entries: list[dict[str, Any]] = []
        with open(self.history_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        return entries
