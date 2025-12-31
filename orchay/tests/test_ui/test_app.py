"""orchay TUI App 테스트.

테스트 케이스:
- TC-01-01: 헤더 기본 렌더링
- TC-01-02: 헤더 모드 표시
- TC-02-01: DataTable 기본 렌더링
- TC-02-02: Task 데이터 표시
- TC-02-03: 우선순위 정렬
- TC-03-01: Worker 목록 표시
- TC-03-02: Worker 상태별 색상
- TC-03-03: 현재 Task 표시
- TC-05-01: F-key 바인딩 표시
- TC-06-01: 모드 색상 적용
- TC-06-02: 모드 전환 시 색상 변경
- TC-07-01: Worker 상태 갱신
- TC-E2E-01: 전체 플로우
"""

import pytest
from textual.widgets import DataTable, Footer, Header

from orchay.models import (
    Config,
    Task,
    TaskCategory,
    TaskPriority,
    TaskStatus,
    Worker,
    WorkerState,
)
from orchay.ui.app import (
    HeaderInfo,
    OrchayApp,
    SchedulerStateIndicator,
    WorkerPanel,
)

# ============================================================
# TC-01: 헤더 위젯 테스트
# ============================================================


@pytest.mark.asyncio
async def test_header_renders() -> None:
    """TC-01-01: Header 위젯이 올바르게 렌더링되는지 확인."""
    app = OrchayApp()
    async with app.run_test():
        header = app.query_one(Header)
        assert header is not None
        # App title이 설정되어 있는지 확인
        assert "orchay" in app.TITLE.lower()


@pytest.mark.asyncio
async def test_header_shows_mode() -> None:
    """TC-01-02: 헤더에 현재 실행 모드가 표시되는지 확인."""
    app = OrchayApp(mode="quick")
    async with app.run_test():
        state_indicator = app.query_one("#scheduler-state", SchedulerStateIndicator)
        rendered = state_indicator.render()
        assert "quick" in str(rendered)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "mode,expected_color",
    [
        ("design", "#3b82f6"),
        ("quick", "#22c55e"),
        ("develop", "#8b5cf6"),
        ("force", "#f59e0b"),
    ],
)
async def test_mode_colors(mode: str, expected_color: str) -> None:
    """TC-06-01: 각 모드에 올바른 색상이 적용되는지 확인."""
    app = OrchayApp(mode=mode)
    async with app.run_test():
        app.query_one("#scheduler-state", SchedulerStateIndicator)
        assert SchedulerStateIndicator.MODE_COLORS.get(mode) == expected_color


# ============================================================
# TC-02: 스케줄 큐 테이블 테스트
# ============================================================


@pytest.mark.asyncio
async def test_queue_table_columns() -> None:
    """TC-02-01: DataTable이 올바른 컬럼으로 렌더링되는지 확인."""
    app = OrchayApp()
    async with app.run_test():
        table = app.query_one("#queue-table", DataTable)
        columns = [col.label.plain for col in table.columns.values()]
        assert "#" in columns
        assert "Task ID" in columns
        assert "Sts" in columns  # Status → Sts
        assert "Categ" in columns  # Category → Categ
        assert "Pri" in columns  # Priority → Pri
        assert "Title" in columns


@pytest.mark.asyncio
async def test_queue_table_data() -> None:
    """TC-02-02: Task 데이터가 올바르게 테이블에 표시되는지 확인."""
    tasks = [
        Task(
            id="TSK-01-01",
            title="Task 1",
            status=TaskStatus.TODO,
            category=TaskCategory.DEVELOPMENT,
            priority=TaskPriority.HIGH,
        ),
        Task(
            id="TSK-01-02",
            title="Task 2",
            status=TaskStatus.DETAIL_DESIGN,
            category=TaskCategory.DEVELOPMENT,
            priority=TaskPriority.MEDIUM,
        ),
        Task(
            id="TSK-02-01",
            title="Task 3",
            status=TaskStatus.TODO,
            category=TaskCategory.DEFECT,
            priority=TaskPriority.LOW,
        ),
    ]
    app = OrchayApp(tasks=tasks)
    async with app.run_test():
        table = app.query_one("#queue-table", DataTable)
        assert table.row_count == 3


