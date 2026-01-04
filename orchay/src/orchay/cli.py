"""orchay CLI 모듈.

서브커맨드 기반 CLI 인터페이스를 제공합니다.

사용법:
    orchay                      # 스케줄러 실행 (기본)
    orchay run [options]        # 스케줄러 실행
    orchay history [task_id]    # 작업 히스토리 조회
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
        default=".orchay/projects/orchay/wbs.yaml",
        help="WBS 파일 경로 (기본: .orchay/projects/orchay/wbs.yaml)",
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

        return run_scheduler()

    args = parser.parse_args()

    if args.command == "history":
        return handle_history(args)
    elif args.command == "run":
        # 스케줄러 실행 (기존 main.py 방식)
        # sys.argv에서 'run' 서브커맨드를 제거하여 main.py에 전달
        sys.argv = [sys.argv[0]] + sys.argv[2:]
        from orchay.main import main as run_scheduler

        return run_scheduler()
    elif args.command is None:
        # 서브커맨드 없이 인자가 있는 경우 (기존 호환성)
        # 기존 main.py 방식으로 처리
        from orchay.main import main as run_scheduler

        return run_scheduler()
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(cli_main())
