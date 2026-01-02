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


def _create_layout_config(workers: int) -> list[int]:
    """Worker 수에 따른 레이아웃 구성 반환.

    Args:
        workers: Worker pane 개수 (1-6)

    Returns:
        list[int]: 각 열의 Worker 수 (예: [3] = 1열 3개, [2,2] = 2열 각 2개)
    """
    layout_map: dict[int, list[int]] = {
        1: [1],
        2: [2],
        3: [3],
        4: [2, 2],
        5: [3, 2],
        6: [3, 3],
    }
    return layout_map[min(workers, 6)]


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


# =============================================================================
# Windows 전용: gui-startup 이벤트 방식
# =============================================================================


def launch_wezterm_windows(
    cwd: str,
    workers: int,
    full_orchay_cmd_list: list[str],
    launcher_args: argparse.Namespace,
) -> int:
    """Windows 전용 WezTerm 레이아웃 생성.

    Windows에서는 CLI 소켓 연결 문제가 있어 gui-startup 이벤트를 사용합니다.
    설정 파일을 생성하고 WezTerm을 시작하면, ~/.wezterm.lua의 gui-startup
    이벤트에서 레이아웃을 생성합니다.

    Args:
        cwd: 현재 작업 디렉토리
        workers: Worker pane 개수
        full_orchay_cmd_list: 스케줄러 실행 명령 리스트
        launcher_args: launcher 설정 인자

    Returns:
        int: 종료 코드 (0: 성공)

    Note:
        - CLI 소켓 연결 문제 참고: https://github.com/wezterm/wezterm/issues/4456
        - gui-startup 이벤트 문서: https://wezterm.org/config/lua/gui-events/gui-startup.html
    """
    import json

    # 1. 설정 파일 생성 (~/.config/wezterm/orchay-startup.json)
    wezterm_config_dir = Path.home() / ".config" / "wezterm"
    wezterm_config_dir.mkdir(parents=True, exist_ok=True)
    startup_file = wezterm_config_dir / "orchay-startup.json"

    # Config 로드 (worker_command.startup을 위해)
    from orchay.utils.config import load_config

    config = load_config()

    # 스케줄러 pane 비율 계산 (scheduler_cols / (scheduler_cols + worker_cols))
    scheduler_cols = launcher_args.scheduler_cols
    worker_cols = launcher_args.worker_cols
    scheduler_ratio = scheduler_cols / (scheduler_cols + worker_cols)

    # pane_startup 포맷: {"1": "cmd1", "3": "cmd3"}
    pane_startup_json = {
        str(k): v for k, v in config.worker_command.pane_startup.items()
    }

    startup_config = {
        "cwd": cwd,
        "workers": workers,
        "scheduler_cmd": " ".join(full_orchay_cmd_list),
        # launcher 설정 추가
        "width": launcher_args.width,
        "height": launcher_args.height,
        "max_rows": launcher_args.max_rows,
        "scheduler_ratio": round(scheduler_ratio, 2),  # 스케줄러 pane 비율
        "font_size": launcher_args.font_size,
        # worker startup 명령어
        "worker_startup_cmd": config.worker_command.startup,  # 기본값 (호환성 유지)
        "pane_startup": pane_startup_json,  # pane별 오버라이드
    }

    with open(startup_file, "w", encoding="utf-8") as f:
        json.dump(startup_config, f, ensure_ascii=False)

    log.info(f"Created startup config: {startup_file}")
    log.info(f"  cwd={cwd}")
    log.info(f"  workers={workers}")
    log.info(f"  scheduler_cmd={' '.join(full_orchay_cmd_list)}")

    # 2. WezTerm 시작 (gui-startup 이벤트가 레이아웃 생성)
    # --config-file로 orchay 전용 설정 파일 사용 (사용자 ~/.wezterm.lua 불필요)
    # 주의: --config-file은 wezterm 전역 옵션이므로 start 앞에 위치해야 함
    config_file = _get_bundled_file("wezterm-orchay-windows.lua")
    wezterm_launch_args = ["wezterm", "--config-file", str(config_file), "start", "--cwd", cwd]

    # 시작 전 wezterm-gui PID 목록 기록
    pids_before = get_wezterm_gui_pids()
    log.debug(f"WezTerm PIDs before launch: {pids_before}")

    log.debug(f"Popen: {wezterm_launch_args}")
    # WEZTERM_LOG=warn으로 불필요한 에러 로그 숨김
    env = os.environ.copy()
    env["WEZTERM_LOG"] = "warn"
    subprocess.Popen(
        wezterm_launch_args,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        env=env,
    )

    # 잠시 대기 후 새로 생긴 wezterm-gui PID 찾기
    time.sleep(1.5)
    pids_after = get_wezterm_gui_pids()
    new_pids = pids_after - pids_before
    log.debug(f"WezTerm PIDs after launch: {pids_after}")
    log.debug(f"New WezTerm PIDs: {new_pids}")

    # 새로 생긴 PID 저장 (여러 개면 가장 큰 것 = 가장 최근)
    if new_pids:
        new_pid = max(new_pids)
        save_wezterm_pid(cwd, new_pid)
        log.info(f"WezTerm GUI started with PID: {new_pid}")
    else:
        log.warning("Could not detect new WezTerm GUI PID")

    log.info("=" * 60)
    log.info("Launcher completed - WezTerm gui-startup will create layout")
    log.info("=" * 60)
    return 0


