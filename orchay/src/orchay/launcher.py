#!/usr/bin/env python3
"""WezTerm 레이아웃으로 orchay 스케줄러 실행.

사용법:
    python launcher.py [OPTIONS]
    python launcher.py --help                    # 도움말 표시
    python launcher.py -w 5                      # Worker 5개로 실행
    python launcher.py --width 1920 --height 1080  # 창 크기 지정
    python launcher.py --max-rows 3              # 열당 최대 3개 worker
    python launcher.py -w 5 -m quick             # 조합 사용

Launcher 옵션:
    -w, --workers N       Worker pane 개수 (기본: 3)
    --width N             창 너비 픽셀 (기본: 1920)
    --height N            창 높이 픽셀 (기본: 1080)
    --max-rows N          열당 최대 worker 수 (기본: 3)
    --scheduler-cols N    스케줄러 너비 columns (기본: 100)
    --worker-cols N       Worker 너비 columns (기본: 120)
    --font-size F         폰트 크기 (기본: 11.0)

나머지 옵션은 orchay에 전달됩니다 (-m, --dry-run 등)
"""

from __future__ import annotations

import argparse
import contextlib
import glob
import logging
import os
import platform
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

# 직접 실행 시 패키지 경로 추가 (import 전에 실행되어야 함)
_src_path = Path(__file__).resolve().parent.parent
if str(_src_path) not in sys.path:
    sys.path.insert(0, str(_src_path))

from orchay.utils.process import _kill_process_sync, _list_processes_sync

# 로그 파일 설정 (.orchay/logs/ 폴더에 저장)
def _get_log_file() -> Path:
    """프로젝트 루트의 .orchay/logs/launcher.log 경로 반환."""
    cwd = Path.cwd()
    for parent in [cwd, *cwd.parents]:
        orchay_dir = parent / ".orchay"
        if orchay_dir.is_dir():
            logs_dir = orchay_dir / "logs"
            logs_dir.mkdir(exist_ok=True)
            return logs_dir / "launcher.log"
    # .orchay 없으면 현재 폴더에 생성
    return cwd / "launcher.log"

LOG_FILE = _get_log_file()

# 즉시 플러시되는 파일 핸들러
class FlushFileHandler(logging.FileHandler):
    def emit(self, record: logging.LogRecord) -> None:
        super().emit(record)
        self.flush()

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        FlushFileHandler(LOG_FILE, mode="w", encoding="utf-8"),  # 덮어쓰기 모드
    ],
)
log = logging.getLogger("launcher")
log.info(f"=== LAUNCHER START === PID: {os.getpid()}")

# 플랫폼별 설치 안내
INSTALL_GUIDE: dict[str, dict[str, str]] = {
    "wezterm": {
        "Windows": "winget install wez.wezterm",
        "Linux": "sudo apt install wezterm  # https://wezfurlong.org/wezterm/install/linux.html",
        "Darwin": "brew install --cask wezterm",
    },
    "claude": {
        "Windows": "irm https://claude.ai/install.ps1 | iex",
        "Linux": "curl -fsSL https://claude.ai/install.sh | bash",
        "Darwin": "curl -fsSL https://claude.ai/install.sh | bash",
    },
    "uv": {
        "Windows": "irm https://astral.sh/uv/install.ps1 | iex",
        "Linux": "curl -LsSf https://astral.sh/uv/install.sh | sh",
        "Darwin": "curl -LsSf https://astral.sh/uv/install.sh | sh",
    },
}


def check_dependency(cmd: str) -> bool:
    """명령어가 PATH에 있는지 확인."""
    return shutil.which(cmd) is not None


def check_all_dependencies() -> list[str]:
    """모든 의존성 체크 후 누락된 것들 반환."""
    missing: list[str] = []
    for dep in ["wezterm", "claude", "uv"]:
        if not check_dependency(dep):
            missing.append(dep)
    return missing


