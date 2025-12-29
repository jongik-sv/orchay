"""CommandHandler 테스트 (TSK-02-03).

TUI 인터랙티브 기능의 명령어 처리 테스트.
"""

from __future__ import annotations

import pytest

from orchay.command import FUNCTION_KEYS, CommandHandler, CommandResult
from orchay.models import Task, TaskCategory, TaskStatus, Worker, WorkerState
from orchay.scheduler import ExecutionMode

# ============================================================================
# Fixtures
# ============================================================================


class MockOrchestrator:
    """테스트용 Mock Orchestrator."""

    def __init__(
        self,
        tasks: list[Task] | None = None,
        workers: int = 3,
        running_tasks: set[str] | None = None,
        mode: ExecutionMode = ExecutionMode.QUICK,
    ) -> None:
        self.tasks = tasks or [
            Task(
                id="TSK-01",
                title="Task 1",
                status=TaskStatus.TODO,
                category=TaskCategory.DEVELOPMENT,
            ),
            Task(
                id="TSK-02",
                title="Task 2",
                status=TaskStatus.TODO,
                category=TaskCategory.DEVELOPMENT,
            ),
            Task(
                id="TSK-03",
                title="Task 3",
                status=TaskStatus.TODO,
                category=TaskCategory.DEVELOPMENT,
            ),
        ]
        self.workers = [
            Worker(id=i + 1, pane_id=i + 1, state=WorkerState.IDLE) for i in range(workers)
        ]
        self.running_tasks = running_tasks or set()
        self.mode = mode
        self._paused = False


@pytest.fixture
def orchestrator() -> MockOrchestrator:
    """기본 Mock Orchestrator."""
    return MockOrchestrator()


@pytest.fixture
def handler(orchestrator: MockOrchestrator) -> CommandHandler:
    """CommandHandler 인스턴스."""
    return CommandHandler(orchestrator)


# ============================================================================
# UT-001~004: CommandHandler.parse_command 테스트
# ============================================================================


class TestParseCommand:
    """parse_command 테스트 그룹."""

    def test_parse_command_with_args(self, handler: CommandHandler) -> None:
        """UT-001: 정상 명령어 파싱 - 인자 있음."""
        cmd, arg = handler.parse_command("top TSK-01-02")
        assert cmd == "top"
        assert arg == "TSK-01-02"

    def test_parse_command_without_args(self, handler: CommandHandler) -> None:
        """UT-002: 인자 없는 명령어 파싱."""
        cmd, arg = handler.parse_command("status")
        assert cmd == "status"
        assert arg is None

    def test_parse_command_unknown(self, handler: CommandHandler) -> None:
        """UT-003: 잘못된 명령어."""
        with pytest.raises(ValueError, match="알 수 없는 명령어"):
            handler.parse_command("unknown_cmd")

    @pytest.mark.asyncio
    async def test_process_command_success(self, handler: CommandHandler) -> None:
        """UT-004: 명령어 실행 성공."""
        result = await handler.process_command("status")
        assert result.success is True
        assert result.message is not None


# ============================================================================
# UT-005~008: Function Key 매핑 테스트
# ============================================================================


class TestFunctionKeys:
    """Function Key 매핑 테스트 그룹."""

    def test_f1_maps_to_help(self) -> None:
        """UT-005: F1 키 → 'help' 매핑."""
        assert FUNCTION_KEYS.get("f1") == "help"

    def test_f7_maps_to_mode(self) -> None:
        """UT-006: F7 키 → 'mode' 매핑."""
        assert FUNCTION_KEYS.get("f7") == "mode"

    def test_f10_maps_to_stop(self) -> None:
        """UT-007: F10 키 → 'stop' 매핑."""
        assert FUNCTION_KEYS.get("f10") == "stop"

    def test_shift_f1_maps_to_worker_1(self) -> None:
        """UT-008: Shift+F1 키 → 'worker 1' 매핑."""
        assert FUNCTION_KEYS.get("shift+f1") == "worker 1"


# ============================================================================
# UT-009~012: 인터랙티브 UI 테스트 (QueueWidget, ActionMenu)
# ============================================================================


class TestQueueInteractive:
    """큐 인터랙티브 UI 테스트."""

    def test_get_queue_tasks(self, handler: CommandHandler) -> None:
        """UT-009: Task 목록 조회."""
        tasks = handler.get_queue_tasks()
        assert len(tasks) == 3
        assert all(isinstance(t, Task) for t in tasks)

    def test_get_prev_task_index(self, handler: CommandHandler) -> None:
        """UT-010: ↑ 키로 이전 항목 선택."""
        current = 1
        prev_idx = handler.get_prev_task_index(current, total=3)
        assert prev_idx == 0

    def test_get_next_task_index(self, handler: CommandHandler) -> None:
        """UT-011: ↓ 키로 다음 항목 선택."""
        current = 1
        next_idx = handler.get_next_task_index(current, total=3)
        assert next_idx == 2

    def test_get_action_options(self, handler: CommandHandler) -> None:
        """UT-012: 액션 옵션 목록."""
        options = handler.get_action_options()
        assert len(options) == 5
        assert "up" in [o["id"] for o in options]
        assert "top" in [o["id"] for o in options]
        assert "skip" in [o["id"] for o in options]
        assert "retry" in [o["id"] for o in options]
        assert "detail" in [o["id"] for o in options]


# ============================================================================
# UT-013~016: 큐 조정 테스트
# ============================================================================


