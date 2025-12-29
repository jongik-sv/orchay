"""orchay CLI 모듈.

서브커맨드 기반 CLI 인터페이스를 제공합니다.

사용법:
    orchay                      # 스케줄러 실행 (기본)
    orchay run [options]        # 스케줄러 실행
    orchay exec start <task> <step>  # Task 실행 시작 등록
    orchay exec stop <task>     # Task 실행 완료 해제
    orchay exec list            # 실행 중인 Task 목록
    orchay exec clear           # 모든 실행 상태 초기화
"""

from __future__ import annotations

import argparse
import sys
from typing import Any

from rich.console import Console
from rich.table import Table

console = Console()


def create_parser() -> argparse.ArgumentParser:
    """CLI 파서 생성."""
    parser = argparse.ArgumentParser(
        prog="orchay",
        description="WezTerm 기반 Task 스케줄러",
    )
    subparsers = parser.add_subparsers(dest="command", help="사용 가능한 명령어")

    # run 서브커맨드 (스케줄러 실행)
    run_parser = subparsers.add_parser(
        "run",
        help="스케줄러 실행",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    run_parser.add_argument(
        "wbs",
        nargs="?",
        default=".orchay/projects/orchay/wbs.md",
        help="WBS 파일 경로 (기본: .orchay/projects/orchay/wbs.md)",
    )
    run_parser.add_argument(
        "-w",
        "--workers",
        type=int,
        default=3,
        help="Worker 수 (기본: 3)",
    )
    run_parser.add_argument(
        "-i",
        "--interval",
        type=int,
        default=5,
        help="모니터링 간격 초 (기본: 5)",
    )
    run_parser.add_argument(
        "-m",
        "--mode",
        choices=["design", "quick", "develop", "force"],
        default="quick",
        help="""실행 모드 (기본: quick)
  design  : 설계까지 자동 ([dd]에서 멈춤)
  quick   : 완료까지 자동 ([xx]까지 진행)
  develop : 구현까지 자동 ([im]에서 멈춤, 검증은 수동)
  force   : 의존성 무시, 완료까지 자동""",
    )
    run_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="분배 없이 상태만 표시",
    )
    run_parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="상세 로그 출력",
    )
    run_parser.add_argument(
        "--no-tui",
        action="store_true",
        help="TUI 없이 CLI 모드로 실행",
    )

    # exec 서브커맨드 (실행 상태 관리)
    exec_parser = subparsers.add_parser(
        "exec",
        help="Task 실행 상태 관리 (워크플로우 훅용)",
    )
    exec_subparsers = exec_parser.add_subparsers(dest="exec_command", help="exec 명령어")

    # exec start
    start_parser = exec_subparsers.add_parser("start", help="Task 실행 시작 등록")
    start_parser.add_argument("task_id", help="Task ID (예: TSK-01-01)")
    start_parser.add_argument("step", help="워크플로우 단계 (예: design, build, done)")
    start_parser.add_argument(
        "-w",
        "--worker",
        type=int,
        default=0,
        help="Worker ID (기본: 0)",
    )
    start_parser.add_argument(
        "-p",
        "--pane",
        type=int,
        default=0,
        help="Pane ID (기본: 0)",
    )

    # exec stop
    stop_parser = exec_subparsers.add_parser("stop", help="Task 실행 완료 해제")
    stop_parser.add_argument("task_id", help="Task ID (예: TSK-01-01)")

    # exec update
    update_parser = exec_subparsers.add_parser("update", help="Task 단계 갱신")
    update_parser.add_argument("task_id", help="Task ID")
    update_parser.add_argument("step", help="새 단계")

    # exec list
    exec_subparsers.add_parser("list", help="실행 중인 Task 목록")

    # exec clear
    exec_subparsers.add_parser("clear", help="모든 실행 상태 초기화")

    # history 서브커맨드 (작업 히스토리 조회)
    history_parser = subparsers.add_parser(
        "history",
        help="작업 히스토리 조회",
    )
    history_parser.add_argument(
        "task_id",
        nargs="?",
        help="조회할 Task ID (생략 시 목록 표시)",
    )
    history_parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="표시할 항목 수 (기본: 10)",
    )
    history_parser.add_argument(
        "--clear",
        action="store_true",
        help="히스토리 삭제",
    )

    return parser


def exec_start(args: argparse.Namespace) -> int:
    """Task 실행 시작 등록 (deprecated)."""
    console.print("[yellow]⚠ exec start 명령어는 더 이상 사용되지 않습니다.[/]")
    console.print("[dim]Task 할당은 Orchestrator 메모리에서 자동으로 관리됩니다.[/]")
    return 0


def exec_stop(args: argparse.Namespace) -> int:
    """Task 실행 완료 해제 (deprecated)."""
    console.print("[yellow]⚠ exec stop 명령어는 더 이상 사용되지 않습니다.[/]")
    console.print("[dim]Task 해제는 Orchestrator 메모리에서 자동으로 관리됩니다.[/]")
    return 0


