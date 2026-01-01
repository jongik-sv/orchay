"""Task 서비스 (Phase 2.1).

Task 생명주기를 관리합니다:
- WBS 파싱 결과 병합
- 실행 가능 Task 필터링
- Task 상태 업데이트
- 완료된 Task 정리
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING

from orchay.domain.policies import TaskFilterPolicy
from orchay.domain.workflow import ExecutionMode, WorkflowConfig, WorkflowEngine
from orchay.models import Task, TaskStatus

if TYPE_CHECKING:
    from orchay.wbs_parser import WbsParser

logger = logging.getLogger(__name__)


# 모드별 stopAtState 매핑
STOP_STATE_MAP: dict[ExecutionMode, set[TaskStatus]] = {
    ExecutionMode.DESIGN: {TaskStatus.DETAIL_DESIGN, TaskStatus.DONE},
    ExecutionMode.QUICK: {TaskStatus.DONE},
    ExecutionMode.DEVELOP: {TaskStatus.IMPLEMENT, TaskStatus.VERIFY, TaskStatus.DONE},
    ExecutionMode.FORCE: {TaskStatus.DONE},
    ExecutionMode.TEST: {TaskStatus.DONE},
}


class TaskService:
    """Task 생명주기 관리 서비스.

    WBS 파싱, Task 필터링, 상태 관리 등 Task 관련 비즈니스 로직을 담당합니다.

    Example:
        ```python
        parser = WbsParser(wbs_path)
        service = TaskService(parser)

        # Task 로드
        await service.reload_tasks()

        # 실행 가능 Task 조회
        executable = service.get_executable_tasks(ExecutionMode.QUICK)

        # 완료된 Task 정리
        service.cleanup_completed(ExecutionMode.QUICK)
        ```
    """

    def __init__(
        self,
        parser: WbsParser,
        workflow_engine: WorkflowEngine | None = None,
    ) -> None:
        """TaskService를 초기화합니다.

        Args:
            parser: WbsParser 인스턴스
            workflow_engine: WorkflowEngine 인스턴스 (None이면 자동 생성)
        """
        self._parser = parser
        self._tasks: list[Task] = []

        # WorkflowEngine 초기화
        if workflow_engine is None:
            config = WorkflowConfig.from_cwd()
            self._engine = WorkflowEngine(config)
        else:
            self._engine = workflow_engine

        self._filter_policy = TaskFilterPolicy(self._engine)

    @property
    def tasks(self) -> list[Task]:
        """현재 Task 목록을 반환합니다."""
        return self._tasks

    @tasks.setter
    def tasks(self, value: list[Task]) -> None:
        """Task 목록을 설정합니다."""
        self._tasks = value

    @property
    def workflow_engine(self) -> WorkflowEngine:
        """WorkflowEngine 인스턴스를 반환합니다."""
        return self._engine

    async def reload_tasks(self) -> list[Task]:
        """WBS를 다시 파싱하고 기존 Task에 병합합니다.

        런타임 상태(assigned_worker)는 보존됩니다.

        Returns:
            병합된 Task 목록
        """
        new_tasks = await self._parser.parse()
        self._merge_tasks(new_tasks)
        return self._tasks

    def _merge_tasks(self, new_tasks: list[Task]) -> None:
        """WBS 파싱 결과를 기존 Task 리스트에 병합합니다.

        런타임 상태(assigned_worker)는 보존하고 WBS 필드만 업데이트합니다.

        Args:
            new_tasks: WBS 파싱으로 얻은 새 Task 리스트
        """
        # 기존 Task를 ID로 매핑
        existing_map = {t.id: t for t in self._tasks}
        new_ids = {t.id for t in new_tasks}

        # 1. 삭제된 Task 제거 (WBS에서 사라진 것)
        self._tasks = [t for t in self._tasks if t.id in new_ids]

        # 2. 기존 Task 업데이트 또는 새 Task 추가
        for new_task in new_tasks:
            if new_task.id in existing_map:
                # 기존 Task: WBS 필드만 업데이트, 런타임 상태 보존
                existing = existing_map[new_task.id]
                existing.title = new_task.title
                existing.status = new_task.status
                existing.priority = new_task.priority
                existing.category = new_task.category
                existing.depends = new_task.depends
                existing.blocked_by = new_task.blocked_by
                # assigned_worker는 절대 건드리지 않음!
            else:
                # 새 Task: 리스트에 추가
                self._tasks.append(new_task)

        logger.debug(f"Task 병합 완료: {len(self._tasks)}개")

    def get_executable_tasks(self, mode: ExecutionMode) -> list[Task]:
        """실행 가능한 Task를 필터링하고 우선순위순으로 정렬합니다.

        Args:
            mode: 현재 실행 모드

        Returns:
            우선순위순 정렬된 실행 가능 Task 리스트
        """
        return self._filter_policy.filter_executable(self._tasks, mode)

    def cleanup_completed(self, mode: ExecutionMode) -> None:
        """stopAtState에 도달한 Task의 할당을 해제합니다.

        모드별 stopAtState:
        - design: [dd] (상세설계)
        - quick/force: [xx] (완료)
        - develop: [im] (구현)
        - test: [xx] (완료)

        Args:
            mode: 현재 실행 모드
        """
        stop_statuses = STOP_STATE_MAP.get(mode, {TaskStatus.DONE})

        # 완료된 Task의 할당 해제
        for task in self._tasks:
            if task.status in stop_statuses and task.assigned_worker is not None:
                logger.debug(f"Task {task.id} 할당 해제 (stopAtState 도달)")
                task.assigned_worker = None

    async def refresh_task_status(self, task: Task) -> bool:
        """단일 Task의 WBS 상태를 재로드합니다.

        스킬이 WBS 파일을 변경한 후 최신 상태를 반영합니다.

        Args:
            task: 갱신할 Task

        Returns:
            True: 갱신 성공
            False: 갱신 실패 (Task를 찾지 못함 등)
        """
        try:
            new_tasks = await self._parser.parse()
            for new_task in new_tasks:
                if new_task.id == task.id:
                    # 상태 관련 필드만 업데이트
                    task.status = new_task.status
                    task.title = new_task.title
                    task.priority = new_task.priority
                    task.category = new_task.category
                    task.depends = new_task.depends
                    task.blocked_by = new_task.blocked_by
                    logger.debug(f"Task 상태 갱신: {task.id} → {task.status.value}")
                    return True
            logger.warning(f"Task를 찾을 수 없음: {task.id}")
            return False
        except Exception as e:
            logger.warning(f"Task 상태 갱신 실패: {task.id} - {e}")
            return False

    def get_task_by_id(self, task_id: str) -> Task | None:
        """ID로 Task를 조회합니다.

        Args:
            task_id: Task ID

        Returns:
            Task 또는 None
        """
        for task in self._tasks:
            if task.id == task_id:
                return task
        return None

    def get_tasks_by_status(self, status: TaskStatus) -> list[Task]:
        """상태로 Task를 조회합니다.

        Args:
            status: 조회할 상태

        Returns:
            해당 상태의 Task 목록
        """
        return [t for t in self._tasks if t.status == status]

    def get_assigned_tasks(self) -> list[Task]:
        """할당된 Task 목록을 반환합니다.

        Returns:
            assigned_worker가 설정된 Task 목록
        """
        return [t for t in self._tasks if t.assigned_worker is not None]

    async def update_task_status(
        self,
        task_id: str,
        new_status: str,
    ) -> bool:
        """WBS 파일에서 Task 상태를 업데이트합니다.

        Args:
            task_id: Task ID
            new_status: 새 상태 코드 (예: "[ap]")

        Returns:
            True: 업데이트 성공
            False: 업데이트 실패
        """
        from orchay.wbs_parser import update_task_status

        wbs_path = self._parser.path
        success = await update_task_status(wbs_path, task_id, new_status)

        if success:
            # 메모리 상태도 동기화
            task = self.get_task_by_id(task_id)
            if task:
                await self.refresh_task_status(task)

        return success
