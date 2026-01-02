"""launcher.py 테스트."""

import argparse
import os
import platform
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest


# 테스트 시 로깅 설정을 건드리지 않도록 모킹
@pytest.fixture(autouse=True)
def mock_logging() -> Any:
    """로깅 설정 모킹."""
    with patch("orchay.launcher.logging"):
        with patch("orchay.launcher.log"):
            yield


class TestCheckDependency:
    """check_dependency 함수 테스트."""

    def test_existing_command(self) -> None:
        """존재하는 명령어."""
        from orchay.launcher import check_dependency

        # python은 항상 존재
        assert check_dependency("python") is True

    def test_nonexistent_command(self) -> None:
        """존재하지 않는 명령어."""
        from orchay.launcher import check_dependency

        assert check_dependency("nonexistent_command_xyz") is False

    def test_with_which_mock(self) -> None:
        """shutil.which 모킹."""
        from orchay.launcher import check_dependency

        with patch("shutil.which", return_value="/usr/bin/test"):
            assert check_dependency("test") is True

        with patch("shutil.which", return_value=None):
            assert check_dependency("test") is False


class TestCheckAllDependencies:
    """check_all_dependencies 함수 테스트."""

    def test_all_present(self) -> None:
        """모든 의존성 존재."""
        from orchay.launcher import check_all_dependencies

        with patch("shutil.which", return_value="/usr/bin/cmd"):
            missing = check_all_dependencies()
            assert missing == []

    def test_some_missing(self) -> None:
        """일부 의존성 누락."""
        from orchay.launcher import check_all_dependencies

        def mock_which(cmd: str) -> str | None:
            if cmd == "wezterm":
                return None
            return f"/usr/bin/{cmd}"

        with patch("shutil.which", side_effect=mock_which):
            missing = check_all_dependencies()
            assert "wezterm" in missing
            assert "claude" not in missing
            assert "uv" not in missing

    def test_all_missing(self) -> None:
        """모든 의존성 누락."""
        from orchay.launcher import check_all_dependencies

        with patch("shutil.which", return_value=None):
            missing = check_all_dependencies()
            assert set(missing) == {"wezterm", "claude", "uv"}


class TestPrintInstallGuide:
    """print_install_guide 함수 테스트."""

    def test_prints_missing_deps(self, capsys: pytest.CaptureFixture[str]) -> None:
        """누락된 의존성 출력."""
        from orchay.launcher import print_install_guide

        print_install_guide(["wezterm", "uv"])

        captured = capsys.readouterr()
        assert "wezterm" in captured.out
        assert "uv" in captured.out

    def test_shows_install_command(self, capsys: pytest.CaptureFixture[str]) -> None:
        """설치 명령어 표시."""
        from orchay.launcher import print_install_guide

        print_install_guide(["wezterm"])

        captured = capsys.readouterr()
        # 플랫폼에 따라 다른 명령어가 표시됨
        assert "설치:" in captured.out or "install" in captured.out.lower()


class TestCreateLayoutConfig:
    """create_layout_config 함수 테스트."""

    def test_single_worker(self) -> None:
        """Worker 1개."""
        from orchay.utils.launcher_helpers import create_layout_config

        assert create_layout_config(1) == [1]

    def test_two_workers(self) -> None:
        """Worker 2개."""
        from orchay.utils.launcher_helpers import create_layout_config

        assert create_layout_config(2) == [2]

    def test_three_workers(self) -> None:
        """Worker 3개."""
        from orchay.utils.launcher_helpers import create_layout_config

        assert create_layout_config(3) == [3]

    def test_four_workers(self) -> None:
        """Worker 4개 (2x2)."""
        from orchay.utils.launcher_helpers import create_layout_config

        assert create_layout_config(4) == [2, 2]

    def test_five_workers(self) -> None:
        """Worker 5개 (3+2)."""
        from orchay.utils.launcher_helpers import create_layout_config

        assert create_layout_config(5) == [3, 2]

    def test_six_workers(self) -> None:
        """Worker 6개 (3+3)."""
        from orchay.utils.launcher_helpers import create_layout_config

        assert create_layout_config(6) == [3, 3]

    def test_more_than_six_capped(self) -> None:
        """6개 초과 시 6개로 제한."""
        from orchay.utils.launcher_helpers import create_layout_config

        assert create_layout_config(10) == [3, 3]


