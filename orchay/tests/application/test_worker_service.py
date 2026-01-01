"""WorkerService 테스트 (Phase 2.2).

WorkerService의 비즈니스 로직 테스트를 제공합니다.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from orchay.application.worker_service import WorkerService
from orchay.models import Config, Task, TaskCategory, TaskPriority, TaskStatus, Worker, WorkerState


def create_config(workers: int = 0, grace_period: float = 20.0) -> Config:
    """테스트용 Config를 생성합니다."""
    config = MagicMock(spec=Config)
    config.workers = workers
    config.dispatch = MagicMock()
    config.dispatch.grace_period = grace_period
    return config


def create_worker(
    id: int = 1,
    pane_id: int = 100,
    state: WorkerState = WorkerState.IDLE,
    current_task: str | None = None,
    dispatch_time: datetime | None = None,
    is_manually_paused: bool = False,
) -> Worker:
    """테스트용 Worker를 생성합니다."""
    worker = Worker(id=id, pane_id=pane_id, state=state)
    worker.current_task = current_task
    worker.dispatch_time = dispatch_time
    worker.is_manually_paused = is_manually_paused
    return worker


def create_task(
    id: str = "TSK-01-01",
    status: TaskStatus = TaskStatus.TODO,
) -> Task:
    """테스트용 Task를 생성합니다."""
    return Task(
        id=id,
        title=f"Task {id}",
        category=TaskCategory.DEVELOPMENT,
        status=status,
        priority=TaskPriority.MEDIUM,
        depends=[],
    )


class TestWorkerServiceInit:
    """WorkerService 초기화 테스트."""

    def test_init_creates_empty_workers(self) -> None:
        """TC-WS-01: 초기화 시 빈 Worker 목록을 생성합니다."""
        config = create_config()
        service = WorkerService(config)

        assert service.workers == []
        assert service.config is config


class TestInitializeWorkers:
    """initialize_workers 메서드 테스트."""

    async def test_creates_workers_from_panes(self) -> None:
        """TC-WS-02: pane에서 Worker를 생성합니다."""
        config = create_config(workers=0)  # 무제한
        service = WorkerService(config)

        # Mock panes
        mock_panes = [
            MagicMock(pane_id=100),
            MagicMock(pane_id=101),
            MagicMock(pane_id=102),
        ]

        with (
            patch("orchay.application.worker_service.wezterm_list_panes", new_callable=AsyncMock) as mock_list,
            patch("orchay.application.worker_service.get_active_pane_id", new_callable=AsyncMock) as mock_active,
            patch.dict("os.environ", {}, clear=True),
        ):
            mock_list.return_value = mock_panes
            mock_active.return_value = 100  # 현재 pane

            workers = await service.initialize_workers()

            # 현재 pane(100) 제외하고 2개 생성
            assert len(workers) == 2
            assert workers[0].pane_id == 101
            assert workers[1].pane_id == 102

    async def test_limits_worker_count(self) -> None:
        """TC-WS-03: config.workers 수만큼만 생성합니다."""
        config = create_config(workers=1)  # 1개만
        service = WorkerService(config)

        mock_panes = [
            MagicMock(pane_id=100),
            MagicMock(pane_id=101),
            MagicMock(pane_id=102),
        ]

        with (
            patch("orchay.application.worker_service.wezterm_list_panes", new_callable=AsyncMock) as mock_list,
            patch("orchay.application.worker_service.get_active_pane_id", new_callable=AsyncMock) as mock_active,
            patch.dict("os.environ", {}, clear=True),
        ):
            mock_list.return_value = mock_panes
            mock_active.return_value = 100

            workers = await service.initialize_workers()

            assert len(workers) == 1

    async def test_returns_empty_when_no_panes(self) -> None:
        """TC-WS-04: pane이 없으면 빈 목록을 반환합니다."""
        config = create_config()
        service = WorkerService(config)

        with patch("orchay.application.worker_service.wezterm_list_panes", new_callable=AsyncMock) as mock_list:
            mock_list.return_value = []

            workers = await service.initialize_workers()

            assert workers == []

    async def test_uses_env_pane(self) -> None:
        """TC-WS-05: WEZTERM_PANE 환경변수를 사용합니다."""
        config = create_config()
        service = WorkerService(config)

        mock_panes = [MagicMock(pane_id=100), MagicMock(pane_id=101)]

        with (
            patch("orchay.application.worker_service.wezterm_list_panes", new_callable=AsyncMock) as mock_list,
            patch.dict("os.environ", {"WEZTERM_PANE": "100"}),
        ):
            mock_list.return_value = mock_panes

            workers = await service.initialize_workers()

            # 환경변수로 지정한 pane(100) 제외
            assert len(workers) == 1
            assert workers[0].pane_id == 101


class TestGetIdleWorkers:
    """get_idle_workers 메서드 테스트."""

    def test_returns_idle_workers(self) -> None:
        """TC-WS-06: idle 상태 Worker를 반환합니다."""
        config = create_config()
        service = WorkerService(config)
        service.workers = [
            create_worker(id=1, state=WorkerState.IDLE),
            create_worker(id=2, state=WorkerState.BUSY),
            create_worker(id=3, state=WorkerState.IDLE),
        ]

        result = service.get_idle_workers()

        assert len(result) == 2
        assert result[0].id == 1
        assert result[1].id == 3

    def test_excludes_manually_paused(self) -> None:
        """TC-WS-07: 수동 일시정지 Worker를 제외합니다."""
        config = create_config()
        service = WorkerService(config)
        service.workers = [
            create_worker(id=1, state=WorkerState.IDLE),
            create_worker(id=2, state=WorkerState.IDLE, is_manually_paused=True),
        ]

        result = service.get_idle_workers()

        assert len(result) == 1
        assert result[0].id == 1


class TestGetBusyWorkers:
    """get_busy_workers 메서드 테스트."""

    def test_returns_busy_workers(self) -> None:
        """TC-WS-08: busy 상태 Worker를 반환합니다."""
        config = create_config()
        service = WorkerService(config)
        service.workers = [
            create_worker(id=1, state=WorkerState.IDLE),
            create_worker(id=2, state=WorkerState.BUSY),
            create_worker(id=3, state=WorkerState.BUSY),
        ]

        result = service.get_busy_workers()

        assert len(result) == 2
        assert result[0].id == 2
        assert result[1].id == 3


class TestGetWorkerById:
    """get_worker_by_id 메서드 테스트."""

    def test_returns_worker(self) -> None:
        """TC-WS-09: ID로 Worker를 조회합니다."""
        config = create_config()
        service = WorkerService(config)
        service.workers = [create_worker(id=1), create_worker(id=2)]

        result = service.get_worker_by_id(2)

        assert result is not None
        assert result.id == 2

    def test_returns_none_for_missing(self) -> None:
        """TC-WS-10: 없는 ID는 None을 반환합니다."""
        config = create_config()
        service = WorkerService(config)
        service.workers = [create_worker(id=1)]

        result = service.get_worker_by_id(999)

        assert result is None


class TestGetWorkerByPane:
    """get_worker_by_pane 메서드 테스트."""

    def test_returns_worker(self) -> None:
        """TC-WS-11: Pane ID로 Worker를 조회합니다."""
        config = create_config()
        service = WorkerService(config)
        service.workers = [
            create_worker(id=1, pane_id=100),
            create_worker(id=2, pane_id=101),
        ]

        result = service.get_worker_by_pane(101)

        assert result is not None
        assert result.id == 2


class TestGetWorkerByTask:
    """get_worker_by_task 메서드 테스트."""

    def test_returns_worker(self) -> None:
        """TC-WS-12: Task ID로 Worker를 조회합니다."""
        config = create_config()
        service = WorkerService(config)
        service.workers = [
            create_worker(id=1, current_task="T1"),
            create_worker(id=2, current_task="T2"),
        ]

        result = service.get_worker_by_task("T2")

        assert result is not None
        assert result.id == 2


class TestClearWorkerTask:
    """clear_worker_task 메서드 테스트."""

    def test_clears_task_assignment(self) -> None:
        """TC-WS-13: Worker의 Task 할당을 해제합니다."""
        config = create_config()
        service = WorkerService(config)

        worker = create_worker(
            id=1,
            state=WorkerState.BUSY,
            current_task="T1",
            dispatch_time=datetime.now(),
        )
        worker.current_step = "build"

        service.clear_worker_task(worker)

        assert worker.current_task is None
        assert worker.current_step is None
        assert worker.dispatch_time is None
        assert worker.state == WorkerState.IDLE


class TestRunningTaskIds:
    """running_task_ids 메서드 테스트."""

    def test_returns_running_task_ids(self) -> None:
        """TC-WS-14: 실행 중인 Task ID 집합을 반환합니다."""
        config = create_config()
        service = WorkerService(config)
        service.workers = [
            create_worker(id=1, current_task="T1"),
            create_worker(id=2, current_task=None),
            create_worker(id=3, current_task="T3"),
        ]

        result = service.running_task_ids()

        assert result == {"T1", "T3"}


class TestUpdateWorkerState:
    """_update_worker_state 메서드 테스트."""

    async def test_skips_grace_period(self) -> None:
        """TC-WS-15: grace period 동안 상태 체크를 건너뜁니다."""
        config = create_config(grace_period=20.0)
        service = WorkerService(config)

        worker = create_worker(
            id=1,
            state=WorkerState.BUSY,
            dispatch_time=datetime.now(),  # 방금 dispatch
        )
        service.workers = [worker]

        with patch("orchay.application.worker_service.detect_worker_state", new_callable=AsyncMock) as mock_detect:
            await service.update_all_states([])

            # grace period 내이므로 detect_worker_state 호출 안 함
            mock_detect.assert_not_called()

    async def test_updates_after_grace_period(self) -> None:
        """TC-WS-16: grace period 이후 상태를 업데이트합니다."""
        config = create_config(grace_period=20.0)
        service = WorkerService(config)

        worker = create_worker(
            id=1,
            state=WorkerState.BUSY,
            dispatch_time=datetime.now() - timedelta(seconds=30),  # 30초 전
        )
        service.workers = [worker]

        with patch("orchay.application.worker_service.detect_worker_state", new_callable=AsyncMock) as mock_detect:
            mock_detect.return_value = ("idle", None)

            await service.update_all_states([])

            mock_detect.assert_called_once()
            assert worker.state == WorkerState.IDLE


class TestSyncWorkerSteps:
    """sync_worker_steps 메서드 테스트."""

    def test_syncs_step_from_task(self) -> None:
        """TC-WS-17: Task 상태에서 step을 동기화합니다."""
        config = create_config()
        service = WorkerService(config)

        worker = create_worker(id=1, current_task="T1")
        worker.current_step = "start"
        service.workers = [worker]

        task = create_task(id="T1", status=TaskStatus.APPROVED)

        def mock_get_next_command(t, mode):
            return "build" if t.id == "T1" else None

        service.sync_worker_steps([task], mock_get_next_command, "quick")

        assert worker.current_step == "build"

    def test_ignores_workers_without_task(self) -> None:
        """TC-WS-18: Task가 없는 Worker는 무시합니다."""
        config = create_config()
        service = WorkerService(config)

        worker = create_worker(id=1, current_task=None)
        worker.current_step = "start"
        service.workers = [worker]

        def mock_get_next_command(t, mode):
            return "build"

        service.sync_worker_steps([], mock_get_next_command, "quick")

        # 변경 없음
        assert worker.current_step == "start"
