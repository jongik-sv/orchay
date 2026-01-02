"""TaskService 테스트 (Phase 2.1).

TaskService의 비즈니스 로직 테스트를 제공합니다.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from orchay.application.task_service import STOP_STATE_MAP, TaskService
from orchay.domain.workflow import ExecutionMode, WorkflowConfig, WorkflowEngine
from orchay.models import Task, TaskCategory, TaskPriority, TaskStatus


# 테스트용 workflows.json 데이터
SAMPLE_WORKFLOWS: dict[str, Any] = {
    "workflows": {
        "development": {
            "transitions": [
                {"from": "[ ]", "to": "[bd]", "command": "start"},
                {"from": "[bd]", "to": "[dd]", "command": "start"},
                {"from": "[dd]", "to": "[ap]", "command": "approve"},
                {"from": "[ap]", "to": "[im]", "command": "build"},
                {"from": "[im]", "to": "[xx]", "command": "done"},
            ],
            "actions": {},
        },
    },
    "executionModes": {
        "design": {"workflowScope": "design-only", "manualCommands": []},
        "quick": {"workflowScope": "transitions-only", "manualCommands": ["approve", "done"]},
        "develop": {"workflowScope": "full", "manualCommands": ["approve", "done"]},
        "force": {"workflowScope": "transitions-only", "manualCommands": ["done"]},
        "test": {"workflowScope": "test-only", "manualCommands": []},
    },
}


def create_task(
    id: str = "TSK-01-01",
    status: TaskStatus = TaskStatus.TODO,
    priority: TaskPriority = TaskPriority.MEDIUM,
    assigned_worker: int | None = None,
) -> Task:
    """테스트용 Task를 생성합니다."""
    return Task(
        id=id,
        title=f"Task {id}",
        category=TaskCategory.DEVELOPMENT,
        status=status,
        priority=priority,
        depends=[],
        assigned_worker=assigned_worker,
    )


@pytest.fixture
def sample_workflows_path(tmp_path: Path) -> Path:
    """테스트용 workflows.json 파일을 생성합니다."""
    settings_dir = tmp_path / ".orchay" / "settings"
    settings_dir.mkdir(parents=True)

    workflows_path = settings_dir / "workflows.json"
    workflows_path.write_text(json.dumps(SAMPLE_WORKFLOWS), encoding="utf-8")

    return workflows_path


@pytest.fixture
def workflow_engine(sample_workflows_path: Path) -> WorkflowEngine:
    """WorkflowEngine 인스턴스를 생성합니다."""
    project_root = sample_workflows_path.parent.parent.parent
    config = WorkflowConfig.from_project_root(project_root)
    return WorkflowEngine(config)


@pytest.fixture
def mock_parser() -> MagicMock:
    """Mock WbsParser를 생성합니다."""
    parser = MagicMock()
    parser.path = Path("/test/wbs.yaml")
    parser.parse = AsyncMock(return_value=[])
    return parser


@pytest.fixture
def task_service(mock_parser: MagicMock, workflow_engine: WorkflowEngine) -> TaskService:
    """TaskService 인스턴스를 생성합니다."""
    return TaskService(mock_parser, workflow_engine)


class TestTaskServiceInit:
    """TaskService 초기화 테스트."""

    def test_init_with_parser(self, mock_parser: MagicMock, workflow_engine: WorkflowEngine) -> None:
        """TC-TS-01: parser와 engine으로 초기화합니다."""
        service = TaskService(mock_parser, workflow_engine)
        assert service.tasks == []
        assert service.workflow_engine is workflow_engine

    def test_init_without_engine(self, mock_parser: MagicMock) -> None:
        """TC-TS-02: engine 없이 초기화하면 자동 생성합니다."""
        service = TaskService(mock_parser)
        assert service.workflow_engine is not None


class TestMergeTasks:
    """_merge_tasks 메서드 테스트."""

    async def test_merge_adds_new_tasks(self, task_service: TaskService, mock_parser: MagicMock) -> None:
        """TC-TS-03: 새 Task를 추가합니다."""
        new_tasks = [create_task(id="T1"), create_task(id="T2")]
        mock_parser.parse.return_value = new_tasks

        await task_service.reload_tasks()

        assert len(task_service.tasks) == 2
        assert task_service.tasks[0].id == "T1"
        assert task_service.tasks[1].id == "T2"

    async def test_merge_preserves_assigned_worker(
        self, task_service: TaskService, mock_parser: MagicMock
    ) -> None:
        """TC-TS-04: 병합 시 assigned_worker를 보존합니다."""
        # 초기 Task (assigned_worker 있음)
        initial_task = create_task(id="T1", status=TaskStatus.TODO, assigned_worker=1)
        task_service.tasks = [initial_task]

        # 새 파싱 결과 (상태만 변경됨)
        new_task = create_task(id="T1", status=TaskStatus.BASIC_DESIGN)
        mock_parser.parse.return_value = [new_task]

        await task_service.reload_tasks()

        # assigned_worker 보존, 상태만 업데이트
        assert task_service.tasks[0].assigned_worker == 1
        assert task_service.tasks[0].status == TaskStatus.BASIC_DESIGN

    async def test_merge_removes_deleted_tasks(
        self, task_service: TaskService, mock_parser: MagicMock
    ) -> None:
        """TC-TS-05: WBS에서 삭제된 Task를 제거합니다."""
        # 초기 Task 2개
        task_service.tasks = [create_task(id="T1"), create_task(id="T2")]

        # 새 파싱 결과 (T2만 남음)
        mock_parser.parse.return_value = [create_task(id="T2")]

        await task_service.reload_tasks()

        assert len(task_service.tasks) == 1
        assert task_service.tasks[0].id == "T2"

    async def test_merge_updates_wbs_fields(
        self, task_service: TaskService, mock_parser: MagicMock
    ) -> None:
        """TC-TS-06: WBS 필드를 업데이트합니다."""
        # 초기 Task
        task_service.tasks = [create_task(id="T1", priority=TaskPriority.LOW)]

        # 새 파싱 결과 (우선순위 변경)
        new_task = create_task(id="T1", priority=TaskPriority.HIGH)
        mock_parser.parse.return_value = [new_task]

        await task_service.reload_tasks()

        assert task_service.tasks[0].priority == TaskPriority.HIGH


class TestGetExecutableTasks:
    """get_executable_tasks 메서드 테스트."""

    def test_returns_executable_tasks(self, task_service: TaskService) -> None:
        """TC-TS-07: 실행 가능 Task를 반환합니다."""
        task_service.tasks = [
            create_task(id="T1", status=TaskStatus.TODO),
            create_task(id="T2", status=TaskStatus.DONE),
        ]

        result = task_service.get_executable_tasks(ExecutionMode.QUICK)

        assert len(result) == 1
        assert result[0].id == "T1"

    def test_excludes_assigned_tasks(self, task_service: TaskService) -> None:
        """TC-TS-08: 할당된 Task를 제외합니다."""
        task_service.tasks = [
            create_task(id="T1", status=TaskStatus.TODO),
            create_task(id="T2", status=TaskStatus.TODO, assigned_worker=1),
        ]

        result = task_service.get_executable_tasks(ExecutionMode.QUICK)

        assert len(result) == 1
        assert result[0].id == "T1"


class TestCleanupCompleted:
    """cleanup_completed 메서드 테스트."""

    def test_design_mode_clears_at_detail_design(self, task_service: TaskService) -> None:
        """TC-TS-09: design 모드에서 [dd] 도달 시 할당 해제."""
        task_service.tasks = [
            create_task(id="T1", status=TaskStatus.DETAIL_DESIGN, assigned_worker=1),
            create_task(id="T2", status=TaskStatus.BASIC_DESIGN, assigned_worker=2),
        ]

        task_service.cleanup_completed(ExecutionMode.DESIGN)

        assert task_service.tasks[0].assigned_worker is None  # T1: 해제됨
        assert task_service.tasks[1].assigned_worker == 2  # T2: 유지

    def test_quick_mode_clears_at_done(self, task_service: TaskService) -> None:
        """TC-TS-10: quick 모드에서 [xx] 도달 시 할당 해제."""
        task_service.tasks = [
            create_task(id="T1", status=TaskStatus.DONE, assigned_worker=1),
            create_task(id="T2", status=TaskStatus.IMPLEMENT, assigned_worker=2),
        ]

        task_service.cleanup_completed(ExecutionMode.QUICK)

        assert task_service.tasks[0].assigned_worker is None  # T1: 해제됨
        assert task_service.tasks[1].assigned_worker == 2  # T2: 유지

    def test_develop_mode_clears_at_implement(self, task_service: TaskService) -> None:
        """TC-TS-11: develop 모드에서 [im] 도달 시 할당 해제."""
        task_service.tasks = [
            create_task(id="T1", status=TaskStatus.IMPLEMENT, assigned_worker=1),
            create_task(id="T2", status=TaskStatus.APPROVED, assigned_worker=2),
        ]

        task_service.cleanup_completed(ExecutionMode.DEVELOP)

        assert task_service.tasks[0].assigned_worker is None  # T1: 해제됨
        assert task_service.tasks[1].assigned_worker == 2  # T2: 유지


class TestRefreshTaskStatus:
    """refresh_task_status 메서드 테스트."""

    async def test_refresh_updates_status(
        self, task_service: TaskService, mock_parser: MagicMock
    ) -> None:
        """TC-TS-12: Task 상태를 갱신합니다."""
        task = create_task(id="T1", status=TaskStatus.TODO)
        task_service.tasks = [task]

        # 파싱 결과: 상태 변경됨
        updated = create_task(id="T1", status=TaskStatus.BASIC_DESIGN)
        mock_parser.parse.return_value = [updated]

        result = await task_service.refresh_task_status(task)

        assert result is True
        assert task.status == TaskStatus.BASIC_DESIGN

    async def test_refresh_returns_false_for_missing(
        self, task_service: TaskService, mock_parser: MagicMock
    ) -> None:
        """TC-TS-13: Task를 찾지 못하면 False를 반환합니다."""
        task = create_task(id="T1")
        mock_parser.parse.return_value = []  # 빈 결과

        result = await task_service.refresh_task_status(task)

        assert result is False

    async def test_refresh_handles_exception(
        self, task_service: TaskService, mock_parser: MagicMock
    ) -> None:
        """TC-TS-14: 예외 발생 시 False를 반환합니다."""
        task = create_task(id="T1")
        mock_parser.parse.side_effect = Exception("Parse error")

        result = await task_service.refresh_task_status(task)

        assert result is False


class TestGetTaskById:
    """get_task_by_id 메서드 테스트."""

    def test_returns_task(self, task_service: TaskService) -> None:
        """TC-TS-15: ID로 Task를 조회합니다."""
        task_service.tasks = [create_task(id="T1"), create_task(id="T2")]

        result = task_service.get_task_by_id("T2")

        assert result is not None
        assert result.id == "T2"

    def test_returns_none_for_missing(self, task_service: TaskService) -> None:
        """TC-TS-16: 없는 ID는 None을 반환합니다."""
        task_service.tasks = [create_task(id="T1")]

        result = task_service.get_task_by_id("T999")

        assert result is None


class TestGetTasksByStatus:
    """get_tasks_by_status 메서드 테스트."""

    def test_returns_matching_tasks(self, task_service: TaskService) -> None:
        """TC-TS-17: 상태로 Task를 조회합니다."""
        task_service.tasks = [
            create_task(id="T1", status=TaskStatus.TODO),
            create_task(id="T2", status=TaskStatus.DONE),
            create_task(id="T3", status=TaskStatus.TODO),
        ]

        result = task_service.get_tasks_by_status(TaskStatus.TODO)

        assert len(result) == 2
        assert result[0].id == "T1"
        assert result[1].id == "T3"


class TestGetAssignedTasks:
    """get_assigned_tasks 메서드 테스트."""

    def test_returns_assigned_tasks(self, task_service: TaskService) -> None:
        """TC-TS-18: 할당된 Task 목록을 반환합니다."""
        task_service.tasks = [
            create_task(id="T1", assigned_worker=1),
            create_task(id="T2"),  # 할당 안 됨
            create_task(id="T3", assigned_worker=2),
        ]

        result = task_service.get_assigned_tasks()

        assert len(result) == 2
        assert result[0].id == "T1"
        assert result[1].id == "T3"


class TestStopStateMap:
    """STOP_STATE_MAP 상수 테스트."""

    def test_design_stop_states(self) -> None:
        """TC-TS-19: design 모드의 stopAtState가 올바릅니다."""
        stop_states = STOP_STATE_MAP[ExecutionMode.DESIGN]
        assert TaskStatus.DETAIL_DESIGN in stop_states
        assert TaskStatus.DONE in stop_states

    def test_quick_stop_states(self) -> None:
        """TC-TS-20: quick 모드의 stopAtState가 올바릅니다."""
        stop_states = STOP_STATE_MAP[ExecutionMode.QUICK]
        assert TaskStatus.DONE in stop_states
        assert len(stop_states) == 1

    def test_develop_stop_states(self) -> None:
        """TC-TS-21: develop 모드의 stopAtState가 올바릅니다."""
        stop_states = STOP_STATE_MAP[ExecutionMode.DEVELOP]
        assert TaskStatus.IMPLEMENT in stop_states
        assert TaskStatus.VERIFY in stop_states
        assert TaskStatus.DONE in stop_states
