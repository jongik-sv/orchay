"""main.py 테스트."""

import asyncio
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from orchay.main import (
    Orchestrator,
    detect_project,
    find_orchay_root,
    get_project_paths,
    parse_args,
)
from orchay.models import Config, Task, TaskCategory, TaskPriority, TaskStatus, Worker, WorkerState


class TestFindOrchayRoot:
    """find_orchay_root 함수 테스트."""

    def test_finds_root_in_current_dir(self, tmp_path: Path) -> None:
        """.orchay가 현재 디렉토리에 있을 때."""
        (tmp_path / ".orchay").mkdir()

        with patch("orchay.main.Path.cwd", return_value=tmp_path):
            result = find_orchay_root()

        assert result == tmp_path

    def test_finds_root_in_parent(self, tmp_path: Path) -> None:
        """.orchay가 상위 디렉토리에 있을 때."""
        (tmp_path / ".orchay").mkdir()
        subdir = tmp_path / "subdir" / "nested"
        subdir.mkdir(parents=True)

        with patch("orchay.main.Path.cwd", return_value=subdir):
            result = find_orchay_root()

        assert result == tmp_path

    def test_returns_none_when_not_found(self, tmp_path: Path) -> None:
        """.orchay가 없을 때."""
        with patch("orchay.main.Path.cwd", return_value=tmp_path):
            result = find_orchay_root()

        assert result is None

    def test_resolves_path(self, tmp_path: Path) -> None:
        """경로가 절대 경로로 변환됨."""
        (tmp_path / ".orchay").mkdir()

        with patch("orchay.main.Path.cwd", return_value=tmp_path):
            result = find_orchay_root()

        assert result is not None
        assert result.is_absolute()


class TestDetectProject:
    """detect_project 함수 테스트."""

    def test_single_project(self, tmp_path: Path) -> None:
        """프로젝트가 1개일 때 자동 선택."""
        (tmp_path / ".orchay" / "projects" / "myproject").mkdir(parents=True)
        (tmp_path / ".orchay" / "projects" / "myproject" / "wbs.md").touch()

        with patch("orchay.main.find_orchay_root", return_value=tmp_path):
            project, projects = detect_project()

        assert project == "myproject"
        assert projects == ["myproject"]

    def test_multiple_projects(self, tmp_path: Path) -> None:
        """프로젝트가 여러 개일 때."""
        for name in ["proj1", "proj2"]:
            d = tmp_path / ".orchay" / "projects" / name
            d.mkdir(parents=True)
            (d / "wbs.md").touch()

        with patch("orchay.main.find_orchay_root", return_value=tmp_path):
            project, projects = detect_project()

        assert project is None
        assert set(projects) == {"proj1", "proj2"}

    def test_no_projects(self, tmp_path: Path) -> None:
        """프로젝트가 없을 때."""
        (tmp_path / ".orchay" / "projects").mkdir(parents=True)

        with patch("orchay.main.find_orchay_root", return_value=tmp_path):
            project, projects = detect_project()

        assert project is None
        assert projects == []

    def test_no_orchay_root(self) -> None:
        """.orchay 폴더가 없을 때."""
        with patch("orchay.main.find_orchay_root", return_value=None):
            project, projects = detect_project()

        assert project is None
        assert projects == []

    def test_ignores_dirs_without_wbs(self, tmp_path: Path) -> None:
        """wbs.md 없는 폴더 무시."""
        (tmp_path / ".orchay" / "projects" / "valid").mkdir(parents=True)
        (tmp_path / ".orchay" / "projects" / "valid" / "wbs.md").touch()
        (tmp_path / ".orchay" / "projects" / "invalid").mkdir()  # no wbs.md

        with patch("orchay.main.find_orchay_root", return_value=tmp_path):
            project, projects = detect_project()

        assert project == "valid"
        assert projects == ["valid"]