class TestPidManagement:
    """PID 관리 함수 테스트."""

    def test_get_pid_file(self) -> None:
        """PID 파일 경로."""
        from orchay.launcher import get_pid_file

        pid_file = get_pid_file("/home/user/project")
        assert pid_file == Path("/home/user/project/.orchay/logs/wezterm.pid")

    def test_save_wezterm_pid(self, tmp_path: Path) -> None:
        """PID 저장."""
        from orchay.launcher import get_pid_file, save_wezterm_pid

        cwd = str(tmp_path)
        save_wezterm_pid(cwd, 12345)

        pid_file = get_pid_file(cwd)
        assert pid_file.exists()
        assert pid_file.read_text() == "12345"

    def test_load_wezterm_pid_exists(self, tmp_path: Path) -> None:
        """PID 로드 (파일 존재)."""
        from orchay.launcher import get_pid_file, load_wezterm_pid

        cwd = str(tmp_path)
        pid_file = get_pid_file(cwd)
        pid_file.parent.mkdir(parents=True, exist_ok=True)
        pid_file.write_text("54321")

        assert load_wezterm_pid(cwd) == 54321

    def test_load_wezterm_pid_not_exists(self, tmp_path: Path) -> None:
        """PID 로드 (파일 없음)."""
        from orchay.launcher import load_wezterm_pid

        assert load_wezterm_pid(str(tmp_path)) is None

    def test_load_wezterm_pid_invalid(self, tmp_path: Path) -> None:
        """PID 로드 (잘못된 값)."""
        from orchay.launcher import get_pid_file, load_wezterm_pid

        cwd = str(tmp_path)
        pid_file = get_pid_file(cwd)
        pid_file.parent.mkdir(parents=True, exist_ok=True)
        pid_file.write_text("not a number")

        assert load_wezterm_pid(cwd) is None


class TestGetWeztermGuiPids:
    """get_wezterm_gui_pids 함수 테스트."""

    def test_returns_set(self) -> None:
        """set 반환."""
        from orchay.launcher import get_wezterm_gui_pids

        with patch("orchay.launcher._list_processes_sync", return_value=[]):
            result = get_wezterm_gui_pids()
            assert isinstance(result, set)

    def test_extracts_pids(self) -> None:
        """PID 추출."""
        from orchay.launcher import get_wezterm_gui_pids

        mock_process1 = MagicMock()
        mock_process1.pid = 100
        mock_process2 = MagicMock()
        mock_process2.pid = 200

        with patch(
            "orchay.launcher._list_processes_sync",
            return_value=[mock_process1, mock_process2],
        ):
            result = get_wezterm_gui_pids()
            assert result == {100, 200}


class TestKillOrchayWezterm:
    """kill_orchay_wezterm 함수 테스트."""

    def test_kills_saved_pid(self, tmp_path: Path) -> None:
        """저장된 PID 종료."""
        from orchay.launcher import get_pid_file, kill_orchay_wezterm

        cwd = str(tmp_path)
        pid_file = get_pid_file(cwd)
        pid_file.parent.mkdir(parents=True, exist_ok=True)
        pid_file.write_text("12345")

        with patch("orchay.launcher._kill_process_sync") as mock_kill:
            with patch("time.sleep"):
                kill_orchay_wezterm(cwd)

            mock_kill.assert_called_once_with(12345)

    def test_no_saved_pid(self, tmp_path: Path) -> None:
        """저장된 PID 없음."""
        from orchay.launcher import kill_orchay_wezterm

        with patch("orchay.launcher._kill_process_sync") as mock_kill:
            kill_orchay_wezterm(str(tmp_path))

            mock_kill.assert_not_called()

    @pytest.mark.skipif(platform.system() == "Windows", reason="Linux only")
    def test_cleans_sockets_linux(self, tmp_path: Path) -> None:
        """Linux에서 소켓 정리."""
        from orchay.launcher import kill_orchay_wezterm

        with patch("platform.system", return_value="Linux"):
            with patch("os.getuid", return_value=1000):
                with patch("os.path.isdir", return_value=True):
                    with patch("glob.glob", return_value=[]):
                        kill_orchay_wezterm(str(tmp_path))


