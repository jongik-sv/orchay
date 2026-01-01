"""StateStore 테스트."""

import json
from pathlib import Path
from typing import Any

import pytest

from orchay.infrastructure.persistence.state_store import (
    ActiveStateData,
    HistoryEntry,
    StateStore,
)


@pytest.fixture
def tmp_store(tmp_path: Path) -> StateStore:
    """임시 경로를 사용하는 StateStore."""
    return StateStore(base_path=tmp_path, max_history_entries=5)


class TestStateStoreInit:
    """StateStore 초기화 테스트."""

    def test_default_base_path(self) -> None:
        """기본 base_path 설정 확인."""
        store = StateStore()
        assert store._base_path == Path.cwd() / ".orchay" / "logs"

    def test_custom_base_path(self, tmp_path: Path) -> None:
        """사용자 정의 base_path 설정 확인."""
        store = StateStore(base_path=tmp_path)
        assert store._base_path == tmp_path

    def test_max_history_entries(self, tmp_path: Path) -> None:
        """max_history_entries 설정 확인."""
        store = StateStore(base_path=tmp_path, max_history_entries=100)
        assert store._max_history == 100

    def test_active_state_path(self, tmp_store: StateStore) -> None:
        """active_state_path 프로퍼티 확인."""
        assert tmp_store.active_state_path.name == "orchay-active.json"

    def test_history_path(self, tmp_store: StateStore) -> None:
        """history_path 프로퍼티 확인."""
        assert tmp_store.history_path.name == "orchay-history.jsonl"


class TestActiveState:
    """활성 상태 관리 테스트."""

    def test_load_default_state_when_file_missing(
        self, tmp_store: StateStore
    ) -> None:
        """파일 없을 때 기본 상태 반환."""
        state = tmp_store.load_active_state()
        assert state["pausedWorkers"] == []
        assert state["schedulerState"] == "running"

    def test_save_and_load_state(self, tmp_store: StateStore) -> None:
        """상태 저장 및 로드."""
        data: ActiveStateData = {
            "pausedWorkers": [1, 2],
            "schedulerState": "paused",
        }
        tmp_store.save_active_state(data)

        loaded = tmp_store.load_active_state()
        assert loaded["pausedWorkers"] == [1, 2]
        assert loaded["schedulerState"] == "paused"

    def test_save_creates_directory(self, tmp_path: Path) -> None:
        """저장 시 디렉토리 자동 생성."""
        nested_path = tmp_path / "nested" / "path"
        store = StateStore(base_path=nested_path)

        data: ActiveStateData = {
            "pausedWorkers": [],
            "schedulerState": "running",
        }
        store.save_active_state(data)

        assert nested_path.exists()
        assert store.active_state_path.exists()

    def test_load_handles_corrupted_file(self, tmp_store: StateStore) -> None:
        """손상된 파일 처리."""
        tmp_store._base_path.mkdir(parents=True, exist_ok=True)
        tmp_store.active_state_path.write_text("invalid json{{{")

        state = tmp_store.load_active_state()
        assert state["pausedWorkers"] == []
        assert state["schedulerState"] == "running"

    def test_load_fills_missing_fields(self, tmp_store: StateStore) -> None:
        """누락된 필드 기본값 채움."""
        tmp_store._base_path.mkdir(parents=True, exist_ok=True)
        tmp_store.active_state_path.write_text("{}")

        state = tmp_store.load_active_state()
        assert state["pausedWorkers"] == []
        assert state["schedulerState"] == "running"


class TestWorkerPauseResume:
    """Worker 일시정지/재개 테스트."""

    def test_pause_worker(self, tmp_store: StateStore) -> None:
        """Worker 일시정지."""
        tmp_store.pause_worker(1)

        state = tmp_store.load_active_state()
        assert 1 in state["pausedWorkers"]

    def test_pause_worker_idempotent(self, tmp_store: StateStore) -> None:
        """중복 일시정지 무시."""
        tmp_store.pause_worker(1)
        tmp_store.pause_worker(1)

        state = tmp_store.load_active_state()
        assert state["pausedWorkers"].count(1) == 1

    def test_resume_worker(self, tmp_store: StateStore) -> None:
        """Worker 재개."""
        tmp_store.pause_worker(1)
        tmp_store.resume_worker(1)

        state = tmp_store.load_active_state()
        assert 1 not in state["pausedWorkers"]

    def test_resume_worker_not_paused(self, tmp_store: StateStore) -> None:
        """일시정지 안된 Worker 재개 시도."""
        tmp_store.resume_worker(999)  # 에러 없이 처리

        state = tmp_store.load_active_state()
        assert 999 not in state["pausedWorkers"]

    def test_is_worker_paused(self, tmp_store: StateStore) -> None:
        """Worker 일시정지 상태 확인."""
        assert not tmp_store.is_worker_paused(1)

        tmp_store.pause_worker(1)
        assert tmp_store.is_worker_paused(1)

        tmp_store.resume_worker(1)
        assert not tmp_store.is_worker_paused(1)

    def test_get_paused_workers(self, tmp_store: StateStore) -> None:
        """일시정지된 Worker 목록."""
        tmp_store.pause_worker(1)
        tmp_store.pause_worker(3)

        paused = tmp_store.get_paused_workers()
        assert set(paused) == {1, 3}

    def test_multiple_workers_pause_resume(self, tmp_store: StateStore) -> None:
        """여러 Worker 일시정지/재개."""
        tmp_store.pause_worker(1)
        tmp_store.pause_worker(2)
        tmp_store.pause_worker(3)
        tmp_store.resume_worker(2)

        paused = tmp_store.get_paused_workers()
        assert set(paused) == {1, 3}


