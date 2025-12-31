"""TUI 테스트 (TSK-02-03).

Textual 앱의 E2E 테스트.
"""

from __future__ import annotations

import pytest

from orchay.models import Task, TaskCategory, TaskPriority, TaskStatus, Worker, WorkerState
from orchay.ui.app import OrchayApp
from orchay.ui.widgets import HelpModal, TaskDetailModal

# ============================================================================
# Fixtures
# ============================================================================


def create_test_tasks() -> list[Task]:
    """테스트용 Task 목록 생성."""
    return [
        Task(
            id="TSK-01",
            title="Task 1",
            status=TaskStatus.TODO,
            category=TaskCategory.DEVELOPMENT,
            priority=TaskPriority.HIGH,
        ),
        Task(
            id="TSK-02",
            title="Task 2",
            status=TaskStatus.TODO,
            category=TaskCategory.DEVELOPMENT,
            priority=TaskPriority.MEDIUM,
        ),
        Task(
            id="TSK-03",
            title="Task 3",
            status=TaskStatus.TODO,
            category=TaskCategory.DEVELOPMENT,
            priority=TaskPriority.LOW,
        ),
    ]


def create_test_workers() -> list[Worker]:
    """테스트용 Worker 목록 생성."""
    return [
        Worker(id=1, pane_id=1, state=WorkerState.IDLE),
        Worker(id=2, pane_id=2, state=WorkerState.BUSY, current_task="TSK-01"),
        Worker(id=3, pane_id=3, state=WorkerState.IDLE),
    ]


# ============================================================================
# E2E-001: 기본 앱 렌더링 테스트
# ============================================================================


@pytest.mark.asyncio
async def test_app_renders() -> None:
    """E2E-001: 앱 기본 렌더링 테스트."""
    app = OrchayApp(
        tasks=create_test_tasks(),
        worker_list=create_test_workers(),
    )

    async with app.run_test() as pilot:
        # 앱이 정상적으로 렌더링되는지 확인
        assert app._tasks is not None
        assert len(app._tasks) == 3


# ============================================================================
# E2E-002: F1 도움말 테스트
# ============================================================================


@pytest.mark.asyncio
async def test_f12_help() -> None:
    """E2E-002: F12 키로 도움말 표시."""
    app = OrchayApp(
        tasks=create_test_tasks(),
        worker_list=create_test_workers(),
    )

    async with app.run_test() as pilot:
        # F12 키 입력
        await pilot.press("f12")

        # 도움말 모달 표시 확인
        help_modal = app.query_one("#help-modal", HelpModal)
        assert help_modal.display is True

        # ESC로 닫기
        await pilot.press("escape")
        assert help_modal.display is False


# ============================================================================
# E2E-003: 큐 인터랙티브 테스트
# ============================================================================


@pytest.mark.asyncio
async def test_queue_interactive() -> None:
    """E2E-003: F3으로 큐 전체화면 토글."""
    app = OrchayApp(
        tasks=create_test_tasks(),
        worker_list=create_test_workers(),
    )

    async with app.run_test() as pilot:
        # F3 키 입력 (전체화면 토글)
        await pilot.press("f3")
        assert app._queue_fullscreen is True

        # ESC로 닫기
        await pilot.press("escape")
        assert app._queue_fullscreen is False


# ============================================================================
# E2E-004: Task detail 모달 표시 테스트
# ============================================================================


@pytest.mark.asyncio
async def test_task_detail_modal() -> None:
    """E2E-004: Enter 키로 Task 상세 모달 표시."""
    tasks = create_test_tasks()
    app = OrchayApp(
        tasks=tasks,
        worker_list=create_test_workers(),
    )

    async with app.run_test() as pilot:
        # Enter 키로 Task 상세 모달 표시
        await pilot.press("enter")

        # 모달 표시 확인
        task_modal = app.query_one("#task-detail-modal", TaskDetailModal)
        assert task_modal.display is True

        # ESC로 닫기
        await pilot.press("escape")
        assert task_modal.display is False


# ============================================================================
# E2E-005: 모드 전환 테스트
# ============================================================================


@pytest.mark.asyncio
async def test_mode_change() -> None:
    """E2E-005: F7으로 모드 순환."""
    app = OrchayApp(
        tasks=create_test_tasks(),
        worker_list=create_test_workers(),
        mode="design",
    )

    async with app.run_test() as pilot:
        # 초기 모드 확인
        assert app._mode == "design"

        # F7로 모드 전환
        await pilot.press("f7")
        assert app._mode == "quick"

        # 계속 전환
        await pilot.press("f7")
        assert app._mode == "develop"

        await pilot.press("f7")
        assert app._mode == "force"

        await pilot.press("f7")
        assert app._mode == "design"  # 순환


# ============================================================================
# E2E-006: 실행 중 Task skip 거부 테스트
# ============================================================================


@pytest.mark.asyncio
async def test_skip_running_task_rejected() -> None:
    """E2E-006: BR-001 - 실행 중 Task는 skip 불가."""
    tasks = create_test_tasks()
    workers = create_test_workers()

    # Worker 2가 TSK-01 실행 중
    workers[1].current_task = "TSK-01"

    app = OrchayApp(
        tasks=tasks,
        worker_list=workers,
    )

    async with app.run_test() as pilot:
        # CommandHandler로 직접 skip 시도
        result = await app._command_handler.skip_task("TSK-01")

        # 실행 중이므로 skip 실패
        assert result.success is False

        # TSK-01은 여전히 blocked_by가 없어야 함
        task = next(t for t in app._tasks if t.id == "TSK-01")
        assert task.blocked_by is None


# ============================================================================
# E2E-007: 모드 전환 후 진행 중 작업 유지 테스트
# ============================================================================


@pytest.mark.asyncio
async def test_mode_change_keeps_running() -> None:
    """E2E-007: BR-002 - 모드 전환은 진행 중 작업에 영향 없음."""
    workers = create_test_workers()
    workers[1].state = WorkerState.BUSY
    workers[1].current_task = "TSK-02"

    app = OrchayApp(
        tasks=create_test_tasks(),
        worker_list=workers,
    )

    async with app.run_test() as pilot:
        # 모드 전환
        await pilot.press("f7")

        # Worker 2는 여전히 busy
        assert workers[1].state == WorkerState.BUSY
        assert workers[1].current_task == "TSK-02"


# ============================================================================
# E2E-008: pause 후 작업 유지 테스트
# ============================================================================


@pytest.mark.asyncio
async def test_pause_keeps_running() -> None:
    """E2E-008: BR-003 - pause 시 진행 중 작업 계속."""
    workers = create_test_workers()
    workers[1].state = WorkerState.BUSY
    workers[1].current_task = "TSK-02"

    app = OrchayApp(
        tasks=create_test_tasks(),
        worker_list=workers,
    )

    async with app.run_test() as pilot:
        # pause 토글
        await pilot.press("f9")

        # _paused 상태 확인
        assert app._paused is True

        # Worker 2는 여전히 busy
        assert workers[1].state == WorkerState.BUSY
        assert workers[1].current_task == "TSK-02"

        # resume
        await pilot.press("f9")
        assert app._paused is False


# ============================================================================
# 추가 테스트
# ============================================================================


@pytest.mark.asyncio
async def test_f5_reload() -> None:
    """F5 재로드 테스트."""
    app = OrchayApp(
        tasks=create_test_tasks(),
        worker_list=create_test_workers(),
    )

    async with app.run_test() as pilot:
        # F5 키 입력
        await pilot.press("f5")
        # 에러 없이 실행되어야 함
