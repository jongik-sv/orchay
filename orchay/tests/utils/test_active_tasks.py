"""active_tasks 유틸리티 테스트 (Phase 5.1)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from orchay.utils.active_tasks import (
    _get_default_data,
    get_active_tasks_path,
    get_paused_workers,
    get_scheduler_state,
    is_worker_paused,
    load_active_tasks,
    pause_worker,
    resume_worker,
    save_active_tasks,
    set_scheduler_state,
)


@pytest.fixture
def active_tasks_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """임시 active_tasks 파일 설정."""
    logs_dir = tmp_path / ".orchay" / "logs"
    logs_dir.mkdir(parents=True)
    active_file = logs_dir / "orchay-active.json"

    # Path.cwd()를 tmp_path로 변경
    monkeypatch.setattr(Path, "cwd", lambda: tmp_path)

    return active_file


class TestGetDefaultData:
    """_get_default_data 테스트."""

    def test_returns_default_structure(self) -> None:
        """TC-AT-01: 기본 데이터 구조를 반환합니다."""
        data = _get_default_data()

        assert "pausedWorkers" in data
        assert "schedulerState" in data
        assert data["pausedWorkers"] == []
        assert data["schedulerState"] == "running"


class TestLoadActiveTasks:
    """load_active_tasks 테스트."""

    def test_returns_default_when_file_not_exists(
        self, active_tasks_file: Path
    ) -> None:
        """TC-AT-02: 파일이 없으면 기본값을 반환합니다."""
        data = load_active_tasks()

        assert data["pausedWorkers"] == []
        assert data["schedulerState"] == "running"

    def test_loads_existing_file(self, active_tasks_file: Path) -> None:
        """TC-AT-03: 기존 파일을 로드합니다."""
        existing_data = {
            "pausedWorkers": [1, 2],
            "schedulerState": "paused",
        }
        active_tasks_file.write_text(json.dumps(existing_data), encoding="utf-8")

        data = load_active_tasks()

        assert data["pausedWorkers"] == [1, 2]
        assert data["schedulerState"] == "paused"

    def test_fills_missing_fields(self, active_tasks_file: Path) -> None:
        """TC-AT-04: 누락된 필드를 기본값으로 채웁니다."""
        existing_data: dict[str, object] = {}  # 빈 JSON
        active_tasks_file.write_text(json.dumps(existing_data), encoding="utf-8")

        data = load_active_tasks()

        assert data["pausedWorkers"] == []
        assert data["schedulerState"] == "running"

    def test_handles_invalid_json(self, active_tasks_file: Path) -> None:
        """TC-AT-05: 잘못된 JSON을 처리합니다."""
        active_tasks_file.write_text("invalid json{", encoding="utf-8")

        data = load_active_tasks()

        assert data["pausedWorkers"] == []
        assert data["schedulerState"] == "running"


class TestSaveActiveTasks:
    """save_active_tasks 테스트."""

    def test_saves_data(self, active_tasks_file: Path) -> None:
        """TC-AT-06: 데이터를 저장합니다."""
        data = {"pausedWorkers": [1, 3], "schedulerState": "stopped"}

        save_active_tasks(data)

        saved = json.loads(active_tasks_file.read_text(encoding="utf-8"))
        assert saved["pausedWorkers"] == [1, 3]
        assert saved["schedulerState"] == "stopped"

    def test_creates_parent_directory(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """TC-AT-07: 부모 디렉토리를 생성합니다."""
        # 디렉토리가 없는 상태
        monkeypatch.setattr(Path, "cwd", lambda: tmp_path)
        data = {"pausedWorkers": [], "schedulerState": "running"}

        save_active_tasks(data)

        active_file = tmp_path / ".orchay" / "logs" / "orchay-active.json"
        assert active_file.exists()


class TestPauseWorker:
    """pause_worker 테스트."""

    def test_adds_worker_to_paused_list(self, active_tasks_file: Path) -> None:
        """TC-AT-08: Worker를 일시정지 목록에 추가합니다."""
        pause_worker(1)

        data = load_active_tasks()
        assert 1 in data["pausedWorkers"]

    def test_does_not_duplicate(self, active_tasks_file: Path) -> None:
        """TC-AT-09: 중복 추가하지 않습니다."""
        pause_worker(1)
        pause_worker(1)

        data = load_active_tasks()
        assert data["pausedWorkers"].count(1) == 1


class TestResumeWorker:
    """resume_worker 테스트."""

    def test_removes_worker_from_paused_list(self, active_tasks_file: Path) -> None:
        """TC-AT-10: Worker를 일시정지 목록에서 제거합니다."""
        pause_worker(1)
        resume_worker(1)

        data = load_active_tasks()
        assert 1 not in data["pausedWorkers"]

    def test_does_nothing_if_not_paused(self, active_tasks_file: Path) -> None:
        """TC-AT-11: 일시정지 상태가 아니면 아무것도 하지 않습니다."""
        resume_worker(1)  # 에러 없이 실행

        data = load_active_tasks()
        assert data["pausedWorkers"] == []


class TestIsWorkerPaused:
    """is_worker_paused 테스트."""

    def test_returns_true_if_paused(self, active_tasks_file: Path) -> None:
        """TC-AT-12: 일시정지 상태이면 True를 반환합니다."""
        pause_worker(1)

        assert is_worker_paused(1) is True

    def test_returns_false_if_not_paused(self, active_tasks_file: Path) -> None:
        """TC-AT-13: 일시정지 상태가 아니면 False를 반환합니다."""
        assert is_worker_paused(1) is False


class TestGetPausedWorkers:
    """get_paused_workers 테스트."""

    def test_returns_empty_list_initially(self, active_tasks_file: Path) -> None:
        """TC-AT-14: 초기에는 빈 목록을 반환합니다."""
        assert get_paused_workers() == []

    def test_returns_paused_workers(self, active_tasks_file: Path) -> None:
        """TC-AT-15: 일시정지된 Worker 목록을 반환합니다."""
        pause_worker(1)
        pause_worker(3)

        workers = get_paused_workers()
        assert 1 in workers
        assert 3 in workers
        assert len(workers) == 2


class TestSetSchedulerState:
    """set_scheduler_state 테스트."""

    def test_sets_running_state(self, active_tasks_file: Path) -> None:
        """TC-AT-16: running 상태를 설정합니다."""
        set_scheduler_state("running")

        assert get_scheduler_state() == "running"

    def test_sets_paused_state(self, active_tasks_file: Path) -> None:
        """TC-AT-17: paused 상태를 설정합니다."""
        set_scheduler_state("paused")

        assert get_scheduler_state() == "paused"

    def test_sets_stopped_state(self, active_tasks_file: Path) -> None:
        """TC-AT-18: stopped 상태를 설정합니다."""
        set_scheduler_state("stopped")

        assert get_scheduler_state() == "stopped"


class TestGetSchedulerState:
    """get_scheduler_state 테스트."""

    def test_returns_running_by_default(self, active_tasks_file: Path) -> None:
        """TC-AT-19: 기본값으로 running을 반환합니다."""
        assert get_scheduler_state() == "running"
