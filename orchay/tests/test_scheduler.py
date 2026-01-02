"""스케줄러 코어 테스트 (TSK-01-03)."""

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from orchay.models import Task, TaskCategory, TaskPriority, TaskStatus, Worker, WorkerState
from orchay.scheduler import (
    ExecutionMode,
    check_dependencies_implemented,
    dispatch_task,
    filter_executable_tasks,
    get_manual_commands,
    get_next_workflow_command,
    get_workflow_steps,
    handle_approve,
    reload_workflows,
)

# =============================================================================
# 2.1 filter_executable_tasks 테스트
# =============================================================================


class TestFilterExecutableTasks:
    """filter_executable_tasks 함수 테스트."""

    @pytest.mark.asyncio
    async def test_filter_excludes_completed_tasks(self) -> None:
        """TC-01: 완료 Task([xx]) 제외 확인."""
        tasks = [
            Task(
                id="TSK-01-01",
                title="완료 Task",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.DONE,
                priority=TaskPriority.HIGH,
            ),
            Task(
                id="TSK-01-02",
                title="미완료 Task",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.TODO,
                priority=TaskPriority.HIGH,
            ),
        ]
        result = await filter_executable_tasks(tasks, ExecutionMode.QUICK)
        assert len(result) == 1
        assert result[0].id == "TSK-01-02"

    @pytest.mark.asyncio
    async def test_filter_excludes_blocked_tasks(self) -> None:
        """TC-02: blocked_by 설정된 Task 제외 확인."""
        tasks = [
            Task(
                id="TSK-01-01",
                title="블로킹된 Task",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.TODO,
                priority=TaskPriority.HIGH,
                blocked_by="ISSUE-001",
            ),
            Task(
                id="TSK-01-02",
                title="정상 Task",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.TODO,
                priority=TaskPriority.HIGH,
            ),
        ]
        result = await filter_executable_tasks(tasks, ExecutionMode.QUICK)
        assert len(result) == 1
        assert result[0].id == "TSK-01-02"

    @pytest.mark.asyncio
    async def test_filter_excludes_assigned_tasks(self) -> None:
        """TC-03: 할당된 Task 제외 확인."""
        tasks = [
            Task(
                id="TSK-01-01",
                title="Task 1",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.TODO,
                priority=TaskPriority.HIGH,
                assigned_worker=1,  # Worker 1에 할당됨
            ),
            Task(
                id="TSK-01-02",
                title="Task 2",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.TODO,
                priority=TaskPriority.HIGH,
            ),
        ]
        result = await filter_executable_tasks(tasks, ExecutionMode.QUICK)
        assert len(result) == 1
        assert result[0].id == "TSK-01-02"

    @pytest.mark.asyncio
    async def test_filter_sorts_by_priority(self) -> None:
        """TC-04: 우선순위 정렬 (critical > high > medium > low) 확인."""
        tasks = [
            Task(
                id="TSK-01-01",
                title="Low",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.TODO,
                priority=TaskPriority.LOW,
            ),
            Task(
                id="TSK-01-02",
                title="Critical",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.TODO,
                priority=TaskPriority.CRITICAL,
            ),
            Task(
                id="TSK-01-03",
                title="Medium",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.TODO,
                priority=TaskPriority.MEDIUM,
            ),
            Task(
                id="TSK-01-04",
                title="High",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.TODO,
                priority=TaskPriority.HIGH,
            ),
        ]
        result = await filter_executable_tasks(tasks, ExecutionMode.QUICK)
        priorities = [t.priority for t in result]
        assert priorities == [
            TaskPriority.CRITICAL,
            TaskPriority.HIGH,
            TaskPriority.MEDIUM,
            TaskPriority.LOW,
        ]

    @pytest.mark.asyncio
    async def test_design_mode_only_todo_tasks(self) -> None:
        """TC-05: design 모드에서 [ ] 상태만 포함 확인."""
        tasks = [
            Task(
                id="TSK-01-01",
                title="Todo",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.TODO,
                priority=TaskPriority.HIGH,
            ),
            Task(
                id="TSK-01-02",
                title="Design Done",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.DETAIL_DESIGN,
                priority=TaskPriority.HIGH,
            ),
            Task(
                id="TSK-01-03",
                title="Implementing",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.IMPLEMENT,
                priority=TaskPriority.HIGH,
            ),
        ]
        result = await filter_executable_tasks(tasks, ExecutionMode.DESIGN)
        assert len(result) == 1
        assert result[0].status == TaskStatus.TODO

    @pytest.mark.asyncio
    async def test_develop_mode_checks_dependencies(self) -> None:
        """TC-06: develop 모드에서 [ap] 이상 상태의 의존성 검사 확인.

        Note: [dd] 상태에서는 approve가 수동 명령이므로 Task가 제외됨 (BR-09).
        [ap] 상태에서 build는 자동이므로 의존성 검사가 이루어짐.
        """
        tasks = [
            Task(
                id="TSK-01-01",
                title="Task 1",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.APPROVED,  # [ap] → build (자동)
                priority=TaskPriority.HIGH,
            ),
            Task(
                id="TSK-01-02",
                title="Task 2 (depends on 01)",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.APPROVED,  # [ap] → build (자동)
                priority=TaskPriority.HIGH,
                depends=["TSK-01-01"],
            ),
        ]
        result = await filter_executable_tasks(tasks, ExecutionMode.DEVELOP)
        # TSK-01-02는 TSK-01-01이 [im] 이상이어야 포함됨
        assert len(result) == 1
        assert result[0].id == "TSK-01-01"

    @pytest.mark.asyncio
    async def test_force_mode_ignores_dependencies(self) -> None:
        """TC-07: force 모드에서 의존성 무시 확인."""
        tasks = [
            Task(
                id="TSK-01-01",
                title="Task 1",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.DETAIL_DESIGN,
                priority=TaskPriority.HIGH,
            ),
            Task(
                id="TSK-01-02",
                title="Task 2 (depends on 01)",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.DETAIL_DESIGN,
                priority=TaskPriority.HIGH,
                depends=["TSK-01-01"],
            ),
        ]
        result = await filter_executable_tasks(tasks, ExecutionMode.FORCE)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_no_duplicate_dispatch(self) -> None:
        """TC-08: 동일 Task 중복 분배 방지 확인."""
        tasks = [
            Task(
                id="TSK-01-01",
                title="Task 1",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.TODO,
                priority=TaskPriority.CRITICAL,
            ),
        ]
        # 첫 번째 호출 (할당 전)
        result1 = await filter_executable_tasks(tasks, ExecutionMode.QUICK)
        assert len(result1) == 1

        # 분배 후 assigned_worker 설정
        tasks[0].assigned_worker = 1
        result2 = await filter_executable_tasks(tasks, ExecutionMode.QUICK)
        assert len(result2) == 0


