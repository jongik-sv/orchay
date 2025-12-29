#!/usr/bin/env python3
"""WezTerm 레이아웃으로 orchay 스케줄러 실행.

사용법:
    python launcher.py [OPTIONS]
    python launcher.py --help                    # 도움말 표시
    python launcher.py -w 5                      # Worker 5개로 실행
    python launcher.py --cols 240 --rows 60      # 창 크기 지정 (약 1920x1080)
    python launcher.py --max-rows 3              # 열당 최대 3개 worker
    python launcher.py -w 5 -m quick             # 조합 사용

Launcher 옵션:
    -w, --workers N       Worker pane 개수 (기본: 3)
    --cols N              창 너비 columns (기본: 240, 약 1920px)
    --rows N              창 높이 rows (기본: 60, 약 1080px)
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

# 플랫폼별 설치 안내
INSTALL_GUIDE = {
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
    missing = []
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


def get_orchay_cmd() -> str:
    """orchay 실행 명령 반환 (uv run 사용)."""
    launcher_dir = os.path.dirname(os.path.abspath(__file__))
    return f"uv run --project {launcher_dir} python -m orchay"


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
        "--cols",
        type=int,
        default=240,
        help="창 너비 columns (기본: 240, 약 1920px)",
    )
    parser.add_argument(
        "--rows",
        type=int,
        default=60,
        help="창 높이 rows (기본: 60, 약 1080px)",
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
        print("  --cols N              창 너비 columns (기본: 240, 약 1920px)")
        print("  --rows N              창 높이 rows (기본: 60, 약 1080px)")
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

    # orchay_args에서 -w 값 추출 (WezTerm 레이아웃용)
    workers = 3  # 기본값
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
    print(f"           Window: {launcher_args.cols}x{launcher_args.rows}")
    print(f"           Max rows per column: {launcher_args.max_rows}")
    print(f"           Command: {cmd}")

    # wezterm 명령
    wezterm_cmd = "wezterm"

    # WezTerm 시작 (창 크기 지정)
    start_cmd = (
        f"{wezterm_cmd} "
        f"--config 'initial_cols={launcher_args.cols}' "
        f"--config 'initial_rows={launcher_args.rows}' "
        f"start --position 0,0"
    )
    subprocess.Popen(start_cmd, shell=True)
    print("[launcher] Waiting for WezTerm to start...")

    # WezTerm이 준비될 때까지 대기
    for attempt in range(10):
        time.sleep(1)
        result = subprocess.run(
            f"{wezterm_cmd} cli list",
            shell=True, capture_output=True, text=True
        )
        if result.returncode == 0:
            print(f"[launcher] WezTerm ready (attempt {attempt + 1})")
            break
    else:
        print("[launcher] WezTerm 시작 타임아웃")
        return 1

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
    max_rows = launcher_args.max_rows

    # 필요한 열 수 계산
    columns_needed = (workers + max_rows - 1) // max_rows
    worker_num = 1
    column_first_panes: list[int] = []  # 각 열의 첫 번째 pane ID

    print("[launcher] Creating layout...")

    for col in range(columns_needed):
        # 이 열에 배치할 worker 수
        workers_in_col = min(max_rows, workers - (col * max_rows))

        if col == 0:
            # 첫 열: scheduler pane(0) 오른쪽에 분할
            split_cmd = (
                f"{wezterm_cmd} cli split-pane --right --pane-id 0 "
                f"--cwd {shlex.quote(cwd)} -- {claude_cmd}"
            )
        else:
            # 추가 열: 이전 열의 첫 pane 오른쪽에 분할
            target_pane = column_first_panes[col - 1]
            split_cmd = (
                f"{wezterm_cmd} cli split-pane --right --pane-id {target_pane} "
                f"--cwd {shlex.quote(cwd)} -- {claude_cmd}"
            )

        print(f"[launcher] Worker {worker_num}: {split_cmd}")
        result = subprocess.run(split_cmd, shell=True, capture_output=True, text=True)
        print(f"[launcher] Worker {worker_num} result: rc={result.returncode}, "
              f"stdout='{result.stdout.strip()}', stderr='{result.stderr.strip()}'")

        if result.returncode != 0:
            print(f"[launcher] Worker {worker_num} pane 생성 실패")
            break

        # 새 pane ID 파싱 (wezterm cli split-pane 출력)
        try:
            current_pane_id = int(result.stdout.strip())
            column_first_panes.append(current_pane_id)
        except ValueError:
            print(f"[launcher] pane ID 파싱 실패: stdout='{result.stdout}'")
            break

        worker_num += 1

        # 열 내 나머지 worker를 수직 분할
        for _row in range(1, workers_in_col):
            result = subprocess.run(
                f"{wezterm_cmd} cli split-pane --bottom --pane-id {current_pane_id} "
                f"--cwd {shlex.quote(cwd)} -- {claude_cmd}",
                shell=True, capture_output=True, text=True
            )
            if result.returncode != 0:
                print(f"[launcher] Worker {worker_num} pane 생성 실패: {result.stderr}")
            else:
                # 다음 분할을 위해 현재 pane ID 업데이트
                with contextlib.suppress(ValueError):
                    current_pane_id = int(result.stdout.strip())
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
