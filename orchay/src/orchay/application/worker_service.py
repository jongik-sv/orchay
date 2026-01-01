"""Worker 서비스 (Phase 2.2).

Worker 상태를 관리합니다:
- Worker 초기화
- 상태 업데이트
- 유휴 Worker 조회
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import TYPE_CHECKING

from orchay.domain.constants import DISPATCH_TIMINGS
from orchay.domain.workflow import ExecutionMode
from orchay.models import Worker, WorkerState
from orchay.scheduler import get_manual_commands, get_next_workflow_command
from orchay.utils.wezterm import get_active_pane_id, wezterm_list_panes
from orchay.worker import detect_worker_state

if TYPE_CHECKING:
    from orchay.application.dispatch_service import DispatchService
    from orchay.application.task_service import TaskService
    from orchay.models import Config, Task

logger = logging.getLogger(__name__)


class WorkerService:
    """Worker 상태 관리 서비스.

    WezTerm pane 기반 Worker 초기화 및 상태 관리를 담당합니다.

    Example:
        ```python
        service = WorkerService(config)

        # Worker 초기화
        await service.initialize_workers()

        # 상태 업데이트
        await service.update_all_states(tasks)

        # 유휴 Worker 조회
        idle_workers = service.get_idle_workers()
        ```
    """

    def __init__(self, config: Config) -> None:
        """WorkerService를 초기화합니다.

        Args:
            config: Config 인스턴스
        """
        self._config = config
        self._workers: list[Worker] = []

    @property
    def workers(self) -> list[Worker]:
        """현재 Worker 목록을 반환합니다."""
        return self._workers

    @workers.setter
    def workers(self, value: list[Worker]) -> None:
        """Worker 목록을 설정합니다."""
        self._workers = value

    @property
    def config(self) -> Config:
        """Config 인스턴스를 반환합니다."""
        return self._config

    async def initialize_workers(self) -> list[Worker]:
        """WezTerm pane에서 Worker 목록을 생성합니다.

        현재 pane을 제외하고 config.workers 개수만큼 Worker를 생성합니다.

        Returns:
            생성된 Worker 목록

        Raises:
            WezTermNotFoundError: WezTerm이 설치되지 않은 경우
        """
        panes = await wezterm_list_panes()

        if not panes:
            logger.warning("WezTerm pane을 찾을 수 없습니다.")
            return []

        # 현재 pane 감지
        current_pane_id = await self._detect_current_pane()

        # Worker 생성
        self._workers = []
        worker_count = 0

        for pane in panes:
            # config.workers가 0이면 무제한, 양수면 해당 개수까지만
            if self._config.workers > 0 and worker_count >= self._config.workers:
                break

            # 현재 pane (orchay 실행 중) 제외
            if pane.pane_id == current_pane_id:
                continue

            # Worker pane으로 등록
            self._workers.append(
                Worker(
                    id=worker_count + 1,
                    pane_id=pane.pane_id,
                    state=WorkerState.IDLE,
                )
            )
            worker_count += 1

        logger.info(f"Worker {len(self._workers)}개 초기화 완료")
        return self._workers

    async def _detect_current_pane(self) -> int:
        """현재 pane ID를 감지합니다.

        환경변수 WEZTERM_PANE을 먼저 확인하고,
        없으면 WezTerm CLI로 활성 pane을 감지합니다.

        Returns:
            현재 pane ID (-1이면 감지 실패)
        """
        # 환경변수 확인
        env_pane = os.environ.get("WEZTERM_PANE")
        if env_pane:
            return int(env_pane)

        # WezTerm CLI로 감지
        active_pane = await get_active_pane_id()
        if active_pane is not None:
            logger.info(f"현재 활성 pane 감지: {active_pane}")
            return active_pane

        # 감지 실패
        logger.warning("현재 pane을 감지할 수 없습니다.")
        return -1

    async def update_all_states(self, tasks: list[Task]) -> None:
        """모든 Worker의 상태를 업데이트합니다.

        Args:
            tasks: 현재 Task 목록 (Task 조회용)
        """
        task_map = {t.id: t for t in tasks}

        for worker in self._workers:
            await self._update_worker_state(worker, task_map)

    async def _update_worker_state(
        self,
        worker: Worker,
        task_map: dict[str, Task],
    ) -> None:
        """단일 Worker의 상태를 업데이트합니다.

        Args:
            worker: 업데이트할 Worker
            task_map: Task ID → Task 매핑
        """
        # Grace period: dispatch 직후에는 상태 체크 건너뛰기
        if worker.dispatch_time:
            elapsed = (datetime.now() - worker.dispatch_time).total_seconds()
            if elapsed < self._config.dispatch.grace_period:
                logger.debug(
                    f"Worker {worker.id}: grace period ({elapsed:.1f}s < "
                    f"{self._config.dispatch.grace_period}s)"
                )
                return

        # Worker의 현재 Task 확인
        has_active_task = worker.current_task is not None

        # 상태 감지
        new_state, done_info = await detect_worker_state(
            worker.pane_id,
            has_active_task=has_active_task,
        )

        # 상태 변경 처리
        if new_state != worker.state.value:
            logger.info(f"Worker {worker.id}: {worker.state.value} → {new_state}")

        worker.state = WorkerState(new_state)

        # done 상태 처리는 Orchestrator에서 수행 (done_info 반환)
        if done_info:
            worker.last_done_info = done_info

    def get_idle_workers(self) -> list[Worker]:
        """유휴 상태의 Worker 목록을 반환합니다.

        수동 일시정지된 Worker는 제외합니다.

        Returns:
            유휴 상태 Worker 목록
        """
        return [
            w
            for w in self._workers
            if w.state == WorkerState.IDLE and not w.is_manually_paused
        ]

    def get_busy_workers(self) -> list[Worker]:
        """작업 중인 Worker 목록을 반환합니다.

        Returns:
            작업 중 Worker 목록
        """
        return [w for w in self._workers if w.state == WorkerState.BUSY]

    def get_worker_by_id(self, worker_id: int) -> Worker | None:
        """ID로 Worker를 조회합니다.

        Args:
            worker_id: Worker ID

        Returns:
            Worker 또는 None
        """
        for worker in self._workers:
            if worker.id == worker_id:
                return worker
        return None

    def get_worker_by_pane(self, pane_id: int) -> Worker | None:
        """Pane ID로 Worker를 조회합니다.

        Args:
            pane_id: Pane ID

        Returns:
            Worker 또는 None
        """
        for worker in self._workers:
            if worker.pane_id == pane_id:
                return worker
        return None

    def get_worker_by_task(self, task_id: str) -> Worker | None:
        """Task ID로 해당 Task를 실행 중인 Worker를 조회합니다.

        Args:
            task_id: Task ID

        Returns:
            Worker 또는 None
        """
        for worker in self._workers:
            if worker.current_task == task_id:
                return worker
        return None

    def sync_worker_steps(
        self,
        tasks: list[Task],
        get_next_command: callable,
        mode: str,
    ) -> None:
        """Worker의 current_step을 WBS 상태 기반으로 업데이트합니다.

        Args:
            tasks: 현재 Task 목록
            get_next_command: 다음 명령어 결정 함수
            mode: 현재 실행 모드
        """
        task_map = {t.id: t for t in tasks}

        for worker in self._workers:
            if worker.current_task is None:
                continue

            task = task_map.get(worker.current_task)
            if task is None:
                continue

            # WBS 상태 기준으로 다음 명령어 결정
            new_step = get_next_command(task, mode)
            if new_step and new_step != worker.current_step:
                logger.debug(
                    f"Worker {worker.id}: step 동기화 {worker.current_step} → {new_step}"
                )
                worker.current_step = new_step

    def clear_worker_task(self, worker: Worker) -> None:
        """Worker의 Task 할당을 해제합니다.

        Args:
            worker: 해제할 Worker
        """
        worker.current_task = None
        worker.current_step = None
        worker.dispatch_time = None
        worker.state = WorkerState.IDLE

    def running_task_ids(self) -> set[str]:
        """현재 실행 중인 Task ID 집합을 반환합니다.

        Returns:
            실행 중인 Task ID 집합
        """
        return {w.current_task for w in self._workers if w.current_task}

    async def update_worker_state_with_continuation(
        self,
        worker: Worker,
        tasks: list[Task],
        dispatch_service: DispatchService,
        task_service: TaskService,
        mode: ExecutionMode,
        paused: bool,
    ) -> None:
        """Worker 상태를 업데이트하고 연속 실행을 처리합니다.

        Orchestrator._update_worker_states()의 복잡한 done 처리 로직을 통합합니다:
        - 이전 Task/step DONE 신호 무시
        - DONE 연속 감지 → IDLE 전환
        - 연속 실행 체크 및 dispatch_next_step 호출
        - BUSY → IDLE 전환 시 min_task_duration 체크

        Args:
            worker: 업데이트할 Worker
            tasks: 현재 Task 목록
            dispatch_service: DispatchService 인스턴스
            task_service: TaskService 인스턴스
            mode: 현재 실행 모드
            paused: 스케줄러 일시정지 여부
        """
        task_map = {t.id: t for t in tasks}

        # Grace period: dispatch 직후에는 상태 체크 건너뛰기
        if worker.dispatch_time:
            elapsed = (datetime.now() - worker.dispatch_time).total_seconds()
            if elapsed < self._config.dispatch.grace_period:
                logger.debug(
                    f"Worker {worker.id}: grace period ({elapsed:.1f}s < "
                    f"{self._config.dispatch.grace_period}s)"
                )
                return

        # Worker가 현재 Task를 실행 중인지 여부 전달
        has_active_task = worker.current_task is not None
        state, done_info = await detect_worker_state(worker.pane_id, has_active_task)

        # 상태 매핑
        state_map = {
            "dead": WorkerState.DEAD,
            "done": WorkerState.DONE,
            "paused": WorkerState.PAUSED,
            "error": WorkerState.ERROR,
            "blocked": WorkerState.BLOCKED,
            "idle": WorkerState.IDLE,
            "busy": WorkerState.BUSY,
        }
        new_state = state_map.get(state, WorkerState.BUSY)

        # done 상태 처리: 연속 실행 또는 할당 해제
        if new_state == WorkerState.DONE:
            await self._handle_done_state(
                worker=worker,
                done_info=done_info,
                task_map=task_map,
                dispatch_service=dispatch_service,
                task_service=task_service,
                mode=mode,
                paused=paused,
            )
        elif new_state == WorkerState.IDLE:
            self._handle_idle_state(worker, task_map)
        else:
            worker.state = new_state

    async def _handle_done_state(
        self,
        worker: Worker,
        done_info: object | None,
        task_map: dict[str, Task],
        dispatch_service: DispatchService,
        task_service: TaskService,
        mode: ExecutionMode,
        paused: bool,
    ) -> None:
        """DONE 상태를 처리합니다.

        Args:
            worker: 대상 Worker
            done_info: DONE 신호 정보 (task_id, action 포함)
            task_map: Task ID → Task 매핑
            dispatch_service: DispatchService 인스턴스
            task_service: TaskService 인스턴스
            mode: 현재 실행 모드
            paused: 스케줄러 일시정지 여부
        """
        # 이전 Task DONE 신호 무시
        if (
            done_info
            and worker.current_task
            and hasattr(done_info, "task_id")
            and done_info.task_id != worker.current_task
        ):
            logger.debug(
                f"Worker {worker.id}: 이전 Task DONE 신호 무시 "
                f"(신호={done_info.task_id}, 현재={worker.current_task})"
            )
            return

        # 이전 step DONE 신호 무시
        if (
            done_info
            and worker.current_step
            and hasattr(done_info, "action")
            and done_info.action != worker.current_step
        ):
            logger.debug(
                f"Worker {worker.id}: 이전 step DONE 신호 무시 "
                f"(신호={done_info.action}, 현재={worker.current_step})"
            )
            return

        if worker.state == WorkerState.DONE:
            # DONE 상태가 연속 감지 → IDLE로 강제 전환
            worker.reset()
        else:
            # 처음 DONE 감지: 연속 실행 체크
            task_id = (
                done_info.task_id
                if done_info and hasattr(done_info, "task_id")
                else worker.current_task
            )
            if task_id:
                task = task_map.get(task_id)
                if task:
                    # WBS 재파싱 (스킬이 변경한 상태 반영)
                    await task_service.refresh_task_status(task)

                    # 다음 action 결정
                    last_action = (
                        done_info.action
                        if done_info and hasattr(done_info, "action")
                        else None
                    )
                    next_cmd = get_next_workflow_command(
                        task, mode=mode, last_action=last_action
                    )
                    manual_cmds = get_manual_commands(mode)

                    if next_cmd and next_cmd not in manual_cmds:
                        if paused:
                            # pause 상태면 연속 실행 중단
                            logger.info(
                                f"연속 실행 중단 (paused): {task.id} → /wf:{next_cmd}"
                            )
                            task.assigned_worker = None
                        else:
                            # 자동: 즉시 다음 단계 dispatch (같은 Worker)
                            logger.info(
                                f"연속 실행: {task.id} → /wf:{next_cmd} (Worker {worker.id})"
                            )
                            await dispatch_service.dispatch_next_step(
                                worker, task, last_action
                            )
                            return  # 상태 유지, 다음으로
                    else:
                        # 수동: 할당 해제
                        task.assigned_worker = None
                        logger.info(f"수동 대기: {task.id} (다음: {next_cmd})")

            # DONE 상태로 유지 (다음 tick에서 IDLE로 전환됨)
            worker.state = WorkerState.DONE
            worker.current_task = None
            worker.current_step = None

    def _handle_idle_state(
        self,
        worker: Worker,
        task_map: dict[str, Task],
    ) -> None:
        """IDLE 상태를 처리합니다.

        Args:
            worker: 대상 Worker
            task_map: Task ID → Task 매핑
        """
        # DONE → IDLE 전환: ORCHAY_DONE 신호가 사라짐
        if worker.state == WorkerState.DONE:
            worker.reset()
        # BUSY → IDLE 전환: Task 완료로 간주
        elif worker.state == WorkerState.BUSY:
            # 추가 검증: dispatch 후 최소 시간 경과 확인
            if worker.dispatch_time:
                elapsed = (datetime.now() - worker.dispatch_time).total_seconds()
                if elapsed < self._config.dispatch.min_task_duration:
                    logger.warning(
                        f"Worker {worker.id}: 비정상 조기 완료 "
                        f"({elapsed:.1f}s < {self._config.dispatch.min_task_duration}s), "
                        f"idle 전환 거부"
                    )
                    return  # idle 전환 거부, BUSY 상태 유지

            if worker.current_task:
                task = task_map.get(worker.current_task)
                if task:
                    task.assigned_worker = None
            worker.reset()
        else:
            worker.state = WorkerState.IDLE