@pytest.mark.asyncio
async def test_queue_priority_sorting() -> None:
    """TC-02-03: Task가 우선순위순으로 정렬되는지 확인."""
    tasks = [
        Task(
            id="TSK-LOW",
            title="Low",
            status=TaskStatus.TODO,
            category=TaskCategory.DEVELOPMENT,
            priority=TaskPriority.LOW,
        ),
        Task(
            id="TSK-CRITICAL",
            title="Critical",
            status=TaskStatus.TODO,
            category=TaskCategory.DEVELOPMENT,
            priority=TaskPriority.CRITICAL,
        ),
        Task(
            id="TSK-HIGH",
            title="High",
            status=TaskStatus.TODO,
            category=TaskCategory.DEVELOPMENT,
            priority=TaskPriority.HIGH,
        ),
    ]
    app = OrchayApp(tasks=tasks)
    async with app.run_test():
        table = app.query_one("#queue-table", DataTable)
        # 첫 번째 행이 critical이어야 함
        first_row = table.get_row_at(0)
        assert "TSK-CRITICAL" in str(first_row)


# ============================================================
# TC-03: Worker 상태 패널 테스트
# ============================================================


@pytest.mark.asyncio
async def test_worker_panel_shows_all_workers() -> None:
    """TC-03-01: Worker 패널에 모든 Worker가 표시되는지 확인."""
    worker_list = [
        Worker(id=1, pane_id=1, state=WorkerState.IDLE),
        Worker(id=2, pane_id=2, state=WorkerState.BUSY),
        Worker(id=3, pane_id=3, state=WorkerState.PAUSED),
    ]
    app = OrchayApp(worker_list=worker_list)
    async with app.run_test():
        panel = app.query_one("#workers-panel", WorkerPanel)
        content = str(panel.render())
        assert "Worker 1" in content
        assert "Worker 2" in content
        assert "Worker 3" in content


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "state,expected_color",
    [
        (WorkerState.IDLE, "#22c55e"),
        (WorkerState.BUSY, "#3b82f6"),
        (WorkerState.PAUSED, "#f59e0b"),
        (WorkerState.ERROR, "#ef4444"),
    ],
)
async def test_worker_state_colors(state: WorkerState, expected_color: str) -> None:
    """TC-03-02: Worker 상태에 따라 올바른 색상이 적용되는지 확인."""
    assert WorkerPanel.STATE_COLORS.get(state) == expected_color


@pytest.mark.asyncio
async def test_worker_current_task_display() -> None:
    """TC-03-03: busy 상태 Worker의 현재 Task가 표시되는지 확인."""
    worker_list = [
        Worker(
            id=1,
            pane_id=1,
            state=WorkerState.BUSY,
            current_task="TSK-01-01",
            current_step="build",
        ),
    ]
    app = OrchayApp(worker_list=worker_list)
    async with app.run_test():
        panel = app.query_one("#workers-panel", WorkerPanel)
        content = str(panel.render())
        assert "TSK-01-01" in content
        assert "build" in content


# ============================================================
# TC-05: 상태바 (Footer) 테스트
# ============================================================


@pytest.mark.asyncio
async def test_footer_shows_keybindings() -> None:
    """TC-05-01: Footer에 F-key 바인딩이 표시되는지 확인."""
    app = OrchayApp()
    async with app.run_test():
        footer = app.query_one(Footer)
        assert footer is not None
        # Footer에 바인딩이 설정되어 있는지 확인
        assert len(app.BINDINGS) > 0
        # F12, F10 바인딩 존재 확인
        binding_keys = [b.key for b in app.BINDINGS]
        assert "f12" in binding_keys
        assert "f10" in binding_keys


# ============================================================
# TC-06: 모드별 색상 표시 (추가)
# ============================================================


@pytest.mark.asyncio
async def test_mode_switch() -> None:
    """TC-06-02: 모드 전환 시 색상이 변경되는지 확인."""
    app = OrchayApp(mode="design")
    async with app.run_test() as pilot:
        # 초기 모드 확인
        assert app.mode == "design"

        # F7로 모드 전환
        await pilot.press("f7")
        assert app.mode == "quick"

        await pilot.press("f7")
        assert app.mode == "develop"