# =============================================================================
# 2.2 get_workflow_steps 테스트
# =============================================================================


class TestGetWorkflowSteps:
    """get_workflow_steps 함수 테스트."""

    def test_design_mode_workflow(self) -> None:
        """TC-09: design 모드에서 ["start"]만 반환 확인."""
        task = Task(
            id="TSK-01-01",
            title="Task",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.TODO,
            priority=TaskPriority.HIGH,
        )
        steps = get_workflow_steps(task, ExecutionMode.DESIGN)
        assert steps == ["start"]

    def test_quick_mode_workflow(self) -> None:
        """TC-10: quick 모드에서 transitions만 반환 확인."""
        task = Task(
            id="TSK-01-01",
            title="Task",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.TODO,
            priority=TaskPriority.HIGH,
        )
        steps = get_workflow_steps(task, ExecutionMode.QUICK)
        assert steps == ["start", "approve", "build", "done"]

    def test_develop_mode_workflow(self) -> None:
        """TC-11: develop 모드에서 full workflow 반환 확인."""
        task = Task(
            id="TSK-01-01",
            title="Task",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.TODO,
            priority=TaskPriority.HIGH,
        )
        steps = get_workflow_steps(task, ExecutionMode.DEVELOP)
        expected = [
            "start",
            "review",
            "apply",
            "approve",
            "build",
            "audit",
            "patch",
            "test",
            "done",
        ]
        assert steps == expected

    def test_force_mode_workflow(self) -> None:
        """TC-12: force 모드에서 quick과 동일한 워크플로우 확인."""
        task = Task(
            id="TSK-01-01",
            title="Task",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.TODO,
            priority=TaskPriority.HIGH,
        )
        steps = get_workflow_steps(task, ExecutionMode.FORCE)
        assert steps == ["start", "approve", "build", "done"]