def print_install_guide(missing: list[str]) -> None:
    """누락된 의존성 설치 안내 출력."""
    system = platform.system()
    print("\n[launcher] 누락된 의존성:")
    for dep in missing:
        print(f"  - {dep}")
        if dep in INSTALL_GUIDE and system in INSTALL_GUIDE[dep]:
            print(f"    설치: {INSTALL_GUIDE[dep][system]}")
    print()


def _get_project_dir() -> Path:
    """pyproject.toml이 위치한 프로젝트 디렉토리 반환.

    Returns:
        Path: orchay 패키지 루트 디렉토리 (pyproject.toml 위치)

    Note:
        - 일반 실행: __file__ (src/orchay/launcher.py) 기준 3단계 상위
        - PyInstaller frozen: 실행 파일 위치 기준
    """
    if getattr(sys, "frozen", False):
        # PyInstaller frozen 환경: 실행 파일 위치
        return Path(sys.executable).parent
    else:
        # 일반 실행: src/orchay/launcher.py → orchay/
        # __file__: orchay/src/orchay/launcher.py
        # parent[0]: orchay/src/orchay/
        # parent[1]: orchay/src/
        # parent[2]: orchay/ (프로젝트 루트)
        return Path(__file__).resolve().parent.parent.parent


def _get_bundled_file(filename: str) -> Path:
    """PyInstaller 번들 파일 또는 프로젝트 파일 경로 반환.

    Args:
        filename: 파일명 (예: wezterm-orchay.lua)

    Returns:
        Path: 파일 경로

    Note:
        - PyInstaller One-file 모드: sys._MEIPASS (임시 추출 폴더)
        - PyInstaller One-folder 모드: exe폴더/_internal/ (PyInstaller 6.x)
        - 일반 실행: 프로젝트 루트
    """
    if getattr(sys, "frozen", False):
        # PyInstaller frozen 환경
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            # _MEIPASS가 있으면 그 경로 사용 (One-file 또는 One-folder 6.x)
            return Path(meipass) / filename
        # fallback: 실행 파일 옆의 _internal 폴더
        internal_path = Path(sys.executable).parent / "_internal" / filename
        if internal_path.exists():
            return internal_path
        return Path(sys.executable).parent / filename
    else:
        # 일반 실행: 프로젝트 루트
        return _get_project_dir() / filename


def get_orchay_cmd() -> str:
    """orchay 실행 명령 반환.

    Returns:
        str: orchay 실행 명령 문자열

    Note:
        - 일반 실행: uv run --project {project_dir} python -m orchay
        - PyInstaller frozen: 직접 실행 (uv 없이)
    """
    if getattr(sys, "frozen", False):
        # PyInstaller frozen 환경: 직접 실행
        return str(Path(sys.executable))
    else:
        project_dir = _get_project_dir()
        return f"uv run --project {project_dir} python -m orchay"


def show_orchay_help() -> int:
    """orchay --help 실행."""
    if getattr(sys, "frozen", False):
        # PyInstaller frozen 환경: 직접 도움말 출력 (무한 재귀 방지)
        print("orchay - WezTerm-based Task scheduler")
        print()
        print("Usage:")
        print("  orchay [PROJECT] [OPTIONS]     WezTerm 레이아웃으로 스케줄러 실행")
        print("  orchay run PROJECT [OPTIONS]   스케줄러 직접 실행 (CLI)")
        print("  orchay exec <command>          실행 상태 관리")
        print()
        print("Options:")
        print("  -w, --workers N    Worker 수 (기본: 3)")
        print("  -m, --mode MODE    실행 모드 (design, quick, develop, force)")
        print("  --dry-run          상태만 표시, 실행 안함")
        print("  -h, --help         도움말 표시")
        return 0
    else:
        # 일반 실행: uv run으로 orchay 호출
        cmd_list = get_orchay_cmd().split() + ["--help"]
        result = subprocess.run(cmd_list)
        return result.returncode