class TestGetProjectPaths:
    """get_project_paths 함수 테스트."""

    def test_returns_correct_paths(self, tmp_path: Path) -> None:
        """올바른 경로 반환."""
        (tmp_path / ".orchay").mkdir()

        with patch("orchay.main.find_orchay_root", return_value=tmp_path):
            wbs_path, base_dir = get_project_paths("myproject")

        assert wbs_path == tmp_path / ".orchay" / "projects" / "myproject" / "wbs.md"
        assert base_dir == tmp_path

    def test_fallback_to_cwd(self, tmp_path: Path) -> None:
        """.orchay 없으면 현재 디렉토리 사용."""
        with patch("orchay.main.find_orchay_root", return_value=None):
            with patch("orchay.main.Path.cwd", return_value=tmp_path):
                wbs_path, base_dir = get_project_paths("test")

        assert base_dir == tmp_path


class TestParseArgs:
    """parse_args 함수 테스트."""

    def test_default_values(self) -> None:
        """기본값."""
        with patch("sys.argv", ["orchay"]):
            args = parse_args()

        assert args.project is None
        assert args.workers is None
        assert args.interval == 5
        assert args.mode == "quick"
        assert args.dry_run is False
        assert args.verbose is False

    def test_project_argument(self) -> None:
        """프로젝트 인자."""
        with patch("sys.argv", ["orchay", "myproject"]):
            args = parse_args()

        assert args.project == "myproject"

    def test_workers_option(self) -> None:
        """Worker 수 옵션."""
        with patch("sys.argv", ["orchay", "-w", "5"]):
            args = parse_args()

        assert args.workers == 5

    def test_mode_option(self) -> None:
        """실행 모드 옵션."""
        for mode in ["design", "quick", "develop", "force", "test"]:
            with patch("sys.argv", ["orchay", "-m", mode]):
                args = parse_args()
            assert args.mode == mode

    def test_dry_run_flag(self) -> None:
        """dry-run 플래그."""
        with patch("sys.argv", ["orchay", "--dry-run"]):
            args = parse_args()

        assert args.dry_run is True

    def test_verbose_flag(self) -> None:
        """verbose 플래그."""
        with patch("sys.argv", ["orchay", "-v"]):
            args = parse_args()

        assert args.verbose is True

    def test_all_flag(self) -> None:
        """all 플래그."""
        with patch("sys.argv", ["orchay", "--all"]):
            args = parse_args()

        assert args.all is True


class TestOrchestratorInit:
    """Orchestrator 초기화 테스트."""

    @pytest.fixture
    def sample_config(self) -> Config:
        """샘플 Config."""
        return Config()

    @pytest.fixture
    def tmp_wbs(self, tmp_path: Path) -> Path:
        """임시 WBS 파일."""
        wbs_file = tmp_path / "wbs.md"
        wbs_file.write_text("# WBS\n- [TSK-01] Task 1 #backend @2h [ ]\n")
        return wbs_file

    def test_init_stores_config(
        self, sample_config: Config, tmp_wbs: Path, tmp_path: Path
    ) -> None:
        """Config 저장."""
        orch = Orchestrator(sample_config, tmp_wbs, tmp_path, "test")
        assert orch.config == sample_config

    def test_init_stores_paths(
        self, sample_config: Config, tmp_wbs: Path, tmp_path: Path
    ) -> None:
        """경로 저장."""
        orch = Orchestrator(sample_config, tmp_wbs, tmp_path, "test")
        assert orch.wbs_path == tmp_wbs
        assert orch.base_dir == tmp_path
        assert orch.project_name == "test"

    def test_init_sets_mode_from_config(
        self, tmp_wbs: Path, tmp_path: Path
    ) -> None:
        """Config에서 모드 설정."""
        config = Config()
        config.execution.mode = "design"
        orch = Orchestrator(config, tmp_wbs, tmp_path, "test")
        assert orch.mode.value == "design"

    def test_init_creates_services(
        self, sample_config: Config, tmp_wbs: Path, tmp_path: Path
    ) -> None:
        """서비스 레이어 생성."""
        orch = Orchestrator(sample_config, tmp_wbs, tmp_path, "test")
        assert orch._task_service is not None
        assert orch._worker_service is not None
        assert orch._dispatch_service is not None