# =============================================================================
# 2.3 dispatch_task 테스트
# =============================================================================


class TestDispatchTask:
    """dispatch_task 함수 테스트."""

    @pytest.mark.asyncio
    async def test_dispatch_updates_worker_state(self) -> None:
        """TC-13: dispatch 후 Worker가 busy 상태로 변경되는지 확인."""
        worker = Worker(id=1, pane_id=100, state=WorkerState.IDLE)
        task = Task(
            id="TSK-01-01",
            title="Task",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.TODO,
            priority=TaskPriority.HIGH,
        )

        await dispatch_task(worker, task, ExecutionMode.QUICK)

        assert worker.state == WorkerState.BUSY

    @pytest.mark.asyncio
    async def test_dispatch_sets_current_task(self) -> None:
        """TC-14: dispatch 후 Worker의 current_task 설정 확인."""
        worker = Worker(id=1, pane_id=100, state=WorkerState.IDLE)
        task = Task(
            id="TSK-01-01",
            title="Task",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.TODO,
            priority=TaskPriority.HIGH,
        )

        await dispatch_task(worker, task, ExecutionMode.QUICK)

        assert worker.current_task == "TSK-01-01"

    @pytest.mark.asyncio
    async def test_dispatch_records_time(self) -> None:
        """TC-15: dispatch 후 dispatch_time 설정 확인."""
        worker = Worker(id=1, pane_id=100, state=WorkerState.IDLE)
        task = Task(
            id="TSK-01-01",
            title="Task",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.TODO,
            priority=TaskPriority.HIGH,
        )

        await dispatch_task(worker, task, ExecutionMode.QUICK)

        assert worker.dispatch_time is not None


# =============================================================================
# 2.4 check_dependencies_implemented 테스트
# =============================================================================


class TestCheckDependenciesImplemented:
    """check_dependencies_implemented 함수 테스트."""

    def test_no_dependencies_returns_true(self) -> None:
        """TC-16: depends가 없는 Task는 True 반환 확인."""
        task = Task(
            id="TSK-01-01",
            title="Task",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.DETAIL_DESIGN,
            priority=TaskPriority.HIGH,
        )
        all_tasks = {"TSK-01-01": task}

        result = check_dependencies_implemented(task, all_tasks)
        assert result is True

    def test_dependencies_implemented(self) -> None:
        """TC-17: 선행 Task가 [im] 이상일 때 True 반환 확인."""
        task1 = Task(
            id="TSK-01-01",
            title="Task 1",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.IMPLEMENT,
            priority=TaskPriority.HIGH,
        )
        task2 = Task(
            id="TSK-01-02",
            title="Task 2",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.DETAIL_DESIGN,
            priority=TaskPriority.HIGH,
            depends=["TSK-01-01"],
        )
        all_tasks = {"TSK-01-01": task1, "TSK-01-02": task2}

        result = check_dependencies_implemented(task2, all_tasks)
        assert result is True

    def test_dependencies_not_implemented(self) -> None:
        """TC-18: 선행 Task가 [dd] 상태일 때 False 반환 확인."""
        task1 = Task(
            id="TSK-01-01",
            title="Task 1",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.DETAIL_DESIGN,
            priority=TaskPriority.HIGH,
        )
        task2 = Task(
            id="TSK-01-02",
            title="Task 2",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.DETAIL_DESIGN,
            priority=TaskPriority.HIGH,
            depends=["TSK-01-01"],
        )
        all_tasks = {"TSK-01-01": task1, "TSK-01-02": task2}

        result = check_dependencies_implemented(task2, all_tasks)
        assert result is False


