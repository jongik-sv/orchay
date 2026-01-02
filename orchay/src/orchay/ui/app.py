"""orchay TUI 메인 App.

Textual 프레임워크 기반 터미널 UI 구현.
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any, ClassVar

from rich.text import Text

if TYPE_CHECKING:
    from orchay.main import Orchestrator
from textual.app import App, ComposeResult
from textual.binding import Binding, BindingType
from textual.containers import Container, Horizontal, Vertical, VerticalScroll
from textual.widgets import DataTable, Footer, Header, RichLog, Static

from orchay.command import CommandHandler
from orchay.scheduler import ExecutionMode
from orchay.models import Config, Task, TaskStatus, Worker, WorkerState
from orchay.ui.widgets import HelpModal, TaskDetailModal, TestSelectionPanel
from orchay.utils.active_tasks import (
    pause_worker,
    resume_worker,
    set_scheduler_state,
)
from orchay.utils.process import kill_process_nowait


class TUILogHandler(logging.Handler):
    """TUI 로그 패널로 로그를 출력하는 커스텀 핸들러."""

    def __init__(self, app: OrchayApp) -> None:
        super().__init__()
        self._app = app

    def emit(self, record: logging.LogRecord) -> None:
        """로그 레코드를 TUI에 출력."""
        try:
            level_map = {
                logging.DEBUG: "debug",
                logging.INFO: "info",
                logging.WARNING: "warning",
                logging.ERROR: "error",
                logging.CRITICAL: "error",
            }
            level = level_map.get(record.levelno, "info")
            # 짧은 로거명 사용 (orchay.main → main)
            name = record.name.split(".")[-1] if "." in record.name else record.name
            message = f"[{name}] {record.getMessage()}"
            self._app.call_from_thread(self._app.write_log, message, level)
        except Exception:
            pass  # TUI가 아직 준비되지 않았거나 종료 중일 수 있음


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
        "test": "#f97316",
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
        self.id = "workers-panel"

    @property
    def selected_worker(self) -> Worker | None:
        """현재 선택된 Worker."""
        if 0 <= self._selected_index < len(self._worker_list):
            return self._worker_list[self._selected_index]
        return None

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

        for i, w in enumerate(self._worker_list):
            is_selected = i == self._selected_index
            color = self.STATE_COLORS.get(w.state, "#6b7280")
            icon = self.STATE_ICONS.get(w.state, "?")

            # 수동 일시정지 표시
            manual_pause_marker = " 🛑" if w.is_manually_paused else ""

            # Worker 정보 라인 - current_step을 명령어 형식으로 표시
            if w.current_task and w.current_step:
                cmd = f"/wf:{w.current_step}"
                task_info = f"{w.current_task} ({cmd})"
            elif w.current_task:
                task_info = w.current_task
            else:
                task_info = "-"
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


class OrchayApp(App[None]):
    """orchay TUI 애플리케이션."""

    TITLE = "orchay - Task Scheduler"
    CSS_PATH = "styles.tcss"
    BINDINGS: ClassVar[list[BindingType]] = [
        Binding("f12", "show_help", "Help"),
        Binding("f3", "show_queue", "Queue"),
        Binding("f5", "reload", "Reload"),
        Binding("f6", "show_history", "History"),
        Binding("f7", "toggle_mode", "Mode"),
        Binding("f9", "pause", "Start"),  # 초기값: Start (start_paused 기본 가정, __init__에서 업데이트)
        Binding("f10", "quit", "Exit"),
        Binding("q", "quit", "Quit"),
        Binding("escape", "close_modal", "Close", show=False),
        Binding("up", "worker_select_prev", "Up", show=False),
        Binding("down", "worker_select_next", "Down", show=False),
        # priority=True: DataTable 키바인딩보다 우선
        Binding("enter", "item_select", "Select", show=False, priority=True),
        Binding("space", "queue_toggle_skip", "Skip/Retry", show=False, priority=True),
        Binding("r", "reset_worker", "Reset Worker", show=False, priority=True),
        Binding("p", "toggle_worker_pause", "Pause Worker", show=False, priority=True),
        Binding("1", "select_worker_1", "W1", show=False, priority=True),
        Binding("2", "select_worker_2", "W2", show=False, priority=True),
        Binding("3", "select_worker_3", "W3", show=False, priority=True),
        Binding("4", "select_worker_4", "W4", show=False, priority=True),
        Binding("5", "select_worker_5", "W5", show=False, priority=True),
        Binding("shift+f1", "show_worker_1", "W1 Info", show=False),
        Binding("shift+f2", "show_worker_2", "W2 Info", show=False),
        Binding("shift+f3", "show_worker_3", "W3 Info", show=False),
        # Test mode 전용 키
        Binding("t", "run_tests", "Run Tests", show=False, priority=True),
        Binding("a", "toggle_select_all", "Select All", show=False, priority=True),
        # 수동 승인 키
        Binding("y", "approve_task", "Approve", show=False, priority=True),
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
        self._paused = self.config.execution.start_paused
        self._scheduler_state = "paused" if self._paused else "running"
        self._ever_started = not self._paused  # start_paused면 아직 시작 안함
        self._queue_fullscreen = False
        self._logs_fullscreen = False
        self._help_visible = False
        self._tick_running = False  # tick 중복 실행 방지

        # 실제 Orchestrator 또는 Mock
        self._real_orchestrator: Orchestrator | None = orchestrator  # type: ignore[assignment]
        self._orchestrator: Any = orchestrator or self._create_mock_orchestrator()
        self._command_handler = CommandHandler(self._orchestrator)

        # Worker 상태 추적 (로그용)
        self._prev_worker_states: dict[int, tuple[WorkerState, str | None]] = {}

        # TUI 로그 핸들러 (on_mount에서 등록)
        self._log_handler: TUILogHandler | None = None

        # 토스트 메시지 설정
        self._max_notifications = 4
        self._notification_timeout = 2.0  # 초

        # F9 바인딩 초기 레이블 설정 (compose 전에 설정해야 Footer에 반영됨)
        self._update_f9_binding()

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
        # Orchestrator 모드 동기화
        if self._real_orchestrator is not None:
            self._real_orchestrator.mode = ExecutionMode(value)
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
                yield Static(
                    "Schedule Queue  (Enter:Detail  Space:Skip/Retry  Y:Approve)",
                    id="queue-title",
                )
                yield DataTable(id="queue-table")

            # Test 모드 선택 패널 (기본 숨김)
            with Vertical(id="test-section"):
                yield Static("Test Mode  (Space:Select  A:All  T:Run)", id="test-title")
                yield TestSelectionPanel()

            # Worker 패널 (스크롤 가능)
            with Vertical(id="workers-section"):
                yield Static("Workers  (↑↓:Select  P:Pause  R:Reset)", id="workers-title")
                with VerticalScroll(id="workers-scroll"):
                    yield WorkerPanel()

            # 로그 영역
            with Vertical(id="log-section"):
                yield Static("Logs  (F6:Expand)", id="log-title")
                yield RichLog(id="log-panel", highlight=True, markup=True)

        # 모달 위젯들 (기본 숨김)
        yield HelpModal()
        yield TaskDetailModal()

        yield Footer()

    def on_mount(self) -> None:
        """마운트 시 초기화."""
        # DataTable 컬럼 설정
        table: DataTable[str] = self.query_one("#queue-table", DataTable)  # type: ignore[assignment]
        table.cursor_type = "row"  # row 전체 선택 모드
        table.add_column("#", width=3)
        table.add_column("Task ID", width=12)
        table.add_column("Sts", width=5)
        table.add_column("Categ", width=6)
        table.add_column("Pri", width=4)
        table.add_column("Title", width=28)
        table.add_column("Depends")  # 자동 너비

        # 모달 위젯 숨김
        try:
            help_modal = self.query_one("#help-modal", HelpModal)
            help_modal.display = False
        except Exception:
            pass
        try:
            task_detail_modal = self.query_one("#task-detail-modal", TaskDetailModal)
            task_detail_modal.display = False
        except Exception:
            pass

        # test 모드 UI 초기 설정
        self._update_test_mode_ui()

        # 초기 데이터 로드
        self._update_queue_table()
        self._update_worker_panel()

        # TUI 로그 핸들러 등록 (모든 로그를 TUI로 출력)
        self._log_handler = TUILogHandler(self)
        self._log_handler.setLevel(logging.DEBUG)
        logging.getLogger().addHandler(self._log_handler)

        # 자동 갱신 타이머 시작
        self.set_interval(self._interval, self._on_auto_refresh)

        # F9 바인딩 초기 레이블 설정
        self._update_f9_binding()

        # 시작 로그
        self.write_log("orchay TUI 시작", "info")

    def on_unmount(self) -> None:
        """앱 종료 시 정리."""
        # TUI 로그 핸들러 제거
        if self._log_handler is not None:
            logging.getLogger().removeHandler(self._log_handler)
            self._log_handler = None

        if self._real_orchestrator is not None and hasattr(self._real_orchestrator, "stop"):
            self._real_orchestrator.stop()

    def _on_auto_refresh(self) -> None:
        """자동 갱신 콜백."""
        # 현재 선택된 Task ID 저장 (커서 위치 유지용)
        selected_task = self._get_selected_task()
        selected_task_id = selected_task.id if selected_task else None

        # 스케줄링 사이클 실행 (pause 상태에서도 상태 업데이트는 필요)
        # Orchestrator._tick() 내부에서 pause일 때 Task 분배만 건너뜀
        if self._real_orchestrator is not None and not self._tick_running:
            self._tick_running = True
            self.run_worker(self._run_orchestrator_tick(selected_task_id))
            # UI 업데이트는 _run_orchestrator_tick() 완료 후 수행됨
        elif not self._tick_running:
            # Orchestrator 없거나 tick 미실행 시에만 직접 UI 업데이트
            self._sync_from_orchestrator()
            self._update_queue_table(preserve_cursor_task_id=selected_task_id)
            self._update_worker_panel()
            self._update_header_info()

    def write_log(self, message: str, level: str = "info") -> None:
        """로그 패널에 메시지 작성.

        Args:
            message: 로그 메시지
            level: 로그 레벨 (info, warning, error, debug)
        """
        try:
            log_panel = self.query_one("#log-panel", RichLog)
            from datetime import datetime

            timestamp = datetime.now().strftime("%H:%M:%S")
            level_colors = {
                "debug": "dim",
                "info": "cyan",
                "warning": "yellow",
                "error": "red bold",
            }
            color = level_colors.get(level, "white")
            log_panel.write(f"[dim]{timestamp}[/] [{color}]{level.upper():5}[/] {message}")
        except Exception:
            pass

    async def _run_orchestrator_tick(self, preserve_cursor_task_id: str | None = None) -> None:
        """Orchestrator 스케줄링 사이클 실행.

        Args:
            preserve_cursor_task_id: 커서 위치 유지할 Task ID
        """
        try:
            if self._real_orchestrator is not None and hasattr(self._real_orchestrator, "_tick"):
                await self._real_orchestrator._tick()  # pyright: ignore[reportPrivateUsage]
            # tick 완료 후 UI 업데이트 (동일 asyncio 루프에서 실행)
            self._sync_from_orchestrator()
            self._update_queue_table(preserve_cursor_task_id=preserve_cursor_task_id)
            self._update_worker_panel()
            self._update_header_info()
        finally:
            self._tick_running = False

    def _sync_from_orchestrator(self) -> None:
        """Orchestrator 상태를 TUI에 동기화."""
        if self._real_orchestrator is not None:
            if hasattr(self._real_orchestrator, "tasks"):
                self._tasks = self._real_orchestrator.tasks
            if hasattr(self._real_orchestrator, "workers"):
                self._worker_list = self._real_orchestrator.workers
                self._log_worker_changes()

    def _log_worker_changes(self) -> None:
        """Worker 상태 변화 로그."""
        for worker in self._worker_list:
            prev = self._prev_worker_states.get(worker.id)
            curr = (worker.state, worker.current_task)

            if prev is None:
                # 최초 기록
                self._prev_worker_states[worker.id] = curr
                continue

            prev_state, prev_task = prev
            curr_state, curr_task = curr

            # 상태 변화 감지
            if prev_state != curr_state:
                if curr_state == WorkerState.BUSY and curr_task:
                    self.write_log(
                        f"Worker {worker.id}: {prev_state.value} → {curr_state.value} "
                        f"(task: {curr_task})",
                        "info",
                    )
                elif curr_state == WorkerState.DONE:
                    if prev_task is not None:
                        self.write_log(
                            f"Worker {worker.id}: Task 완료 ({prev_task})",
                            "info",
                        )
                elif curr_state == WorkerState.ERROR:
                    self.write_log(
                        f"Worker {worker.id}: 오류 발생",
                        "error",
                    )
                elif curr_state == WorkerState.PAUSED:
                    self.write_log(
                        f"Worker {worker.id}: Rate limit 감지",
                        "warning",
                    )
                elif curr_state == WorkerState.BLOCKED:
                    self.write_log(
                        f"Worker {worker.id}: 입력 대기 중",
                        "warning",
                    )
                elif curr_state == WorkerState.IDLE and prev_state == WorkerState.BUSY:
                    self.write_log(
                        f"Worker {worker.id}: Idle (이전: {prev_task})",
                        "debug",
                    )

            # Task 변경 감지 (dispatch)
            elif prev_task != curr_task and curr_task is not None:
                self.write_log(
                    f"Worker {worker.id}: Dispatch → {curr_task}",
                    "info",
                )

            self._prev_worker_states[worker.id] = curr

    def _count_queue(self) -> int:
        """대기 중인 Task 수."""
        return sum(
            1 for t in self._tasks if t.status not in (TaskStatus.DONE, TaskStatus.IMPLEMENT)
        )

    def _count_completed(self) -> int:
        """완료된 Task 수."""
        return sum(1 for t in self._tasks if t.status == TaskStatus.DONE)

    def _update_queue_table(self, preserve_cursor_task_id: str | None = None) -> None:
        """스케줄 큐 테이블 업데이트.

        Args:
            preserve_cursor_task_id: 이 task ID의 위치로 커서 유지 (None이면 기본 동작)
        """
        try:
            table: DataTable[str] = self.query_one("#queue-table", DataTable)  # type: ignore[assignment]
        except Exception:
            return

        table.clear()

        # Task ID 순서로 정렬
        sorted_tasks = sorted(
            [t for t in self._tasks if t.status != TaskStatus.DONE],
            key=lambda t: t.id,
        )

        # 현재 작업 중인 Task 찾기 (첫 번째)
        active_row: int | None = None
        preserved_row: int | None = None
        running_task_ids = {w.current_task for w in self._worker_list if w.current_task}

        # 짧은 표시명 매핑
        category_short = {
            "development": "dev",
            "defect": "def",
            "infrastructure": "infra",
            "simple-dev": "sdev",
        }
        priority_short = {
            "critical": "crit",
            "high": "high",
            "medium": "med",
            "low": "low",
        }

        for i, task in enumerate(sorted_tasks, 1):
            status_color = self._get_status_color(task.status)
            # Title과 Depends를 별도 컬럼으로
            title = task.title[:25] + ".." if len(task.title) > 27 else task.title
            deps_raw = ", ".join(task.depends) if task.depends else "-"
            deps = deps_raw.ljust(20)  # 최소 20자 보장

            # 작업 중인 Task 또는 스킵된 Task 표시
            task_id_display: str | Text = task.id
            if task.id in running_task_ids:
                task_id_display = Text(f"▶ {task.id}", style="#22c55e")  # green
                if active_row is None:
                    active_row = i - 1  # 0-indexed
            elif task.blocked_by == "skipped":
                task_id_display = Text()
                task_id_display.append("⏸ ", style="bold #ffffff on #f97316")
                task_id_display.append(task.id)

            # 커서 유지할 task 찾기
            if preserve_cursor_task_id and task.id == preserve_cursor_task_id:
                preserved_row = i - 1  # 0-indexed

            table.add_row(
                str(i),
                task_id_display,
                Text(task.status.value, style=status_color),  # type: ignore[arg-type]
                category_short.get(task.category.value, task.category.value[:4]),
                priority_short.get(task.priority.value, task.priority.value[:4]),
                title,
                deps,
            )

        # 커서 위치 결정: preserved_row 우선, 없으면 active_row
        target_row = preserved_row if preserved_row is not None else active_row
        if target_row is not None and table.row_count > 0:
            table.move_cursor(row=target_row)

    def _update_worker_panel(self) -> None:
        """Worker 패널 업데이트."""
        try:
            panel = self.query_one("#workers-panel", WorkerPanel)
            panel.set_workers(self._worker_list)
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

    def _update_layout(self) -> None:
        """레이아웃 상태 업데이트 (전체화면 토글)."""
        try:
            queue_section = self.query_one("#queue-section")
            workers_section = self.query_one("#workers-section")
            log_section = self.query_one("#log-section")

            if self._queue_fullscreen:
                workers_section.display = False
                log_section.display = False
                queue_section.display = True
                queue_section.styles.height = "1fr"
            elif self._logs_fullscreen:
                queue_section.display = False
                workers_section.display = False
                log_section.display = True
                log_section.styles.height = "1fr"
            else:
                queue_section.display = True
                workers_section.display = True
                log_section.display = True
                queue_section.styles.height = "1fr"
                log_section.styles.height = 8
        except Exception:
            pass

    def _get_sorted_tasks(self) -> list[Task]:
        """정렬된 Task 목록 반환 (Queue 테이블과 동일한 순서)."""
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        return sorted(
            [t for t in self._tasks if t.status != TaskStatus.DONE],
            key=lambda t: priority_order.get(t.priority.value, 99),
        )

    def _get_selected_task(self) -> Task | None:
        """DataTable에서 현재 선택된 Task 반환."""
        try:
            table: DataTable[str] = self.query_one("#queue-table", DataTable)  # type: ignore[assignment]
            cursor_row = table.cursor_row
            if cursor_row is None:
                return None
            sorted_tasks = self._get_sorted_tasks()
            if 0 <= cursor_row < len(sorted_tasks):
                return sorted_tasks[cursor_row]
        except Exception:
            pass
        return None

    def notify(
        self,
        message: str,
        *,
        title: str = "",
        severity: str = "information",
        timeout: float | None = None,
    ) -> None:
        """토스트 메시지 표시 (최대 4개, 빠른 소멸).

        Args:
            message: 표시할 메시지
            title: 제목 (선택)
            severity: 심각도 (information, warning, error)
            timeout: 표시 시간 (초), None이면 기본값 사용
        """
        # 기존 알림 정리 (최대 개수 초과 시)
        try:
            from textual.widgets._toast import ToastRack

            toast_rack = self.screen.query_one(ToastRack)
            toasts = list(toast_rack.children)
            # 최대 개수 - 1개 초과 시 오래된 것 제거 (새 알림 추가될 예정)
            while len(toasts) >= self._max_notifications:
                oldest = toasts.pop(0)
                oldest.remove()
        except Exception:
            pass

        # 짧은 timeout으로 알림 표시
        super().notify(
            message,
            title=title,
            severity=severity,  # type: ignore[arg-type]
            timeout=timeout if timeout is not None else self._notification_timeout,
        )

    def _get_status_color(self, status: TaskStatus) -> str:
        """상태별 색상."""
        status_colors = {
            TaskStatus.TODO: "#6b7280",
            TaskStatus.BASIC_DESIGN: "#3b82f6",
            TaskStatus.DETAIL_DESIGN: "#8b5cf6",
            TaskStatus.ANALYSIS: "#f59e0b",
            TaskStatus.DESIGN: "#3b82f6",
            TaskStatus.APPROVED: "#06b6d4",
            TaskStatus.IMPLEMENT: "#f59e0b",
            TaskStatus.FIX: "#ef4444",
            TaskStatus.VERIFY: "#22c55e",
            TaskStatus.DONE: "#10b981",
        }
        return status_colors.get(status, "#6b7280")

    # 액션 핸들러
    def action_quit(self) -> None:
        """앱 종료 및 현재 폴더의 WezTerm 닫기."""
        from pathlib import Path

        from orchay.launcher import get_pid_file, load_wezterm_pid

        # 먼저 앱 종료 처리
        if self._real_orchestrator is not None and hasattr(self._real_orchestrator, "stop"):
            self._real_orchestrator.stop()

        # 현재 폴더의 WezTerm만 종료 (PID 파일 기반)
        cwd = str(Path.cwd())
        saved_pid = load_wezterm_pid(cwd)
        if saved_pid:
            kill_process_nowait(saved_pid)
            # PID 파일 삭제
            try:
                get_pid_file(cwd).unlink()
            except OSError:
                pass

        # 앱 종료
        self.exit()

    def action_show_help(self) -> None:
        """도움말 표시."""
        try:
            help_modal = self.query_one("#help-modal", HelpModal)
            help_modal.display = not help_modal.display
            self._help_visible = help_modal.display
        except Exception:
            self.notify("F12:Help F3:Queue F5:Reload F6:Logs F7:Mode F9:Pause F10:Exit")

    def action_show_queue(self) -> None:
        """Queue 전체화면 토글."""
        self._queue_fullscreen = not self._queue_fullscreen
        if self._queue_fullscreen:
            self._logs_fullscreen = False  # 다른 전체화면 해제
        self._update_layout()
        status = "expanded" if self._queue_fullscreen else "normal"
        self.notify(f"Queue view: {status}")

    def action_worker_select_prev(self) -> None:
        """이전 Worker 선택."""
        try:
            panel = self.query_one("#workers-panel", WorkerPanel)
            panel.select_prev()
        except Exception:
            pass

    def action_worker_select_next(self) -> None:
        """다음 Worker 선택."""
        try:
            panel = self.query_one("#workers-panel", WorkerPanel)
            panel.select_next()
        except Exception:
            pass

    def action_reload(self) -> None:
        """WBS 재로드."""
        self._update_queue_table()
        self._update_worker_panel()
        self._update_header_info()
        self.notify("Reloaded")

    def action_toggle_mode(self) -> None:
        """모드 전환."""
        modes = ["design", "quick", "develop", "force", "test"]
        current_idx = modes.index(self._mode) if self._mode in modes else 0
        next_idx = (current_idx + 1) % len(modes)
        self.mode = modes[next_idx]
        self.notify(f"Mode changed to: {self._mode}")
        # test 모드 전환 시 UI 업데이트
        self._update_test_mode_ui()

    def _get_f9_label(self) -> str:
        """F9 바인딩 레이블 결정.

        Returns:
            - "Start": 처음 시작 전 (start_paused 모드)
            - "Pause": 실행 중
            - "Resume": 일시 중지 상태
        """
        if not self._ever_started:
            return "Start"
        elif self._paused:
            return "Resume"
        else:
            return "Pause"

    def _update_f9_binding(self, refresh: bool = True) -> None:
        """F9 바인딩 레이블 동적 업데이트.

        Args:
            refresh: True면 refresh_bindings() 호출 (마운트 후에만 가능)
        """
        label = self._get_f9_label()
        logging.debug(f"[F9] _paused={self._paused}, _ever_started={self._ever_started}, label={label}")

        # BINDINGS 리스트에서 F9 찾아서 교체 (클래스 레벨)
        for i, binding in enumerate(type(self).BINDINGS):
            if isinstance(binding, Binding) and binding.key == "f9":
                type(self).BINDINGS[i] = Binding("f9", "pause", label)
                logging.debug(f"[F9] Updated BINDINGS[{i}] to '{label}'")
                break

        if refresh:
            try:
                # 인스턴스 바인딩도 업데이트
                new_binding = Binding("f9", "pause", label)
                self._bindings.bind(
                    new_binding.key,
                    new_binding.action,
                    new_binding.description,
                    show=new_binding.show,
                    key_display=new_binding.key_display,
                    priority=new_binding.priority,
                )
                # Footer에 바인딩 변경 알림
                self.refresh_bindings()
                footer = self.query_one(Footer)
                footer.refresh(layout=True)
            except Exception as e:
                logging.debug(f"[F9] refresh failed: {e}")
                pass  # 아직 마운트 전이면 무시

    def action_pause(self) -> None:
        """스케줄러 일시정지 토글."""
        self._paused = not self._paused
        self._scheduler_state = "paused" if self._paused else "running"
        self._ever_started = True  # 한번이라도 토글하면 시작한 것으로 간주

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

        # F9 바인딩 레이블 업데이트
        self._update_f9_binding()

        status = "paused" if self._paused else "resumed"
        self.notify(f"Scheduler {status}")

    def action_show_history(self) -> None:
        """Logs 전체화면 토글."""
        self._logs_fullscreen = not self._logs_fullscreen
        if self._logs_fullscreen:
            self._queue_fullscreen = False  # 다른 전체화면 해제
        self._update_layout()
        status = "expanded" if self._logs_fullscreen else "normal"
        self.notify(f"Logs view: {status}")

    def action_close_modal(self) -> None:
        """모달/전체화면 모드 닫기."""
        # Task 상세 모달 해제
        try:
            task_modal = self.query_one("#task-detail-modal", TaskDetailModal)
            if task_modal.display:
                task_modal.display = False
                return
        except Exception:
            pass

        # 전체화면 해제
        if self._queue_fullscreen or self._logs_fullscreen:
            self._queue_fullscreen = False
            self._logs_fullscreen = False
            self._update_layout()
            return

        # Help 모달 해제
        try:
            help_modal = self.query_one("#help-modal", HelpModal)
            if help_modal.display:
                help_modal.display = False
                self._help_visible = False
        except Exception:
            pass

    async def action_item_select(self) -> None:
        """선택된 Task 상세 정보 모달 표시/닫기 (Enter 키)."""
        # 먼저 모달 상태 확인
        try:
            modal = self.query_one("#task-detail-modal", TaskDetailModal)
            # 모달이 이미 열려있으면 닫기 (모든 모드에서)
            if modal.display:
                modal.display = False
                return
        except Exception:
            pass

        # test 모드에서는 TestSelectionPanel에서 Task 가져오기
        if self._mode == "test":
            try:
                panel = self.query_one("#test-selection-panel", TestSelectionPanel)
                task = panel.get_highlighted_task()
            except Exception:
                task = None
        else:
            task = self._get_selected_task()
        if task:
            try:
                modal = self.query_one("#task-detail-modal", TaskDetailModal)
                modal.set_task(task)
                modal.display = True
            except Exception:
                # 모달 못 찾으면 토스트로 fallback
                self.notify(f"Selected: {task.id} ({task.status.value})")

    def action_toggle_worker_pause(self) -> None:
        """선택된 Worker의 일시정지 토글."""
        if not self._worker_list:
            self.notify("No workers available", severity="warning")
            return

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

    async def action_queue_toggle_skip(self) -> None:
        """선택된 Task의 스킵 상태 토글 (Space키)."""
        # test 모드에서는 SelectionList의 선택 토글
        if self._mode == "test":
            try:
                from textual.widgets import SelectionList
                selection_list: SelectionList[str] = self.query_one(
                    "#test-task-list", SelectionList
                )
                # highlighted된 항목의 값을 가져와서 toggle
                idx = selection_list.highlighted
                if idx is not None:
                    option = selection_list.get_option_at_index(idx)
                    if option is not None:
                        selection_list.toggle(option.value)
            except Exception as e:
                self.write_log(f"Toggle error: {e}", "error")
            return
        task = self._get_selected_task()
        if task:
            # 스킵된 상태면 Retry, 아니면 Skip
            if task.blocked_by == "skipped":
                result = await self._command_handler.retry_task(task.id)
            else:
                result = await self._command_handler.skip_task(task.id)
            if result.success:
                self.notify(result.message)
            else:
                self.notify(result.message, severity="error")
            self._update_queue_table(preserve_cursor_task_id=task.id)

    async def action_approve_task(self) -> None:
        """선택된 Task 수동 승인 (Y키).

        [dd] 상태의 idle Task를 [ap]로 변경합니다.
        force 모드에서는 자동 승인이므로 불필요 메시지를 표시합니다.
        """
        # test 모드에서는 무시
        if self._mode == "test":
            return

        # force 모드 체크 (자동 승인이므로 불필요)
        if self._mode == "force":
            self.notify("force 모드에서는 자동 승인됩니다", severity="warning")
            return

        task = self._get_selected_task()
        if task is None:
            self.notify("Task를 선택하세요", severity="warning")
            return

        # approve_task 호출
        result = await self._command_handler.approve_task(task.id)

        if result.success:
            self.notify(result.message)
            self.write_log(f"수동 승인: {task.id}", "info")
        else:
            self.notify(result.message, severity="error")

        # 테이블 업데이트 (커서 유지)
        self._update_queue_table(preserve_cursor_task_id=task.id)

    async def action_reset_worker(self) -> None:
        """선택된 Worker를 idle 상태로 강제 리셋."""
        try:
            panel = self.query_one("#workers-panel", WorkerPanel)
            worker = panel.selected_worker
            if worker is None:
                self.notify("No worker selected", severity="warning")
                return

            # 현재 Task 정보 저장
            current_task = worker.current_task
            prev_state = worker.state

            # Worker 리셋 (상태 무관하게 항상 리셋)
            worker.reset()
            worker.is_manually_paused = False  # 수동 일시정지도 해제

            # 파일에서도 정리
            resume_worker(worker.id)

            # Task의 할당 해제
            if current_task and self._real_orchestrator is not None:
                task = next(
                    (t for t in self._real_orchestrator.tasks if t.id == current_task), None
                )
                if task:
                    task.assigned_worker = None

            self.notify(f"Worker {worker.id} force reset: {prev_state.value} → idle")
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

    # ─────────────────────────────────────────────────────────────────────────
    # Test Mode Actions
    # ─────────────────────────────────────────────────────────────────────────

    def _update_test_mode_ui(self) -> None:
        """test 모드 UI 표시/숨김 토글."""
        try:
            test_section = self.query_one("#test-section")
            queue_section = self.query_one("#queue-section")

            if self._mode == "test":
                # test 모드: TestSelectionPanel 표시, Queue 숨김
                test_section.display = True
                queue_section.display = False
                # 태스크 목록 업데이트
                panel = self.query_one(TestSelectionPanel)
                panel.set_tasks(self._tasks)
                # SelectionList에 focus 설정
                try:
                    from textual.widgets import SelectionList
                    selection_list = self.query_one("#test-task-list", SelectionList)
                    selection_list.focus()
                except Exception:
                    pass
            else:
                # 다른 모드: Queue 표시, TestSelectionPanel 숨김
                test_section.display = False
                queue_section.display = True
                # DataTable에 focus 복원
                try:
                    table = self.query_one("#queue-table")
                    table.focus()
                except Exception:
                    pass
        except Exception:
            pass  # 위젯이 아직 마운트되지 않았을 수 있음

    async def action_run_tests(self) -> None:
        """선택된 Task에 /wf:test dispatch (test 모드 전용)."""
        if self._mode != "test":
            self.notify("Test mode에서만 사용 가능", severity="warning")
            return

        try:
            panel = self.query_one(TestSelectionPanel)
            selected_ids = panel.get_selected_task_ids()
        except Exception:
            self.notify("TestSelectionPanel not found", severity="error")
            return

        if not selected_ids:
            self.notify("테스트할 Task를 선택하세요", severity="warning")
            return

        # idle Worker 찾기
        idle_workers = [
            w for w in self._worker_list
            if w.state == WorkerState.IDLE and not w.is_manually_paused
        ]

        if not idle_workers:
            self.notify("사용 가능한 Worker 없음", severity="warning")
            return

        # 선택된 태스크에 dispatch (idle Worker 수만큼)
        dispatched = 0
        for task_id in selected_ids:
            if dispatched >= len(idle_workers):
                break

            task = next((t for t in self._tasks if t.id == task_id), None)
            if task is None:
                continue

            worker = idle_workers[dispatched]

            # dispatch 실행
            from orchay.utils.wezterm import wezterm_send_text
            command = f"/wf:test {self._project}/{task_id}"
            await wezterm_send_text(worker.pane_id, command)
            await asyncio.sleep(1.0)
            await wezterm_send_text(worker.pane_id, "\r")

            # 상태 업데이트
            worker.state = WorkerState.BUSY
            worker.current_task = task_id
            worker.current_step = "test"
            task.assigned_worker = worker.id

            dispatched += 1
            self.write_log(f"Test dispatch: {task_id} → Worker {worker.id}")

        self.notify(f"테스트 시작: {dispatched}개 Task")
        self._update_worker_panel()

    def action_toggle_select_all(self) -> None:
        """전체 선택/해제 토글 (test 모드 전용)."""
        if self._mode != "test":
            return

        try:
            panel = self.query_one(TestSelectionPanel)
            if panel.get_selected_count() > 0:
                panel.deselect_all()
                self.notify("전체 선택 해제")
            else:
                panel.select_all()
                self.notify(f"전체 선택: {panel.get_task_count()}개")
        except Exception:
            pass


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