# ============================================================
# TC-07: 실시간 갱신 테스트
# ============================================================


@pytest.mark.asyncio
async def test_header_info_update() -> None:
    """TC-07-01: 헤더 정보가 업데이트되는지 확인."""
    app = OrchayApp()
    async with app.run_test():
        info = app.query_one("#header-info", HeaderInfo)

        # 정보 업데이트
        info.update_info(workers=5, queue_size=10, completed=3, total=15)

        rendered = str(info.render())
        assert "5" in rendered  # workers
        assert "10" in rendered  # queue_size


# ============================================================
# TC-E2E: End-to-End 테스트
# ============================================================


@pytest.mark.asyncio
async def test_full_flow() -> None:
    """TC-E2E-01: App 시작부터 종료까지 전체 플로우 확인."""
    tasks = [
        Task(
            id="TSK-01-01",
            title="Test Task",
            status=TaskStatus.TODO,
            category=TaskCategory.DEVELOPMENT,
            priority=TaskPriority.HIGH,
        ),
    ]
    worker_list = [
        Worker(id=1, pane_id=1, state=WorkerState.IDLE),
    ]

    app = OrchayApp(tasks=tasks, worker_list=worker_list)
    async with app.run_test() as pilot:
        # 초기 렌더링 확인
        assert app.query_one(Header)
        assert app.query_one("#queue-table", DataTable)
        assert app.query_one(Footer)

        # 상태 갱신 대기
        await pilot.pause(0.5)

        # F10으로 종료
        await pilot.press("f10")

        # 정상 종료 확인
        # Note: run_test context에서는 app.is_running 확인 불가


@pytest.mark.asyncio
async def test_reload_action() -> None:
    """F5 Reload 액션 테스트."""
    app = OrchayApp()
    async with app.run_test() as pilot:
        # F5로 리로드
        await pilot.press("f5")
        # 오류 없이 실행되면 성공


@pytest.mark.asyncio
async def test_pause_action() -> None:
    """F9 Pause 액션 테스트."""
    app = OrchayApp()
    async with app.run_test() as pilot:
        assert not app._paused

        # F9로 일시정지
        await pilot.press("f9")
        assert app._paused

        # 다시 F9로 재개
        await pilot.press("f9")
        assert not app._paused


# ============================================================
# TC-07-02: 큐 데이터 갱신 테스트
# ============================================================


@pytest.mark.asyncio
async def test_queue_data_refresh() -> None:
    """TC-07-02: Task 목록 변경 시 큐가 갱신되는지 확인."""
    initial_tasks = [
        Task(
            id="TSK-01-01",
            title="Initial Task",
            status=TaskStatus.TODO,
            category=TaskCategory.DEVELOPMENT,
            priority=TaskPriority.HIGH,
        ),
    ]
    app = OrchayApp(tasks=initial_tasks)
    async with app.run_test() as pilot:
        table = app.query_one("#queue-table", DataTable)
        assert table.row_count == 1

        # Task 목록 업데이트
        new_tasks = [
            Task(
                id="TSK-01-01",
                title="Initial Task",
                status=TaskStatus.TODO,
                category=TaskCategory.DEVELOPMENT,
                priority=TaskPriority.HIGH,
            ),
            Task(
                id="TSK-01-02",
                title="New Task",
                status=TaskStatus.TODO,
                category=TaskCategory.DEVELOPMENT,
                priority=TaskPriority.MEDIUM,
            ),
        ]
        app.tasks = new_tasks
        await pilot.pause(0.1)

        # 테이블 갱신 확인
        assert table.row_count == 2


# ============================================================
# TC-INT: 통합 테스트
# ============================================================