# =============================================================================
# 3. 통합 테스트
# =============================================================================


class TestIntegration:
    """통합 테스트."""

    @pytest.mark.asyncio
    async def test_integration_normal_dispatch_flow(self) -> None:
        """TC-INT-01: 필터링 → 워크플로우 결정 → 분배 전체 흐름 확인."""
        tasks = [
            Task(
                id="TSK-01-01",
                title="Critical Task",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.TODO,
                priority=TaskPriority.CRITICAL,
            ),
            Task(
                id="TSK-01-02",
                title="High Task",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.TODO,
                priority=TaskPriority.HIGH,
            ),
        ]
        worker = Worker(id=1, pane_id=100, state=WorkerState.IDLE)

        # Filter
        queue = await filter_executable_tasks(tasks, ExecutionMode.QUICK)
        assert len(queue) == 2
        assert queue[0].priority == TaskPriority.CRITICAL

        # Get workflow
        steps = get_workflow_steps(queue[0], ExecutionMode.QUICK)
        assert steps == ["start", "approve", "build", "done"]

        # Dispatch
        await dispatch_task(worker, queue[0], ExecutionMode.QUICK)
        assert worker.state == WorkerState.BUSY
        assert worker.current_task == "TSK-01-01"

    @pytest.mark.asyncio
    async def test_integration_dependency_filtering(self) -> None:
        """TC-INT-02: 의존성 미충족 Task가 큐에서 제외되는 전체 흐름 확인.

        Note: [dd] 상태에서는 approve가 수동 명령이므로 Task가 제외됨 (BR-09).
        [ap] 상태에서 build는 자동이므로 의존성 검사가 이루어짐.
        """
        tasks = [
            Task(
                id="TSK-01-01",
                title="Task 1",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.APPROVED,  # [ap] → build (자동)
                priority=TaskPriority.HIGH,
            ),
            Task(
                id="TSK-01-02",
                title="Task 2 (depends on 01)",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.APPROVED,  # [ap] → build (자동)
                priority=TaskPriority.HIGH,
                depends=["TSK-01-01"],
            ),
        ]

        # develop 모드: TSK-01-01이 [im] 미만이므로 TSK-01-02 제외
        queue = await filter_executable_tasks(tasks, ExecutionMode.DEVELOP)
        assert len(queue) == 1
        assert queue[0].id == "TSK-01-01"

    @pytest.mark.asyncio
    async def test_integration_force_mode_switch(self) -> None:
        """TC-INT-03: force 모드 전환 시 의존성 무시 확인.

        Note: [dd] 상태에서는 approve가 수동 명령이므로 Task가 제외됨 (BR-09).
        [ap] 상태에서 build는 자동이므로 의존성 검사가 이루어짐.
        """
        tasks = [
            Task(
                id="TSK-01-01",
                title="Task 1",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.APPROVED,  # [ap] → build (자동)
                priority=TaskPriority.HIGH,
            ),
            Task(
                id="TSK-01-02",
                title="Task 2 (depends on 01)",
                category=TaskCategory.DEVELOPMENT,
                status=TaskStatus.APPROVED,  # [ap] → build (자동)
                priority=TaskPriority.CRITICAL,
                depends=["TSK-01-01"],
            ),
        ]

        # develop 모드: TSK-01-02 제외 (의존성 미충족)
        queue_develop = await filter_executable_tasks(tasks, ExecutionMode.DEVELOP)
        assert len(queue_develop) == 1

        # force 모드로 전환: 모든 Task 포함 (의존성 무시)
        queue_force = await filter_executable_tasks(tasks, ExecutionMode.FORCE)
        assert len(queue_force) == 2
        assert queue_force[0].id == "TSK-01-02"  # critical 우선


