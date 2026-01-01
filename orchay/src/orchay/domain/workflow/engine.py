"""워크플로우 엔진 (Phase 1.1).

workflows.json 기반 워크플로우 로직을 인스턴스 기반으로 관리합니다.
전역 상태를 제거하고 의존성 주입을 통해 테스트 가능성을 높입니다.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from orchay.models import Task

logger = logging.getLogger(__name__)


class ExecutionMode(str, Enum):
    """실행 모드."""

    DESIGN = "design"
    QUICK = "quick"
    DEVELOP = "develop"
    FORCE = "force"
    TEST = "test"


@dataclass
class WorkflowConfig:
    """워크플로우 설정 관리 (인스턴스 기반, 전역 상태 제거).

    workflows.json 파일을 로드하고 캐싱합니다.
    파일 변경 시 자동으로 리로드합니다.

    Attributes:
        config_path: workflows.json 파일 경로
        _data: 캐싱된 설정 데이터
        _mtime: 마지막 수정 시간
    """

    config_path: Path | None = None
    _data: dict[str, Any] = field(default_factory=dict)
    _mtime: float = 0.0

    @classmethod
    def from_project_root(cls, project_root: Path) -> WorkflowConfig:
        """프로젝트 루트에서 workflows.json을 찾아 로드합니다.

        Args:
            project_root: 프로젝트 루트 디렉토리

        Returns:
            WorkflowConfig 인스턴스
        """
        config_path = project_root / ".orchay" / "settings" / "workflows.json"
        instance = cls(config_path=config_path if config_path.exists() else None)
        instance._load()
        return instance

    @classmethod
    def from_cwd(cls) -> WorkflowConfig:
        """현재 작업 디렉토리 또는 부모에서 workflows.json을 찾습니다.

        Returns:
            WorkflowConfig 인스턴스
        """
        cwd = Path.cwd()
        for parent in [cwd, *cwd.parents]:
            config_path = parent / ".orchay" / "settings" / "workflows.json"
            if config_path.exists():
                instance = cls(config_path=config_path)
                instance._load()
                return instance

        # 설정 파일 없으면 빈 config
        return cls()

    def _load(self) -> None:
        """설정 파일을 로드합니다."""
        if self.config_path is None or not self.config_path.exists():
            self._data = {}
            self._mtime = 0.0
            return

        try:
            self._data = json.loads(self.config_path.read_text(encoding="utf-8"))
            self._mtime = self.config_path.stat().st_mtime
        except Exception as e:
            logger.warning(f"workflows.json 로드 실패: {e}")
            self._data = {}
            self._mtime = 0.0

    def is_stale(self) -> bool:
        """설정 파일이 변경되었는지 확인합니다.

        Returns:
            True: 파일이 변경됨 (리로드 필요)
            False: 파일이 동일함
        """
        if self.config_path is None:
            return False

        try:
            current_mtime = self.config_path.stat().st_mtime
            return current_mtime != self._mtime
        except OSError:
            return False

    def reload_if_stale(self) -> bool:
        """파일이 변경되었으면 리로드합니다.

        Returns:
            True: 리로드 수행됨
            False: 리로드 불필요
        """
        if self.is_stale():
            logger.info("workflows.json 변경 감지, 리로드")
            self._load()
            return True
        return False

    def reload(self) -> None:
        """강제로 리로드합니다."""
        logger.info("workflows.json 강제 리로드")
        self._load()

    @property
    def data(self) -> dict[str, Any]:
        """캐싱된 설정 데이터를 반환합니다."""
        return self._data

    @property
    def workflows(self) -> dict[str, Any]:
        """워크플로우 정의를 반환합니다."""
        return self._data.get("workflows", {})

    @property
    def execution_modes(self) -> dict[str, Any]:
        """실행 모드 설정을 반환합니다."""
        return self._data.get("executionModes", {})


class WorkflowEngine:
    """워크플로우 엔진 (순수 로직).

    Task 상태와 실행 모드에 따라 다음 명령어를 결정합니다.
    외부 I/O 없이 순수 비즈니스 로직만 포함합니다.

    Example:
        ```python
        config = WorkflowConfig.from_cwd()
        engine = WorkflowEngine(config)

        next_cmd = engine.get_next_command(task, ExecutionMode.QUICK)
        manual_cmds = engine.get_manual_commands(ExecutionMode.DESIGN)
        ```
    """

    # 카테고리 → 워크플로우 이름 매핑
    CATEGORY_TO_WORKFLOW: dict[str, str] = {
        "development": "development",
        "development-full": "development-full",
        "defect": "defect",
        "infrastructure": "infrastructure",
    }

    def __init__(self, config: WorkflowConfig) -> None:
        """WorkflowEngine을 초기화합니다.

        Args:
            config: WorkflowConfig 인스턴스
        """
        self._config = config

    @property
    def config(self) -> WorkflowConfig:
        """설정 객체를 반환합니다."""
        return self._config

    def get_manual_commands(self, mode: ExecutionMode) -> set[str]:
        """모드별 수동 실행이 필요한 명령어 집합을 반환합니다.

        Args:
            mode: 현재 실행 모드

        Returns:
            수동 실행이 필요한 명령어 집합 (예: {"approve", "done"})
        """
        mode_config = self._config.execution_modes.get(mode.value, {})
        return set(mode_config.get("manualCommands", []))

    def _get_workflow_name(self, category: str) -> str:
        """Task 카테고리에 해당하는 workflow 이름을 반환합니다.

        Args:
            category: Task 카테고리 (예: "development")

        Returns:
            워크플로우 이름
        """
        return self.CATEGORY_TO_WORKFLOW.get(category, "development")

    def get_next_command(
        self,
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
        """
        workflows = self._config.workflows
        execution_modes = self._config.execution_modes

        # 현재 모드의 workflowScope 확인
        mode_config = execution_modes.get(mode.value, {}) if mode else {}
        workflow_scope = mode_config.get("workflowScope", "transitions-only")
        stop_after_cmd = mode_config.get("stopAfterCommand")

        # test-only scope: 항상 "test" 명령 반환 (상태 변경 없음)
        if workflow_scope == "test-only":
            return "test"

        # Task 카테고리에 해당하는 workflow 찾기
        workflow_name = self._get_workflow_name(task.category.value)
        workflow = workflows.get(workflow_name, {})
        transitions = workflow.get("transitions", [])
        actions = workflow.get("actions", {})

        current_status = task.status.value

        # transition commands 집합 (action과 구분용)
        transition_commands = {t.get("command") for t in transitions}

        # actions 처리 (design-only 또는 full scope)
        if workflow_scope in ("design-only", "full"):
            state_actions = actions.get(current_status, [])

            if state_actions:
                next_action = self._get_next_action(
                    state_actions, last_action, transition_commands
                )

                if next_action:
                    # stopAfterCommand 체크 (design 모드에서 apply 후 멈춤 등)
                    if stop_after_cmd == next_action:
                        return next_action  # 이게 마지막 명령
                    return next_action

        # transition 반환
        for transition in transitions:
            if transition.get("from") == current_status:
                cmd = transition.get("command")
                # stopAfterCommand 체크
                if stop_after_cmd == cmd:
                    return cmd
                return cmd

        # transition 없으면 None 반환
        logger.debug(
            f"다음 명령 없음: {task.id} ({task.category.value}) "
            f"상태 {current_status}, last_action={last_action}"
        )
        return None

    def _get_next_action(
        self,
        state_actions: list[str],
        last_action: str | None,
        transition_commands: set[str | None],
    ) -> str | None:
        """현재 상태에서 다음 action을 결정합니다.

        Args:
            state_actions: 현재 상태의 action 목록
            last_action: 마지막으로 완료된 action
            transition_commands: transition 명령어 집합

        Returns:
            다음 action 또는 None
        """
        # last_action이 transition이면 → 새 상태 진입, 첫 번째 action 반환
        # last_action이 action이면 → 같은 상태, 다음 action 반환
        # last_action이 None이면 → 첫 번째 action 반환

        if last_action is None or last_action in transition_commands:
            # 새 상태 진입: 첫 번째 action
            return state_actions[0]

        # 같은 상태에서 action 완료: 다음 action 찾기
        try:
            idx = state_actions.index(last_action)
            if idx + 1 < len(state_actions):
                return state_actions[idx + 1]
            # 모든 actions 완료 → transition으로
            return None
        except ValueError:
            # last_action이 이 상태의 action이 아님 → 첫 번째 action
            return state_actions[0]

    def get_workflow_steps(self, mode: ExecutionMode) -> list[str]:
        """모드에 따른 기본 워크플로우 단계를 반환합니다.

        Note:
            이 메서드는 레거시 호환성을 위해 유지됩니다.
            실제 워크플로우는 workflows.json 기반으로 동작합니다.

        Args:
            mode: 현재 실행 모드

        Returns:
            워크플로우 명령어 리스트
        """
        # 레거시 하드코딩 (workflows.json이 없을 때 폴백)
        legacy_steps: dict[ExecutionMode, list[str]] = {
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
            ExecutionMode.TEST: ["test"],
        }
        return legacy_steps.get(mode, legacy_steps[ExecutionMode.QUICK])

    def has_transition(self, task: Task, mode: ExecutionMode | None = None) -> bool:
        """Task에 다음 transition이 있는지 확인합니다.

        Args:
            task: 대상 Task
            mode: 현재 실행 모드

        Returns:
            True: transition 있음
            False: transition 없음 (수동 완료 대상)
        """
        return self.get_next_command(task, mode) is not None

    def is_manual_command(self, command: str, mode: ExecutionMode) -> bool:
        """명령어가 수동 실행 대상인지 확인합니다.

        Args:
            command: 확인할 명령어
            mode: 현재 실행 모드

        Returns:
            True: 수동 실행 필요
            False: 자동 실행 가능
        """
        return command in self.get_manual_commands(mode)
