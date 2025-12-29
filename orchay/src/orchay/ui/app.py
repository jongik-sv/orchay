"""orchay TUI 메인 App.

Textual 프레임워크 기반 터미널 UI 구현.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, ClassVar

from rich.text import Text

if TYPE_CHECKING:
    from orchay.main import Orchestrator
from textual.app import App, ComposeResult
from textual.binding import Binding, BindingType
from textual.containers import Container, Horizontal, Vertical
from textual.widgets import DataTable, Footer, Header, Input, Static

from orchay.command import CommandHandler
from orchay.models import Config, Task, TaskStatus, Worker, WorkerState
from orchay.ui.widgets import HelpModal, QueueWidget
from orchay.utils.active_tasks import (
    pause_worker,
    resume_worker,
    set_scheduler_state,
)


class SchedulerStateIndicator(Static):
    """스케줄러 상태 표시 위젯."""

    # 상태별 색상
    STATE_COLORS: ClassVar[dict[str, str]] = {
        "running": "#22c55e",  # green
        "paused": "#f59e0b",  # yellow
        "stopped": "#ef4444",  # red
    }

    # 상태별 아이콘
    STATE_ICONS: ClassVar[dict[str, str]] = {
        "running": "▶",
        "paused": "⏸",
        "stopped": "⏹",
    }

    # 모드별 색상
    MODE_COLORS: ClassVar[dict[str, str]] = {
        "design": "#3b82f6",
        "quick": "#22c55e",
        "develop": "#8b5cf6",
        "force": "#f59e0b",
    }

    def __init__(self, state: str = "running", mode: str = "quick", project: str = "") -> None:
        super().__init__()
        self._state = state
        self._mode = mode
        self._project = project
        self.id = "scheduler-state"

    @property
    def state(self) -> str:
        """현재 스케줄러 상태."""
        return self._state

    @state.setter
    def state(self, value: str) -> None:
        self._state = value
        self.refresh()

    @property
    def mode(self) -> str:
        """현재 모드."""
        return self._mode

    @mode.setter
    def mode(self, value: str) -> None:
        self._mode = value
        self.refresh()

    @property
    def project(self) -> str:
        """현재 프로젝트."""
        return self._project

    @project.setter
    def project(self, value: str) -> None:
        self._project = value
        self.refresh()

    def render(self) -> Text:
        """스케줄러 상태 렌더링."""
        state_color = self.STATE_COLORS.get(self._state, "#6b7280")
        mode_color = self.MODE_COLORS.get(self._mode, "#6b7280")
        icon = self.STATE_ICONS.get(self._state, "?")

        text = Text()
        text.append(f"{icon} {self._state.upper()}", style=state_color)
        text.append(" | ", style="#6b7280")
        text.append(self._mode, style=mode_color)
        if self._project:
            text.append(" | ", style="#6b7280")
            text.append(self._project, style="#ffffff")
        return text


class ModeIndicator(Static):
    """실행 모드 표시 위젯."""

    # 모드별 색상 (workflows.json 참조)
    MODE_COLORS: ClassVar[dict[str, str]] = {
        "design": "#3b82f6",
        "quick": "#22c55e",
        "develop": "#8b5cf6",
        "force": "#f59e0b",
    }

    def __init__(self, mode: str = "quick") -> None:
        super().__init__()
        self._mode = mode
        self.id = "mode-indicator"

    @property
    def mode(self) -> str:
        """현재 모드."""
        return self._mode

    @mode.setter
    def mode(self, value: str) -> None:
        self._mode = value
        self.refresh()

    def render(self) -> Text:
        """모드 렌더링."""
        color = self.MODE_COLORS.get(self._mode, "#6b7280")
        return Text(f"[MODE: {self._mode}]", style=color)


class HeaderInfo(Static):
    """헤더 정보 위젯."""

    def __init__(
        self,
        project: str = "orchay",
        workers: int = 0,
        queue_size: int = 0,
        completed: int = 0,
        total: int = 0,
    ) -> None:
        super().__init__()
        self.project = project
        self.workers_count = workers
        self.queue_size = queue_size
        self.completed = completed
        self.total = total
        self.id = "header-info"

    def update_info(
        self,
        workers: int | None = None,
        queue_size: int | None = None,
        completed: int | None = None,
        total: int | None = None,
    ) -> None:
        """정보 업데이트."""
        if workers is not None:
            self.workers_count = workers
        if queue_size is not None:
            self.queue_size = queue_size
        if completed is not None:
            self.completed = completed
        if total is not None:
            self.total = total
        self.refresh()

    def render(self) -> Text:
        """헤더 정보 렌더링."""
        return Text(
            f"Project: {self.project} | Workers: {self.workers_count} | "
            f"Queue: {self.queue_size} | Completed: {self.completed}/{self.total}"
        )


class WorkerPanel(Static):
    """Worker 상태 패널 (선택 및 제어 기능 포함)."""

    # 상태별 색상
    STATE_COLORS: ClassVar[dict[WorkerState, str]] = {
        WorkerState.IDLE: "#22c55e",
        WorkerState.BUSY: "#3b82f6",
        WorkerState.PAUSED: "#f59e0b",
        WorkerState.ERROR: "#ef4444",
        WorkerState.BLOCKED: "#8b5cf6",
        WorkerState.DEAD: "#6b7280",
        WorkerState.DONE: "#10b981",
    }

    # 상태별 아이콘
    STATE_ICONS: ClassVar[dict[WorkerState, str]] = {
        WorkerState.IDLE: "●",
        WorkerState.BUSY: "◐",
        WorkerState.PAUSED: "⏸",
        WorkerState.ERROR: "✗",
        WorkerState.BLOCKED: "⊘",
        WorkerState.DEAD: "○",
        WorkerState.DONE: "✓",
    }

    def __init__(self) -> None:
        super().__init__()
        self._worker_list: list[Worker] = []
        self._selected_index: int = 0
        self._interactive: bool = False  # 인터랙티브 모드 여부
        self.id = "workers-panel"

    @property
    def selected_worker(self) -> Worker | None:
        """현재 선택된 Worker."""
        if 0 <= self._selected_index < len(self._worker_list):
            return self._worker_list[self._selected_index]
        return None

    @property
    def interactive(self) -> bool:
        """인터랙티브 모드 여부."""
        return self._interactive

    @interactive.setter
    def interactive(self, value: bool) -> None:
        self._interactive = value
        self.refresh()

    def set_workers(self, worker_list: list[Worker]) -> None:
        """Worker 목록 설정."""
        self._worker_list = worker_list
        self._selected_index = min(self._selected_index, max(0, len(worker_list) - 1))
        self.refresh()

    def select_prev(self) -> None:
        """이전 Worker 선택."""
        if self._selected_index > 0:
            self._selected_index -= 1
            self.refresh()

    def select_next(self) -> None:
        """다음 Worker 선택."""
        if self._selected_index < len(self._worker_list) - 1:
            self._selected_index += 1
            self.refresh()

    def select_by_id(self, worker_id: int) -> bool:
        """Worker ID로 선택.

        Args:
            worker_id: Worker ID (1, 2, 3...)

        Returns:
            선택 성공 여부
        """
        for i, w in enumerate(self._worker_list):
            if w.id == worker_id:
                self._selected_index = i
                self.refresh()
                return True
        return False

    def render(self) -> Text:
        """Worker 패널 렌더링."""
        if not self._worker_list:
            return Text("No workers available", style="dim")

        lines: list[Text] = []

        # 헤더 (인터랙티브 모드일 때만)
        if self._interactive:
            lines.append(Text("  Workers (↑↓: 선택  P: Pause/Resume  ESC: 닫기)\n", style="dim"))

        for i, w in enumerate(self._worker_list):
            is_selected = self._interactive and i == self._selected_index
            color = self.STATE_COLORS.get(w.state, "#6b7280")
            icon = self.STATE_ICONS.get(w.state, "?")

            # 수동 일시정지 표시
            manual_pause_marker = " 🛑" if w.is_manually_paused else ""

            # Worker 정보 라인
            task_info = f"{w.current_task} ({w.current_step})" if w.current_task else "-"
            status_text = self._get_status_text(w)

            line = Text()
            prefix = "  ▶ " if is_selected else "    "
            line.append(prefix)
            line.append(f"Worker {w.id}  ", style="bold cyan" if is_selected else "bold")
            line.append(f"{icon}  ", style=color)
            line.append(f"{w.state.value:8}", style=color)
            line.append(manual_pause_marker, style="#ef4444")
            line.append(f"  {task_info:20}  ", style="white")
            line.append(status_text, style="dim")

            if is_selected:
                line.stylize("reverse")

            lines.append(line)

        result = Text()
        for i, line in enumerate(lines):
            result.append_text(line)
            if i < len(lines) - 1:
                result.append("\n")

        return result

    def _get_status_text(self, worker: Worker) -> str:
        """Worker 상태 텍스트 생성."""
        # 수동 일시정지 상태 우선 표시
        if worker.is_manually_paused:
            return "Manually paused (P to resume)"
        if worker.state == WorkerState.IDLE:
            return "Ready for next task"
        elif worker.state == WorkerState.PAUSED:
            return "Rate limit - waiting..."
        elif worker.state == WorkerState.ERROR:
            return "Error occurred"
        elif worker.state == WorkerState.BLOCKED:
            return "Waiting for input"
        elif worker.state == WorkerState.DEAD:
            return "Pane not found"
        elif worker.state == WorkerState.DONE:
            return "Task completed"
        else:
            return ""


class ProgressPanel(Static):
    """전체 진행률 패널."""

    def __init__(self) -> None:
        super().__init__()
        self.completed = 0
        self.total = 0
        self.id = "progress-panel"

    def set_progress(self, completed: int, total: int) -> None:
        """진행률 설정."""
        self.completed = completed
        self.total = total
        self.refresh()

    @property
    def percentage(self) -> float:
        """완료율 (%)."""
        if self.total == 0:
            return 0.0
        return (self.completed / self.total) * 100

    def render(self) -> Text:
        """진행률 렌더링."""
        pct = self.percentage
        bar_width = 40
        filled = int(bar_width * pct / 100)
        empty = bar_width - filled

        bar = "█" * filled + "░" * empty
        return Text(f"  Total: {bar}  {pct:.0f}% ({self.completed}/{self.total} tasks)")


class OrchayApp(App[None]):
    """orchay TUI 애플리케이션."""

    TITLE = "orchay - Task Scheduler"
    CSS_PATH = "styles.tcss"
    BINDINGS: ClassVar[list[BindingType]] = [
        Binding("f1", "show_help", "Help"),
        Binding("f2", "show_status", "Status"),
        Binding("f3", "show_queue", "Queue"),
        Binding("f4", "show_workers", "Workers"),
        Binding("f5", "reload", "Reload"),
        Binding("f6", "show_history", "History"),
        Binding("f7", "toggle_mode", "Mode"),
        Binding("f9", "pause", "Pause"),
        Binding("f10", "quit", "Exit"),
        Binding("q", "quit", "Quit"),
        Binding("escape", "close_modal", "Close", show=False),
        Binding("up", "navigate_up", "Up", show=False),
        Binding("down", "navigate_down", "Down", show=False),
        Binding("enter", "item_select", "Select", show=False),
        Binding("u", "queue_move_up", "Move Up", show=False),
        Binding("t", "queue_move_top", "Top", show=False),
        Binding("s", "queue_skip", "Skip", show=False),
        Binding("r", "reset_or_retry", "Reset/Retry", show=False),
        Binding("p", "toggle_worker_pause", "Pause Worker", show=False),
        Binding("1", "select_worker_1", "W1", show=False),
        Binding("2", "select_worker_2", "W2", show=False),
        Binding("3", "select_worker_3", "W3", show=False),
        Binding("4", "select_worker_4", "W4", show=False),
        Binding("5", "select_worker_5", "W5", show=False),
        Binding("shift+f1", "show_worker_1", "W1 Info", show=False),
        Binding("shift+f2", "show_worker_2", "W2 Info", show=False),
        Binding("shift+f3", "show_worker_3", "W3 Info", show=False),
    ]

    def __init__(
        self,
        config: Config | None = None,
        tasks: list[Task] | None = None,
        worker_list: list[Worker] | None = None,
        mode: str = "quick",
        project: str = "orchay",
        interval: int = 5,
        orchestrator: object | None = None,
    ) -> None:
        super().__init__()
        self.config = config or Config()
        self._tasks = tasks or []
        self._worker_list = worker_list or []
        self._mode = mode
        self._project = project
        self._interval = interval
        self._paused = False
        self._scheduler_state = "running"
        self._queue_interactive = False
        self._workers_interactive = False
        self._help_visible = False
        self._action_menu_visible = False

        # 실제 Orchestrator 또는 Mock
        self._real_orchestrator: Orchestrator | None = orchestrator  # type: ignore[assignment]
        self._orchestrator: Any = orchestrator or self._create_mock_orchestrator()
        self._command_handler = CommandHandler(self._orchestrator)

    def _create_mock_orchestrator(self) -> object:
        """Mock Orchestrator 생성."""
        from orchay.scheduler import ExecutionMode

        class MockOrchestrator:
            def __init__(self, app: OrchayApp) -> None:
                self._app = app

            @property
            def tasks(self) -> list[Task]:
                return self._app._tasks

            @tasks.setter
            def tasks(self, value: list[Task]) -> None:
                self._app._tasks = value

            @property
            def workers(self) -> list[Worker]:
                return self._app._worker_list

            @property
            def running_tasks(self) -> set[str]:
                return {w.current_task for w in self._app._worker_list if w.current_task}

            @property
            def mode(self) -> ExecutionMode:
                return ExecutionMode(self._app._mode)

            @mode.setter
            def mode(self, value: ExecutionMode) -> None:
                self._app._mode = value.value
                self._app.mode = value.value

            @property
            def _paused(self) -> bool:
                return self._app._paused

            @_paused.setter
            def _paused(self, value: bool) -> None:
                self._app._paused = value

        return MockOrchestrator(self)

    @property
    def tasks(self) -> list[Task]:
        """Task 목록."""
        return self._tasks

    @tasks.setter
    def tasks(self, value: list[Task]) -> None:
        self._tasks = value
        self._update_queue_table()

    @property
    def worker_list(self) -> list[Worker]:
        """Worker 목록."""
        return self._worker_list

    @worker_list.setter
    def worker_list(self, value: list[Worker]) -> None:
        self._worker_list = value
        self._update_worker_panel()

    @property
    def mode(self) -> str:
        """실행 모드."""
        return self._mode

    @mode.setter
    def mode(self, value: str) -> None:
        self._mode = value
        try:
            indicator = self.query_one("#scheduler-state", SchedulerStateIndicator)
            indicator.mode = value
        except Exception:
            pass

    def compose(self) -> ComposeResult:
        """UI 구성."""
        yield Header()

        with Container(id="main-container"):
            # 헤더 정보 영역
            with Horizontal(id="header-bar"):
                yield SchedulerStateIndicator(self._scheduler_state, self._mode, self._project)
                yield HeaderInfo(
                    project=self._project,
                    workers=len(self._worker_list),
                    queue_size=self._count_queue(),
                    completed=self._count_completed(),
                    total=len(self._tasks),
                )

            # 스케줄 큐 테이블
            with Vertical(id="queue-section"):
                yield Static("Schedule Queue", id="queue-title")
                yield DataTable(id="queue-table")

            # Worker 패널
            with Vertical(id="workers-section"):
                yield Static("Workers", id="workers-title")
                yield WorkerPanel()

            # 진행률
            with Vertical(id="progress-section"):
                yield Static("Progress", id="progress-title")
                yield ProgressPanel()

            # 명령어 입력
            with Horizontal(id="input-section"):
                yield Input(placeholder="명령어 입력 (help로 도움말)", id="command-input")

        # 모달 위젯들 (기본 숨김)
        yield QueueWidget(self._tasks)
        yield HelpModal()

        yield Footer()

    def on_mount(self) -> None:
        """마운트 시 초기화."""
        # DataTable 컬럼 설정
        table: DataTable[str] = self.query_one("#queue-table", DataTable)  # type: ignore[assignment]
        table.add_column("#", width=3)
        table.add_column("Task ID", width=12)
        table.add_column("Status", width=8)
        table.add_column("Category", width=14)
        table.add_column("Priority", width=10)
        table.add_column("Title", width=25)
        table.add_column("Depends", width=15)

        # 모달 위젯 숨김
        try:
            queue_widget = self.query_one("#queue-widget", QueueWidget)
            queue_widget.display = False
            help_modal = self.query_one("#help-modal", HelpModal)
            help_modal.display = False
        except Exception:
            pass

        # 초기 데이터 로드
        self._update_queue_table()
        self._update_worker_panel()
        self._update_progress()

        # 자동 갱신 타이머 시작
        self.set_interval(self._interval, self._on_auto_refresh)

    def on_unmount(self) -> None:
        """앱 종료 시 정리."""
        if self._real_orchestrator is not None and hasattr(self._real_orchestrator, "stop"):
            self._real_orchestrator.stop()

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        """Input 제출 이벤트 핸들러."""
        if event.input.id != "command-input":
            return

        command = event.value.strip()
        if not command:
            return

        # 명령어 실행
        result = await self._command_handler.process_command(command)

        # 결과 표시
        if result.success:
            self.notify(result.message)
        else:
            self.notify(result.message, severity="error")

        # Input 클리어
        event.input.clear()

        # UI 업데이트
        self._update_queue_table()
        self._update_header_info()

    def _on_auto_refresh(self) -> None:
        """자동 갱신 콜백."""
        if not self._paused:
            # 실제 Orchestrator가 있으면 스케줄링 사이클 실행
            if self._real_orchestrator is not None:
                self.run_worker(self._run_orchestrator_tick())
            self._sync_from_orchestrator()
            self._update_queue_table()
            self._update_worker_panel()
            self._update_header_info()
            self._update_progress()

    async def _run_orchestrator_tick(self) -> None:
        """Orchestrator 스케줄링 사이클 실행."""
        if self._real_orchestrator is not None and hasattr(self._real_orchestrator, "_tick"):
            await self._real_orchestrator._tick()  # pyright: ignore[reportPrivateUsage]

    def _sync_from_orchestrator(self) -> None:
        """Orchestrator 상태를 TUI에 동기화."""
        if self._real_orchestrator is not None:
            if hasattr(self._real_orchestrator, "tasks"):
                self._tasks = self._real_orchestrator.tasks
            if hasattr(self._real_orchestrator, "workers"):
                self._worker_list = self._real_orchestrator.workers

    def _count_queue(self) -> int:
        """대기 중인 Task 수."""
        return sum(
            1 for t in self._tasks if t.status not in (TaskStatus.DONE, TaskStatus.IMPLEMENT)
        )

    def _count_completed(self) -> int:
        """완료된 Task 수."""
        return sum(1 for t in self._tasks if t.status == TaskStatus.DONE)

    def _update_queue_table(self) -> None:
        """스케줄 큐 테이블 업데이트."""
        try:
            table: DataTable[str] = self.query_one("#queue-table", DataTable)  # type: ignore[assignment]
        except Exception:
            return

        table.clear()

        # 우선순위 순서
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        sorted_tasks = sorted(
            [t for t in self._tasks if t.status != TaskStatus.DONE],
            key=lambda t: priority_order.get(t.priority.value, 99),
        )

        for i, task in enumerate(sorted_tasks[:10], 1):
            status_color = self._get_status_color(task.status)
            # Title과 Depends를 별도 컬럼으로
            title = task.title[:23] + ".." if len(task.title) > 25 else task.title
            deps = ", ".join(task.depends) if task.depends else "-"
            table.add_row(
                str(i),
                task.id,
                Text(task.status.value, style=status_color),  # type: ignore[arg-type]
                task.category.value,
                task.priority.value,
                title,
                deps,
            )

    def _update_worker_panel(self) -> None:
        """Worker 패널 업데이트."""
        try:
            panel = self.query_one("#workers-panel", WorkerPanel)
            panel.set_workers(self._worker_list)
        except Exception:
            pass

    def _update_progress(self) -> None:
        """진행률 업데이트."""
        try:
            panel = self.query_one("#progress-panel", ProgressPanel)
            panel.set_progress(self._count_completed(), len(self._tasks))
        except Exception:
            pass

    def _update_header_info(self) -> None:
        """헤더 정보 업데이트."""
        try:
            info = self.query_one("#header-info", HeaderInfo)
            info.update_info(
                workers=len(self._worker_list),
                queue_size=self._count_queue(),
                completed=self._count_completed(),
                total=len(self._tasks),
            )
        except Exception:
            pass

    def _get_status_color(self, status: TaskStatus) -> str:
        """상태별 색상."""
        status_colors = {
            TaskStatus.TODO: "#6b7280",
            TaskStatus.BASIC_DESIGN: "#3b82f6",
            TaskStatus.DETAIL_DESIGN: "#8b5cf6",
            TaskStatus.ANALYSIS: "#f59e0b",
            TaskStatus.DESIGN: "#3b82f6",
            TaskStatus.APPROVED: "#10b981",
            TaskStatus.IMPLEMENT: "#f59e0b",
            TaskStatus.FIX: "#ef4444",
            TaskStatus.VERIFY: "#22c55e",
            TaskStatus.DONE: "#10b981",
        }
        return status_colors.get(status, "#6b7280")

    # 액션 핸들러
    def action_show_help(self) -> None:
        """도움말 표시."""
        try:
            help_modal = self.query_one("#help-modal", HelpModal)
            help_modal.display = not help_modal.display
            self._help_visible = help_modal.display
        except Exception:
            self.notify("F1:Help F2:Status F3:Queue F4:Workers F5:Reload F7:Mode F9:Pause F10:Exit")

    def action_show_status(self) -> None:
        """상태 표시."""
        completed = self._count_completed()
        total = len(self._tasks)
        running = sum(1 for w in self._worker_list if w.state == WorkerState.BUSY)
        self.notify(f"Status: {completed}/{total} done, {running} running, mode={self._mode}")

    def action_show_queue(self) -> None:
        """큐 인터랙티브 UI 표시."""
        try:
            queue_widget = self.query_one("#queue-widget", QueueWidget)
            queue_widget.tasks = [t for t in self._tasks if t.status != TaskStatus.DONE]
            queue_widget.display = not queue_widget.display
            self._queue_interactive = queue_widget.display
        except Exception:
            queue_count = self._count_queue()
            self.notify(f"Queue: {queue_count} tasks pending")

    def action_show_workers(self) -> None:
        """Worker 인터랙티브 UI 표시/토글."""
        try:
            panel = self.query_one("#workers-panel", WorkerPanel)
            panel.interactive = not panel.interactive
            self._workers_interactive = panel.interactive

            # Input 포커스 제어
            command_input = self.query_one("#command-input", Input)

            if self._workers_interactive:
                # Queue 인터랙티브 모드 해제
                self._queue_interactive = False
                queue_widget = self.query_one("#queue-widget", QueueWidget)
                queue_widget.display = False
                # Input 포커스 해제 (P 키 등이 Input으로 가지 않도록)
                command_input.disabled = True
                self.set_focus(None)
                self.notify("Workers: ↑↓로 선택, P로 일시정지/재개")
            else:
                # Input 다시 활성화
                command_input.disabled = False
                idle = sum(1 for w in self._worker_list if w.state == WorkerState.IDLE)
                busy = sum(1 for w in self._worker_list if w.state == WorkerState.BUSY)
                paused = sum(1 for w in self._worker_list if w.is_manually_paused)
                self.notify(f"Workers: {idle} idle, {busy} busy, {paused} paused")
        except Exception:
            idle = sum(1 for w in self._worker_list if w.state == WorkerState.IDLE)
            busy = sum(1 for w in self._worker_list if w.state == WorkerState.BUSY)
            self.notify(f"Workers: {len(self._worker_list)} total, {idle} idle, {busy} busy")

    def action_reload(self) -> None:
        """WBS 재로드."""
        self._update_queue_table()
        self._update_worker_panel()
        self._update_progress()
        self._update_header_info()
        self.notify("Reloaded")

    def action_toggle_mode(self) -> None:
        """모드 전환."""
        modes = ["design", "quick", "develop", "force"]
        current_idx = modes.index(self._mode) if self._mode in modes else 0
        next_idx = (current_idx + 1) % len(modes)
        self.mode = modes[next_idx]
        self.notify(f"Mode changed to: {self._mode}")

    def action_pause(self) -> None:
        """스케줄러 일시정지 토글."""
        self._paused = not self._paused
        self._scheduler_state = "paused" if self._paused else "running"

        # Orchestrator와 동기화
        if self._real_orchestrator is not None:
            self._real_orchestrator._paused = self._paused  # pyright: ignore[reportPrivateUsage]

        # 파일에 상태 저장
        set_scheduler_state(self._scheduler_state)

        # UI 업데이트
        try:
            indicator = self.query_one("#scheduler-state", SchedulerStateIndicator)
            indicator.state = self._scheduler_state
        except Exception:
            pass

        status = "paused" if self._paused else "resumed"
        self.notify(f"Scheduler {status}")

    def action_show_history(self) -> None:
        """히스토리 표시."""
        self.notify("History: (not implemented)")

    def action_close_modal(self) -> None:
        """모달/인터랙티브 모드 닫기."""
        try:
            command_input = self.query_one("#command-input", Input)

            # Workers 인터랙티브 모드 해제
            if self._workers_interactive:
                panel = self.query_one("#workers-panel", WorkerPanel)
                panel.interactive = False
                self._workers_interactive = False
                # Input 다시 활성화
                command_input.disabled = False
                return

            # Queue 인터랙티브 모드 해제
            queue_widget = self.query_one("#queue-widget", QueueWidget)
            if queue_widget.display:
                queue_widget.display = False
                self._queue_interactive = False
                # Input 다시 활성화
                command_input.disabled = False
                return

            # Help 모달 해제
            help_modal = self.query_one("#help-modal", HelpModal)
            if help_modal.display:
                help_modal.display = False
                self._help_visible = False
        except Exception:
            pass

    def action_navigate_up(self) -> None:
        """인터랙티브 모드에서 이전 항목 선택."""
        if self._workers_interactive:
            try:
                panel = self.query_one("#workers-panel", WorkerPanel)
                panel.select_prev()
            except Exception:
                pass
        elif self._queue_interactive:
            try:
                queue_widget = self.query_one("#queue-widget", QueueWidget)
                queue_widget.select_prev()
            except Exception:
                pass

    def action_navigate_down(self) -> None:
        """인터랙티브 모드에서 다음 항목 선택."""
        if self._workers_interactive:
            try:
                panel = self.query_one("#workers-panel", WorkerPanel)
                panel.select_next()
            except Exception:
                pass
        elif self._queue_interactive:
            try:
                queue_widget = self.query_one("#queue-widget", QueueWidget)
                queue_widget.select_next()
            except Exception:
                pass

    def action_item_select(self) -> None:
        """선택된 항목에 대한 액션 실행."""
        if self._workers_interactive:
            # 워커 선택 시 pause/resume 토글
            self.action_toggle_worker_pause()
        elif self._queue_interactive:
            try:
                queue_widget = self.query_one("#queue-widget", QueueWidget)
                task = queue_widget.selected_task
                if task:
                    self.notify(f"Selected: {task.id}")
            except Exception:
                pass

    def action_toggle_worker_pause(self) -> None:
        """선택된 Worker의 일시정지 토글."""
        try:
            panel = self.query_one("#workers-panel", WorkerPanel)
            worker = panel.selected_worker
            if worker is None:
                self.notify("No worker selected", severity="warning")
                return

            if worker.is_manually_paused:
                # 재개
                worker.resume()
                resume_worker(worker.id)  # 파일에서도 제거
                self.notify(f"Worker {worker.id} resumed")
            else:
                # 일시정지
                worker.pause()
                pause_worker(worker.id)  # 파일에 저장
                self.notify(f"Worker {worker.id} paused")

            self._update_worker_panel()
        except Exception as e:
            self.notify(f"Error: {e}", severity="error")

    def _select_worker(self, worker_id: int) -> None:
        """Worker 선택 (1~5 키)."""
        try:
            panel = self.query_one("#workers-panel", WorkerPanel)
            if panel.select_by_id(worker_id):
                panel.interactive = True
                self._workers_interactive = True
                # Input 비활성화 (키 입력이 Input으로 가지 않도록)
                try:
                    command_input = self.query_one("#command-input", Input)
                    command_input.disabled = True
                    self.set_focus(None)
                except Exception:
                    pass
                self.notify(f"Worker {worker_id} selected (P to pause/resume)")
            else:
                self.notify(f"Worker {worker_id} not found", severity="warning")
        except Exception:
            pass

    def action_select_worker_1(self) -> None:
        """Worker 1 선택."""
        self._select_worker(1)

    def action_select_worker_2(self) -> None:
        """Worker 2 선택."""
        self._select_worker(2)

    def action_select_worker_3(self) -> None:
        """Worker 3 선택."""
        self._select_worker(3)

    def action_select_worker_4(self) -> None:
        """Worker 4 선택."""
        self._select_worker(4)

    def action_select_worker_5(self) -> None:
        """Worker 5 선택."""
        self._select_worker(5)

    async def action_queue_move_up(self) -> None:
        """선택된 Task를 위로 이동."""
        if not self._queue_interactive:
            return
        try:
            queue_widget = self.query_one("#queue-widget", QueueWidget)
            task = queue_widget.selected_task
            if task:
                result = await self._command_handler.up_task(task.id)
                self.notify(result.message)
                queue_widget.tasks = self._tasks
                self._update_queue_table()
        except Exception:
            pass

    async def action_queue_move_top(self) -> None:
        """선택된 Task를 최우선으로 이동."""
        if not self._queue_interactive:
            return
        try:
            queue_widget = self.query_one("#queue-widget", QueueWidget)
            task = queue_widget.selected_task
            if task:
                result = await self._command_handler.top_task(task.id)
                self.notify(result.message)
                queue_widget.tasks = self._tasks
                self._update_queue_table()
        except Exception:
            pass

    async def action_queue_skip(self) -> None:
        """선택된 Task를 스킵."""
        if not self._queue_interactive:
            return
        try:
            queue_widget = self.query_one("#queue-widget", QueueWidget)
            task = queue_widget.selected_task
            if task:
                result = await self._command_handler.skip_task(task.id)
                if result.success:
                    self.notify(result.message)
                else:
                    self.notify(result.message, severity="error")
                queue_widget.tasks = self._tasks
                self._update_queue_table()
        except Exception:
            pass

    async def action_reset_or_retry(self) -> None:
        """R 키: Workers 모드에서는 reset, Queue 모드에서는 retry."""
        if self._workers_interactive:
            await self.action_reset_worker()
        elif self._queue_interactive:
            await self._queue_retry()

    async def _queue_retry(self) -> None:
        """선택된 Task를 재시도."""
        try:
            queue_widget = self.query_one("#queue-widget", QueueWidget)
            task = queue_widget.selected_task
            if task:
                result = await self._command_handler.retry_task(task.id)
                self.notify(result.message)
                queue_widget.tasks = self._tasks
                self._update_queue_table()
        except Exception:
            pass

    async def action_reset_worker(self) -> None:
        """선택된 Worker를 idle 상태로 리셋."""
        try:
            panel = self.query_one("#workers-panel", WorkerPanel)
            worker = panel.selected_worker
            if worker is None:
                self.notify("No worker selected", severity="warning")
                return

            # error 또는 다른 비정상 상태인 경우만 reset
            if worker.state in (WorkerState.IDLE, WorkerState.BUSY):
                self.notify(f"Worker {worker.id} is {worker.state.value}, no reset needed")
                return

            # 현재 Task 정보 저장
            current_task = worker.current_task

            # Worker 리셋
            worker.reset()

            # Task의 할당 해제
            if current_task and self._real_orchestrator is not None:
                task = next(
                    (t for t in self._real_orchestrator.tasks if t.id == current_task), None
                )
                if task:
                    task.assigned_worker = None

            self.notify(f"Worker {worker.id} reset to idle")
            self._update_worker_panel()
        except Exception as e:
            self.notify(f"Reset failed: {e}", severity="error")

    def action_show_worker_1(self) -> None:
        """Worker 1 정보 표시."""
        self._show_worker_info(1)

    def action_show_worker_2(self) -> None:
        """Worker 2 정보 표시."""
        self._show_worker_info(2)

    def action_show_worker_3(self) -> None:
        """Worker 3 정보 표시."""
        self._show_worker_info(3)

    def _show_worker_info(self, worker_id: int) -> None:
        """특정 Worker 정보 표시."""
        worker = next((w for w in self._worker_list if w.id == worker_id), None)
        if worker is None:
            self.notify(f"Worker {worker_id} not found", severity="error")
            return
        task_info = worker.current_task or "-"
        self.notify(f"Worker {worker_id}: {worker.state.value}, task={task_info}")


def run_app(
    config: Config | None = None,
    tasks: list[Task] | None = None,
    worker_list: list[Worker] | None = None,
    mode: str = "quick",
    project: str = "orchay",
) -> None:
    """TUI 앱 실행."""
    app = OrchayApp(
        config=config,
        tasks=tasks,
        worker_list=worker_list,
        mode=mode,
        project=project,
    )
    app.run()