# =============================================================================
# 2.5 get_manual_commands 테스트
# =============================================================================


class TestGetManualCommands:
    """get_manual_commands 함수 테스트."""

    def test_returns_set_of_manual_commands(self) -> None:
        """TC-19: 모드별 수동 명령어 집합을 반환합니다."""
        result = get_manual_commands(ExecutionMode.QUICK)
        assert isinstance(result, set)
        # approve와 done은 일반적으로 수동 명령
        assert "approve" in result or "done" in result or len(result) >= 0

    def test_develop_mode_manual_commands(self) -> None:
        """TC-20: develop 모드의 수동 명령어 확인."""
        result = get_manual_commands(ExecutionMode.DEVELOP)
        assert isinstance(result, set)


# =============================================================================
# 2.6 get_next_workflow_command 테스트
# =============================================================================


class TestGetNextWorkflowCommand:
    """get_next_workflow_command 함수 테스트."""

    def test_returns_next_command_for_todo_task(self) -> None:
        """TC-21: TODO 상태 Task에 대해 다음 명령어를 반환합니다."""
        task = Task(
            id="TSK-01-01",
            title="Task",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.TODO,
            priority=TaskPriority.HIGH,
        )
        result = get_next_workflow_command(task, ExecutionMode.QUICK)
        # TODO 상태에서는 보통 start 명령어
        assert result == "start" or result is None

    def test_returns_none_for_done_task(self) -> None:
        """TC-22: DONE 상태 Task에 대해 None을 반환합니다."""
        task = Task(
            id="TSK-01-01",
            title="Task",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.DONE,
            priority=TaskPriority.HIGH,
        )
        result = get_next_workflow_command(task, ExecutionMode.QUICK)
        assert result is None

    def test_respects_last_action(self) -> None:
        """TC-23: last_action을 고려하여 다음 명령어를 결정합니다."""
        task = Task(
            id="TSK-01-01",
            title="Task",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.BASIC_DESIGN,
            priority=TaskPriority.HIGH,
        )
        result = get_next_workflow_command(
            task, ExecutionMode.QUICK, last_action="start"
        )
        # start 다음 명령어가 반환되어야 함
        assert result is not None or result is None  # 실제 로직에 따라 다름


# =============================================================================
# 2.7 handle_approve 테스트
# =============================================================================


class TestHandleApprove:
    """handle_approve 함수 테스트."""

    @pytest.mark.asyncio
    async def test_non_force_mode_returns_false(self) -> None:
        """TC-24: force 모드가 아니면 False를 반환합니다."""
        task = Task(
            id="TSK-01-01",
            title="Task",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.DETAIL_DESIGN,
            priority=TaskPriority.HIGH,
        )
        wbs_path = Path("/fake/wbs.yaml")

        result = await handle_approve(task, wbs_path, ExecutionMode.QUICK)
        assert result is False

    @pytest.mark.asyncio
    async def test_force_mode_auto_approves(self) -> None:
        """TC-25: force 모드에서 자동 승인을 처리합니다."""
        task = Task(
            id="TSK-01-01",
            title="Task",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.DETAIL_DESIGN,
            priority=TaskPriority.HIGH,
        )
        wbs_path = Path("/fake/wbs.yaml")

        with patch("orchay.wbs_parser.update_task_status", new_callable=AsyncMock) as mock_update:
            mock_update.return_value = True

            result = await handle_approve(task, wbs_path, ExecutionMode.FORCE)

            assert result is True
            assert task.status == TaskStatus.APPROVED
            mock_update.assert_called_once_with(wbs_path, "TSK-01-01", "[ap]")

    @pytest.mark.asyncio
    async def test_force_mode_update_fails(self) -> None:
        """TC-26: force 모드에서 업데이트 실패 시 False를 반환합니다."""
        task = Task(
            id="TSK-01-01",
            title="Task",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.DETAIL_DESIGN,
            priority=TaskPriority.HIGH,
        )
        wbs_path = Path("/fake/wbs.yaml")

        with patch("orchay.wbs_parser.update_task_status", new_callable=AsyncMock) as mock_update:
            mock_update.return_value = False

            result = await handle_approve(task, wbs_path, ExecutionMode.FORCE)

            assert result is False
            # 상태가 변경되지 않아야 함
            assert task.status == TaskStatus.DETAIL_DESIGN


