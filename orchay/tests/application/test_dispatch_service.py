"""DispatchService 테스트 (Phase 2.3).

DispatchService의 비즈니스 로직 테스트를 제공합니다.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from orchay.application.dispatch_service import DispatchResult, DispatchService
from orchay.domain.workflow import ExecutionMode
from orchay.models import Task, TaskCategory, TaskPriority, TaskStatus, Worker, WorkerState


def create_config(clear_before_dispatch: bool = True) -> MagicMock:
    """테스트용 Config를 생성합니다."""
    config = MagicMock()
    config.dispatch = MagicMock()
    config.dispatch.clear_before_dispatch = clear_before_dispatch
    config.worker_command = MagicMock()
    config.worker_command.template = "/wf:{action} {project}/{task_id}"
    config.worker_command.clear = "/clear"
    config.worker_command.resume = "/resume"
    return config


def create_worker(
    id: int = 1,
    pane_id: int = 100,
    state: WorkerState = WorkerState.IDLE,
) -> Worker:
    """테스트용 Worker를 생성합니다."""
    return Worker(id=id, pane_id=pane_id, state=state)


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


@pytest.fixture
def dispatch_service() -> DispatchService:
    """DispatchService 인스턴스를 생성합니다."""
    config = create_config()
    return DispatchService(
        config=config,
        project_name="test",
        wbs_path=Path("/test/wbs.yaml"),
        mode=ExecutionMode.QUICK,
    )


class TestDispatchResult:
    """DispatchResult 테스트."""

    def test_success_result(self) -> None:
        """TC-DS-01: 성공 결과를 생성합니다."""
        result = DispatchResult(success=True, command="start", message="OK")

        assert result.success is True
        assert result.command == "start"
        assert result.message == "OK"
        assert result.needs_manual_action is False

    def test_failure_result(self) -> None:
        """TC-DS-02: 실패 결과를 생성합니다."""
        result = DispatchResult(success=False, message="Error")

        assert result.success is False
        assert result.needs_manual_action is False

    def test_manual_action_required(self) -> None:
        """TC-DS-03: 수동 작업 필요 결과를 생성합니다."""
        result = DispatchResult(
            success=False,
            command="approve",
            needs_manual_action=True,
        )

        assert result.success is False
        assert result.needs_manual_action is True


class TestDispatchServiceInit:
    """DispatchService 초기화 테스트."""

    def test_init(self) -> None:
        """TC-DS-04: 올바르게 초기화합니다."""
        config = create_config()
        service = DispatchService(
            config=config,
            project_name="test",
            wbs_path=Path("/test/wbs.yaml"),
            mode=ExecutionMode.QUICK,
        )

        assert service.mode == ExecutionMode.QUICK

    def test_mode_setter(self, dispatch_service: DispatchService) -> None:
        """TC-DS-05: mode를 설정할 수 있습니다."""
        dispatch_service.mode = ExecutionMode.DESIGN
        assert dispatch_service.mode == ExecutionMode.DESIGN


class TestDispatchTask:
    """dispatch_task 메서드 테스트."""

    async def test_cancels_if_worker_not_idle(
        self, dispatch_service: DispatchService
    ) -> None:
        """TC-DS-06: Worker가 idle이 아니면 취소합니다."""
        worker = create_worker()
        task = create_task()

        with patch(
            "orchay.application.dispatch_service.detect_worker_state",
            new_callable=AsyncMock,
        ) as mock_detect:
            mock_detect.return_value = ("busy", None)

            result = await dispatch_service.dispatch_task(worker, task)

            assert result.success is False
            assert task.assigned_worker is None

    async def test_dispatches_to_idle_worker(
        self, dispatch_service: DispatchService
    ) -> None:
        """TC-DS-07: idle Worker에 분배합니다."""
        worker = create_worker()
        task = create_task()

        with (
            patch(
                "orchay.application.dispatch_service.detect_worker_state",
                new_callable=AsyncMock,
            ) as mock_detect,
            patch(
                "orchay.application.dispatch_service.dispatch_task",
                new_callable=AsyncMock,
            ),
            patch(
                "orchay.application.dispatch_service.get_next_workflow_command",
            ) as mock_next,
            patch(
                "orchay.application.dispatch_service.wezterm_send_text",
                new_callable=AsyncMock,
            ),
        ):
            mock_detect.return_value = ("idle", None)
            mock_next.return_value = "start"

            result = await dispatch_service.dispatch_task(worker, task)

            assert result.success is True
            assert result.command == "start"

    async def test_skips_state_check_when_disabled(
        self, dispatch_service: DispatchService
    ) -> None:
        """TC-DS-08: check_state=False이면 상태 체크를 건너뜁니다."""
        worker = create_worker()
        task = create_task()

        with (
            patch(
                "orchay.application.dispatch_service.detect_worker_state",
                new_callable=AsyncMock,
            ) as mock_detect,
            patch(
                "orchay.application.dispatch_service.dispatch_task",
                new_callable=AsyncMock,
            ),
            patch(
                "orchay.application.dispatch_service.get_next_workflow_command",
            ) as mock_next,
            patch(
                "orchay.application.dispatch_service.wezterm_send_text",
                new_callable=AsyncMock,
            ),
        ):
            mock_next.return_value = "start"

            result = await dispatch_service.dispatch_task(
                worker, task, check_state=False
            )

            # detect_worker_state 호출 안 함
            mock_detect.assert_not_called()
            assert result.success is True


class TestDispatchNextStep:
    """dispatch_next_step 메서드 테스트."""

    async def test_dispatches_next_step(
        self, dispatch_service: DispatchService
    ) -> None:
        """TC-DS-09: 다음 단계를 분배합니다."""
        worker = create_worker()
        task = create_task(status=TaskStatus.BASIC_DESIGN)

        with (
            patch(
                "orchay.application.dispatch_service.get_next_workflow_command",
            ) as mock_next,
            patch(
                "orchay.application.dispatch_service.wezterm_send_text",
                new_callable=AsyncMock,
            ),
        ):
            mock_next.return_value = "start"

            result = await dispatch_service.dispatch_next_step(
                worker, task, last_action="review"
            )

            assert result.success is True
            mock_next.assert_called_with(
                task, mode=ExecutionMode.QUICK, last_action="review"
            )

    async def test_returns_failure_when_no_next(
        self, dispatch_service: DispatchService
    ) -> None:
        """TC-DS-10: 다음 단계가 없으면 실패를 반환합니다."""
        worker = create_worker()
        task = create_task(status=TaskStatus.DONE)

        with patch(
            "orchay.application.dispatch_service.get_next_workflow_command",
        ) as mock_next:
            mock_next.return_value = None

            result = await dispatch_service.dispatch_next_step(worker, task)

            assert result.success is False
            assert task.assigned_worker is None


class TestApproveHandling:
    """approve 처리 테스트."""

    async def test_auto_approve_continues(
        self, dispatch_service: DispatchService
    ) -> None:
        """TC-DS-11: 자동 승인 후 다음 단계를 진행합니다."""
        worker = create_worker()
        task = create_task(status=TaskStatus.DETAIL_DESIGN)

        with (
            patch(
                "orchay.application.dispatch_service.get_next_workflow_command",
            ) as mock_next,
            patch(
                "orchay.application.dispatch_service.handle_approve",
                new_callable=AsyncMock,
            ) as mock_approve,
            patch(
                "orchay.application.dispatch_service.wezterm_send_text",
                new_callable=AsyncMock,
            ),
        ):
            # 첫 호출: approve, 두 번째 호출(재귀): build
            mock_next.side_effect = ["approve", "build"]
            mock_approve.return_value = True  # 자동 승인 성공

            result = await dispatch_service.dispatch_next_step(worker, task)

            assert result.success is True
            assert result.command == "build"

    async def test_manual_approve_waits(
        self, dispatch_service: DispatchService
    ) -> None:
        """TC-DS-12: 수동 승인이 필요하면 대기합니다."""
        worker = create_worker()
        task = create_task(status=TaskStatus.DETAIL_DESIGN)

        with (
            patch(
                "orchay.application.dispatch_service.get_next_workflow_command",
            ) as mock_next,
            patch(
                "orchay.application.dispatch_service.handle_approve",
                new_callable=AsyncMock,
            ) as mock_approve,
        ):
            mock_next.return_value = "approve"
            mock_approve.return_value = False  # 수동 승인 필요

            result = await dispatch_service.dispatch_next_step(worker, task)

            assert result.success is False
            assert result.needs_manual_action is True
            assert task.assigned_worker is None


class TestSendCommand:
    """명령어 전송 테스트."""

    async def test_sends_clear_when_enabled(
        self, dispatch_service: DispatchService
    ) -> None:
        """TC-DS-13: clear_before_dispatch=True이면 /clear를 전송합니다."""
        worker = create_worker()
        task = create_task()

        with (
            patch(
                "orchay.application.dispatch_service.detect_worker_state",
                new_callable=AsyncMock,
            ) as mock_detect,
            patch(
                "orchay.application.dispatch_service.dispatch_task",
                new_callable=AsyncMock,
            ),
            patch(
                "orchay.application.dispatch_service.get_next_workflow_command",
            ) as mock_next,
            patch(
                "orchay.application.dispatch_service.wezterm_send_text",
                new_callable=AsyncMock,
            ) as mock_send,
        ):
            mock_detect.return_value = ("idle", None)
            mock_next.return_value = "start"

            await dispatch_service.dispatch_task(worker, task)

            # /clear가 전송됨 (clear_before_dispatch=True)
            calls = [str(c) for c in mock_send.call_args_list]
            assert any("/clear" in c for c in calls)

    async def test_skips_clear_when_disabled(self) -> None:
        """TC-DS-14: clear_before_dispatch=False이면 /clear를 전송하지 않습니다."""
        config = create_config(clear_before_dispatch=False)
        service = DispatchService(
            config=config,
            project_name="test",
            wbs_path=Path("/test/wbs.yaml"),
            mode=ExecutionMode.QUICK,
        )

        worker = create_worker()
        task = create_task()

        with (
            patch(
                "orchay.application.dispatch_service.detect_worker_state",
                new_callable=AsyncMock,
            ) as mock_detect,
            patch(
                "orchay.application.dispatch_service.dispatch_task",
                new_callable=AsyncMock,
            ),
            patch(
                "orchay.application.dispatch_service.get_next_workflow_command",
            ) as mock_next,
            patch(
                "orchay.application.dispatch_service.wezterm_send_text",
                new_callable=AsyncMock,
            ) as mock_send,
        ):
            mock_detect.return_value = ("idle", None)
            mock_next.return_value = "start"

            await service.dispatch_task(worker, task)

            # /clear가 전송되지 않음
            calls = [str(c) for c in mock_send.call_args_list]
            assert not any("/clear" in c for c in calls)

    async def test_handles_send_error(
        self, dispatch_service: DispatchService
    ) -> None:
        """TC-DS-15: 전송 실패 시 할당을 해제합니다."""
        worker = create_worker()
        task = create_task()

        with (
            patch(
                "orchay.application.dispatch_service.detect_worker_state",
                new_callable=AsyncMock,
            ) as mock_detect,
            patch(
                "orchay.application.dispatch_service.dispatch_task",
                new_callable=AsyncMock,
            ),
            patch(
                "orchay.application.dispatch_service.get_next_workflow_command",
            ) as mock_next,
            patch(
                "orchay.application.dispatch_service.wezterm_send_text",
                new_callable=AsyncMock,
            ) as mock_send,
        ):
            mock_detect.return_value = ("idle", None)
            mock_next.return_value = "start"
            mock_send.side_effect = Exception("Send error")

            result = await dispatch_service.dispatch_task(worker, task)

            assert result.success is False
            assert task.assigned_worker is None