class TestSchedulerState:
    """스케줄러 상태 테스트."""

    def test_set_scheduler_state(self, tmp_store: StateStore) -> None:
        """스케줄러 상태 설정."""
        tmp_store.set_scheduler_state("paused")

        state = tmp_store.load_active_state()
        assert state["schedulerState"] == "paused"

    def test_get_scheduler_state_default(self, tmp_store: StateStore) -> None:
        """기본 스케줄러 상태."""
        assert tmp_store.get_scheduler_state() == "running"

    def test_get_scheduler_state_after_set(self, tmp_store: StateStore) -> None:
        """설정 후 상태 조회."""
        tmp_store.set_scheduler_state("stopped")
        assert tmp_store.get_scheduler_state() == "stopped"

    def test_scheduler_state_persistence(self, tmp_path: Path) -> None:
        """스케줄러 상태 영속성."""
        store1 = StateStore(base_path=tmp_path)
        store1.set_scheduler_state("paused")

        store2 = StateStore(base_path=tmp_path)
        assert store2.get_scheduler_state() == "paused"


class TestHistory:
    """히스토리 관리 테스트."""

    @pytest.fixture
    def sample_entry(self) -> HistoryEntry:
        """샘플 히스토리 항목."""
        return HistoryEntry(
            task_id="TSK-01-01",
            command="/wf:run TSK-01-01",
            result="success",
            worker_id=1,
            timestamp="2025-12-28T10:00:00",
            output="Task completed successfully",
        )

    def test_append_history(
        self, tmp_store: StateStore, sample_entry: HistoryEntry
    ) -> None:
        """히스토리 항목 추가."""
        tmp_store.append_history(sample_entry)

        entries = tmp_store.list_history(limit=10)
        assert len(entries) == 1
        assert entries[0]["task_id"] == "TSK-01-01"

    def test_list_history_order(
        self, tmp_store: StateStore
    ) -> None:
        """히스토리 최신순 정렬."""
        for i in range(3):
            entry = HistoryEntry(
                task_id=f"TSK-01-0{i + 1}",
                command=f"/wf:run TSK-01-0{i + 1}",
                result="success",
                worker_id=1,
                timestamp=f"2025-12-28T10:0{i}:00",
                output="OK",
            )
            tmp_store.append_history(entry)

        entries = tmp_store.list_history(limit=10)
        assert entries[0]["task_id"] == "TSK-01-03"  # 최신 먼저
        assert entries[2]["task_id"] == "TSK-01-01"  # 오래된 것 마지막

    def test_list_history_limit(self, tmp_store: StateStore) -> None:
        """히스토리 조회 개수 제한."""
        for i in range(10):
            entry = HistoryEntry(
                task_id=f"TSK-{i:02d}",
                command="/wf:run",
                result="success",
                worker_id=1,
                timestamp=f"2025-12-28T10:{i:02d}:00",
                output="OK",
            )
            tmp_store.append_history(entry)

        entries = tmp_store.list_history(limit=3)
        assert len(entries) == 3

    def test_max_history_entries(self, tmp_path: Path) -> None:
        """최대 히스토리 항목 수 제한."""
        store = StateStore(base_path=tmp_path, max_history_entries=3)

        for i in range(5):
            entry = HistoryEntry(
                task_id=f"TSK-{i:02d}",
                command="/wf:run",
                result="success",
                worker_id=1,
                timestamp=f"2025-12-28T10:{i:02d}:00",
                output="OK",
            )
            store.append_history(entry)

        entries = store.list_history(limit=10)
        assert len(entries) == 3
        # 가장 오래된 것들이 삭제됨
        task_ids = {e["task_id"] for e in entries}
        assert "TSK-00" not in task_ids
        assert "TSK-01" not in task_ids
        assert "TSK-04" in task_ids

    def test_get_task_history(
        self, tmp_store: StateStore
    ) -> None:
        """특정 Task 히스토리 조회."""
        for i in range(3):
            entry = HistoryEntry(
                task_id="TSK-01-01" if i % 2 == 0 else "TSK-01-02",
                command="/wf:run",
                result="success" if i < 2 else "error",
                worker_id=1,
                timestamp=f"2025-12-28T10:{i:02d}:00",
                output="OK",
            )
            tmp_store.append_history(entry)

        result = tmp_store.get_task_history("TSK-01-01")
        assert result is not None
        assert result["task_id"] == "TSK-01-01"
        assert result["result"] == "error"  # 가장 최근 것

    def test_get_task_history_not_found(self, tmp_store: StateStore) -> None:
        """존재하지 않는 Task 히스토리."""
        result = tmp_store.get_task_history("NONEXISTENT")
        assert result is None

    def test_clear_history(
        self, tmp_store: StateStore, sample_entry: HistoryEntry
    ) -> None:
        """히스토리 삭제."""
        tmp_store.append_history(sample_entry)
        tmp_store.clear_history()

        entries = tmp_store.list_history(limit=10)
        assert len(entries) == 0

    def test_clear_history_no_file(self, tmp_store: StateStore) -> None:
        """히스토리 파일 없을 때 삭제."""
        tmp_store.clear_history()  # 에러 없이 처리

    def test_history_handles_corrupted_line(
        self, tmp_store: StateStore, sample_entry: HistoryEntry
    ) -> None:
        """손상된 라인 무시."""
        tmp_store._base_path.mkdir(parents=True, exist_ok=True)
        with open(tmp_store.history_path, "w", encoding="utf-8") as f:
            f.write("invalid json line\n")
            f.write(json.dumps({"task_id": "TSK-01", "command": "", "result": "", "worker_id": 1, "timestamp": "", "output": ""}) + "\n")

        entries = tmp_store.list_history(limit=10)
        assert len(entries) == 1
        assert entries[0]["task_id"] == "TSK-01"