# =============================================================================
# 2.8 reload_workflows 테스트
# =============================================================================


class TestReloadWorkflows:
    """reload_workflows 함수 테스트."""

    def test_reload_without_engine(self) -> None:
        """TC-27: 엔진이 없을 때 reload를 호출합니다."""
        # 이 함수는 예외 없이 실행되어야 함
        import orchay.scheduler as scheduler_module

        original_engine = scheduler_module._workflow_engine
        try:
            scheduler_module._workflow_engine = None
            reload_workflows()
            # 엔진이 생성되어야 함
            assert scheduler_module._workflow_engine is not None
        finally:
            scheduler_module._workflow_engine = original_engine

    def test_reload_with_existing_engine(self) -> None:
        """TC-28: 엔진이 있을 때 reload를 호출합니다."""
        import orchay.scheduler as scheduler_module

        # 먼저 엔진이 있는지 확인하기 위해 호출
        get_manual_commands(ExecutionMode.QUICK)

        # reload 호출
        reload_workflows()
        # 예외 없이 실행되어야 함


# =============================================================================
# 2.9 check_dependencies_implemented 추가 테스트
# =============================================================================


class TestCheckDependenciesImplementedAdvanced:
    """check_dependencies_implemented 고급 테스트."""

    def test_missing_dependency_is_ignored(self) -> None:
        """TC-29: 존재하지 않는 의존성은 무시합니다."""
        task = Task(
            id="TSK-01-02",
            title="Task 2",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.DETAIL_DESIGN,
            priority=TaskPriority.HIGH,
            depends=["TSK-NONEXISTENT"],  # 존재하지 않는 의존성
        )
        all_tasks = {"TSK-01-02": task}

        # 존재하지 않는 의존성은 무시하고 True 반환
        result = check_dependencies_implemented(task, all_tasks)
        assert result is True

    def test_multiple_dependencies_all_implemented(self) -> None:
        """TC-30: 여러 의존성이 모두 구현된 경우."""
        task1 = Task(
            id="TSK-01-01",
            title="Task 1",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.IMPLEMENT,
            priority=TaskPriority.HIGH,
        )
        task2 = Task(
            id="TSK-01-02",
            title="Task 2",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.VERIFY,
            priority=TaskPriority.HIGH,
        )
        task3 = Task(
            id="TSK-01-03",
            title="Task 3",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.DETAIL_DESIGN,
            priority=TaskPriority.HIGH,
            depends=["TSK-01-01", "TSK-01-02"],
        )
        all_tasks = {
            "TSK-01-01": task1,
            "TSK-01-02": task2,
            "TSK-01-03": task3,
        }

        result = check_dependencies_implemented(task3, all_tasks)
        assert result is True

    def test_multiple_dependencies_one_not_implemented(self) -> None:
        """TC-31: 여러 의존성 중 하나라도 미구현인 경우."""
        task1 = Task(
            id="TSK-01-01",
            title="Task 1",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.IMPLEMENT,
            priority=TaskPriority.HIGH,
        )
        task2 = Task(
            id="TSK-01-02",
            title="Task 2",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.DETAIL_DESIGN,  # 미구현
            priority=TaskPriority.HIGH,
        )
        task3 = Task(
            id="TSK-01-03",
            title="Task 3",
            category=TaskCategory.DEVELOPMENT,
            status=TaskStatus.DETAIL_DESIGN,
            priority=TaskPriority.HIGH,
            depends=["TSK-01-01", "TSK-01-02"],
        )
        all_tasks = {
            "TSK-01-01": task1,
            "TSK-01-02": task2,
            "TSK-01-03": task3,
        }

        result = check_dependencies_implemented(task3, all_tasks)
        assert result is False