# =============================================================================
# Linux/macOS 전용: CLI 방식
# =============================================================================


def launch_wezterm_linux(
    cwd: str,
    workers: int,
    full_orchay_cmd_list: list[str],
    launcher_args: argparse.Namespace,
) -> int:
    """Linux/macOS 전용 WezTerm 레이아웃 생성.

    Linux에서는 CLI 소켓 연결이 안정적이므로 wezterm cli 명령을 사용합니다.

    Args:
        cwd: 현재 작업 디렉토리
        workers: Worker pane 개수
        full_orchay_cmd_list: 스케줄러 실행 명령 리스트
        launcher_args: launcher 설정 인자

    Returns:
        int: 종료 코드 (0: 성공)
    """
    wezterm_cmd = "wezterm"

    # 시작 전 wezterm-gui PID 목록 기록
    pids_before = get_wezterm_gui_pids()
    log.debug(f"WezTerm PIDs before launch: {pids_before}")

    # 1. WezTerm 시작
    wezterm_launch_args = [wezterm_cmd]
    log.debug(f"Popen: {wezterm_launch_args}")
    # WEZTERM_LOG=warn으로 불필요한 에러 로그 숨김
    env = os.environ.copy()
    env["WEZTERM_LOG"] = "warn"
    subprocess.Popen(wezterm_launch_args, start_new_session=True, env=env)

    log.info("Waiting for WezTerm to start (2s)...")
    time.sleep(2)
    log.debug("Wait complete")

    # 새로 생긴 wezterm-gui PID 찾아서 저장
    pids_after = get_wezterm_gui_pids()
    new_pids = pids_after - pids_before
    log.debug(f"WezTerm PIDs after launch: {pids_after}")
    log.debug(f"New WezTerm PIDs: {new_pids}")

    if new_pids:
        new_pid = max(new_pids)
        save_wezterm_pid(cwd, new_pid)
        log.info(f"WezTerm GUI started with PID: {new_pid}")
    else:
        log.warning("Could not detect new WezTerm GUI PID")

    # 2. 창 크기 조절 (wmctrl 사용)
    if shutil.which("wmctrl"):
        resize_cmd = [
            "wmctrl", "-r", ":ACTIVE:", "-e",
            f"0,0,0,{launcher_args.width},{launcher_args.height}"
        ]
        log.debug(f"Resize command: {resize_cmd}")
        resize_result = subprocess.run(resize_cmd, capture_output=True, text=True)
        log.debug(f"Resize result: returncode={resize_result.returncode}")

    # 3. 레이아웃 생성
    layout = _create_layout_config(workers)
    column_first_panes: list[int] = []
    column_panes: list[list[int]] = [[] for _ in layout]

    log.info(f"Creating layout: {'/'.join(map(str, layout))}")

    # Worker별 startup 명령어 선택을 위한 카운터
    worker_num = 1

    # 3-1. 각 열의 첫 번째 Worker 생성 (수평 분할)
    for col in range(len(layout)):
        # Worker별 startup 명령어 조회
        startup_cmd = config.worker_command.get_startup_for_worker(worker_num)
        startup_cmd_parts = shlex.split(startup_cmd)
        log.info(f"Worker {worker_num}: startup={startup_cmd}")

        if col == 0:
            split_cmd = [
                wezterm_cmd, "cli", "split-pane", "--right", "--pane-id", "0",
                "--cwd", cwd, "--", *startup_cmd_parts
            ]
        else:
            target_pane = column_first_panes[col - 1]
            split_cmd = [
                wezterm_cmd, "cli", "split-pane", "--right", "--pane-id", str(target_pane),
                "--cwd", cwd, "--", *startup_cmd_parts
            ]

        log.debug(f"Split command (col {col}): {split_cmd}")
        result = subprocess.run(split_cmd, capture_output=True, text=True)
        log.debug(f"Split result: returncode={result.returncode}, stdout={result.stdout}")

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

        worker_num += 1

    # 3-2. 각 열 내에서 수직 분할 (균등 분할)
    log.debug("Starting vertical splits...")
    for col, workers_in_col in enumerate(layout):
        if col >= len(column_first_panes):
            break
        current_pane_id = column_first_panes[col]

        for row in range(1, workers_in_col):
            # Worker별 startup 명령어 조회
            startup_cmd = config.worker_command.get_startup_for_worker(worker_num)
            startup_cmd_parts = shlex.split(startup_cmd)
            log.info(f"Worker {worker_num}: startup={startup_cmd}")

            remaining = workers_in_col - row
            percent = int(remaining / (remaining + 1) * 100)
            split_cmd = [
                wezterm_cmd, "cli", "split-pane", "--bottom", "--percent", str(percent),
                "--pane-id", str(current_pane_id),
                "--cwd", cwd, "--", *startup_cmd_parts
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

            worker_num += 1

    # 4. Worker 번호 로그 (startup 명령은 pane 생성 시 이미 실행됨)
    worker_num = 1
    for col_panes in column_panes:
        for pane_id in col_panes:
            log.info(f"Worker {worker_num}: pane {pane_id}")
            worker_num += 1

    log.debug("Waiting 1s before sending scheduler command...")
    time.sleep(1)

    # 5. 스케줄러 명령 전송
    log.info("Sending scheduler command to pane 0...")
    orchay_cmd_str = " ".join(full_orchay_cmd_list)
    full_cmd_str = f"cd {shlex.quote(cwd)} && {orchay_cmd_str}\n"

    send_text_cmd = [
        wezterm_cmd, "cli", "send-text", "--pane-id", "0", "--no-paste", full_cmd_str
    ]
    log.debug(f"Send text command: {send_text_cmd}")
    result = subprocess.run(send_text_cmd, capture_output=True, text=True)
    log.debug(f"Send text result: returncode={result.returncode}")

    if result.returncode != 0:
        log.error(f"Error sending command: {result.stderr}")
    else:
        log.info("Scheduler started successfully")

    log.info("=" * 60)
    log.info("Launcher completed successfully")
    log.info("=" * 60)
    return 0


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
    # launcher는 WezTerm 레이아웃을 생성하는 경우에만 실행 (서브커맨드 없이 호출)
    cli_subcommands = {"run", "exec", "history"}
    if len(sys.argv) > 1 and sys.argv[1] in cli_subcommands:
        log.info(f"Delegating to cli.py: {sys.argv[1]}")
        try:
            from orchay.cli import cli_main
        except ModuleNotFoundError:
            # 직접 실행 시 (python launcher.py) - 패키지 경로 추가
            src_dir = Path(__file__).resolve().parent.parent  # orchay/src/
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
    # launcher가 pane 0에 보낼 때 "run" 서브커맨드를 추가 → cli.py가 처리 → main.py 실행
    orchay_base_cmd = get_orchay_cmd().split()
    # 주의: cd와 &&는 쉘 기능이므로, wezterm cli에서 직접 실행하기 보다
    # wezterm 시작 시 --cwd를 사용하거나, send-text에서 처리해야 함.
    # 여기서는 orchay 실행 인자만 모음.
    full_orchay_cmd_list = orchay_base_cmd + ["run"] + orchay_args

    log.info("Killing existing WezTerm for this folder...")
    kill_orchay_wezterm(cwd)
    log.debug("kill_orchay_wezterm() completed")

    log.info("Starting WezTerm...")
    log.info(f"  Workers: {workers}")
    log.info(f"  Window: {launcher_args.width}x{launcher_args.height}")
    log.info(f"  Max rows per column: {launcher_args.max_rows}")
    log.info(f"  Command: {' '.join(full_orchay_cmd_list)}")

    # 플랫폼별 분기
    # - Windows: gui-startup 이벤트 방식 (CLI 소켓 연결 문제 회피)
    # - Linux/macOS: CLI 방식 (안정적)
    if platform.system() == "Windows":
        return launch_wezterm_windows(cwd, workers, full_orchay_cmd_list, launcher_args)
    else:
        return launch_wezterm_linux(cwd, workers, full_orchay_cmd_list, launcher_args)


if __name__ == "__main__":
    sys.exit(main())