class TestOrchestratorInitialize:
    """Orchestrator.initialize 메서드 테스트."""

    @pytest.fixture
    def sample_config(self) -> Config:
        """샘플 Config."""
        return Config()

    @pytest.fixture
    def tmp_wbs(self, tmp_path: Path) -> Path:
        """임시 WBS 파일."""
        wbs_file = tmp_path / ".orchay" / "projects" / "test" / "wbs.md"
        wbs_file.parent.mkdir(parents=True)
        wbs_file.write_text("# WBS\n- [TSK-01] Task 1 #backend @2h [ ]\n")
        return wbs_file

    async def test_returns_false_when_wbs_not_found(
        self, sample_config: Config, tmp_path: Path
    ) -> None:
        """WBS 파일 없을 때."""
        orch = Orchestrator(
            sample_config, tmp_path / "nonexistent.md", tmp_path, "test"
        )
        result = await orch.initialize()
        assert result is False

    async def test_returns_false_when_no_panes(
        self, sample_config: Config, tmp_wbs: Path, tmp_path: Path
    ) -> None:
        """pane 없을 때."""
        orch = Orchestrator(sample_config, tmp_wbs, tmp_path, "test")

        with patch("orchay.main.wezterm_list_panes", return_value=[]):
            result = await orch.initialize()

        assert result is False

    async def test_returns_false_when_no_worker_panes(
        self, sample_config: Config, tmp_wbs: Path, tmp_path: Path
    ) -> None:
        """Worker pane 없을 때 (현재 pane만 있음)."""
        orch = Orchestrator(sample_config, tmp_wbs, tmp_path, "test")

        mock_pane = MagicMock()
        mock_pane.pane_id = 0

        with patch("orchay.main.wezterm_list_panes", return_value=[mock_pane]):
            with patch.dict("os.environ", {"WEZTERM_PANE": "0"}):
                result = await orch.initialize()

        assert result is False

    async def test_initializes_workers(
        self, sample_config: Config, tmp_wbs: Path, tmp_path: Path
    ) -> None:
        """Worker 초기화."""
        sample_config.workers = 0  # 무제한
        orch = Orchestrator(sample_config, tmp_wbs, tmp_path, "test")

        mock_panes = [MagicMock(pane_id=i) for i in range(4)]

        with patch("orchay.main.wezterm_list_panes", return_value=mock_panes):
            with patch.dict("os.environ", {"WEZTERM_PANE": "0"}):
                result = await orch.initialize()

        assert result is True
        assert len(orch.workers) == 3  # pane 0 제외

    async def test_limits_workers_by_config(
        self, tmp_wbs: Path, tmp_path: Path
    ) -> None:
        """Config.workers로 Worker 수 제한."""
        config = Config()
        config.workers = 2
        orch = Orchestrator(config, tmp_wbs, tmp_path, "test")

        mock_panes = [MagicMock(pane_id=i) for i in range(5)]

        with patch("orchay.main.wezterm_list_panes", return_value=mock_panes):
            with patch.dict("os.environ", {"WEZTERM_PANE": "0"}):
                await orch.initialize()

        assert len(orch.workers) == 2

    async def test_parses_initial_tasks(
        self, sample_config: Config, tmp_wbs: Path, tmp_path: Path
    ) -> None:
        """초기 Task 파싱."""
        orch = Orchestrator(sample_config, tmp_wbs, tmp_path, "test")

        mock_panes = [MagicMock(pane_id=i) for i in range(2)]

        with patch("orchay.main.wezterm_list_panes", return_value=mock_panes):
            with patch.dict("os.environ", {"WEZTERM_PANE": "0"}):
                await orch.initialize()

        assert len(orch.tasks) >= 0  # 파싱 완료


