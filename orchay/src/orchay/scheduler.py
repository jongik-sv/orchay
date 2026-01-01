"""스케줄러 코어 모듈 (TSK-01-03).

실행 가능 Task 필터링, 모드별 워크플로우 결정, Task 분배 로직을 구현합니다.

Note:
    이 모듈은 Phase 1.1에서 리팩토링되어 WorkflowEngine을 내부적으로 사용합니다.
    기존 함수들은 호환성을 위해 유지됩니다.
"""

import logging
from datetime import datetime
from pathlib import Path

from orchay.domain.workflow import ExecutionMode, WorkflowConfig, WorkflowEngine
from orchay.models import Task, TaskPriority, TaskStatus, Worker, WorkerState

logger = logging.getLogger(__name__)

# ExecutionMode를 re-export (하위 호환성)
__all__ = [
    "ExecutionMode",
    "PRIORITY_ORDER",
    "IMPLEMENTED_STATUSES",
    "WORKFLOW_STEPS",
    "check_dependencies_implemented",
    "filter_executable_tasks",
    "get_workflow_steps",
    "get_manual_commands",
    "get_next_workflow_command",
    "reload_workflows",
    "handle_approve",
    "dispatch_task",
]


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

# 모드별 워크플로우 단계
WORKFLOW_STEPS: dict[ExecutionMode, list[str]] = {
    ExecutionMode.DESIGN: ["start"],
    ExecutionMode.QUICK: ["start", "approve", "build", "done"],
    ExecutionMode.DEVELOP: [
        "start",
        "review",
        "apply",
        "approve",
        "build",
        "audit",
        "patch",
        "test",
        "done",
    ],
    ExecutionMode.FORCE: ["start", "approve", "build", "done"],
    ExecutionMode.TEST: ["test"],  # 테스트만 실행
}


def check_dependencies_implemented(
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


def _is_beyond_todo_status(status: TaskStatus) -> bool:
    """Task가 TODO 이후 상태([dd] 이상)인지 확인."""
    return status not in {TaskStatus.TODO}


async def filter_executable_tasks(
    tasks: list[Task],
    mode: ExecutionMode,
) -> list[Task]:
    """실행 가능한 Task를 필터링하고 우선순위순으로 정렬합니다.

    Args:
        tasks: 전체 Task 목록
        mode: 현재 실행 모드

    Returns:
        우선순위순 정렬된 실행 가능 Task 리스트

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

    Note:
        내부적으로 TaskFilterPolicy를 사용합니다 (Phase 1.2 리팩토링).
    """
    from orchay.domain.policies import TaskFilterPolicy

    engine = _get_workflow_engine()
    policy = TaskFilterPolicy(engine)
    return policy.filter_executable(tasks, mode)


def get_workflow_steps(
    task: Task,
    mode: ExecutionMode,
) -> list[str]:
    """모드와 Task 상태에 따른 워크플로우 단계를 반환합니다.

    Args:
        task: 대상 Task
        mode: 현재 실행 모드

    Returns:
        워크플로우 명령어 리스트 (예: ["start", "approve", "build", "done"])
    """
    return WORKFLOW_STEPS.get(mode, WORKFLOW_STEPS[ExecutionMode.QUICK])


# ============================================================================
# WorkflowEngine 싱글톤 (전역 캐시 대체)
# ============================================================================

_workflow_engine: WorkflowEngine | None = None


def _get_workflow_engine() -> WorkflowEngine:
    """WorkflowEngine 싱글톤을 반환합니다.

    자동으로 설정 파일 변경을 감지하고 리로드합니다.
    """
    global _workflow_engine

    if _workflow_engine is None:
        config = WorkflowConfig.from_cwd()
        _workflow_engine = WorkflowEngine(config)
    else:
        # 설정 파일 변경 감지 및 리로드
        _workflow_engine.config.reload_if_stale()

    return _workflow_engine


def reload_workflows() -> None:
    """workflows.json 캐시를 강제로 갱신합니다."""
    global _workflow_engine

    if _workflow_engine is not None:
        _workflow_engine.config.reload()
    else:
        _get_workflow_engine()

    logger.info("workflows.json 캐시 강제 갱신 완료")


def get_manual_commands(mode: ExecutionMode) -> set[str]:
    """모드별 수동 실행이 필요한 명령어 집합을 반환합니다.

    Args:
        mode: 현재 실행 모드

    Returns:
        수동 실행이 필요한 명령어 집합 (예: {"approve", "done"})

    Note:
        내부적으로 WorkflowEngine을 사용합니다.
    """
    engine = _get_workflow_engine()
    return engine.get_manual_commands(mode)


def get_next_workflow_command(
    task: Task,
    mode: ExecutionMode | None = None,
    last_action: str | None = None,
) -> str | None:
    """Task 상태에 따라 다음 실행할 workflow 명령을 반환합니다.

    Args:
        task: 대상 Task
        mode: 현재 실행 모드 (actions 포함 여부 결정)
        last_action: 마지막으로 완료된 action (연속 실행 시)

    Returns:
        workflow 명령어 (예: "start", "build", "done") 또는 None (transition 없음)

    Note:
        - design/develop 모드: transitions + actions 실행
        - quick/force 모드: transitions만 실행
        - 내부적으로 WorkflowEngine을 사용합니다.
    """
    engine = _get_workflow_engine()
    return engine.get_next_command(task, mode, last_action)


async def handle_approve(
    task: Task,
    wbs_path: Path,
    mode: ExecutionMode,
) -> bool:
    """설계 승인 처리.

    force 모드에서만 자동 승인을 수행하고, 그 외 모드에서는 수동 승인 대기.

    Args:
        task: 승인 대상 Task
        wbs_path: WBS 파일 경로
        mode: 현재 실행 모드

    Returns:
        True: 승인 완료 (다음 단계 진행 가능)
        False: 수동 승인 대기 필요
    """
    from orchay.wbs_parser import update_task_status

    if mode != ExecutionMode.FORCE:
        # force 모드가 아니면 수동 승인 대기
        logger.info(f"[{task.id}] 수동 승인 대기 (모드: {mode.value})")
        return False

    # force 모드: 자동 승인
    logger.info(f"[{task.id}] 자동 승인 처리 (force 모드)")

    # WBS 상태 업데이트: [dd] → [ap]
    success = await update_task_status(wbs_path, task.id, "[ap]")

    if success:
        logger.info(f"[{task.id}] 승인 완료: [dd] → [ap]")
        # 메모리 상태도 동기화
        task.status = TaskStatus.APPROVED
    else:
        logger.error(f"[{task.id}] 승인 실패")

    return success


async def dispatch_task(
    worker: Worker,
    task: Task,
    mode: ExecutionMode,
) -> None:
    """Worker에 Task를 분배합니다.

    Args:
        worker: 대상 Worker
        task: 분배할 Task
        mode: 현재 실행 모드

    Side Effects:
        - worker.state = "busy"
        - worker.current_task = task.id
        - worker.dispatch_time = now()
        - task.assigned_worker = worker.id
    """
    # Worker 상태 업데이트
    worker.state = WorkerState.BUSY
    worker.current_task = task.id
    worker.dispatch_time = datetime.now()

    # 워크플로우 첫 단계 설정
    steps = get_workflow_steps(task, mode)
    first_step = steps[0] if steps else "start"
    worker.current_step = first_step

    # Task에 할당된 Worker 설정
    task.assigned_worker = worker.id
