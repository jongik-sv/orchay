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
import shlex
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, cast

# 로그 파일 설정 (즉시 플러시, PID 포함)
LOG_FILE = Path.home() / f"launcher_debug_{os.getpid()}.log"

# 즉시 플러시되는 파일 핸들러
class FlushFileHandler(logging.FileHandler):
    def emit(self, record: logging.LogRecord) -> None:
        super().emit(record)
        self.flush()

class FlushStreamHandler(logging.StreamHandler):  # type: ignore[type-arg]
    def emit(self, record: logging.LogRecord) -> None:
        super().emit(record)
        self.flush()

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        FlushFileHandler(LOG_FILE, mode="a", encoding="utf-8"),
        FlushStreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("launcher")
log.info(f"=== NEW LOG SESSION === PID: {os.getpid()}, Log file: {LOG_FILE}")

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
    # orchay_cmd는 'uv run ...' 형태의 문자열이므로 리스트로 분할
    cmd_list = get_orchay_cmd().split() + ["--help"]
    result = subprocess.run(cmd_list)
    return result.returncode


def kill_mux_server() -> None:
    """기존 mux-server 종료 및 완전히 종료될 때까지 대기."""
    log.debug("kill_mux_server() called")
    log.debug(f"Current PID: {os.getpid()}")

    if platform.system() == "Windows":
        log.debug("Windows: killing wezterm processes...")
        # mux-server 종료
        subprocess.run(
            ["taskkill", "/f", "/im", "wezterm-mux-server.exe"],
            capture_output=True,
        )
        # wezterm-gui도 종료 (connect 모드로 인해 같이 종료해야 함)
        subprocess.run(
            ["taskkill", "/f", "/im", "wezterm-gui.exe"],
            capture_output=True,
        )
    else:
        log.debug("Linux: killing wezterm-mux-server...")
        result1 = subprocess.run(["pkill", "-f", "wezterm-mux-server"], capture_output=True)
        log.debug(f"pkill wezterm-mux-server: returncode={result1.returncode}")

        log.debug("Linux: killing wezterm-gui...")
        result2 = subprocess.run(["pkill", "-f", "wezterm-gui"], capture_output=True)
        log.debug(f"pkill wezterm-gui: returncode={result2.returncode}")

        # 오래된 socket 파일 정리
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

    # 프로세스 완전 종료 대기
    log.debug("Waiting 1s for processes to terminate...")
    time.sleep(1)
    log.debug("kill_mux_server() completed")


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

    # 의존성 체크
    log.debug("Checking dependencies...")
    missing = check_all_dependencies()
    if missing:
        print_install_guide(missing)
        return 1
    log.debug("All dependencies OK")

    # --help 또는 -h 처리 (orchay 도움말 표시)
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

    # 1. 파일 설정 로드 (.orchay/settings/orchay.yaml)
    file_config: dict[str, Any] = {}
    cwd = os.getcwd()
    log.debug(f"cwd: {cwd}")
    for parent in [cwd, *[str(p) for p in Path(cwd).parents]]:
        yaml_path = Path(parent) / ".orchay" / "settings" / "orchay.yaml"
        if yaml_path.exists():
            try:
                import yaml

                with open(yaml_path, encoding="utf-8") as f:
                    file_config = yaml.safe_load(f) or {}
                log.info(f"설정 로드: {yaml_path}")
            except Exception as e:
                log.error(f"설정 로드 실패: {e}")
            break

    # 파일에서 workers 로드
    workers_config = file_config.get("workers", 3)
    workers = int(workers_config) if isinstance(workers_config, (int, str)) else 3

    # 파일에서 launcher 설정 로드 (CLI 기본값 override)
    launcher_config_raw = file_config.get("launcher", {})
    if isinstance(launcher_config_raw, dict):
        launcher_config = cast(dict[str, Any], launcher_config_raw)
        width_val = launcher_config.get("width")
        if isinstance(width_val, (int, float)):
            launcher_args.width = int(width_val)
        height_val = launcher_config.get("height")
        if isinstance(height_val, (int, float)):
            launcher_args.height = int(height_val)
        max_rows_val = launcher_config.get("max_rows")
        if isinstance(max_rows_val, (int, float)):
            launcher_args.max_rows = int(max_rows_val)
        scheduler_cols_val = launcher_config.get("scheduler_cols")
        if isinstance(scheduler_cols_val, (int, float)):
            launcher_args.scheduler_cols = int(scheduler_cols_val)
        worker_cols_val = launcher_config.get("worker_cols")
        if isinstance(worker_cols_val, (int, float)):
            launcher_args.worker_cols = int(worker_cols_val)
        font_size_val = launcher_config.get("font_size")
        if isinstance(font_size_val, (int, float)):
            launcher_args.font_size = float(font_size_val)

    # 2. CLI 인자로 override (-w 또는 --workers)
    for i, arg in enumerate(orchay_args):
        if arg in ("-w", "--workers") and i + 1 < len(orchay_args):
            with contextlib.suppress(ValueError):
                workers = int(orchay_args[i + 1])
            break

    # 현재 작업 디렉토리
    cwd = os.getcwd()

    # 0번 pane에서 실행할 명령 구성
    orchay_base_cmd = get_orchay_cmd().split()
    # 주의: cd와 &&는 쉘 기능이므로, wezterm cli에서 직접 실행하기 보다
    # wezterm 시작 시 --cwd를 사용하거나, send-text에서 처리해야 함.
    # 여기서는 orchay 실행 인자만 모음.
    full_orchay_cmd_list = orchay_base_cmd + orchay_args

    log.info("Killing existing WezTerm processes...")
    kill_mux_server()
    log.debug("kill_mux_server() completed")

    log.info("Starting WezTerm...")
    log.info(f"  Workers: {workers}")
    log.info(f"  Window: {launcher_args.width}x{launcher_args.height}")
    log.info(f"  Max rows per column: {launcher_args.max_rows}")
    log.info(f"  Command: {' '.join(full_orchay_cmd_list)}")

    # wezterm 명령
    wezterm_cmd = "wezterm"

    # WezTerm 시작 (독립 세션으로 분리하여 launcher 종료 시 영향 안 받음)
    # Windows에서는 리스트 형식을 더 선호함
    wezterm_launch_args = [wezterm_cmd]
    log.debug(f"Popen: {wezterm_launch_args}")
    proc = subprocess.Popen(wezterm_launch_args, start_new_session=True)
    log.debug(f"WezTerm process started, PID: {proc.pid}")
    log.info("Waiting for WezTerm to start (2s)...")
    time.sleep(2)
    log.debug("Wait complete")

    # 창 크기 조절 (wmctrl 사용 - Linux 전용)
    if platform.system() != "Windows" and shutil.which("wmctrl"):
        resize_cmd = ["wmctrl", "-r", ":ACTIVE:", "-e", f"0,0,0,{launcher_args.width},{launcher_args.height}"]
        log.debug(f"Resize command: {resize_cmd}")
        resize_result = subprocess.run(resize_cmd, capture_output=True, text=True)
        log.debug(f"Resize result: returncode={resize_result.returncode}, stderr={resize_result.stderr}")

    # 레이아웃 생성:
    # Workers 1-3:                    Workers 4-6:
    # +----------+--------+           +----------+--------+--------+
    # |          | W1     |           |          | W1     | W4     |
    # | Sched    +--------+           | Sched    +--------+--------+
    # |          | W2     |           |          | W2     | W5     |
    # |          +--------+           |          +--------+--------+
    # |          | W3     |           |          | W3     | W6     |
    # +----------+--------+           +----------+--------+--------+

    # Claude Code 명령 (권한 확인 스킵)
    claude_cmd = "claude --dangerously-skip-permissions"

    # 배치 레이아웃: workers -> [열1개수, 열2개수]
    # 1-3: 세로 1열, 4: 2/2, 5: 3/2, 6: 3/3, 7+: 최대 6개
    layout_map: dict[int, list[int]] = {
        1: [1],
        2: [2],
        3: [3],
        4: [2, 2],
        5: [3, 2],
        6: [3, 3],
    }
    workers = min(workers, 6)  # 최대 6개
    layout = layout_map[workers]

    column_first_panes: list[int] = []  # 각 열의 첫 번째 pane ID
    column_panes: list[list[int]] = [[] for _ in layout]  # 각 열의 모든 pane ID

    log.info(f"Creating layout: {'/'.join(map(str, layout))}")

    # 1단계: 각 열의 첫 번째 worker 생성 (수평 분할)
    for col in range(len(layout)):
        if col == 0:
            split_cmd = [
                wezterm_cmd, "cli", "split-pane", "--right", "--pane-id", "0",
                "--cwd", cwd, "--", "claude", "--dangerously-skip-permissions"
            ]
        else:
            target_pane = column_first_panes[col - 1]
            split_cmd = [
                wezterm_cmd, "cli", "split-pane", "--right", "--pane-id", str(target_pane),
                "--cwd", cwd, "--", "claude", "--dangerously-skip-permissions"
            ]

        log.debug(f"Split command (col {col}): {split_cmd}")
        result = subprocess.run(split_cmd, capture_output=True, text=True)
        log.debug(f"Split result: returncode={result.returncode}, stdout={result.stdout}, stderr={result.stderr}")
        if result.returncode != 0:
            log.error(f"열 {col + 1} 생성 실패: {result.stderr}")
            break

        try:
            pane_id = int(result.stdout.strip())
            column_first_panes.append(pane_id)
            column_panes[col].append(pane_id)
            log.debug(f"Created pane {pane_id} for column {col}")
        except ValueError:
            log.error(f"pane ID 파싱 실패: {result.stdout}")
            break

    # 2단계: 각 열 내에서 수직 분할 (균등 분할)
    log.debug("Starting vertical splits...")
    for col, workers_in_col in enumerate(layout):
        if col >= len(column_first_panes):
            break
        current_pane_id = column_first_panes[col]

        for row in range(1, workers_in_col):
            # 균등 분할을 위한 비율 계산
            # 예: 3개 분할 시 첫 분할은 67% (2/3), 두 번째는 50% (1/2)
            remaining = workers_in_col - row
            percent = int(remaining / (remaining + 1) * 100)
            split_cmd = [
                wezterm_cmd, "cli", "split-pane", "--bottom", "--percent", str(percent),
                "--pane-id", str(current_pane_id),
                "--cwd", cwd, "--", "claude", "--dangerously-skip-permissions"
            ]
            log.debug(f"Vertical split command (col {col}, row {row}): {split_cmd}")
            result = subprocess.run(split_cmd, capture_output=True, text=True)
            log.debug(f"Vertical split result: returncode={result.returncode}")
            if result.returncode != 0:
                log.error(f"pane 생성 실패: {result.stderr}")
            else:
                with contextlib.suppress(ValueError):
                    current_pane_id = int(result.stdout.strip())
                    column_panes[col].append(current_pane_id)

    # Worker 번호 출력 (왼쪽 위부터 아래로, 그 다음 오른쪽)
    worker_num = 1
    for col_panes in column_panes:
        for pane_id in col_panes:
            log.info(f"Worker {worker_num}: pane {pane_id}")
            worker_num += 1

    log.debug("Waiting 1s before sending scheduler command...")
    time.sleep(1)

    # pane 0에 스케줄러 명령 전송
    log.info("Sending scheduler command to pane 0...")
    # pane 0은 홈 디렉토리에서 시작하므로, cd로 프로젝트 디렉토리로 이동 후 명령 실행
    orchay_cmd_str = " ".join(full_orchay_cmd_list)
    if platform.system() == "Windows":
        # PowerShell: cd path; command (세미콜론으로 연결)
        full_cmd_str = f"cd {cwd}; {orchay_cmd_str}\n"
    else:
        # Linux/macOS: cd path && command
        full_cmd_str = f"cd {shlex.quote(cwd)} && {orchay_cmd_str}\n"
    send_text_cmd = [
        wezterm_cmd, "cli", "send-text", "--pane-id", "0", "--no-paste", full_cmd_str
    ]
    log.debug(f"Send text command: {send_text_cmd}")
    result = subprocess.run(send_text_cmd, capture_output=True, text=True)
    log.debug(f"Send text result: returncode={result.returncode}, stdout={result.stdout}, stderr={result.stderr}")
    if result.returncode != 0:
        log.error(f"Error sending command: {result.stderr}")
    else:
        log.info("Scheduler started successfully")

    log.info("=" * 60)
    log.info("Launcher completed successfully")
    log.info("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