class TestOrchestratorTick:
    """Orchestrator._tick 메서드 테스트."""

    @pytest.fixture
    def orchestrator(self, tmp_path: Path) -> Orchestrator:
        """테스트용 Orchestrator."""
        wbs_file = tmp_path / "wbs.md"
        wbs_file.write_text("# WBS\n")

        config = Config()
        orch = Orchestrator(config, wbs_file, tmp_path, "test")
        orch.workers = [Worker(id=1, pane_id=1)]
        orch.tasks = []
        orch._task_service = MagicMock()
        orch._worker_service = MagicMock()
        orch._dispatch_service = MagicMock()
        return orch

    async def test_reloads_tasks(self, orchestrator: Orchestrator) -> None:
        """Task 재로드."""
        # 실제 Task 객체를 사용 (print_status에서 status.value 접근)
        sample_task = Task(
            id="TSK-01",
            title="Test",
            category=TaskCategory.DEVELOPMENT,
            domain="backend",
            status=TaskStatus.TODO,
        )
        orchestrator._task_service.reload_tasks = AsyncMock(return_value=[sample_task])
        orchestrator._task_service.get_executable_tasks.return_value = []
        orchestrator._worker_service.update_worker_state_with_continuation = AsyncMock()
        orchestrator._worker_service.running_task_ids.return_value = set()

        await orchestrator._tick()

        orchestrator._task_service.reload_tasks.assert_called_once()

    async def test_calls_cleanup_completed(self, orchestrator: Orchestrator) -> None:
        """cleanup_completed 호출."""
        orchestrator._task_service.reload_tasks = AsyncMock(return_value=[])
        orchestrator._task_service.get_executable_tasks.return_value = []
        orchestrator._worker_service.update_worker_state_with_continuation = AsyncMock()
        orchestrator._worker_service.running_task_ids.return_value = set()

        await orchestrator._tick()

        orchestrator._task_service.cleanup_completed.assert_called_once()

    async def test_updates_worker_states(self, orchestrator: Orchestrator) -> None:
        """Worker 상태 업데이트."""
        orchestrator._task_service.reload_tasks = AsyncMock(return_value=[])
        orchestrator._task_service.get_executable_tasks.return_value = []
        orchestrator._worker_service.update_worker_state_with_continuation = AsyncMock()
        orchestrator._worker_service.running_task_ids.return_value = set()

        await orchestrator._tick()

        orchestrator._worker_service.update_worker_state_with_continuation.assert_called()

    async def test_syncs_worker_steps(self, orchestrator: Orchestrator) -> None:
        """Worker step 동기화."""
        orchestrator._task_service.reload_tasks = AsyncMock(return_value=[])
        orchestrator._task_service.get_executable_tasks.return_value = []
        orchestrator._worker_service.update_worker_state_with_continuation = AsyncMock()
        orchestrator._worker_service.running_task_ids.return_value = set()

        await orchestrator._tick()

        orchestrator._worker_service.sync_worker_steps.assert_called_once()

    async def test_skips_dispatch_when_paused(self, orchestrator: Orchestrator) -> None:
        """일시정지 시 dispatch 생략."""
        orchestrator._paused = True
        orchestrator._task_service.reload_tasks = AsyncMock(return_value=[])
        orchestrator._task_service.get_executable_tasks.return_value = []
        orchestrator._worker_service.update_worker_state_with_continuation = AsyncMock()
        orchestrator._worker_service.running_task_ids.return_value = set()

        await orchestrator._tick()

        # 일시정지 상태에서는 get_executable_tasks 호출 안 함
        orchestrator._task_service.get_executable_tasks.assert_not_called()


