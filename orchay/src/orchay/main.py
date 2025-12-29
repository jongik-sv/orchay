"""orchay 메인 모듈.

WezTerm 기반 Task 스케줄러의 진입점입니다.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import logging
import os
import signal
import sys
import traceback
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

from rich.console import Console
from rich.table import Table

from orchay.models import Config, ExecutionConfig, Task, TaskStatus, Worker, WorkerState
from orchay.scheduler import (
    ExecutionMode,
    dispatch_task,
    filter_executable_tasks,
    get_next_workflow_command,
)
from orchay.utils.wezterm import (
    WezTermNotFoundError,
    get_active_pane_id,
    wezterm_list_panes,
    wezterm_send_text,
)
from orchay.wbs_parser import WbsParser
from orchay.worker import detect_worker_state

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
        self._paused = False

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
            if worker_count >= self.config.workers:
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
        """단일 스케줄링 사이클."""
        logger.debug("_tick 시작")

        # 1. WBS 재파싱
        self.tasks = await self.parser.parse()

        # 2. stopAtState에 도달한 Task 정리
        self._cleanup_completed_tasks()

        # 3. Worker 상태 업데이트
        await self._update_worker_states()

        # 3.5. Worker의 current_step을 WBS 상태 기반으로 업데이트
        self._sync_worker_steps()

        # 4. 실행 가능 Task 필터링 (assigned_worker 기반)
        executable = await filter_executable_tasks(
            self.tasks,
            self.mode,
        )

        # 5. idle Worker에 Task 분배 (일시정지 상태가 아닐 때만)
        logger.debug(f"_tick: executable={len(executable)}개, paused={self._paused}")
        if not self._paused:
            for worker in self.workers:
                if not executable:
                    break
                logger.debug(
                    f"Worker {worker.id}: state={worker.state.value}, "
                    f"manually_paused={worker.is_manually_paused}"
                )
                if worker.state == WorkerState.IDLE and not worker.is_manually_paused:
                    task = executable.pop(0)
                    logger.info(f"Dispatch: {task.id} -> Worker {worker.id}")
                    await self._dispatch_to_worker(worker, task)

        # 6. 상태 출력
        self.print_status()

    def _sync_worker_steps(self) -> None:
        """Worker의 current_step을 WBS 상태 기반으로 동기화."""
        # Task ID → Task 매핑
        task_map = {t.id: t for t in self.tasks}

        for worker in self.workers:
            if not worker.current_task:
                continue

            # Worker가 작업 중인 Task 찾기
            task = task_map.get(worker.current_task)
            if not task:
                continue

            # Task 상태를 step으로 변환
            status_to_step = {
                "[ ]": "start",
                "[bd]": "design",
                "[dd]": "draft",
                "[ap]": "approve",
                "[im]": "build",
                "[vf]": "verify",
                "[xx]": "done",
                "[an]": "analyze",
                "[fx]": "fix",
                "[ds]": "design",
            }
            new_step = status_to_step.get(task.status.value, worker.current_step)

            if new_step and new_step != worker.current_step:
                worker.current_step = new_step

    def _cleanup_completed_tasks(self) -> None:
        """stopAtState에 도달한 Task를 active에서 제거.

        모드별 stopAtState:
        - design: [dd] (상세설계)
        - quick/force: [xx] (완료)
        - develop: [im] (구현)
        """
        # 모드별 stopAtState 매핑
        stop_state_map: dict[ExecutionMode, set[TaskStatus]] = {
            ExecutionMode.DESIGN: {TaskStatus.DETAIL_DESIGN, TaskStatus.DONE},
            ExecutionMode.QUICK: {TaskStatus.DONE},
            ExecutionMode.DEVELOP: {TaskStatus.IMPLEMENT, TaskStatus.VERIFY, TaskStatus.DONE},
            ExecutionMode.FORCE: {TaskStatus.DONE},
        }

        stop_statuses = stop_state_map.get(self.mode, {TaskStatus.DONE})

        # WBS에서 stopAtState 이상인 Task들의 ID 수집
        {t.id for t in self.tasks if t.status in stop_statuses}

        # 완료된 Task의 할당 해제
        for task in self.tasks:
            if task.status in stop_statuses and task.assigned_worker is not None:
                task.assigned_worker = None

    async def _update_worker_states(self) -> None:
        """모든 Worker의 상태를 업데이트."""
        for worker in self.workers:
            # Grace period: dispatch 직후에는 상태 체크 건너뛰기
            if worker.dispatch_time:
                elapsed = (datetime.now() - worker.dispatch_time).total_seconds()
                if elapsed < self.config.dispatch.grace_period:
                    logger.debug(
                        f"Worker {worker.id}: grace period ({elapsed:.1f}s < "
                        f"{self.config.dispatch.grace_period}s)"
                    )
                    continue  # 상태 체크 건너뛰기

            state, done_info = await detect_worker_state(worker.pane_id)

            # 상태 매핑
            state_map = {
                "dead": WorkerState.DEAD,
                "done": WorkerState.DONE,
                "paused": WorkerState.PAUSED,
                "error": WorkerState.ERROR,
                "blocked": WorkerState.BLOCKED,
                "idle": WorkerState.IDLE,
                "busy": WorkerState.BUSY,
            }
            new_state = state_map.get(state, WorkerState.BUSY)

            # done 상태 처리: Task 할당 해제
            if new_state == WorkerState.DONE:
                # 이미 DONE 상태면 중복 처리 방지 (다음 tick에서 idle로 전환됨)
                if worker.state == WorkerState.DONE:
                    continue

                # Task 할당 해제
                task_id = done_info.task_id if done_info else worker.current_task
                if task_id:
                    task = next((t for t in self.tasks if t.id == task_id), None)
                    if task:
                        task.assigned_worker = None

                # DONE 상태로 유지 (다음 tick에서 신호가 사라지면 idle로 전환)
                worker.state = WorkerState.DONE
                worker.current_task = None
                worker.current_step = None

            elif new_state == WorkerState.IDLE:
                # DONE → IDLE 전환: ORCHAY_DONE 신호가 사라짐
                if worker.state == WorkerState.DONE:
                    worker.reset()
                # BUSY → IDLE 전환: Task 완료로 간주
                elif worker.state == WorkerState.BUSY:
                    # 추가 검증: dispatch 후 최소 시간 경과 확인
                    # 너무 빨리 끝나면 잘못된 idle 판정일 수 있음
                    if worker.dispatch_time:
                        elapsed = (datetime.now() - worker.dispatch_time).total_seconds()
                        if elapsed < self.config.dispatch.min_task_duration:
                            logger.warning(
                                f"Worker {worker.id}: 비정상 조기 완료 "
                                f"({elapsed:.1f}s < {self.config.dispatch.min_task_duration}s), "
                                f"idle 전환 거부"
                            )
                            # idle 전환 거부, BUSY 상태 유지
                            continue

                    if worker.current_task:
                        task = next((t for t in self.tasks if t.id == worker.current_task), None)
                        if task:
                            task.assigned_worker = None
                    worker.reset()
                else:
                    worker.state = new_state
            else:
                worker.state = new_state

    async def _dispatch_to_worker(self, worker: Worker, task: Task) -> None:
        """Worker에 Task를 분배."""
        # Worker 상태 업데이트 (TaskQueue 할당은 이미 완료됨)
        await dispatch_task(worker, task, self.mode)

        # /clear 전송 (옵션)
        if self.config.dispatch.clear_before_dispatch:
            try:
                await wezterm_send_text(worker.pane_id, "/clear")
                await asyncio.sleep(3.0)  # /clear 처리 대기
                await wezterm_send_text(worker.pane_id, "\r")
                await asyncio.sleep(1.0)  # Enter 처리 대기
                await wezterm_send_text(worker.pane_id, " ")  # 추천 프롬프트 제거
            except Exception as e:
                logger.warning(f"Worker {worker.id} /clear 실패: {e}")

        # 워크플로우 명령 전송
        # 형식: /wf:{workflow} {project}/{task_id}
        # Task 상태에 따라 다음 workflow 결정
        next_workflow = get_next_workflow_command(task)

        # transition이 없으면 dispatch 안 함
        if next_workflow is None:
            console.print(
                f"[red]Error:[/] {task.id} ({task.status.value}) - "
                f"다음 transition을 찾을 수 없음 (category: {task.category.value})"
            )
            task.assigned_worker = None
            worker.reset()
            return

        command = f"/wf:{next_workflow} {self.project_name}/{task.id}"

        try:
            # 명령어 전송
            await wezterm_send_text(worker.pane_id, command)
            await asyncio.sleep(1.0)  # 명령어 입력 대기
            await wezterm_send_text(worker.pane_id, "\r")
            await asyncio.sleep(1.0)  # Enter 처리 대기
            await wezterm_send_text(worker.pane_id, " ")  # 추천 프롬프트 제거
            console.print(
                f"[cyan]Dispatch:[/] {task.id} ({task.status.value}) → Worker {worker.id} "
                f"(/wf:{next_workflow})"
            )
        except Exception as e:
            logger.error(f"Worker {worker.id} 명령 전송 실패: {e}")
            task.assigned_worker = None
            worker.reset()

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
        default="orchay",
        help="프로젝트명 (.orchay/projects/{project}/ 사용, 기본: orchay)",
    )
    parser.add_argument(
        "-w",
        "--workers",
        type=int,
        default=3,
        help="Worker 수 (기본: 3)",
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
        choices=["design", "quick", "develop", "force"],
        default="quick",
        help="실행 모드 (기본: quick)",
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
    parser.add_argument(
        "--no-tui",
        action="store_true",
        help="TUI 없이 CLI 모드로 실행",
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
    wbs_path = orchay_dir / "wbs.md"
    return wbs_path, base_dir


def setup_logging(verbose: bool = False) -> Path | None:
    """로깅 설정 (콘솔 + 파일).

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

    # 콘솔 핸들러
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # 파일 핸들러 (.orchay/logs/orchay.log)
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

            logger.info(f"로그 파일: {log_file}")
    except Exception as e:
        logger.warning(f"파일 로깅 설정 실패: {e}")

    return log_file


async def async_main() -> int:
    """비동기 메인 함수."""
    args = parse_args()

    # 로깅 설정 (콘솔 + 파일)
    setup_logging(args.verbose)

    # Config 생성
    config = Config(
        workers=args.workers,
        interval=args.interval,
        execution=ExecutionConfig(mode=args.mode),
    )

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

    # TUI 모드 (기본)
    if not args.no_tui:
        from orchay.ui.app import OrchayApp

        app = OrchayApp(
            config=config,
            tasks=orchestrator.tasks,
            worker_list=orchestrator.workers,
            mode=args.mode,
            project=args.project,
            interval=args.interval,
            orchestrator=orchestrator,
        )

        await app.run_async()
        return 0

    # CLI 모드 (--no-tui)
    # 시그널 핸들러 설정
    def signal_handler() -> None:
        orchestrator.stop()

    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        with contextlib.suppress(NotImplementedError):
            # Windows에서는 add_signal_handler가 지원되지 않음
            loop.add_signal_handler(sig, signal_handler)

    # 메인 루프 실행
    try:
        await orchestrator.run()
    except KeyboardInterrupt:
        orchestrator.stop()

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