def get_pid_file(cwd: str) -> Path:
    """현재 폴더의 WezTerm PID 파일 경로."""
    return Path(cwd) / ".orchay" / "logs" / "wezterm.pid"


def save_wezterm_pid(cwd: str, pid: int) -> None:
    """WezTerm PID를 파일에 저장."""
    pid_file = get_pid_file(cwd)
    pid_file.parent.mkdir(parents=True, exist_ok=True)
    pid_file.write_text(str(pid))
    log.debug(f"Saved WezTerm PID {pid} to {pid_file}")


def get_wezterm_gui_pids() -> set[int]:
    """현재 실행 중인 wezterm-gui 프로세스 PID 목록."""
    processes = _list_processes_sync("wezterm-gui")
    return {p.pid for p in processes}


def load_wezterm_pid(cwd: str) -> int | None:
    """저장된 WezTerm PID 로드."""
    pid_file = get_pid_file(cwd)
    if not pid_file.exists():
        return None
    try:
        return int(pid_file.read_text().strip())
    except (ValueError, OSError):
        return None


def kill_orchay_wezterm(cwd: str) -> None:
    """현재 폴더의 orchay WezTerm만 종료 (다른 폴더는 유지)."""
    log.debug(f"kill_orchay_wezterm() called for {cwd}")

    # 저장된 PID로 해당 프로세스만 종료
    saved_pid = load_wezterm_pid(cwd)
    if saved_pid:
        log.info(f"Killing previous WezTerm (PID: {saved_pid}) for this folder...")
        _kill_process_sync(saved_pid)
        # PID 파일 삭제
        pid_file = get_pid_file(cwd)
        with contextlib.suppress(OSError):
            pid_file.unlink()
        # 프로세스 종료 대기
        time.sleep(0.5)
    else:
        log.debug("No previous WezTerm PID found for this folder")

    # Linux: 오래된 socket 파일 정리 (현재 폴더와 무관하게)
    if platform.system() != "Windows":
        log.debug("Cleaning up socket files...")
        wezterm_runtime = f"/run/user/{os.getuid()}/wezterm"
        if os.path.isdir(wezterm_runtime):
            for sock in glob.glob(f"{wezterm_runtime}/gui-sock-*"):
                with contextlib.suppress(OSError):
                    os.remove(sock)
                    log.debug(f"Removed socket: {sock}")
            for link in glob.glob(f"{wezterm_runtime}/x11-*"):
                with contextlib.suppress(OSError):
                    os.remove(link)
                    log.debug(f"Removed link: {link}")

    log.debug("kill_orchay_wezterm() completed")


def parse_args() -> tuple[argparse.Namespace, list[str]]:
    """launcher 전용 인자 파싱.

    launcher 전용 옵션만 파싱하고, 나머지는 orchay에 그대로 전달합니다.

    launcher 전용: --scheduler-cols, --worker-cols, --font-size
    orchay 전달: project, -w, -m, --dry-run 등

    Returns:
        tuple: (launcher_args, orchay_args)
    """
    parser = argparse.ArgumentParser(add_help=False)
    # launcher 전용 옵션 (WezTerm 레이아웃 관련)
    parser.add_argument(
        "--scheduler-cols",
        type=int,
        default=100,
        help="스케줄러 pane 너비 columns (기본: 100)",
    )
    parser.add_argument(
        "--worker-cols",
        type=int,
        default=120,
        help="Worker pane 너비 columns (기본: 120)",
    )
    parser.add_argument(
        "--font-size",
        type=float,
        default=11.0,
        help="폰트 크기 (기본: 11.0)",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=1920,
        help="창 너비 픽셀 (기본: 1920)",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=1080,
        help="창 높이 픽셀 (기본: 1080)",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=3,
        help="열당 최대 worker 수 (기본: 3)",
    )
    return parser.parse_known_args()


