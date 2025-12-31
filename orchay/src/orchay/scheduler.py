"""스케줄러 코어 모듈 (TSK-01-03).

실행 가능 Task 필터링, 모드별 워크플로우 결정, Task 분배 로직을 구현합니다.
"""

import json
import logging
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any

from orchay.models import Task, TaskPriority, TaskStatus, Worker, WorkerState

logger = logging.getLogger(__name__)


class ExecutionMode(str, Enum):
    """실행 모드."""

    DESIGN = "design"
    QUICK = "quick"
    DEVELOP = "develop"
    FORCE = "force"


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
    """
    # 전체 Task를 딕셔너리로 변환 (의존성 검사용)
    all_tasks_dict = {t.id: t for t in tasks}

    result: list[Task] = []

    for task in tasks:
        # BR-01: 완료 Task 제외
        if task.status == TaskStatus.DONE:
            continue

        # BR-02: blocked-by 설정된 Task 제외
        if task.blocked_by is not None:
            continue

        # BR-03: 이미 할당된 Task 제외
        if task.assigned_worker is not None:
            continue

        # BR-08: transition이 없는 Task 제외 (수동 완료 대상)
        next_cmd = get_next_workflow_command(task)
        if next_cmd is None:
            continue

        # BR-09: 다음 명령어가 수동 실행 대상이면 제외
        if next_cmd in get_manual_commands(mode):
            continue

        # 모드별 필터링
        if mode == ExecutionMode.DESIGN:
            # BR-04: design 모드는 [ ] 상태만 포함
            if task.status != TaskStatus.TODO:
                continue
        elif mode == ExecutionMode.FORCE:
            # BR-06: force 모드는 의존성 무시, 모든 미완료 Task 포함
            pass
        else:
            # BR-05: quick/develop 모드 의존성 검사
            # [ ] 상태는 의존성 무시, [dd] 이상 상태에서는 의존성 검사
            if _is_beyond_todo_status(task.status) and not check_dependencies_implemented(
                task, all_tasks_dict
            ):
                continue

        result.append(task)

    # BR-07: 우선순위 정렬
    result.sort(key=lambda t: PRIORITY_ORDER.get(t.priority, 99))

    return result


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


# workflows.json 캐시 (데이터, 파일 경로, 수정 시간)
_workflows_cache: dict[str, Any] | None = None
_workflows_path: Path | None = None
_workflows_mtime: float = 0.0


def _load_workflows() -> dict[str, Any]:
    """workflows.json 파일을 로드합니다.

    파일 수정 시간을 체크하여 변경 시 자동으로 캐시를 갱신합니다.
    """
    global _workflows_cache, _workflows_path, _workflows_mtime

    # 캐시된 파일이 있으면 수정 시간 체크
    if _workflows_cache is not None and _workflows_path is not None:
        try:
            current_mtime = _workflows_path.stat().st_mtime
            if current_mtime == _workflows_mtime:
                return _workflows_cache
            # 파일이 변경됨 → 캐시 무효화
            logger.info(f"workflows.json 변경 감지, 캐시 갱신")
            _workflows_cache = None
        except OSError:
            # 파일 접근 실패 시 캐시 유지
            return _workflows_cache

    # .orchay/settings/workflows.json 찾기
    cwd = Path.cwd()
    for parent in [cwd, *cwd.parents]:
        workflows_path = parent / ".orchay" / "settings" / "workflows.json"
        if workflows_path.exists():
            try:
                loaded: dict[str, Any] = json.loads(workflows_path.read_text(encoding="utf-8"))
                _workflows_cache = loaded
                _workflows_path = workflows_path
                _workflows_mtime = workflows_path.stat().st_mtime
                return loaded
            except Exception as e:
                logger.warning(f"workflows.json 로드 실패: {e}")
                break

    # 기본값 반환
    _workflows_cache = {}
    return _workflows_cache


def reload_workflows() -> None:
    """workflows.json 캐시를 강제로 갱신합니다."""
    global _workflows_cache, _workflows_mtime
    _workflows_cache = None
    _workflows_mtime = 0.0
    _load_workflows()
    logger.info("workflows.json 캐시 강제 갱신 완료")


def get_manual_commands(mode: ExecutionMode) -> set[str]:
    """모드별 수동 실행이 필요한 명령어 집합을 반환합니다.

    Args:
        mode: 현재 실행 모드

    Returns:
        수동 실행이 필요한 명령어 집합 (예: {"approve", "done"})
    """
    workflows_data = _load_workflows()
    execution_modes = workflows_data.get("executionModes", {})
    mode_config = execution_modes.get(mode.value, {})
    return set(mode_config.get("manualCommands", []))


def _get_workflow_name(category: str) -> str:
    """Task 카테고리에 해당하는 workflow 이름을 반환합니다."""
    # category -> workflow 매핑
    category_to_workflow = {
        "development": "development",
        "development-full": "development-full",
        "defect": "defect",
        "infrastructure": "infrastructure",
    }
    return category_to_workflow.get(category, "development")


def get_next_workflow_command(task: Task) -> str | None:
    """Task 상태에 따라 다음 실행할 workflow 명령을 반환합니다.

    Args:
        task: 대상 Task

    Returns:
        workflow 명령어 (예: "start", "build", "done") 또는 None (transition 없음)
    """
    workflows_data = _load_workflows()
    workflows = workflows_data.get("workflows", {})

    # Task 카테고리에 해당하는 workflow 찾기
    workflow_name = _get_workflow_name(task.category.value)
    workflow = workflows.get(workflow_name, {})
    transitions = workflow.get("transitions", [])

    # 현재 상태에서 다음으로 가는 transition 찾기
    current_status = task.status.value
    for transition in transitions:
        if transition.get("from") == current_status:
            return transition.get("command")

    # transition 없으면 None 반환
    logger.warning(
        f"Transition 없음: {task.id} ({task.category.value}) "
        f"상태 {current_status} → workflow '{workflow_name}'"
    )
    return None


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
