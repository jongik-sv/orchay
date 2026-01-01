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
from orchay.models import Worker, WorkerState
from orchay.utils.wezterm import get_active_pane_id, wezterm_list_panes
from orchay.worker import detect_worker_state

if TYPE_CHECKING:
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