def exec_update(args: argparse.Namespace) -> int:
    """Task 단계 갱신 (deprecated)."""
    console.print("[yellow]⚠ exec update 명령어는 더 이상 사용되지 않습니다.[/]")
    console.print("[dim]Task 단계는 WBS 상태에서 자동으로 동기화됩니다.[/]")
    return 0


def exec_list(_args: argparse.Namespace) -> int:
    """실행 중인 Task 목록 출력 (deprecated)."""
    console.print("[yellow]⚠ exec list 명령어는 더 이상 사용되지 않습니다.[/]")
    console.print("[dim]실행 중인 Task는 TUI에서 확인하세요.[/]")
    return 0


def exec_clear(_args: argparse.Namespace) -> int:
    """모든 실행 상태 초기화 (deprecated)."""
    console.print("[yellow]⚠ exec clear 명령어는 더 이상 사용되지 않습니다.[/]")
    console.print("[dim]Orchestrator 재시작 시 상태가 자동으로 초기화됩니다.[/]")
    return 0


def handle_exec(args: argparse.Namespace) -> int:
    """exec 서브커맨드 처리."""
    if args.exec_command == "start":
        return exec_start(args)
    elif args.exec_command == "stop":
        return exec_stop(args)
    elif args.exec_command == "update":
        return exec_update(args)
    elif args.exec_command == "list":
        return exec_list(args)
    elif args.exec_command == "clear":
        return exec_clear(args)
    else:
        console.print("[yellow]사용법:[/] orchay exec {start|stop|update|list|clear}")
        return 1


def handle_history(args: argparse.Namespace) -> int:
    """history 서브커맨드 처리."""
    from orchay.utils.config import load_config
    from orchay.utils.history import HistoryManager

    try:
        config = load_config()
    except Exception:
        # 설정 파일 오류 시 기본 경로 사용
        storage_path = ".orchay/logs/orchay-history.jsonl"
        max_entries = 1000
    else:
        storage_path = config.history.storage_path
        max_entries = config.history.max_entries

    manager = HistoryManager(storage_path, max_entries)

    # --clear 옵션
    if args.clear:
        manager.clear()
        console.print("[green]✓[/] 히스토리가 삭제되었습니다.")
        return 0

    # 특정 Task ID 조회
    if args.task_id:
        entry: dict[str, Any] | None = manager.get(args.task_id)
        if entry:
            console.print(f"\n[bold]Task:[/] {entry['task_id']}")
            console.print(f"[bold]Command:[/] {entry['command']}")
            result_color = "green" if entry["result"] == "success" else "red"
            console.print(f"[bold]Result:[/] [{result_color}]{entry['result']}[/{result_color}]")
            console.print(f"[bold]Worker:[/] {entry['worker_id']}")
            console.print(f"[bold]Timestamp:[/] {entry['timestamp']}")
            if entry.get("output"):
                console.print("\n[dim]--- Captured Output ---[/]\n")
                console.print(entry["output"])
        else:
            console.print(f"[yellow]Task {args.task_id}의 히스토리를 찾을 수 없습니다.[/]")
        return 0

    # 목록 출력
    entries: list[dict[str, Any]] = manager.list(args.limit)
    if not entries:
        console.print("[yellow]히스토리가 없습니다.[/]")
        return 0

    table = Table(title="Task History")
    table.add_column("Task ID", style="cyan")
    table.add_column("Command", style="green")
    table.add_column("Result")
    table.add_column("Worker", justify="center")
    table.add_column("Timestamp", style="dim")

    for e in entries:
        result_style = "green" if e["result"] == "success" else "red"
        table.add_row(
            str(e["task_id"]),
            str(e["command"]),
            f"[{result_style}]{e['result']}[/{result_style}]",
            str(e.get("worker_id", "-")),
            str(e["timestamp"]),
        )

    console.print(table)
    console.print("\n[dim]ℹ️  'orchay history <TASK-ID>'로 상세 출력 확인[/]")
    return 0


def cli_main() -> int:
    """CLI 메인 함수."""
    parser = create_parser()

    # 인자가 없으면 기본적으로 run 실행
    if len(sys.argv) == 1:
        # 스케줄러 실행
        from orchay.main import main as run_scheduler

        run_scheduler()
        return 0

    args = parser.parse_args()

    if args.command == "exec":
        return handle_exec(args)
    elif args.command == "history":
        return handle_history(args)
    elif args.command == "run":
        # 스케줄러 실행 (기존 main.py 방식)
        # sys.argv에서 'run' 서브커맨드를 제거하여 main.py에 전달
        sys.argv = [sys.argv[0]] + sys.argv[2:]
        from orchay.main import main as run_scheduler

        run_scheduler()
        return 0
    elif args.command is None:
        # 서브커맨드 없이 인자가 있는 경우 (기존 호환성)
        # 기존 main.py 방식으로 처리
        from orchay.main import main as run_scheduler

        run_scheduler()
        return 0
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(cli_main())
