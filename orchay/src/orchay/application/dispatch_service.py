"""Dispatch 서비스 (Phase 2.3).

Task 분배 로직을 통합합니다:
- 초기 분배 (_dispatch_to_worker)
- 연속 실행 (_dispatch_next_step)
- 공통 로직 통합
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Callable

from orchay.domain.constants import DISPATCH_TIMINGS
from orchay.domain.workflow import ExecutionMode, WorkflowEngine
from orchay.models import Task, Worker, WorkerState
from orchay.scheduler import dispatch_task, get_next_workflow_command, handle_approve
from orchay.utils.wezterm import wezterm_send_text
from orchay.worker import detect_worker_state

if TYPE_CHECKING:
    from orchay.models import Config

logger = logging.getLogger(__name__)


class DispatchResult:
    """Dispatch 결과."""

    def __init__(
        self,
        success: bool,
        command: str | None = None,
        message: str | None = None,
        needs_manual_action: bool = False,
    ) -> None:
        """DispatchResult를 초기화합니다.

        Args:
            success: 분배 성공 여부
            command: 실행된 명령어
            message: 결과 메시지
            needs_manual_action: 수동 작업 필요 여부
        """
        self.success = success
        self.command = command
        self.message = message
        self.needs_manual_action = needs_manual_action


class DispatchService:
    """Task 분배 서비스.

    Worker에 Task를 분배하고 명령어를 전송합니다.
    기존 _dispatch_to_worker와 _dispatch_next_step의 중복을 통합합니다.

    Example:
        ```python
        service = DispatchService(config, project_name, wbs_path, mode)

        # 초기 분배
        result = await service.dispatch_task(worker, task)

        # 연속 실행
        result = await service.dispatch_next_step(worker, task, last_action="start")
        ```
    """

    def __init__(
        self,
        config: Config,
        project_name: str,
        wbs_path: Path,
        mode: ExecutionMode,
        workflow_engine: WorkflowEngine | None = None,
        output_callback: Callable[[str], None] | None = None,
    ) -> None:
        """DispatchService를 초기화합니다.

        Args:
            config: Config 인스턴스
            project_name: 프로젝트 이름
            wbs_path: WBS 파일 경로
            mode: 실행 모드
            workflow_engine: WorkflowEngine 인스턴스
            output_callback: 출력 콜백 함수 (console.print 대체)
        """
        self._config = config
        self._project_name = project_name
        self._wbs_path = wbs_path
        self._mode = mode
        self._engine = workflow_engine
        self._output = output_callback or (lambda x: None)

    @property
    def mode(self) -> ExecutionMode:
        """현재 실행 모드를 반환합니다."""
        return self._mode

    @mode.setter
    def mode(self, value: ExecutionMode) -> None:
        """실행 모드를 설정합니다."""
        self._mode = value

    async def dispatch_task(
        self,
        worker: Worker,
        task: Task,
        check_state: bool = True,
    ) -> DispatchResult:
        """Worker에 Task를 분배합니다 (초기 분배).

        Args:
            worker: 대상 Worker
            task: 분배할 Task
            check_state: Worker 상태 확인 여부

        Returns:
            DispatchResult
        """
        # Worker 상태 확인 (옵션)
        if check_state:
            actual_state, _ = await detect_worker_state(
                worker.pane_id, has_active_task=False
            )
            if actual_state not in ("idle", "done"):
                logger.warning(
                    f"Worker {worker.id} dispatch 취소: "
                    f"실제 상태가 {actual_state} (idle/done 아님)"
                )
                self._reset_assignment(worker, task)
                return DispatchResult(
                    success=False,
                    message=f"Worker 상태가 {actual_state}",
                )

        # Worker 상태 업데이트
        await dispatch_task(worker, task, self._mode)

        # 다음 명령 결정 (초기 분배이므로 last_action=None)
        return await self._do_dispatch(worker, task, last_action=None)

    async def dispatch_next_step(
        self,
        worker: Worker,
        task: Task,
        last_action: str | None = None,
    ) -> DispatchResult:
        """같은 Worker에 다음 워크플로우 단계를 분배합니다 (연속 실행).

        Args:
            worker: 대상 Worker
            task: 대상 Task
            last_action: 마지막으로 완료된 action

        Returns:
            DispatchResult
        """
        return await self._do_dispatch(worker, task, last_action)

    async def _do_dispatch(
        self,
        worker: Worker,
        task: Task,
        last_action: str | None,
    ) -> DispatchResult:
        """실제 분배 로직 (공통).

        Args:
            worker: 대상 Worker
            task: 대상 Task
            last_action: 마지막 액션 (연속 실행 시)

        Returns:
            DispatchResult
        """
        # 다음 워크플로우 명령 결정
        next_workflow = get_next_workflow_command(
            task, mode=self._mode, last_action=last_action
        )

        if next_workflow is None:
            logger.warning(f"다음 워크플로우 없음: {task.id}")
            self._reset_assignment(worker, task)
            return DispatchResult(
                success=False,
                message="다음 transition 없음",
            )

        # approve 단계 특별 처리
        if next_workflow == "approve":
            return await self._handle_approve_step(worker, task)

        # Worker 상태 업데이트
        self._update_worker_state(worker, task, next_workflow)

        # 명령어 전송
        return await self._send_command(worker, task, next_workflow)

    async def _handle_approve_step(
        self,
        worker: Worker,
        task: Task,
    ) -> DispatchResult:
        """approve 단계를 처리합니다.

        Args:
            worker: 대상 Worker
            task: 대상 Task

        Returns:
            DispatchResult
        """
        success = await handle_approve(task, self._wbs_path, self._mode)

        if success:
            # 승인 완료 → 다음 단계 진행 (재귀 호출)
            self._output(f"[green]자동 승인:[/] {task.id} → [ap]")
            return await self.dispatch_next_step(worker, task, last_action="approve")
        else:
            # 수동 승인 대기
            self._output(f"[yellow]수동 승인 대기:[/] {task.id}")
            self._reset_assignment(worker, task)
            return DispatchResult(
                success=False,
                command="approve",
                message="수동 승인 대기",
                needs_manual_action=True,
            )

    def _update_worker_state(
        self,
        worker: Worker,
        task: Task,
        next_workflow: str,
    ) -> None:
        """Worker 상태를 업데이트합니다.

        Args:
            worker: 대상 Worker
            task: 대상 Task
            next_workflow: 다음 명령어
        """
        worker.state = WorkerState.BUSY
        worker.current_task = task.id
        worker.dispatch_time = datetime.now()
        worker.current_step = next_workflow
        task.assigned_worker = worker.id

    async def _send_command(
        self,
        worker: Worker,
        task: Task,
        next_workflow: str,
    ) -> DispatchResult:
        """명령어를 Worker에 전송합니다.

        Args:
            worker: 대상 Worker
            task: 대상 Task
            next_workflow: 전송할 명령어

        Returns:
            DispatchResult
        """
        # /clear 전송 (옵션)
        if self._config.dispatch.clear_before_dispatch:
            await self._send_clear(worker)

        # 명령어 생성 (템플릿 사용)
        command = self._config.worker_command.template.format(
            action=next_workflow,
            project=self._project_name,
            task_id=task.id,
        )

        try:
            # 명령어 전송
            await wezterm_send_text(worker.pane_id, command)
            await asyncio.sleep(DISPATCH_TIMINGS.COMMAND_WAIT_SECONDS)
            await wezterm_send_text(worker.pane_id, "\r")
            await asyncio.sleep(DISPATCH_TIMINGS.ENTER_WAIT_SECONDS)

            self._output(
                f"[cyan]Dispatch:[/] {task.id} ({task.status.value}) → "
                f"Worker {worker.id} (/wf:{next_workflow})"
            )

            return DispatchResult(
                success=True,
                command=next_workflow,
                message=f"Worker {worker.id}에 분배됨",
            )

        except Exception as e:
            logger.error(f"Worker {worker.id} 명령 전송 실패: {e}")
            self._reset_assignment(worker, task)
            return DispatchResult(
                success=False,
                message=f"명령 전송 실패: {e}",
            )

    async def _send_clear(self, worker: Worker) -> None:
        """Worker에 clear 명령을 전송합니다.

        Args:
            worker: 대상 Worker
        """
        try:
            clear_cmd = self._config.worker_command.clear
            await wezterm_send_text(worker.pane_id, clear_cmd)
            await asyncio.sleep(DISPATCH_TIMINGS.CLEAR_WAIT_SECONDS)
            await wezterm_send_text(worker.pane_id, "\r")
            await asyncio.sleep(DISPATCH_TIMINGS.ENTER_WAIT_SECONDS)
        except Exception as e:
            logger.warning(f"Worker {worker.id} {clear_cmd} 실패: {e}")

    def _reset_assignment(self, worker: Worker, task: Task) -> None:
        """할당을 리셋합니다.

        Args:
            worker: 대상 Worker
            task: 대상 Task
        """
        task.assigned_worker = None
        worker.reset()
