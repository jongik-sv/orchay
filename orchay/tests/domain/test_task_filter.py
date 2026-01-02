"""TaskFilterPolicy 테스트 (Phase 1.2).

TaskFilterPolicy의 비즈니스 규칙 테스트를 제공합니다.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from orchay.domain.policies.task_filter import (
    IMPLEMENTED_STATUSES,
    PRIORITY_ORDER,
    TaskFilterPolicy,
    topological_sort_tasks,
)
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
        "design": {
            "workflowScope": "design-only",
            "manualCommands": [],
        },
        "quick": {
            "workflowScope": "transitions-only",
            "manualCommands": ["approve", "done"],
        },
        "develop": {
            "workflowScope": "full",
            "manualCommands": ["approve", "done"],
        },
        "force": {
            "workflowScope": "transitions-only",
            "manualCommands": ["done"],
        },
        "test": {
            "workflowScope": "test-only",
            "manualCommands": [],
        },
    },
}


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
def filter_policy(workflow_engine: WorkflowEngine) -> TaskFilterPolicy:
    """TaskFilterPolicy 인스턴스를 생성합니다."""
    return TaskFilterPolicy(workflow_engine)


def create_task(
    id: str = "TSK-01-01",
    status: TaskStatus = TaskStatus.TODO,
    priority: TaskPriority = TaskPriority.MEDIUM,
    depends: list[str] | None = None,
    blocked_by: str | None = None,
    assigned_worker: int | None = None,
) -> Task:
    """테스트용 Task를 생성합니다."""
    return Task(
        id=id,
        title=f"Task {id}",
        category=TaskCategory.DEVELOPMENT,
        status=status,
        priority=priority,
        depends=depends if depends is not None else [],
        blocked_by=blocked_by,
        assigned_worker=assigned_worker,
    )


class TestConstants:
    """상수 테스트."""

    def test_priority_order(self) -> None:
        """TC-TF-01: 우선순위 순서가 올바릅니다."""
        assert PRIORITY_ORDER[TaskPriority.CRITICAL] < PRIORITY_ORDER[TaskPriority.HIGH]
        assert PRIORITY_ORDER[TaskPriority.HIGH] < PRIORITY_ORDER[TaskPriority.MEDIUM]
        assert PRIORITY_ORDER[TaskPriority.MEDIUM] < PRIORITY_ORDER[TaskPriority.LOW]

    def test_implemented_statuses(self) -> None:
        """TC-TF-02: 구현 완료 상태 집합이 올바릅니다."""
        assert TaskStatus.IMPLEMENT in IMPLEMENTED_STATUSES
        assert TaskStatus.VERIFY in IMPLEMENTED_STATUSES
        assert TaskStatus.DONE in IMPLEMENTED_STATUSES
        assert TaskStatus.TODO not in IMPLEMENTED_STATUSES
        assert TaskStatus.APPROVED not in IMPLEMENTED_STATUSES


class TestFilterExecutable:
    """filter_executable 메서드 테스트."""

    def test_br01_excludes_completed_tasks(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-03: BR-01 완료 Task 제외."""
        tasks = [
            create_task(id="T1", status=TaskStatus.TODO),
            create_task(id="T2", status=TaskStatus.DONE),
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.QUICK)

        assert len(result) == 1
        assert result[0].id == "T1"

    def test_br02_excludes_blocked_tasks(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-04: BR-02 blocked-by 설정된 Task 제외."""
        tasks = [
            create_task(id="T1", status=TaskStatus.TODO),
            create_task(id="T2", status=TaskStatus.TODO, blocked_by="blocker"),
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.QUICK)

        assert len(result) == 1
        assert result[0].id == "T1"

    def test_br03_excludes_assigned_tasks(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-05: BR-03 이미 할당된 Task 제외."""
        tasks = [
            create_task(id="T1", status=TaskStatus.TODO),
            create_task(id="T2", status=TaskStatus.TODO, assigned_worker=1),
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.QUICK)

        assert len(result) == 1
        assert result[0].id == "T1"

    def test_br04_design_mode_only_todo(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-06: BR-04 design 모드는 TODO만 포함."""
        tasks = [
            create_task(id="T1", status=TaskStatus.TODO),
            create_task(id="T2", status=TaskStatus.BASIC_DESIGN),
            create_task(id="T3", status=TaskStatus.DETAIL_DESIGN),
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.DESIGN)

        assert len(result) == 1
        assert result[0].id == "T1"

    def test_br05_develop_mode_checks_dependencies(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-07: BR-05 develop 모드에서 의존성 검사."""
        tasks = [
            create_task(id="T1", status=TaskStatus.IMPLEMENT),  # 구현 완료
            create_task(id="T2", status=TaskStatus.APPROVED, depends=["T1"]),  # 의존성 충족
            create_task(id="T3", status=TaskStatus.APPROVED, depends=["T4"]),  # T4 미완료
            create_task(id="T4", status=TaskStatus.TODO),  # 미완료
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.DEVELOP)

        # T2만 포함 (T1 의존성 충족, build 명령 가능)
        # T3 제외 (T4 미완료)
        # T4 TODO → start 명령 가능
        result_ids = {t.id for t in result}
        assert "T2" in result_ids
        assert "T3" not in result_ids

    def test_br06_force_mode_ignores_dependencies(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-08: BR-06 force 모드는 의존성 무시."""
        tasks = [
            create_task(id="T1", status=TaskStatus.TODO),
            create_task(id="T2", status=TaskStatus.APPROVED, depends=["T3"]),  # T3 없음
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.FORCE)

        # force 모드에서는 의존성 무시하고 모두 포함
        result_ids = {t.id for t in result}
        assert "T1" in result_ids
        assert "T2" in result_ids

    def test_br07_priority_sorting(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-09: BR-07 우선순위 정렬."""
        tasks = [
            create_task(id="T1", status=TaskStatus.TODO, priority=TaskPriority.LOW),
            create_task(id="T2", status=TaskStatus.TODO, priority=TaskPriority.CRITICAL),
            create_task(id="T3", status=TaskStatus.TODO, priority=TaskPriority.HIGH),
            create_task(id="T4", status=TaskStatus.TODO, priority=TaskPriority.MEDIUM),
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.QUICK)

        assert result[0].id == "T2"  # CRITICAL
        assert result[1].id == "T3"  # HIGH
        assert result[2].id == "T4"  # MEDIUM
        assert result[3].id == "T1"  # LOW

    def test_br08_excludes_no_transition(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-10: BR-08 transition 없는 Task 제외."""
        tasks = [
            create_task(id="T1", status=TaskStatus.TODO),  # start 가능
            create_task(id="T2", status=TaskStatus.DONE),  # transition 없음
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.QUICK)

        assert len(result) == 1
        assert result[0].id == "T1"

    def test_br09_excludes_manual_commands(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-11: BR-09 수동 명령 대상 제외."""
        tasks = [
            create_task(id="T1", status=TaskStatus.TODO),  # start → 자동
            create_task(id="T2", status=TaskStatus.DETAIL_DESIGN),  # approve → 수동 (quick)
            create_task(id="T3", status=TaskStatus.IMPLEMENT),  # done → 수동 (quick)
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.QUICK)

        # approve, done은 수동 명령이므로 T2, T3 제외
        assert len(result) == 1
        assert result[0].id == "T1"

    def test_empty_tasks_returns_empty(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-12: 빈 목록은 빈 결과를 반환합니다."""
        result = filter_policy.filter_executable([], ExecutionMode.QUICK)
        assert result == []


class TestCheckDependenciesImplemented:
    """check_dependencies_implemented 메서드 테스트."""

    def test_no_dependencies_returns_true(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-13: 의존성 없으면 True 반환."""
        task = create_task(id="T1", depends=None)
        all_tasks = {task.id: task}

        assert filter_policy.check_dependencies_implemented(task, all_tasks)

    def test_empty_dependencies_returns_true(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-14: 빈 의존성 목록이면 True 반환."""
        task = create_task(id="T1", depends=[])
        all_tasks = {task.id: task}

        assert filter_policy.check_dependencies_implemented(task, all_tasks)

    def test_dependencies_implemented(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-15: 모든 의존성 구현 완료면 True 반환."""
        dep1 = create_task(id="D1", status=TaskStatus.IMPLEMENT)
        dep2 = create_task(id="D2", status=TaskStatus.DONE)
        task = create_task(id="T1", depends=["D1", "D2"])
        all_tasks = {t.id: t for t in [dep1, dep2, task]}

        assert filter_policy.check_dependencies_implemented(task, all_tasks)

    def test_dependencies_not_implemented(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-16: 일부 의존성 미완료면 False 반환."""
        dep1 = create_task(id="D1", status=TaskStatus.IMPLEMENT)
        dep2 = create_task(id="D2", status=TaskStatus.APPROVED)  # 미완료
        task = create_task(id="T1", depends=["D1", "D2"])
        all_tasks = {t.id: t for t in [dep1, dep2, task]}

        assert not filter_policy.check_dependencies_implemented(task, all_tasks)

    def test_missing_dependency_ignored(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-17: 존재하지 않는 의존성은 무시합니다."""
        dep1 = create_task(id="D1", status=TaskStatus.IMPLEMENT)
        task = create_task(id="T1", depends=["D1", "D2"])  # D2 없음
        all_tasks = {dep1.id: dep1, task.id: task}

        # D2는 무시되고 D1만 검사
        assert filter_policy.check_dependencies_implemented(task, all_tasks)


class TestSortByPriority:
    """sort_by_priority 메서드 테스트."""

    def test_sorts_correctly(self, filter_policy: TaskFilterPolicy) -> None:
        """TC-TF-18: 우선순위별 정렬이 올바릅니다."""
        tasks = [
            create_task(id="T1", priority=TaskPriority.LOW),
            create_task(id="T2", priority=TaskPriority.CRITICAL),
            create_task(id="T3", priority=TaskPriority.MEDIUM),
        ]

        result = filter_policy.sort_by_priority(tasks)

        assert result[0].id == "T2"  # CRITICAL
        assert result[1].id == "T3"  # MEDIUM
        assert result[2].id == "T1"  # LOW

    def test_returns_new_list(self, filter_policy: TaskFilterPolicy) -> None:
        """TC-TF-19: 새 리스트를 반환합니다 (원본 수정 없음)."""
        tasks = [
            create_task(id="T1", priority=TaskPriority.LOW),
            create_task(id="T2", priority=TaskPriority.HIGH),
        ]

        result = filter_policy.sort_by_priority(tasks)

        assert result is not tasks
        assert tasks[0].id == "T1"  # 원본 순서 유지


class TestTestMode:
    """test 모드 필터링 테스트."""

    def test_test_mode_only_implemented_tasks(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TF-20: test 모드는 구현 완료 상태만 포함."""
        tasks = [
            create_task(id="T1", status=TaskStatus.TODO),
            create_task(id="T2", status=TaskStatus.APPROVED),
            create_task(id="T3", status=TaskStatus.IMPLEMENT),
            create_task(id="T4", status=TaskStatus.VERIFY),
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.TEST)

        result_ids = {t.id for t in result}
        assert "T1" not in result_ids  # TODO 제외
        assert "T2" not in result_ids  # APPROVED 제외
        assert "T3" in result_ids  # IMPLEMENT 포함
        assert "T4" in result_ids  # VERIFY 포함


class TestTopologicalSort:
    """위상정렬 테스트 (Dependency → Priority → Task ID)."""

    def test_tc_ts_01_no_dependencies_priority_then_id(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TS-01: 의존성 없으면 Priority → Task ID 순 정렬."""
        tasks = [
            create_task(id="T1", status=TaskStatus.TODO, priority=TaskPriority.LOW),
            create_task(id="T2", status=TaskStatus.TODO, priority=TaskPriority.CRITICAL),
            create_task(id="T3", status=TaskStatus.TODO, priority=TaskPriority.HIGH),
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.DESIGN)

        assert [t.id for t in result] == ["T2", "T3", "T1"]

    def test_tc_ts_02_simple_dependency(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TS-02: 단순 의존성 - 의존 대상이 먼저."""
        tasks = [
            create_task(id="T2", status=TaskStatus.TODO, depends=["T1"]),
            create_task(id="T1", status=TaskStatus.TODO),
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.DESIGN)

        # T1이 먼저 (T2가 T1에 의존)
        assert result[0].id == "T1"
        assert result[1].id == "T2"

    def test_tc_ts_03_chain_dependency(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TS-03: 체인 의존성 (T1 → T2 → T3)."""
        tasks = [
            create_task(id="T3", status=TaskStatus.TODO, depends=["T2"]),
            create_task(id="T1", status=TaskStatus.TODO),
            create_task(id="T2", status=TaskStatus.TODO, depends=["T1"]),
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.DESIGN)

        assert [t.id for t in result] == ["T1", "T2", "T3"]

    def test_tc_ts_04_priority_within_level(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TS-04: 같은 레벨 내 Priority 정렬."""
        tasks = [
            create_task(id="T0", status=TaskStatus.TODO),
            create_task(
                id="T1", status=TaskStatus.TODO, priority=TaskPriority.LOW, depends=["T0"]
            ),
            create_task(
                id="T2", status=TaskStatus.TODO, priority=TaskPriority.HIGH, depends=["T0"]
            ),
            create_task(
                id="T3", status=TaskStatus.TODO, priority=TaskPriority.MEDIUM, depends=["T0"]
            ),
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.DESIGN)

        # T0(레벨0) 먼저, 그 다음 T2(HIGH) > T3(MEDIUM) > T1(LOW) (레벨1)
        assert result[0].id == "T0"
        assert result[1].id == "T2"
        assert result[2].id == "T3"
        assert result[3].id == "T1"

    def test_tc_ts_05_task_id_tiebreaker(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TS-05: 같은 레벨, 같은 Priority면 Task ID 순."""
        tasks = [
            create_task(id="TSK-01-03", status=TaskStatus.TODO),
            create_task(id="TSK-01-01", status=TaskStatus.TODO),
            create_task(id="TSK-01-02", status=TaskStatus.TODO),
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.DESIGN)

        assert [t.id for t in result] == ["TSK-01-01", "TSK-01-02", "TSK-01-03"]

    def test_tc_ts_06_cyclic_dependency_warning(
        self, filter_policy: TaskFilterPolicy, caplog: pytest.LogCaptureFixture
    ) -> None:
        """TC-TS-06: 순환 의존성 경고 및 맨 뒤 배치."""
        import logging

        tasks = [
            create_task(id="T1", status=TaskStatus.TODO, depends=["T2"]),
            create_task(id="T2", status=TaskStatus.TODO, depends=["T1"]),
            create_task(id="T3", status=TaskStatus.TODO),
        ]

        with caplog.at_level(logging.WARNING):
            result = filter_policy.filter_executable(tasks, ExecutionMode.DESIGN)

        assert "순환 의존성" in caplog.text
        # T3는 순환 없으므로 먼저
        assert result[0].id == "T3"
        # T1, T2는 순환이므로 맨 뒤
        assert {t.id for t in result[1:]} == {"T1", "T2"}

    def test_tc_ts_07_external_dependency_ignored(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TS-07: 필터링된 목록에 없는 의존성은 무시."""
        tasks = [
            create_task(id="T1", status=TaskStatus.TODO, depends=["EXTERNAL"]),
            create_task(id="T2", status=TaskStatus.TODO),
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.DESIGN)

        # EXTERNAL은 tasks에 없으므로 무시, T1, T2 모두 레벨 0
        assert len(result) == 2
        # 둘 다 레벨 0, 같은 Priority면 Task ID 순
        assert [t.id for t in result] == ["T1", "T2"]

    def test_tc_ts_08_diamond_dependency(
        self, filter_policy: TaskFilterPolicy
    ) -> None:
        """TC-TS-08: 다이아몬드 의존성 (A → B,C → D)."""
        tasks = [
            create_task(id="D", status=TaskStatus.TODO, depends=["B", "C"]),
            create_task(id="C", status=TaskStatus.TODO, depends=["A"]),
            create_task(id="B", status=TaskStatus.TODO, depends=["A"]),
            create_task(id="A", status=TaskStatus.TODO),
        ]

        result = filter_policy.filter_executable(tasks, ExecutionMode.DESIGN)

        # A(레벨0) → B,C(레벨1) → D(레벨2)
        assert result[0].id == "A"
        assert result[-1].id == "D"
        # B, C는 레벨1에서 Task ID 순
        assert {t.id for t in result[1:3]} == {"B", "C"}


class TestTopologicalSortFunction:
    """topological_sort_tasks 함수 직접 테스트."""

    def test_empty_list(self) -> None:
        """TC-TS-09: 빈 목록은 빈 결과를 반환합니다."""
        result = topological_sort_tasks([], {})
        assert result == []

    def test_single_task(self) -> None:
        """TC-TS-10: 단일 Task는 그대로 반환합니다."""
        task = create_task(id="T1")
        result = topological_sort_tasks([task], {task.id: task})
        assert len(result) == 1
        assert result[0].id == "T1"

    def test_returns_new_list(self) -> None:
        """TC-TS-11: 새 리스트를 반환합니다 (원본 수정 없음)."""
        tasks = [
            create_task(id="T1", priority=TaskPriority.LOW),
            create_task(id="T2", priority=TaskPriority.HIGH),
        ]
        all_tasks = {t.id: t for t in tasks}

        result = topological_sort_tasks(tasks, all_tasks)

        assert result is not tasks
        assert tasks[0].id == "T1"  # 원본 순서 유지