class TestParseArgs:
    """parse_args 함수 테스트."""

    def test_default_values(self) -> None:
        """기본값."""
        from orchay.launcher import parse_args

        with patch("sys.argv", ["launcher"]):
            launcher_args, orchay_args = parse_args()

        assert launcher_args.scheduler_cols == 100
        assert launcher_args.worker_cols == 120
        assert launcher_args.font_size == 11.0
        assert launcher_args.width == 1920
        assert launcher_args.height == 1080
        assert launcher_args.max_rows == 3

    def test_custom_scheduler_cols(self) -> None:
        """커스텀 scheduler_cols."""
        from orchay.launcher import parse_args

        with patch("sys.argv", ["launcher", "--scheduler-cols", "150"]):
            launcher_args, _ = parse_args()

        assert launcher_args.scheduler_cols == 150

    def test_custom_window_size(self) -> None:
        """커스텀 창 크기."""
        from orchay.launcher import parse_args

        with patch("sys.argv", ["launcher", "--width", "2560", "--height", "1440"]):
            launcher_args, _ = parse_args()

        assert launcher_args.width == 2560
        assert launcher_args.height == 1440

    def test_orchay_args_passed_through(self) -> None:
        """orchay 인자 전달."""
        from orchay.launcher import parse_args

        with patch(
            "sys.argv",
            ["launcher", "--scheduler-cols", "100", "-w", "5", "-m", "quick"],
        ):
            _, orchay_args = parse_args()

        assert "-w" in orchay_args
        assert "5" in orchay_args
        assert "-m" in orchay_args
        assert "quick" in orchay_args


class TestGetOrchayCmd:
    """get_orchay_cmd 함수 테스트."""

    def test_normal_execution(self) -> None:
        """일반 실행."""
        from orchay.launcher import get_orchay_cmd

        cmd = get_orchay_cmd()
        assert "uv run" in cmd
        assert "python -m orchay" in cmd

    def test_frozen_execution(self) -> None:
        """PyInstaller frozen 실행."""
        from orchay.launcher import get_orchay_cmd

        with patch("sys.frozen", True, create=True):
            with patch("sys.executable", "/path/to/orchay.exe"):
                cmd = get_orchay_cmd()

        # 경로에 orchay.exe가 포함되어 있어야 함
        assert "orchay.exe" in cmd


class TestGetProjectDir:
    """_get_project_dir 함수 테스트."""

    def test_normal_execution(self) -> None:
        """일반 실행."""
        from orchay.launcher import _get_project_dir

        project_dir = _get_project_dir()
        assert project_dir.is_dir() or not project_dir.exists()

    def test_frozen_execution(self) -> None:
        """PyInstaller frozen 실행."""
        from orchay.launcher import _get_project_dir

        with patch("sys.frozen", True, create=True):
            with patch("sys.executable", "/path/to/dist/orchay.exe"):
                project_dir = _get_project_dir()

        # 디렉토리 이름만 확인 (경로 구분자 무관)
        assert project_dir.name == "dist"


class TestShowOrchayHelp:
    """show_orchay_help 함수 테스트."""

    def test_frozen_prints_help(self, capsys: pytest.CaptureFixture[str]) -> None:
        """frozen 모드에서 도움말 출력."""
        from orchay.launcher import show_orchay_help

        with patch("sys.frozen", True, create=True):
            result = show_orchay_help()

        assert result == 0
        captured = capsys.readouterr()
        assert "orchay" in captured.out.lower()

    def test_normal_calls_subprocess(self) -> None:
        """일반 모드에서 subprocess 호출."""
        from orchay.launcher import show_orchay_help

        mock_result = MagicMock()
        mock_result.returncode = 0

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            with patch("orchay.launcher.get_orchay_cmd", return_value="uv run python -m orchay"):
                result = show_orchay_help()

        assert result == 0
        mock_run.assert_called_once()


class TestGetBundledFile:
    """_get_bundled_file 함수 테스트."""

    def test_normal_execution(self) -> None:
        """일반 실행."""
        from orchay.launcher import _get_bundled_file

        path = _get_bundled_file("test.txt")
        assert path.name == "test.txt"

    def test_frozen_with_meipass(self) -> None:
        """PyInstaller frozen (MEIPASS)."""
        from orchay.launcher import _get_bundled_file

        with patch("sys.frozen", True, create=True):
            with patch("sys._MEIPASS", "/tmp/meipass", create=True):
                path = _get_bundled_file("test.txt")

        # 파일 이름과 부모 디렉토리 이름만 확인 (경로 구분자 무관)
        assert path.name == "test.txt"
        assert path.parent.name == "meipass"


class TestGetLogFile:
    """_get_log_file 함수 테스트."""

    def test_finds_orchay_dir(self, tmp_path: Path) -> None:
        """orchay 디렉토리 찾기."""
        from orchay.launcher import _get_log_file

        orchay_dir = tmp_path / ".orchay"
        orchay_dir.mkdir()

        with patch("pathlib.Path.cwd", return_value=tmp_path):
            log_file = _get_log_file()

        assert log_file.parent.parent == orchay_dir

    def test_fallback_to_cwd(self, tmp_path: Path) -> None:
        """orchay 디렉토리 없으면 현재 폴더."""
        from orchay.launcher import _get_log_file

        with patch("pathlib.Path.cwd", return_value=tmp_path):
            log_file = _get_log_file()

        assert log_file == tmp_path / "launcher.log"