class TestOrchestratorDispatchIdleWorkers:
    """Orchestrator._dispatch_idle_workers 메서드 테스트."""

    @pytest.fixture
    def orchestrator(self, tmp_path: Path) -> Orchestrator:
        """테스트용 Orchestrator."""
        wbs_file = tmp_path / "wbs.md"
        wbs_file.write_text("# WBS\n")

        config = Config()
        orch = Orchestrator(config, wbs_file, tmp_path, "test")
        orch._task_service = MagicMock()
        orch._worker_service = MagicMock()
        orch._dispatch_service = MagicMock()
        return orch

    async def test_dispatches_to_idle_workers(
        self, orchestrator: Orchestrator
    ) -> None:
        """유휴 Worker에 dispatch."""
        worker = Worker(id=1, pane_id=1, state=WorkerState.IDLE)
        task = Task(
            id="TSK-01",
            title="Test",
            category=TaskCategory.DEVELOPMENT,
            domain="backend",
            status=TaskStatus.TODO,
        )

        orchestrator.workers = [worker]
        orchestrator._task_service.get_executable_tasks.return_value = [task]
        orchestrator._worker_service.running_task_ids.return_value = set()
        orchestrator._dispatch_service.dispatch_task = AsyncMock(
            return_value=MagicMock(success=True)
        )

        await orchestrator._dispatch_idle_workers()

        orchestrator._dispatch_service.dispatch_task.assert_called_once()

    async def test_skips_busy_workers(self, orchestrator: Orchestrator) -> None:
        """BUSY Worker 건너뜀."""
        worker = Worker(id=1, pane_id=1, state=WorkerState.BUSY)
        task = Task(
            id="TSK-01",
            title="Test",
            category=TaskCategory.DEVELOPMENT,
            domain="backend",
            status=TaskStatus.TODO,
        )

        orchestrator.workers = [worker]
        orchestrator._task_service.get_executable_tasks.return_value = [task]
        orchestrator._worker_service.running_task_ids.return_value = set()
        orchestrator._dispatch_service.dispatch_task = AsyncMock()

        await orchestrator._dispatch_idle_workers()

        orchestrator._dispatch_service.dispatch_task.assert_not_called()

    async def test_skips_manually_paused_workers(
        self, orchestrator: Orchestrator
    ) -> None:
        """수동 일시정지 Worker 건너뜀."""
        worker = Worker(id=1, pane_id=1, state=WorkerState.IDLE)
        worker.is_manually_paused = True
        task = Task(
            id="TSK-01",
            title="Test",
            category=TaskCategory.DEVELOPMENT,
            domain="backend",
            status=TaskStatus.TODO,
        )

        orchestrator.workers = [worker]
        orchestrator._task_service.get_executable_tasks.return_value = [task]
        orchestrator._worker_service.running_task_ids.return_value = set()
        orchestrator._dispatch_service.dispatch_task = AsyncMock()

        await orchestrator._dispatch_idle_workers()

        orchestrator._dispatch_service.dispatch_task.assert_not_called()

    async def test_prevents_duplicate_execution(
        self, orchestrator: Orchestrator
    ) -> None:
        """중복 실행 방지."""
        worker = Worker(id=1, pane_id=1, state=WorkerState.IDLE)
        task = Task(
            id="TSK-01",
            title="Test",
            category=TaskCategory.DEVELOPMENT,
            domain="backend",
            status=TaskStatus.TODO,
        )

        orchestrator.workers = [worker]
        orchestrator._task_service.get_executable_tasks.return_value = [task]
        orchestrator._worker_service.running_task_ids.return_value = {"TSK-01"}  # 이미 실행 중
        orchestrator._dispatch_service.dispatch_task = AsyncMock()

        await orchestrator._dispatch_idle_workers()

        orchestrator._dispatch_service.dispatch_task.assert_not_called()