def main() -> int:
    """메인 함수."""
    log.info("=" * 60)
    log.info(f"Launcher started at {datetime.now()}")
    log.info(f"PID: {os.getpid()}")
    log.info(f"Log file: {LOG_FILE}")
    log.info("=" * 60)

    # 서브커맨드 감지: run, exec, history는 cli.py로 위임
    cli_subcommands = {"run", "exec", "history"}
    if len(sys.argv) > 1 and sys.argv[1] in cli_subcommands:
        log.info(f"Delegating to cli.py: {sys.argv[1]}")
        try:
            from orchay.cli import cli_main
        except ModuleNotFoundError:
            src_dir = Path(__file__).resolve().parent.parent
            if str(src_dir) not in sys.path:
                sys.path.insert(0, str(src_dir))
            from orchay.cli import cli_main
        return cli_main()

    # 의존성 체크
    log.debug("Checking dependencies...")
    missing = check_all_dependencies()
    if missing:
        print_install_guide(missing)
        return 1
    log.debug("All dependencies OK")

    # --help 처리
    if "-h" in sys.argv or "--help" in sys.argv:
        print("Launcher 전용 옵션 (WezTerm 레이아웃):")
        print("  --width N             창 너비 픽셀 (기본: 1920)")
        print("  --height N            창 높이 픽셀 (기본: 1080)")
        print("  --max-rows N          열당 최대 worker 수 (기본: 3)")
        print("  --scheduler-cols N    스케줄러 너비 columns (기본: 100)")
        print("  --worker-cols N       Worker 너비 columns (기본: 120)")
        print("  --font-size F         폰트 크기 (기본: 11.0)")
        print()
        print("나머지 옵션은 orchay에 그대로 전달됩니다:")
        print()
        return show_orchay_help()

    # launcher 전용 인자와 나머지 분리
    log.debug(f"sys.argv: {sys.argv}")
    launcher_args, orchay_args = parse_args()
    log.debug(f"launcher_args: {launcher_args}")
    log.debug(f"orchay_args: {orchay_args}")

    # 설정 로드 (load_config() 사용)
    from orchay.utils.config import load_config

    config = load_config()
    log.info("설정 로드 완료")

    # CLI launcher_args로 config.launcher 업데이트
    if launcher_args.width != 1920:
        config.launcher.width = launcher_args.width
    if launcher_args.height != 1080:
        config.launcher.height = launcher_args.height
    if launcher_args.max_rows != 3:
        config.launcher.max_rows = launcher_args.max_rows
    if launcher_args.scheduler_cols != 100:
        config.launcher.scheduler_cols = launcher_args.scheduler_cols
    if launcher_args.worker_cols != 120:
        config.launcher.worker_cols = launcher_args.worker_cols
    if launcher_args.font_size != 11.0:
        config.launcher.font_size = launcher_args.font_size

    # Workers 결정: config.workers > CLI override
    workers = config.workers if config.workers > 0 else 3
    for i, arg in enumerate(orchay_args):
        if arg in ("-w", "--workers") and i + 1 < len(orchay_args):
            with contextlib.suppress(ValueError):
                workers = int(orchay_args[i + 1])
            break

    cwd = os.getcwd()

    # 스케줄러 명령 구성
    orchay_base_cmd = get_orchay_cmd().split()
    full_orchay_cmd_list = orchay_base_cmd + ["run"] + orchay_args

    # 기존 WezTerm 종료
    log.info("Killing existing WezTerm for this folder...")
    kill_orchay_wezterm(cwd)
    log.debug("kill_orchay_wezterm() completed")

    log.info(f"  Command: {' '.join(full_orchay_cmd_list)}")

    # 새 Launcher 사용
    from orchay.utils.wezterm_launcher import LaunchContext, create_launcher

    context = LaunchContext(
        cwd=cwd,
        workers=workers,
        orchay_cmd_list=full_orchay_cmd_list,
        config=config,
        logger=log,
    )

    launcher = create_launcher(context)
    return launcher.launch()


if __name__ == "__main__":
    sys.exit(main())