class TestLaunchWeztermWindows:
    """WindowsLauncher 클래스 테스트."""

    @pytest.mark.skipif(platform.system() != "Windows", reason="Windows only")
    def test_creates_startup_config(self, tmp_path: Path) -> None:
        """startup config 파일 생성."""
        from orchay.utils.wezterm_launcher import LaunchContext, WindowsLauncher

        # 최소 설정으로 Config mock 생성
        mock_config = MagicMock()
        mock_config.launcher.width = 1920
        mock_config.launcher.height = 1080
        mock_config.launcher.max_rows = 3
        mock_config.launcher.scheduler_cols = 100
        mock_config.launcher.worker_cols = 120
        mock_config.launcher.font_size = 11.0
        mock_config.launcher.startup_delay_windows = 0.1
        mock_config.launcher.config_filename = "orchay-startup.json"
        mock_config.launcher.lua_config_file = "wezterm-orchay.lua"
        mock_config.worker_command.startup = "claude --dangerously-skip-permissions"
        mock_config.worker_command.pane_startup = {}

        mock_logger = MagicMock()
        context = LaunchContext(
            cwd=str(tmp_path),
            workers=3,
            orchay_cmd_list=["orchay", "run"],
            config=mock_config,
            logger=mock_logger,
        )

        launcher = WindowsLauncher(context)

        with patch("subprocess.Popen"):
            with patch("time.sleep"):
                with patch.object(
                    launcher, "_get_wezterm_pids", return_value=set()
                ):
                    with patch.object(
                        launcher,
                        "_get_bundled_file",
                        return_value=tmp_path / "wezterm.lua",
                    ):
                        with patch.dict(os.environ, {}, clear=False):
                            result = launcher.launch()

        assert result == 0


class TestLaunchWeztermLinux:
    """LinuxLauncher 클래스 테스트."""

    @pytest.mark.skipif(platform.system() == "Windows", reason="Linux/macOS only")
    def test_starts_wezterm(self, tmp_path: Path) -> None:
        """WezTerm 시작."""
        from orchay.utils.wezterm_launcher import LaunchContext, LinuxLauncher

        # 최소 설정으로 Config mock 생성
        mock_config = MagicMock()
        mock_config.launcher.width = 1920
        mock_config.launcher.height = 1080
        mock_config.launcher.max_rows = 3
        mock_config.launcher.scheduler_cols = 100
        mock_config.launcher.worker_cols = 120
        mock_config.launcher.font_size = 11.0
        mock_config.launcher.startup_delay_linux = 0.1
        mock_config.worker_command.startup = "claude --dangerously-skip-permissions"
        mock_config.worker_command.pane_startup = {}

        mock_logger = MagicMock()
        context = LaunchContext(
            cwd=str(tmp_path),
            workers=3,
            orchay_cmd_list=["orchay", "run"],
            config=mock_config,
            logger=mock_logger,
        )

        launcher = LinuxLauncher(context)

        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "1"

        with patch("subprocess.Popen"):
            with patch("subprocess.run", return_value=mock_result):
                with patch("time.sleep"):
                    with patch("shutil.which", return_value=None):  # no wmctrl
                        with patch.object(
                            launcher, "_get_wezterm_pids", return_value=set()
                        ):
                            result = launcher.launch()

        assert result == 0