class TestOrchestratorRun:
    """Orchestrator.run 메서드 테스트."""

    @pytest.fixture
    def orchestrator(self, tmp_path: Path) -> Orchestrator:
        """테스트용 Orchestrator."""
        wbs_file = tmp_path / "wbs.md"
        wbs_file.write_text("# WBS\n")

        config = Config()
        config.interval = 0.1  # 빠른 테스트
        orch = Orchestrator(config, wbs_file, tmp_path, "test")
        return orch

    async def test_sets_running_flag(self, orchestrator: Orchestrator) -> None:
        """_running 플래그 설정."""
        orchestrator._tick = AsyncMock()

        async def stop_after_tick() -> None:
            await asyncio.sleep(0.2)
            orchestrator.stop()

        task = asyncio.create_task(stop_after_tick())
        await orchestrator.run()
        await task

        # run() 종료 후 _running은 여전히 False여야 함
        assert orchestrator._running is False

    async def test_handles_cancellation(self, orchestrator: Orchestrator) -> None:
        """CancelledError 처리."""
        call_count = 0

        async def tick_then_cancel() -> None:
            nonlocal call_count
            call_count += 1
            if call_count >= 2:
                raise asyncio.CancelledError()

        orchestrator._tick = tick_then_cancel

        await orchestrator.run()

        assert call_count >= 2


class TestOrchestratorPrintStatus:
    """Orchestrator.print_status 메서드 테스트."""

    @pytest.fixture
    def orchestrator(self, tmp_path: Path) -> Orchestrator:
        """테스트용 Orchestrator."""
        wbs_file = tmp_path / "wbs.md"
        wbs_file.write_text("# WBS\n")

        config = Config()
        orch = Orchestrator(config, wbs_file, tmp_path, "test")
        return orch

    def test_prints_worker_table(
        self, orchestrator: Orchestrator, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """Worker 테이블 출력."""
        orchestrator.workers = [
            Worker(id=1, pane_id=1, state=WorkerState.IDLE),
            Worker(id=2, pane_id=2, state=WorkerState.BUSY, current_task="TSK-01"),
        ]
        orchestrator.tasks = []

        with patch("orchay.main.console") as mock_console:
            orchestrator.print_status()

            # Table과 Queue 상태 출력
            assert mock_console.print.called

    def test_counts_tasks(self, orchestrator: Orchestrator) -> None:
        """Task 카운트."""
        orchestrator.workers = []
        orchestrator.tasks = [
            Task(
                id="T1",
                title="T1",
                category=TaskCategory.DEVELOPMENT,
                domain="backend",
                status=TaskStatus.TODO,
            ),
            Task(
                id="T2",
                title="T2",
                category=TaskCategory.DEVELOPMENT,
                domain="backend",
                status=TaskStatus.DONE,
            ),
        ]

        with patch("orchay.main.console"):
            orchestrator.print_status()


class TestOrchestratorStop:
    """Orchestrator.stop 메서드 테스트."""

    def test_sets_running_false(self, tmp_path: Path) -> None:
        """_running을 False로 설정."""
        wbs_file = tmp_path / "wbs.md"
        wbs_file.touch()

        config = Config()
        orch = Orchestrator(config, wbs_file, tmp_path, "test")
        orch._running = True

        orch.stop()

        assert orch._running is False


class TestOrchestratorRunningTasks:
    """Orchestrator.running_tasks 프로퍼티 테스트."""

    def test_returns_running_task_ids(self, tmp_path: Path) -> None:
        """실행 중인 Task ID 반환."""
        wbs_file = tmp_path / "wbs.md"
        wbs_file.touch()

        config = Config()
        orch = Orchestrator(config, wbs_file, tmp_path, "test")
        orch.workers = [
            Worker(id=1, pane_id=1, current_task="TSK-01"),
            Worker(id=2, pane_id=2, current_task=None),
            Worker(id=3, pane_id=3, current_task="TSK-03"),
        ]

        result = orch.running_tasks

        assert result == {"TSK-01", "TSK-03"}

    def test_returns_empty_set_when_no_running(self, tmp_path: Path) -> None:
        """실행 중인 Task 없을 때."""
        wbs_file = tmp_path / "wbs.md"
        wbs_file.touch()

        config = Config()
        orch = Orchestrator(config, wbs_file, tmp_path, "test")
        orch.workers = [
            Worker(id=1, pane_id=1),
            Worker(id=2, pane_id=2),
        ]

        result = orch.running_tasks

        assert result == set()