@pytest.mark.asyncio
async def test_scheduler_ui_integration() -> None:
    """TC-INT-01: 스케줄러 이벤트가 UI에 반영되는지 확인."""
    tasks = [
        Task(
            id="TSK-01-01",
            title="Test Task",
            status=TaskStatus.TODO,
            category=TaskCategory.DEVELOPMENT,
            priority=TaskPriority.HIGH,
        ),
    ]
    worker_list = [
        Worker(id=1, pane_id=1, state=WorkerState.IDLE),
    ]
    app = OrchayApp(tasks=tasks, worker_list=worker_list)
    async with app.run_test() as pilot:
        # 초기 상태 확인
        worker_panel = app.query_one("#workers-panel", WorkerPanel)
        assert "idle" in str(worker_panel.render()).lower()

        # Worker 상태 변경 (Task 분배 시뮬레이션)
        app.worker_list[0].state = WorkerState.BUSY
        app.worker_list[0].current_task = "TSK-01-01"
        app.worker_list[0].current_step = "build"
        app._update_worker_panel()
        await pilot.pause(0.1)

        # UI에 변경 반영 확인
        rendered = str(worker_panel.render())
        assert "busy" in rendered.lower()
        assert "TSK-01-01" in rendered


@pytest.mark.asyncio
async def test_config_ui_integration() -> None:
    """TC-INT-02: 설정 값이 UI에 올바르게 반영되는지 확인."""
    config = Config()  # 기본 설정 사용
    app = OrchayApp(config=config, mode="develop", project="test-project")
    async with app.run_test():
        # 모드 확인
        state_indicator = app.query_one("#scheduler-state", SchedulerStateIndicator)
        assert "develop" in str(state_indicator.render())

        # 프로젝트명 확인
        header_info = app.query_one("#header-info", HeaderInfo)
        assert "test-project" in str(header_info.render())


@pytest.mark.asyncio
async def test_empty_queue_display() -> None:
    """빈 큐 상태에서의 표시 확인."""
    app = OrchayApp(tasks=[])
    async with app.run_test():
        table = app.query_one("#queue-table", DataTable)
        assert table.row_count == 0


@pytest.mark.asyncio
async def test_no_workers_display() -> None:
    """Worker가 없는 상태에서의 표시 확인."""
    app = OrchayApp(worker_list=[])
    async with app.run_test():
        panel = app.query_one("#workers-panel", WorkerPanel)
        content = str(panel.render())
        assert "No workers available" in content


@pytest.mark.asyncio
async def test_action_show_status() -> None:
    """F2 상태 표시 액션 테스트."""
    tasks = [
        Task(
            id="TSK-01-01",
            title="Done Task",
            status=TaskStatus.DONE,
            category=TaskCategory.DEVELOPMENT,
            priority=TaskPriority.HIGH,
        ),
        Task(
            id="TSK-01-02",
            title="Todo Task",
            status=TaskStatus.TODO,
            category=TaskCategory.DEVELOPMENT,
            priority=TaskPriority.MEDIUM,
        ),
    ]
    worker_list = [
        Worker(id=1, pane_id=1, state=WorkerState.BUSY),
    ]
    app = OrchayApp(tasks=tasks, worker_list=worker_list, mode="quick")
    async with app.run_test() as pilot:
        # F2로 상태 표시 (notify 발생)
        await pilot.press("f2")
        # 오류 없이 실행되면 성공


@pytest.mark.asyncio
async def test_action_show_queue() -> None:
    """F3 큐 정보 표시 액션 테스트."""
    tasks = [
        Task(
            id="TSK-01-01",
            title="Task",
            status=TaskStatus.TODO,
            category=TaskCategory.DEVELOPMENT,
            priority=TaskPriority.HIGH,
        ),
    ]
    app = OrchayApp(tasks=tasks)
    async with app.run_test() as pilot:
        await pilot.press("f3")
        # 오류 없이 실행되면 성공


@pytest.mark.asyncio
async def test_action_worker_select() -> None:
    """Worker 선택 테스트 (화살표 키)."""
    worker_list = [
        Worker(id=1, pane_id=1, state=WorkerState.IDLE),
        Worker(id=2, pane_id=2, state=WorkerState.BUSY),
    ]
    app = OrchayApp(worker_list=worker_list)
    async with app.run_test() as pilot:
        await pilot.press("down")
        await pilot.press("up")
        # 오류 없이 실행되면 성공


@pytest.mark.asyncio
async def test_action_show_help() -> None:
    """F1 도움말 표시 액션 테스트."""
    app = OrchayApp()
    async with app.run_test() as pilot:
        await pilot.press("f1")
        # 오류 없이 실행되면 성공
