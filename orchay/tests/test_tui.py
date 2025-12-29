"""TUI 테스트 (TSK-02-03).

Textual 앱의 E2E 테스트.
"""

from __future__ import annotations

import pytest
from textual.widgets import Input

from orchay.models import Task, TaskCategory, TaskPriority, TaskStatus, Worker, WorkerState
from orchay.ui.app import OrchayApp
from orchay.ui.widgets import HelpModal, QueueWidget

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
# E2E-001: 명령어 입력 테스트
# ============================================================================


@pytest.mark.asyncio
async def test_command_input_status() -> None:
    """E2E-001: 명령어 입력 → 결과 표시."""
    app = OrchayApp(
        tasks=create_test_tasks(),
        worker_list=create_test_workers(),
    )

    async with app.run_test() as pilot:
        # Input 포커스
        command_input = app.query_one("#command-input", Input)
        command_input.focus()

        # status 명령 입력 (Textual 테스트에서는 직접 값 설정)
        command_input.value = "status"
        await pilot.press("enter")

        # 명령어가 실행되었는지 확인 (Input이 클리어됨)
        assert command_input.value == ""


# ============================================================================
# E2E-002: F1 도움말 테스트
# ============================================================================


@pytest.mark.asyncio
async def test_f1_help() -> None:
    """E2E-002: F1 키로 도움말 표시."""
    app = OrchayApp(
        tasks=create_test_tasks(),
        worker_list=create_test_workers(),
    )

    async with app.run_test() as pilot:
        # F1 키 입력
        await pilot.press("f1")

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
    """E2E-003: F3으로 큐 인터랙티브 UI 표시."""
    app = OrchayApp(
        tasks=create_test_tasks(),
        worker_list=create_test_workers(),
    )

    async with app.run_test() as pilot:
        # F3 키 입력
        await pilot.press("f3")

        # 큐 위젯 표시 확인
        queue_widget = app.query_one("#queue-widget", QueueWidget)
        assert queue_widget.display is True

        # 선택된 Task 확인
        assert queue_widget.selected_task is not None

        # ESC로 닫기
        await pilot.press("escape")
        assert queue_widget.display is False


# ============================================================================
# E2E-004: Task top 기능 테스트
# ============================================================================


@pytest.mark.asyncio
async def test_task_top() -> None:
    """E2E-004: 큐에서 T 키로 Task 최우선 이동."""
    tasks = create_test_tasks()
    app = OrchayApp(
        tasks=tasks,
        worker_list=create_test_workers(),
    )

    async with app.run_test() as pilot:
        # F3으로 큐 열기
        await pilot.press("f3")

        # 마지막 Task 선택 (아래로 2번)
        await pilot.press("down")
        await pilot.press("down")

        queue_widget = app.query_one("#queue-widget", QueueWidget)
        assert queue_widget.selected_task is not None
        original_id = queue_widget.selected_task.id

        # T 키로 최우선 이동
        await pilot.press("t")

        # 첫 번째 Task가 원래 선택된 Task인지 확인
        assert app._tasks[0].id == original_id


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
        # skip TSK-01 명령 실행
        command_input = app.query_one("#command-input", Input)
        command_input.focus()
        command_input.value = "skip TSK-01"
        await pilot.press("enter")

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
async def test_queue_navigation() -> None:
    """큐 네비게이션 테스트."""
    app = OrchayApp(
        tasks=create_test_tasks(),
        worker_list=create_test_workers(),
    )

    async with app.run_test() as pilot:
        # F3으로 큐 열기
        await pilot.press("f3")

        queue_widget = app.query_one("#queue-widget", QueueWidget)

        # 초기 선택: 첫 번째 (인덱스 0)
        assert queue_widget._selected_index == 0

        # 직접 네비게이션 메서드 호출로 테스트
        queue_widget.select_next()
        assert queue_widget._selected_index == 1

        queue_widget.select_prev()
        assert queue_widget._selected_index == 0

        # 경계에서 더 위로 이동 (무반응)
        queue_widget.select_prev()
        assert queue_widget._selected_index == 0


@pytest.mark.asyncio
async def test_f2_status() -> None:
    """F2 상태 표시 테스트."""
    app = OrchayApp(
        tasks=create_test_tasks(),
        worker_list=create_test_workers(),
    )

    async with app.run_test() as pilot:
        # F2 키 입력
        await pilot.press("f2")
        # notify가 호출되었는지는 별도로 확인 필요


@pytest.mark.asyncio
async def test_f4_workers() -> None:
    """F4 Worker 정보 표시 테스트."""
    app = OrchayApp(
        tasks=create_test_tasks(),
        worker_list=create_test_workers(),
    )

    async with app.run_test() as pilot:
        # F4 키 입력
        await pilot.press("f4")
        # notify가 호출되었는지는 별도로 확인 필요


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
