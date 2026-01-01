"""Task 필터링 정책 (Phase 1.2).

실행 가능한 Task를 필터링하는 비즈니스 규칙을 정의합니다.
순수 로직만 포함하며, I/O가 없습니다.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from orchay.domain.workflow import ExecutionMode, WorkflowEngine
from orchay.models import Task, TaskPriority, TaskStatus

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


# 우선순위 정렬 순서
PRIORITY_ORDER: dict[TaskPriority, int] = {
    TaskPriority.CRITICAL: 0,
    TaskPriority.HIGH: 1,
    TaskPriority.MEDIUM: 2,
    TaskPriority.LOW: 3,
}

# 구현 완료 이상 상태
IMPLEMENTED_STATUSES: set[TaskStatus] = {
    TaskStatus.IMPLEMENT,
    TaskStatus.VERIFY,
    TaskStatus.DONE,
}


class TaskFilterPolicy:
    """Task 필터링 정책.

    실행 가능한 Task를 필터링하는 비즈니스 규칙을 캡슐화합니다.

    Business Rules:
        BR-01: 완료 Task([xx])는 항상 제외
        BR-02: blocked-by 설정된 Task 제외
        BR-03: 실행 중 Task 중복 분배 금지
        BR-04: design 모드: [ ] 상태만 표시
        BR-05: develop/quick: 구현 단계에서 의존성 검사
        BR-06: force 모드: 의존성 무시
        BR-07: 우선순위 정렬: critical > high > medium > low
        BR-08: transition이 없는 Task 제외 (수동 완료 대상)
        BR-09: 다음 명령어가 수동 실행 대상이면 제외

    Example:
        ```python
        engine = WorkflowEngine(config)
        policy = TaskFilterPolicy(engine)

        executable = policy.filter_executable(tasks, ExecutionMode.QUICK)
        ```
    """

    def __init__(self, workflow_engine: WorkflowEngine) -> None:
        """TaskFilterPolicy를 초기화합니다.

        Args:
            workflow_engine: WorkflowEngine 인스턴스
        """
        self._engine = workflow_engine

    def filter_executable(
        self,
        tasks: list[Task],
        mode: ExecutionMode,
    ) -> list[Task]:
        """실행 가능한 Task를 필터링하고 우선순위순으로 정렬합니다.

        Args:
            tasks: 전체 Task 목록
            mode: 현재 실행 모드

        Returns:
            우선순위순 정렬된 실행 가능 Task 리스트
        """
        # 전체 Task를 딕셔너리로 변환 (의존성 검사용)
        all_tasks_dict = {t.id: t for t in tasks}

        result: list[Task] = []
        manual_cmds = self._engine.get_manual_commands(mode)

        logger.debug(f"filter: mode={mode.value}, manualCommands={manual_cmds}")

        for task in tasks:
            if self._should_include(task, mode, all_tasks_dict, manual_cmds):
                result.append(task)

        # BR-07: 우선순위 정렬
        result.sort(key=lambda t: PRIORITY_ORDER.get(t.priority, 99))

        return result

    def _should_include(
        self,
        task: Task,
        mode: ExecutionMode,
        all_tasks: dict[str, Task],
        manual_cmds: set[str],
    ) -> bool:
        """Task가 실행 가능한지 확인합니다.

        Args:
            task: 검사 대상 Task
            mode: 현재 실행 모드
            all_tasks: 전체 Task 딕셔너리
            manual_cmds: 수동 실행 명령어 집합

        Returns:
            True: 실행 가능
            False: 제외
        """
        # BR-01: 완료 Task 제외
        if task.status == TaskStatus.DONE:
            logger.debug(f"  {task.id}: BR-01 제외 (완료)")
            return False

        # BR-02: blocked-by 설정된 Task 제외
        if task.blocked_by is not None:
            logger.debug(f"  {task.id}: BR-02 제외 (blocked_by={task.blocked_by})")
            return False

        # BR-03: 이미 할당된 Task 제외
        if task.assigned_worker is not None:
            logger.debug(f"  {task.id}: BR-03 제외 (assigned={task.assigned_worker})")
            return False

        # BR-08: transition이 없는 Task 제외 (수동 완료 대상)
        next_cmd = self._engine.get_next_command(task, mode)
        if next_cmd is None:
            logger.debug(
                f"  {task.id}: BR-08 제외 (transition 없음, status={task.status.value})"
            )
            return False

        # BR-09: 다음 명령어가 수동 실행 대상이면 제외
        if next_cmd in manual_cmds:
            logger.debug(f"  {task.id}: BR-09 제외 (수동 명령={next_cmd})")
            return False

        # 모드별 필터링
        if not self._check_mode_specific(task, mode, all_tasks):
            return False

        return True

    def _check_mode_specific(
        self,
        task: Task,
        mode: ExecutionMode,
        all_tasks: dict[str, Task],
    ) -> bool:
        """모드별 추가 필터링 규칙을 적용합니다.

        Args:
            task: 검사 대상 Task
            mode: 현재 실행 모드
            all_tasks: 전체 Task 딕셔너리

        Returns:
            True: 통과
            False: 제외
        """
        if mode == ExecutionMode.DESIGN:
            # BR-04: design 모드는 [ ] 상태만 포함
            return task.status == TaskStatus.TODO

        if mode == ExecutionMode.FORCE:
            # BR-06: force 모드는 의존성 무시, 모든 미완료 Task 포함
            return True

        if mode == ExecutionMode.TEST:
            # BR-TEST: test 모드는 구현 완료 상태([im], [vf], [xx])만 포함
            if task.status not in IMPLEMENTED_STATUSES:
                logger.debug(f"  {task.id}: BR-TEST 제외 (구현 미완료)")
                return False
            return True

        # BR-05: quick/develop 모드 의존성 검사
        # [ ] 상태는 의존성 무시, [dd] 이상 상태에서는 의존성 검사
        if self._is_beyond_todo_status(task.status):
            if not self.check_dependencies_implemented(task, all_tasks):
                return False

        return True

    def _is_beyond_todo_status(self, status: TaskStatus) -> bool:
        """Task가 TODO 이후 상태([dd] 이상)인지 확인합니다.

        Args:
            status: Task 상태

        Returns:
            True: TODO 이후 상태
            False: TODO 상태
        """
        return status not in {TaskStatus.TODO}

    def check_dependencies_implemented(
        self,
        task: Task,
        all_tasks: dict[str, Task],
    ) -> bool:
        """Task의 선행 의존성이 모두 구현 완료([im] 이상)인지 확인합니다.

        Args:
            task: 검사 대상 Task
            all_tasks: 전체 Task 딕셔너리 (id -> Task)

        Returns:
            모든 의존성이 충족되면 True
        """
        if not task.depends:
            return True

        for dep_id in task.depends:
            dep_task = all_tasks.get(dep_id)
            if dep_task is None:
                # 존재하지 않는 의존성은 무시 (경고 로그는 별도 처리)
                continue
            if dep_task.status not in IMPLEMENTED_STATUSES:
                return False

        return True

    def sort_by_priority(self, tasks: list[Task]) -> list[Task]:
        """Task를 우선순위순으로 정렬합니다.

        Args:
            tasks: 정렬할 Task 목록

        Returns:
            우선순위순 정렬된 Task 목록 (새 리스트)
        """
        return sorted(tasks, key=lambda t: PRIORITY_ORDER.get(t.priority, 99))