class TestQueueAdjustment:
    """큐 조정 기능 테스트."""

    @pytest.mark.asyncio
    async def test_up_task(self, handler: CommandHandler) -> None:
        """UT-013: Task 위로 이동."""
        # TSK-02를 위로 이동
        result = await handler.up_task("TSK-02")
        assert result.success
        # 순서 확인: TSK-02가 TSK-01 앞으로
        task_ids = [t.id for t in handler.orchestrator.tasks]
        assert task_ids.index("TSK-02") < task_ids.index("TSK-01")

    @pytest.mark.asyncio
    async def test_top_task(self, handler: CommandHandler) -> None:
        """UT-014: Task 최우선 이동."""
        result = await handler.top_task("TSK-03")
        assert result.success
        # TSK-03이 첫 번째
        assert handler.orchestrator.tasks[0].id == "TSK-03"

    @pytest.mark.asyncio
    async def test_skip_task(self, handler: CommandHandler) -> None:
        """UT-015: Task 스킵 (blocked 처리)."""
        result = await handler.skip_task("TSK-01")
        assert result.success
        # blocked_by 설정 확인
        task = next(t for t in handler.orchestrator.tasks if t.id == "TSK-01")
        assert task.blocked_by == "skipped"

    @pytest.mark.asyncio
    async def test_retry_task(self, handler: CommandHandler) -> None:
        """UT-016: Task 재시도 (큐 복귀)."""
        # 먼저 skip 처리
        await handler.skip_task("TSK-01")
        # retry로 복구
        result = await handler.retry_task("TSK-01")
        assert result.success
        task = next(t for t in handler.orchestrator.tasks if t.id == "TSK-01")
        assert task.blocked_by is None


# ============================================================================
# UT-017: 모드 전환 테스트
# ============================================================================


class TestModeChange:
    """모드 전환 테스트."""

    @pytest.mark.asyncio
    async def test_change_mode_cycle(self, handler: CommandHandler) -> None:
        """UT-017: 모드 순환."""
        # 초기 모드: quick
        assert handler.orchestrator.mode == ExecutionMode.QUICK

        # quick → develop
        result = await handler.change_mode()
        assert result.success
        assert handler.orchestrator.mode == ExecutionMode.DEVELOP

        # develop → force
        result = await handler.change_mode()
        assert handler.orchestrator.mode == ExecutionMode.FORCE

        # force → design
        result = await handler.change_mode()
        assert handler.orchestrator.mode == ExecutionMode.DESIGN

        # design → quick (순환)
        result = await handler.change_mode()
        assert handler.orchestrator.mode == ExecutionMode.QUICK


# ============================================================================
# UT-018~020: 비즈니스 규칙 테스트
# ============================================================================


class TestBusinessRules:
    """비즈니스 규칙 테스트."""

    @pytest.mark.asyncio
    async def test_skip_running_task_rejected(self) -> None:
        """UT-018: BR-001 - 실행 중 Task skip 불가."""
        orchestrator = MockOrchestrator(running_tasks={"TSK-01"})
        handler = CommandHandler(orchestrator)

        result = await handler.skip_task("TSK-01")
        assert not result.success
        assert "실행 중인 Task" in result.message

    @pytest.mark.asyncio
    async def test_mode_change_no_affect_running(self) -> None:
        """UT-019: BR-002 - 모드 전환은 진행 중 작업에 영향 없음."""
        # Worker 1이 busy 상태
        orchestrator = MockOrchestrator()
        orchestrator.workers[0].state = WorkerState.BUSY
        orchestrator.workers[0].current_task = "TSK-01"
        handler = CommandHandler(orchestrator)

        # 모드 전환
        await handler.change_mode()

        # Worker 상태 유지 확인
        assert orchestrator.workers[0].state == WorkerState.BUSY
        assert orchestrator.workers[0].current_task == "TSK-01"

    @pytest.mark.asyncio
    async def test_pause_keeps_running_tasks(self) -> None:
        """UT-020: BR-003 - pause 시 진행 중 작업 계속."""
        orchestrator = MockOrchestrator()
        orchestrator.workers[0].state = WorkerState.BUSY
        orchestrator.workers[0].current_task = "TSK-01"
        handler = CommandHandler(orchestrator)

        # pause 토글
        result = await handler.toggle_pause()
        assert result.success
        assert orchestrator._paused is True

        # Worker busy 상태 유지
        assert orchestrator.workers[0].state == WorkerState.BUSY


# ============================================================================
# 추가 명령어 테스트
# ============================================================================


class TestAdditionalCommands:
    """추가 명령어 테스트."""

    @pytest.mark.asyncio
    async def test_status_command(self, handler: CommandHandler) -> None:
        """status 명령어 테스트."""
        result = await handler.process_command("status")
        assert result.success
        assert "Workers" in result.message or "mode" in result.message

    @pytest.mark.asyncio
    async def test_queue_command(self, handler: CommandHandler) -> None:
        """queue 명령어 테스트."""
        result = await handler.process_command("queue")
        assert result.success
        assert "tasks" in result.message.lower() or "대기" in result.message

    @pytest.mark.asyncio
    async def test_workers_command(self, handler: CommandHandler) -> None:
        """workers 명령어 테스트."""
        result = await handler.process_command("workers")
        assert result.success
        assert "idle" in result.message.lower() or "Workers" in result.message

    @pytest.mark.asyncio
    async def test_help_command(self, handler: CommandHandler) -> None:
        """help 명령어 테스트."""
        result = await handler.process_command("help")
        assert result.success
        assert "F1" in result.message or "Help" in result.message


class TestCommandResult:
    """CommandResult 테스트."""

    def test_success_result(self) -> None:
        """성공 결과 생성."""
        result = CommandResult.ok("작업 완료")
        assert result.success is True
        assert result.message == "작업 완료"

    def test_error_result(self) -> None:
        """에러 결과 생성."""
        result = CommandResult.error("오류 발생")
        assert result.success is False
        assert result.message == "오류 발생"
