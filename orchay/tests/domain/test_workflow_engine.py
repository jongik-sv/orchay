"""WorkflowEngine 테스트 (Phase 1.1).

WorkflowConfig와 WorkflowEngine의 단위 테스트를 제공합니다.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

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
            "actions": {
                "[bd]": ["review", "apply"],
                "[dd]": ["review", "apply"],
            },
        },
    },
    "executionModes": {
        "design": {
            "workflowScope": "design-only",
            "stopAfterCommand": "apply",
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
def workflow_config(sample_workflows_path: Path) -> WorkflowConfig:
    """WorkflowConfig 인스턴스를 생성합니다."""
    # sample_workflows_path = tmp_path/.orchay/settings/workflows.json
    # parent = settings, parent.parent = .orchay, parent.parent.parent = tmp_path (project root)
    project_root = sample_workflows_path.parent.parent.parent
    return WorkflowConfig.from_project_root(project_root)


@pytest.fixture
def workflow_engine(workflow_config: WorkflowConfig) -> WorkflowEngine:
    """WorkflowEngine 인스턴스를 생성합니다."""
    return WorkflowEngine(workflow_config)


@pytest.fixture
def sample_task() -> Task:
    """샘플 Task를 생성합니다."""
    return Task(
        id="TSK-01-01",
        title="테스트 Task",
        category=TaskCategory.DEVELOPMENT,
        status=TaskStatus.TODO,
        priority=TaskPriority.HIGH,
    )


class TestWorkflowConfig:
    """WorkflowConfig 클래스 테스트."""

    def test_from_project_root_loads_config(
        self, sample_workflows_path: Path, workflow_config: WorkflowConfig
    ) -> None:
        """TC-WE-01: 프로젝트 루트에서 설정을 로드합니다."""
        assert workflow_config.config_path == sample_workflows_path
        assert workflow_config.data == SAMPLE_WORKFLOWS

    def test_from_project_root_missing_file(self, tmp_path: Path) -> None:
        """TC-WE-02: 설정 파일이 없으면 빈 config를 반환합니다."""
        config = WorkflowConfig.from_project_root(tmp_path)
        assert config.config_path is None
        assert config.data == {}

    def test_is_stale_detects_change(
        self, sample_workflows_path: Path, workflow_config: WorkflowConfig
    ) -> None:
        """TC-WE-03: 파일 변경을 감지합니다."""
        assert not workflow_config.is_stale()

        # 파일 수정
        sample_workflows_path.write_text('{"test": true}', encoding="utf-8")

        assert workflow_config.is_stale()

    def test_reload_if_stale(
        self, sample_workflows_path: Path, workflow_config: WorkflowConfig
    ) -> None:
        """TC-WE-04: 변경 시 자동 리로드합니다."""
        # 파일 수정
        new_data = {"workflows": {"new": {}}, "executionModes": {}}
        sample_workflows_path.write_text(json.dumps(new_data), encoding="utf-8")

        assert workflow_config.reload_if_stale()
        assert workflow_config.data == new_data

    def test_workflows_property(self, workflow_config: WorkflowConfig) -> None:
        """TC-WE-05: workflows 프로퍼티가 올바른 데이터를 반환합니다."""
        assert "development" in workflow_config.workflows

    def test_execution_modes_property(self, workflow_config: WorkflowConfig) -> None:
        """TC-WE-06: execution_modes 프로퍼티가 올바른 데이터를 반환합니다."""
        assert "design" in workflow_config.execution_modes
        assert "quick" in workflow_config.execution_modes


class TestWorkflowEngine:
    """WorkflowEngine 클래스 테스트."""

    class TestGetManualCommands:
        """get_manual_commands 메서드 테스트."""

        def test_design_mode_no_manual_commands(
            self, workflow_engine: WorkflowEngine
        ) -> None:
            """TC-WE-07: design 모드는 수동 명령이 없습니다."""
            cmds = workflow_engine.get_manual_commands(ExecutionMode.DESIGN)
            assert cmds == set()

        def test_quick_mode_manual_commands(
            self, workflow_engine: WorkflowEngine
        ) -> None:
            """TC-WE-08: quick 모드의 수동 명령을 반환합니다."""
            cmds = workflow_engine.get_manual_commands(ExecutionMode.QUICK)
            assert cmds == {"approve", "done"}

        def test_force_mode_only_done_manual(
            self, workflow_engine: WorkflowEngine
        ) -> None:
            """TC-WE-09: force 모드는 done만 수동입니다."""
            cmds = workflow_engine.get_manual_commands(ExecutionMode.FORCE)
            assert cmds == {"done"}

    class TestGetNextCommand:
        """get_next_command 메서드 테스트."""

        def test_todo_returns_start(
            self, workflow_engine: WorkflowEngine, sample_task: Task
        ) -> None:
            """TC-WE-10: TODO 상태에서 start를 반환합니다."""
            sample_task.status = TaskStatus.TODO
            cmd = workflow_engine.get_next_command(sample_task, ExecutionMode.QUICK)
            assert cmd == "start"

        def test_design_mode_returns_action(
            self, workflow_engine: WorkflowEngine, sample_task: Task
        ) -> None:
            """TC-WE-11: design 모드에서 action을 반환합니다."""
            sample_task.status = TaskStatus.BASIC_DESIGN
            cmd = workflow_engine.get_next_command(sample_task, ExecutionMode.DESIGN)
            assert cmd == "review"  # [bd] 상태의 첫 번째 action

        def test_design_mode_action_sequence(
            self, workflow_engine: WorkflowEngine, sample_task: Task
        ) -> None:
            """TC-WE-12: design 모드에서 action 순서를 따릅니다."""
            sample_task.status = TaskStatus.BASIC_DESIGN

            # 첫 번째 action
            cmd1 = workflow_engine.get_next_command(sample_task, ExecutionMode.DESIGN)
            assert cmd1 == "review"

            # review 완료 후 다음 action
            cmd2 = workflow_engine.get_next_command(
                sample_task, ExecutionMode.DESIGN, last_action="review"
            )
            assert cmd2 == "apply"

        def test_quick_mode_skips_actions(
            self, workflow_engine: WorkflowEngine, sample_task: Task
        ) -> None:
            """TC-WE-13: quick 모드에서는 action을 건너뜁니다."""
            sample_task.status = TaskStatus.BASIC_DESIGN
            cmd = workflow_engine.get_next_command(sample_task, ExecutionMode.QUICK)
            # [bd] → [dd] transition의 command
            assert cmd == "start"

        def test_detail_design_returns_approve(
            self, workflow_engine: WorkflowEngine, sample_task: Task
        ) -> None:
            """TC-WE-14: [dd] 상태에서 approve를 반환합니다."""
            sample_task.status = TaskStatus.DETAIL_DESIGN
            cmd = workflow_engine.get_next_command(sample_task, ExecutionMode.QUICK)
            assert cmd == "approve"

        def test_approved_returns_build(
            self, workflow_engine: WorkflowEngine, sample_task: Task
        ) -> None:
            """TC-WE-15: [ap] 상태에서 build를 반환합니다."""
            sample_task.status = TaskStatus.APPROVED
            cmd = workflow_engine.get_next_command(sample_task, ExecutionMode.QUICK)
            assert cmd == "build"

        def test_implement_returns_done(
            self, workflow_engine: WorkflowEngine, sample_task: Task
        ) -> None:
            """TC-WE-16: [im] 상태에서 done을 반환합니다."""
            sample_task.status = TaskStatus.IMPLEMENT
            cmd = workflow_engine.get_next_command(sample_task, ExecutionMode.QUICK)
            assert cmd == "done"

        def test_done_returns_none(
            self, workflow_engine: WorkflowEngine, sample_task: Task
        ) -> None:
            """TC-WE-17: [xx] 상태에서 None을 반환합니다."""
            sample_task.status = TaskStatus.DONE
            cmd = workflow_engine.get_next_command(sample_task, ExecutionMode.QUICK)
            assert cmd is None

        def test_test_mode_always_returns_test(
            self, workflow_engine: WorkflowEngine, sample_task: Task
        ) -> None:
            """TC-WE-18: test 모드에서는 항상 test를 반환합니다."""
            sample_task.status = TaskStatus.IMPLEMENT
            cmd = workflow_engine.get_next_command(sample_task, ExecutionMode.TEST)
            assert cmd == "test"

    class TestHasTransition:
        """has_transition 메서드 테스트."""

        def test_has_transition_true(
            self, workflow_engine: WorkflowEngine, sample_task: Task
        ) -> None:
            """TC-WE-19: transition이 있으면 True를 반환합니다."""
            sample_task.status = TaskStatus.TODO
            assert workflow_engine.has_transition(sample_task, ExecutionMode.QUICK)

        def test_has_transition_false(
            self, workflow_engine: WorkflowEngine, sample_task: Task
        ) -> None:
            """TC-WE-20: transition이 없으면 False를 반환합니다."""
            sample_task.status = TaskStatus.DONE
            assert not workflow_engine.has_transition(sample_task, ExecutionMode.QUICK)

    class TestIsManualCommand:
        """is_manual_command 메서드 테스트."""

        def test_is_manual_command_true(
            self, workflow_engine: WorkflowEngine
        ) -> None:
            """TC-WE-21: 수동 명령이면 True를 반환합니다."""
            assert workflow_engine.is_manual_command("approve", ExecutionMode.QUICK)

        def test_is_manual_command_false(
            self, workflow_engine: WorkflowEngine
        ) -> None:
            """TC-WE-22: 자동 명령이면 False를 반환합니다."""
            assert not workflow_engine.is_manual_command("start", ExecutionMode.QUICK)

    class TestGetWorkflowSteps:
        """get_workflow_steps 메서드 테스트 (레거시 호환성)."""

        def test_design_mode_steps(self, workflow_engine: WorkflowEngine) -> None:
            """TC-WE-23: design 모드의 기본 단계를 반환합니다."""
            steps = workflow_engine.get_workflow_steps(ExecutionMode.DESIGN)
            assert steps == ["start"]

        def test_quick_mode_steps(self, workflow_engine: WorkflowEngine) -> None:
            """TC-WE-24: quick 모드의 기본 단계를 반환합니다."""
            steps = workflow_engine.get_workflow_steps(ExecutionMode.QUICK)
            assert steps == ["start", "approve", "build", "done"]

        def test_develop_mode_steps(self, workflow_engine: WorkflowEngine) -> None:
            """TC-WE-25: develop 모드의 기본 단계를 반환합니다."""
            steps = workflow_engine.get_workflow_steps(ExecutionMode.DEVELOP)
            assert "review" in steps
            assert "audit" in steps


class TestEmptyConfig:
    """빈 설정에서의 동작 테스트."""

    @pytest.fixture
    def empty_engine(self) -> WorkflowEngine:
        """빈 설정의 WorkflowEngine을 생성합니다."""
        config = WorkflowConfig()
        return WorkflowEngine(config)

    def test_empty_config_returns_empty_manual_commands(
        self, empty_engine: WorkflowEngine
    ) -> None:
        """TC-WE-26: 빈 설정에서 빈 수동 명령 집합을 반환합니다."""
        cmds = empty_engine.get_manual_commands(ExecutionMode.QUICK)
        assert cmds == set()

    def test_empty_config_returns_none_command(
        self, empty_engine: WorkflowEngine, sample_task: Task
    ) -> None:
        """TC-WE-27: 빈 설정에서 None을 반환합니다."""
        cmd = empty_engine.get_next_command(sample_task, ExecutionMode.QUICK)
        assert cmd is None
