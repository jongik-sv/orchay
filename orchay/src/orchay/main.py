"""orchay 메인 모듈.

WezTerm 기반 Task 스케줄러의 진입점입니다.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
import traceback
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

from rich.console import Console
from rich.table import Table

from orchay.application import DispatchService, TaskService, WorkerService
from orchay.domain.workflow import WorkflowConfig, WorkflowEngine
from orchay.models import Config, Task, TaskStatus, Worker, WorkerState
from orchay.scheduler import ExecutionMode, get_next_workflow_command
from orchay.utils.wezterm import (
    WezTermNotFoundError,
    get_active_pane_id,
    wezterm_list_panes,
)
from orchay.wbs_parser import WbsParser

logger = logging.getLogger(__name__)
console = Console()


class Orchestrator:
    """Task 오케스트레이터.

    WBS 파일을 모니터링하고 Worker에 Task를 분배합니다.
    """

    def __init__(self, config: Config, wbs_path: Path, base_dir: Path, project_name: str) -> None:
        self.config = config
        self.wbs_path = wbs_path
        self.base_dir = base_dir  # 프로젝트 루트 디렉토리
        self.project_name = project_name  # 프로젝트명 (예: orchay)
        self.parser = WbsParser(wbs_path)
        self.workers: list[Worker] = []
        self.tasks: list[Task] = []
        self.mode = ExecutionMode(config.execution.mode)
        self._running = False
        self._paused = config.execution.start_paused

        # Phase 2.4: 서비스 레이어 초기화
        workflow_config = WorkflowConfig.from_project_root(base_dir)
        self._workflow_engine = WorkflowEngine(workflow_config)
        self._task_service = TaskService(self.parser, self._workflow_engine)
        self._worker_service = WorkerService(config)
        self._dispatch_service = DispatchService(
            config=config,
            project_name=project_name,
            wbs_path=wbs_path,
            mode=self.mode,
            workflow_engine=self._workflow_engine,
            output_callback=lambda msg: console.print(msg),
        )

    @property
    def running_tasks(self) -> set[str]:
        """현재 실행 중인 Task ID 집합."""
        return {w.current_task for w in self.workers if w.current_task}

    async def initialize(self) -> bool:
        """오케스트레이터 초기화.

        Returns:
            성공 여부
        """
        console.print("[bold cyan]orchay[/] - Task Scheduler v0.1.0\n")

        # WBS 파일 확인
        if not self.wbs_path.exists():
            console.print(f"[red]Error:[/] WBS 파일을 찾을 수 없습니다: {self.wbs_path}")
            return False

        # WezTerm pane 목록 조회
        try:
            panes = await wezterm_list_panes()
        except WezTermNotFoundError as e:
            console.print(f"[red]Error:[/] {e}")
            return False

        if not panes:
            console.print("[red]Error:[/] WezTerm pane을 찾을 수 없습니다.")
            return False

        # Worker 초기화 (현재 pane 제외, 최대 config.workers 개)
        # 현재 pane 감지: 환경변수 → WezTerm CLI → 경고
        env_pane = os.environ.get("WEZTERM_PANE")
        if env_pane:
            current_pane_id = int(env_pane)
        else:
            # WezTerm CLI로 현재 활성 pane 감지
            active_pane = await get_active_pane_id()
            if active_pane is not None:
                current_pane_id = active_pane
                logger.info(f"현재 활성 pane 감지: {current_pane_id}")
            else:
                # 감지 실패 시 -1 사용 (모든 pane을 Worker로 등록)
                current_pane_id = -1
                console.print(
                    "[yellow]Warning:[/] 현재 pane을 감지할 수 없습니다. "
                    "WEZTERM_PANE 환경변수를 설정하거나 WezTerm에서 실행하세요."
                )
        worker_count = 0
        for pane in panes:
            # config.workers가 0이면 무제한, 양수면 해당 개수까지만
            if self.config.workers > 0 and worker_count >= self.config.workers:
                break
            # 현재 pane (orchay 실행 중) 제외
            if pane.pane_id == current_pane_id:
                continue
            # Worker pane으로 등록
            self.workers.append(
                Worker(
                    id=worker_count + 1,
                    pane_id=pane.pane_id,
                    state=WorkerState.IDLE,
                )
            )
            worker_count += 1

        if not self.workers:
            console.print("[red]Error:[/] 사용 가능한 Worker pane이 없습니다.")
            return False

        # 초기 WBS 파싱
        self.tasks = await self.parser.parse()

        console.print(f"[green]WBS:[/] {self.wbs_path}")
        console.print(f"[green]Mode:[/] {self.mode.value}")
        console.print(f"[green]Workers:[/] {len(self.workers)}개")
        console.print(f"[green]Tasks:[/] {len(self.tasks)}개\n")

        return True

    async def run(self) -> None:
        """메인 스케줄링 루프 실행."""
        self._running = True
        console.print("[bold green]스케줄러 시작[/] (Ctrl+C로 종료)\n")

        while self._running:
            try:
                await self._tick()
                await asyncio.sleep(self.config.interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"스케줄링 오류: {e}")
                await asyncio.sleep(self.config.interval)

        console.print("\n[yellow]스케줄러 종료[/]")

    async def _tick(self) -> None:
        """단일 스케줄링 사이클.

        Phase 2.4: 서비스 레이어로 리팩토링됨.
        """
        logger.debug("_tick 시작")

        # 1. Task 재로드 및 정리 (TaskService 사용)
        self.tasks = await self._task_service.reload_tasks()
        self._task_service.tasks = self.tasks  # 서비스와 동기화
        self._task_service.cleanup_completed(self.mode)

        # 2. Worker 상태 업데이트 (WorkerService 사용, 연속 실행 포함)
        for worker in self.workers:
            await self._worker_service.update_worker_state_with_continuation(
                worker=worker,
                tasks=self.tasks,
                dispatch_service=self._dispatch_service,
                task_service=self._task_service,
                mode=self.mode,
                paused=self._paused,
            )

        # 3. Worker의 current_step 동기화 (WorkerService 사용)
        self._worker_service.sync_worker_steps(
            tasks=self.tasks,
            get_next_command=lambda t, m: get_next_workflow_command(t, m),
            mode=self.mode.value,
        )

        # 4. 유휴 Worker에 Task 분배 (DispatchService 사용)
        if not self._paused:
            await self._dispatch_idle_workers()

        # 5. 상태 출력
        self.print_status()

    async def _dispatch_idle_workers(self) -> None:
        """유휴 Worker에 실행 가능 Task를 분배합니다.

        Phase 2.4: 새로 추가된 헬퍼 메서드.
        """
        # 실행 가능 Task 조회
        executable = self._task_service.get_executable_tasks(self.mode)
        running_task_ids = self._worker_service.running_task_ids()

        logger.debug(f"_dispatch_idle_workers: executable={len(executable)}개")

        for worker in self.workers:
            if not executable:
                break

            if worker.state != WorkerState.IDLE or worker.is_manually_paused:
                continue

            task = executable.pop(0)

            # 중복 실행 방지
            if task.id in running_task_ids:
                logger.warning(f"중복 실행 방지: {task.id}는 이미 다른 Worker에서 실행 중")
                continue

            # Race condition 방지: dispatch 전에 즉시 할당 상태 설정
            task.assigned_worker = worker.id
            worker.state = WorkerState.BUSY
            worker.current_task = task.id
            running_task_ids.add(task.id)

            logger.info(f"Dispatch: {task.id} -> Worker {worker.id}")

            # DispatchService 사용
            result = await self._dispatch_service.dispatch_task(
                worker, task, check_state=True
            )
            if not result.success:
                logger.warning(f"Dispatch 실패: {result.message}")

    def print_status(self) -> None:
        """현재 상태 출력."""
        # Worker 상태 테이블
        table = Table(title="Worker Status", show_header=True)
        table.add_column("ID", style="cyan", width=4)
        table.add_column("Pane", width=6)
        table.add_column("State", width=10)
        table.add_column("Task", width=20)

        state_colors = {
            WorkerState.IDLE: "green",
            WorkerState.BUSY: "yellow",
            WorkerState.PAUSED: "magenta",
            WorkerState.ERROR: "red",
            WorkerState.BLOCKED: "orange3",
            WorkerState.DEAD: "dim",
            WorkerState.DONE: "blue",
        }

        for w in self.workers:
            color = state_colors.get(w.state, "white")
            table.add_row(
                str(w.id),
                str(w.pane_id),
                f"[{color}]{w.state.value}[/]",
                w.current_task or "-",
            )

        console.print(table)

        # 큐 상태
        pending = sum(1 for t in self.tasks if t.status.value == "[ ]")
        running = sum(1 for t in self.tasks if t.assigned_worker is not None)
        done = sum(1 for t in self.tasks if t.status.value == "[xx]")
        console.print(f"\n[dim]Queue:[/] {pending} pending, {running} running, {done} done\n")

    def stop(self) -> None:
        """스케줄러 중지."""
        self._running = False


def parse_args() -> argparse.Namespace:
    """CLI 인자 파싱."""
    parser = argparse.ArgumentParser(
        prog="orchay",
        description="WezTerm 기반 Task 스케줄러",
    )
    parser.add_argument(
        "project",
        nargs="?",
        default=None,
        help="프로젝트명 (.orchay/projects/{project}/ 사용)",
    )
    parser.add_argument(
        "-w",
        "--workers",
        type=int,
        default=None,
        help="Worker 수 (미지정=자동, 0=무제한)",
    )
    parser.add_argument(
        "-i",
        "--interval",
        type=int,
        default=5,
        help="모니터링 간격 초 (기본: 5)",
    )
    parser.add_argument(
        "-m",
        "--mode",
        choices=["design", "quick", "develop", "force", "test"],
        default="quick",
        help="실행 모드 (기본: quick)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="(test 모드) 모든 구현 완료 Task 자동 선택",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="분배 없이 상태만 표시",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="상세 로그 출력",
    )

    return parser.parse_args()


def find_orchay_root() -> Path | None:
    """`.orchay` 폴더가 있는 프로젝트 루트를 찾습니다.

    현재 디렉토리부터 상위로 탐색합니다.

    Returns:
        프로젝트 루트 경로 또는 None
    """
    cwd = Path.cwd().resolve()
    for parent in [cwd, *cwd.parents]:
        if (parent / ".orchay").is_dir():
            return parent
    return None


def detect_project() -> tuple[str | None, list[str]]:
    """.orchay/projects/ 폴더에서 프로젝트를 자동 감지.

    Returns:
        (프로젝트명, 프로젝트 목록) 튜플
        - 프로젝트가 1개면: (프로젝트명, [프로젝트명])
        - 그 외: (None, 프로젝트 목록)
    """
    base_dir = find_orchay_root()
    if base_dir is None:
        return None, []

    projects_dir = base_dir / ".orchay" / "projects"
    if not projects_dir.exists():
        return None, []

    # wbs.yaml이 있는 폴더만 프로젝트로 인식
    projects = [
        d.name
        for d in projects_dir.iterdir()
        if d.is_dir() and (d / "wbs.yaml").exists()
    ]

    if len(projects) == 1:
        return projects[0], projects
    return None, projects


def get_project_paths(project_name: str) -> tuple[Path, Path]:
    """프로젝트명으로 WBS 경로와 베이스 디렉토리 반환.

    Args:
        project_name: 프로젝트명

    Returns:
        (wbs_path, base_dir) 튜플
    """
    base_dir = find_orchay_root()
    if base_dir is None:
        # .orchay 폴더를 찾지 못하면 현재 디렉토리 사용
        base_dir = Path.cwd()

    orchay_dir = base_dir / ".orchay" / "projects" / project_name
    wbs_path = orchay_dir / "wbs.yaml"
    return wbs_path, base_dir


def setup_logging(verbose: bool = False) -> Path | None:
    """로깅 설정 (파일만).

    Args:
        verbose: 상세 로그 출력 여부

    Returns:
        로그 파일 경로 (설정 실패 시 None)
    """
    log_level = logging.DEBUG if verbose else logging.INFO

    # 로그 포맷
    log_format = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    formatter = logging.Formatter(log_format)

    # 루트 로거 설정
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # 기존 핸들러 제거 (중복 방지)
    root_logger.handlers.clear()

    # 파일 핸들러만 (.orchay/logs/orchay.log)
    log_file = None
    try:
        base_dir = find_orchay_root()
        if base_dir:
            log_dir = base_dir / ".orchay" / "logs"
            log_dir.mkdir(parents=True, exist_ok=True)
            log_file = log_dir / "orchay.log"

            # RotatingFileHandler: 최대 5MB, 백업 3개
            file_handler = RotatingFileHandler(
                log_file,
                maxBytes=5 * 1024 * 1024,
                backupCount=3,
                encoding="utf-8",
            )
            file_handler.setLevel(logging.DEBUG)  # 파일은 항상 DEBUG 레벨
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
    except Exception:
        pass  # 파일 로깅 실패 시 무시

    return log_file


async def async_main() -> int:
    """비동기 메인 함수."""
    args = parse_args()

    # 프로젝트 인자 처리: 없으면 자동 감지
    if args.project is None:
        detected, projects = detect_project()
        if detected:
            args.project = detected
            console.print(f"[green]프로젝트 자동 감지:[/] {detected}\n")
        else:
            # 프로젝트 감지 실패 시 안내 메시지 출력
            base_dir = find_orchay_root()
            if base_dir is None:
                console.print("[red]오류:[/] .orchay 폴더를 찾을 수 없습니다.")
                console.print("프로젝트를 초기화하세요: [cyan]orchay-init <project>[/]")
                return 1

            projects_dir = base_dir / ".orchay" / "projects"
            if not projects_dir.exists() or len(projects) == 0:
                console.print("[red]오류:[/] 프로젝트가 없습니다.")
                console.print(
                    f"[dim]{projects_dir}[/] 폴더에 wbs.yaml 파일을 생성하세요."
                )
                return 1

            # 2개 이상인 경우
            console.print("[yellow]프로젝트를 선택하세요:[/]\n")
            for p in sorted(projects):
                console.print(f"  • {p}")
            console.print("\n[dim]사용법:[/] orchay [cyan]<프로젝트명>[/]")
            return 1

    # 1. 파일 기반 설정 로드 (.orchay/settings/orchay.yaml)
    from orchay.utils.config import load_config

    try:
        config = load_config()
    except Exception as e:
        logger.warning(f"설정 파일 로드 실패, 기본값 사용: {e}")
        config = Config()

    # 2. CLI 인자로 override (명시적 지정 시)
    if args.workers is not None:
        config.workers = args.workers
    if args.interval != 5:
        config.interval = args.interval
    if args.mode != "quick":
        config.execution.mode = args.mode
    if args.verbose:
        config.verbose = True

    # 로깅 설정 (파일만, 콘솔 로깅 비활성화)
    setup_logging(config.verbose)

    # 프로젝트 경로 계산
    wbs_path, base_dir = get_project_paths(args.project)

    # 오케스트레이터 생성 및 초기화
    orchestrator = Orchestrator(config, wbs_path, base_dir, args.project)

    # 전체 초기화
    if not await orchestrator.initialize():
        return 1

    # dry-run 모드
    if args.dry_run:
        console.print("[yellow]--dry-run 모드: 분배 없이 상태만 표시[/]\n")
        orchestrator.print_status()
        return 0

    # TUI 모드
    from orchay.ui.app import OrchayApp

    app = OrchayApp(
        config=config,
        tasks=orchestrator.tasks,
        worker_list=orchestrator.workers,
        mode=config.execution.mode,
        project=args.project,
        interval=config.interval,
        orchestrator=orchestrator,
    )

    await app.run_async()
    return 0


def main() -> None:
    """orchay 스케줄러 진입점."""
    # 시작 시 기본 로깅 설정 (async_main 전에 crash 발생 대비)
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    try:
        exit_code = asyncio.run(async_main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        console.print("\n[yellow]중단됨[/]")
        logger.info("사용자에 의해 중단됨 (Ctrl+C)")
        sys.exit(0)
    except Exception as e:
        # 예상치 못한 예외 발생 시 로그에 기록
        error_msg = f"orchay 비정상 종료: {type(e).__name__}: {e}"
        console.print(f"\n[red bold]Fatal Error:[/] {error_msg}")

        # 전체 traceback 로깅
        logger.critical(error_msg)
        logger.critical(f"Traceback:\n{traceback.format_exc()}")

        # crash 파일에도 기록 (로그 파일 접근 불가 시 대비)
        try:
            base_dir = find_orchay_root() or Path.cwd()
            crash_dir = base_dir / ".orchay" / "logs"
            crash_dir.mkdir(parents=True, exist_ok=True)
            crash_file = crash_dir / "orchay-crash.log"

            timestamp = datetime.now().isoformat()
            with open(crash_file, "a", encoding="utf-8") as f:
                f.write(f"\n{'=' * 60}\n")
                f.write(f"[{timestamp}] {error_msg}\n")
                f.write(traceback.format_exc())
                f.write(f"{'=' * 60}\n")

            console.print(f"[dim]Crash 로그: {crash_file}[/]")
        except Exception:
            pass  # crash 로그 기록 실패는 무시

        sys.exit(1)


if __name__ == "__main__":
    main()
