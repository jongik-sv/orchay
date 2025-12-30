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
import os
import platform
import shlex
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, cast

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
    result = subprocess.run(f"{get_orchay_cmd()} --help", shell=True)
    return result.returncode


def kill_mux_server() -> None:
    """기존 mux-server 종료 및 완전히 종료될 때까지 대기."""
    if platform.system() == "Windows":
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
        subprocess.run(["pkill", "-f", "wezterm-mux-server"], capture_output=True)
        subprocess.run(["pkill", "-f", "wezterm-gui"], capture_output=True)

        # 오래된 socket 파일 정리
        wezterm_runtime = f"/run/user/{os.getuid()}/wezterm"
        if os.path.isdir(wezterm_runtime):
            for sock in glob.glob(f"{wezterm_runtime}/gui-sock-*"):
                with contextlib.suppress(OSError):
                    os.remove(sock)
            for link in glob.glob(f"{wezterm_runtime}/x11-*"):
                with contextlib.suppress(OSError):
                    os.remove(link)

    # 프로세스 완전 종료 대기
    time.sleep(1)


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
    # 의존성 체크
    missing = check_all_dependencies()
    if missing:
        print_install_guide(missing)
        return 1

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
    launcher_args, orchay_args = parse_args()

    # 1. 파일 설정 로드 (.orchay/settings/orchay.yaml)
    file_config: dict[str, Any] = {}
    cwd = os.getcwd()
    for parent in [cwd, *[str(p) for p in Path(cwd).parents]]:
        yaml_path = Path(parent) / ".orchay" / "settings" / "orchay.yaml"
        if yaml_path.exists():
            try:
                import yaml

                with open(yaml_path, encoding="utf-8") as f:
                    file_config = yaml.safe_load(f) or {}
                print(f"[launcher] 설정 로드: {yaml_path}")
            except Exception as e:
                print(f"[launcher] 설정 로드 실패: {e}")
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

    # 0번 pane에서 실행할 명령 구성 (cd로 디렉토리 이동 포함)
    orchay_base = get_orchay_cmd()
    cmd = f"cd {shlex.quote(cwd)} && {orchay_base} run"
    if orchay_args:
        cmd = f"{cmd} {' '.join(orchay_args)}"

    print("[launcher] Killing existing WezTerm processes...")
    kill_mux_server()

    print("[launcher] Starting WezTerm...")
    print(f"           Workers: {workers}")
    print(f"           Window: {launcher_args.width}x{launcher_args.height}")
    print(f"           Max rows per column: {launcher_args.max_rows}")
    print(f"           Command: {cmd}")

    # wezterm 명령
    wezterm_cmd = "wezterm"

    # WezTerm 시작
    subprocess.Popen(wezterm_cmd, shell=True)
    print("[launcher] Waiting for WezTerm to start...")
    time.sleep(2)

    # 창 크기 조절 (wmctrl 사용)
    resize_cmd = f"wmctrl -r :ACTIVE: -e 0,0,0,{launcher_args.width},{launcher_args.height}"
    subprocess.run(resize_cmd, shell=True, capture_output=True)

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

    print(f"[launcher] Creating layout: {'/'.join(map(str, layout))}")

    # 1단계: 각 열의 첫 번째 worker 생성 (수평 분할)
    for col in range(len(layout)):
        if col == 0:
            split_cmd = (
                f"{wezterm_cmd} cli split-pane --right --pane-id 0 "
                f"--cwd {shlex.quote(cwd)} -- {claude_cmd}"
            )
        else:
            target_pane = column_first_panes[col - 1]
            split_cmd = (
                f"{wezterm_cmd} cli split-pane --right --pane-id {target_pane} "
                f"--cwd {shlex.quote(cwd)} -- {claude_cmd}"
            )

        result = subprocess.run(split_cmd, shell=True, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"[launcher] 열 {col + 1} 생성 실패: {result.stderr}")
            break

        try:
            pane_id = int(result.stdout.strip())
            column_first_panes.append(pane_id)
            column_panes[col].append(pane_id)
        except ValueError:
            print(f"[launcher] pane ID 파싱 실패: {result.stdout}")
            break

    # 2단계: 각 열 내에서 수직 분할 (균등 분할)
    for col, workers_in_col in enumerate(layout):
        if col >= len(column_first_panes):
            break
        current_pane_id = column_first_panes[col]

        for row in range(1, workers_in_col):
            # 균등 분할을 위한 비율 계산
            # 예: 3개 분할 시 첫 분할은 67% (2/3), 두 번째는 50% (1/2)
            remaining = workers_in_col - row
            percent = int(remaining / (remaining + 1) * 100)
            split_cmd = (
                f"{wezterm_cmd} cli split-pane --bottom --percent {percent} "
                f"--pane-id {current_pane_id} "
                f"--cwd {shlex.quote(cwd)} -- {claude_cmd}"
            )
            result = subprocess.run(split_cmd, shell=True, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"[launcher] pane 생성 실패: {result.stderr}")
            else:
                with contextlib.suppress(ValueError):
                    current_pane_id = int(result.stdout.strip())
                    column_panes[col].append(current_pane_id)

    # Worker 번호 출력 (왼쪽 위부터 아래로, 그 다음 오른쪽)
    worker_num = 1
    for col_panes in column_panes:
        for pane_id in col_panes:
            print(f"[launcher] Worker {worker_num}: pane {pane_id}")
            worker_num += 1

    time.sleep(1)

    # pane 0에 스케줄러 명령 전송
    print("[launcher] Sending scheduler command to pane 0...")
    cmd_with_newline = shlex.quote(cmd + chr(10))
    send_text_cmd = f"{wezterm_cmd} cli send-text --pane-id 0 --no-paste {cmd_with_newline}"
    result = subprocess.run(send_text_cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[launcher] Error: {result.stderr}")
    else:
        print("[launcher] Scheduler started successfully")

    return 0


if __name__ == "__main__":
    sys.exit(main())