class TestMain:
    """main 함수 테스트."""

    def test_missing_dependencies(self) -> None:
        """의존성 누락 시 종료."""
        from orchay.launcher import main

        with patch("sys.argv", ["launcher"]):
            with patch(
                "orchay.launcher.check_all_dependencies", return_value=["wezterm"]
            ):
                with patch("orchay.launcher.print_install_guide"):
                    result = main()

        assert result == 1

    def test_delegates_to_cli(self) -> None:
        """서브커맨드 있으면 cli로 위임."""
        from orchay.launcher import main

        with patch("sys.argv", ["launcher", "run", "orchay"]):
            with patch("orchay.launcher.check_all_dependencies", return_value=[]):
                with patch("orchay.cli.cli_main", return_value=42) as mock_cli:
                    result = main()

        mock_cli.assert_called_once()
        assert result == 42

    def test_shows_help(self, capsys: pytest.CaptureFixture[str]) -> None:
        """--help 옵션."""
        from orchay.launcher import main

        with patch("sys.argv", ["launcher", "--help"]):
            with patch("orchay.launcher.check_all_dependencies", return_value=[]):
                with patch("orchay.launcher.show_orchay_help", return_value=0):
                    result = main()

        assert result == 0
        captured = capsys.readouterr()
        assert "Launcher" in captured.out

    def test_loads_yaml_config(self, tmp_path: Path) -> None:
        """YAML 설정 로드."""
        from orchay.launcher import main

        # 설정 파일 생성
        settings_dir = tmp_path / ".orchay" / "settings"
        settings_dir.mkdir(parents=True)
        yaml_file = settings_dir / "orchay.yaml"
        yaml_file.write_text("workers: 5\nlauncher:\n  width: 2560\n")

        mock_launcher = MagicMock()
        mock_launcher.launch.return_value = 0

        with patch("sys.argv", ["launcher"]):
            with patch("os.getcwd", return_value=str(tmp_path)):
                with patch("orchay.launcher.check_all_dependencies", return_value=[]):
                    with patch("platform.system", return_value="Windows"):
                        with patch(
                            "orchay.utils.wezterm_launcher.create_launcher",
                            return_value=mock_launcher,
                        ) as mock_create:
                            with patch("orchay.launcher.kill_orchay_wezterm"):
                                result = main()

        assert result == 0
        mock_create.assert_called_once()
        mock_launcher.launch.assert_called_once()

    def test_cli_overrides_yaml(self, tmp_path: Path) -> None:
        """CLI 인자가 YAML 설정 오버라이드."""
        from orchay.launcher import main

        # 설정 파일 생성 (workers: 3)
        settings_dir = tmp_path / ".orchay" / "settings"
        settings_dir.mkdir(parents=True)
        yaml_file = settings_dir / "orchay.yaml"
        yaml_file.write_text("workers: 3\n")

        mock_launcher = MagicMock()
        mock_launcher.launch.return_value = 0

        with patch("sys.argv", ["launcher", "-w", "5"]):
            with patch("os.getcwd", return_value=str(tmp_path)):
                with patch("orchay.launcher.check_all_dependencies", return_value=[]):
                    with patch("platform.system", return_value="Windows"):
                        with patch(
                            "orchay.utils.wezterm_launcher.create_launcher",
                            return_value=mock_launcher,
                        ) as mock_create:
                            with patch("orchay.launcher.kill_orchay_wezterm"):
                                result = main()

        assert result == 0
        # workers=5가 사용되어야 함 (create_launcher의 context.workers)
        call_args = mock_create.call_args
        context = call_args[0][0]  # LaunchContext
        assert context.workers == 5

    def test_platform_dispatch_windows(self, tmp_path: Path) -> None:
        """Windows에서 WindowsLauncher 사용."""
        from orchay.launcher import main

        mock_launcher = MagicMock()
        mock_launcher.launch.return_value = 0

        with patch("sys.argv", ["launcher"]):
            with patch("os.getcwd", return_value=str(tmp_path)):
                with patch("orchay.launcher.check_all_dependencies", return_value=[]):
                    with patch("platform.system", return_value="Windows"):
                        with patch(
                            "orchay.utils.wezterm_launcher.create_launcher",
                            return_value=mock_launcher,
                        ) as mock_create:
                            with patch("orchay.launcher.kill_orchay_wezterm"):
                                main()

        mock_create.assert_called_once()
        mock_launcher.launch.assert_called_once()

    def test_platform_dispatch_linux(self, tmp_path: Path) -> None:
        """Linux에서 LinuxLauncher 사용."""
        from orchay.launcher import main

        mock_launcher = MagicMock()
        mock_launcher.launch.return_value = 0

        with patch("sys.argv", ["launcher"]):
            with patch("os.getcwd", return_value=str(tmp_path)):
                with patch("orchay.launcher.check_all_dependencies", return_value=[]):
                    with patch("platform.system", return_value="Linux"):
                        with patch(
                            "orchay.utils.wezterm_launcher.create_launcher",
                            return_value=mock_launcher,
                        ) as mock_create:
                            with patch("orchay.launcher.kill_orchay_wezterm"):
                                main()

        mock_create.assert_called_once()
        mock_launcher.launch.assert_called_once()


class TestFlushFileHandler:
    """FlushFileHandler 테스트."""

    def test_inherits_file_handler(self) -> None:
        """FileHandler 상속."""
        import logging

        from orchay.launcher import FlushFileHandler

        assert issubclass(FlushFileHandler, logging.FileHandler)
