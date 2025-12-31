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

from orchay.models import Config, Task, TaskStatus, Worker, WorkerState
from orchay.scheduler import (
    ExecutionMode,
    dispatch_task,
    filter_executable_tasks,
    get_manual_commands,
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
        self._paused = config.execution.start_paused

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

    def _merge_tasks(self, new_tasks: list[Task]) -> None:
        """WBS 파싱 결과를 기존 Task 리스트에 병합.

        런타임 상태(assigned_worker)는 보존하고 WBS 필드만 업데이트합니다.

        Args:
            new_tasks: WBS 파싱으로 얻은 새 Task 리스트
        """
        # 기존 Task를 ID로 매핑
        existing_map = {t.id: t for t in self.tasks}
        new_ids = {t.id for t in new_tasks}

        # 1. 삭제된 Task 제거 (WBS에서 사라진 것)
        self.tasks = [t for t in self.tasks if t.id in new_ids]

        # 2. 기존 Task 업데이트 또는 새 Task 추가
        for new_task in new_tasks:
            if new_task.id in existing_map:
                # 기존 Task: WBS 필드만 업데이트, 런타임 상태 보존
                existing = existing_map[new_task.id]
                existing.title = new_task.title
                existing.status = new_task.status
                existing.priority = new_task.priority
                existing.category = new_task.category
                existing.depends = new_task.depends
                existing.blocked_by = new_task.blocked_by
                # assigned_worker는 절대 건드리지 않음!
            else:
                # 새 Task: 리스트에 추가
                self.tasks.append(new_task)

        logger.debug(f"Task 병합 완료: {len(self.tasks)}개")

    async def _tick(self) -> None:
        """단일 스케줄링 사이클."""
        logger.debug("_tick 시작")

        # 1. WBS 재파싱 후 기존 Task에 병합 (런타임 상태 보존)
        new_tasks = await self.parser.parse()
        self._merge_tasks(new_tasks)

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
            # 현재 Worker들이 실행 중인 Task ID 집합 (중복 방지용)
            running_task_ids = {w.current_task for w in self.workers if w.current_task}

            for worker in self.workers:
                if not executable:
                    break
                logger.debug(
                    f"Worker {worker.id}: state={worker.state.value}, "
                    f"manually_paused={worker.is_manually_paused}"
                )
                if worker.state == WorkerState.IDLE and not worker.is_manually_paused:
                    task = executable.pop(0)

                    # 중복 실행 방지: 다른 Worker가 이미 실행 중인 Task인지 확인
                    if task.id in running_task_ids:
                        logger.warning(
                            f"중복 실행 방지: {task.id}는 이미 다른 Worker에서 실행 중"
                        )
                        continue

                    # Race condition 방지: dispatch 전에 즉시 할당 상태 설정
                    task.assigned_worker = worker.id
                    worker.state = WorkerState.BUSY
                    worker.current_task = task.id
                    running_task_ids.add(task.id)  # 중복 방지 집합에 추가
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

            # Worker가 현재 Task를 실행 중인지 여부 전달
            has_active_task = worker.current_task is not None
            state, done_info = await detect_worker_state(worker.pane_id, has_active_task)

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

            # done 상태 처리: 연속 실행 또는 할당 해제
            if new_state == WorkerState.DONE:
                # 현재 Task의 DONE 신호인지 확인 (이전 Task의 신호 무시)
                if done_info and worker.current_task and done_info.task_id != worker.current_task:
                    logger.debug(
                        f"Worker {worker.id}: 이전 DONE 신호 무시 "
                        f"(신호={done_info.task_id}, 현재={worker.current_task})"
                    )
                    # 상태 변경 없이 BUSY 유지
                    continue

                if worker.state == WorkerState.DONE:
                    # DONE 상태가 연속 감지 → IDLE로 강제 전환
                    # (ORCHAY_DONE 신호가 화면에 남아있어도 두 번째 tick에서 전환)
                    worker.reset()
                else:
                    # 처음 DONE 감지: 연속 실행 체크
                    task_id = done_info.task_id if done_info else worker.current_task
                    if task_id:
                        task = next((t for t in self.tasks if t.id == task_id), None)
                        if task:
                            # WBS 재파싱 (스킬이 변경한 상태 반영)
                            await self._refresh_task_status(task)

                            next_cmd = get_next_workflow_command(task)
                            manual_cmds = get_manual_commands(self.mode)

                            if next_cmd and next_cmd not in manual_cmds:
                                # 자동: 즉시 다음 단계 dispatch (같은 Worker)
                                logger.info(
                                    f"연속 실행: {task.id} → /wf:{next_cmd} (Worker {worker.id})"
                                )
                                await self._dispatch_next_step(worker, task)
                                continue  # 다음 Worker로 (상태 유지)
                            else:
                                # 수동: 할당 해제
                                task.assigned_worker = None
                                logger.info(
                                    f"수동 대기: {task.id} (다음: {next_cmd})"
                                )

                    # DONE 상태로 유지 (다음 tick에서 IDLE로 전환됨)
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

    async def _refresh_task_status(self, task: Task) -> None:
        """단일 Task의 WBS 상태를 재로드합니다.

        스킬이 WBS 파일을 변경한 후 최신 상태를 반영합니다.
        """
        try:
            new_tasks = await self.parser.parse()
            for new_task in new_tasks:
                if new_task.id == task.id:
                    # 상태 관련 필드만 업데이트
                    task.status = new_task.status
                    task.title = new_task.title
                    task.priority = new_task.priority
                    task.category = new_task.category
                    task.depends = new_task.depends
                    task.blocked_by = new_task.blocked_by
                    logger.debug(f"Task 상태 갱신: {task.id} → {task.status.value}")
                    break
        except Exception as e:
            logger.warning(f"Task 상태 갱신 실패: {task.id} - {e}")

    async def _dispatch_next_step(self, worker: Worker, task: Task) -> None:
        """같은 Worker에 다음 워크플로우 단계를 dispatch합니다.

        연속 실행을 위해 DONE 상태 감지 후 즉시 다음 명령어를 전송합니다.
        """
        next_workflow = get_next_workflow_command(task)
        if next_workflow is None:
            logger.warning(f"다음 워크플로우 없음: {task.id}")
            task.assigned_worker = None
            worker.reset()
            return

        # Worker 상태 업데이트 (BUSY 유지)
        worker.state = WorkerState.BUSY
        worker.current_task = task.id
        worker.dispatch_time = datetime.now()
        worker.current_step = next_workflow

        # Task 할당 유지
        task.assigned_worker = worker.id

        # 명령어 전송
        command = f"/wf:{next_workflow} {self.project_name}/{task.id}"
        try:
            await wezterm_send_text(worker.pane_id, command)
            await asyncio.sleep(1.0)
            await wezterm_send_text(worker.pane_id, "\r")
            await asyncio.sleep(1.0)
            await wezterm_send_text(worker.pane_id, " ")  # 추천 프롬프트 제거
            console.print(
                f"[cyan]연속 실행:[/] {task.id} ({task.status.value}) → Worker {worker.id} "
                f"(/wf:{next_workflow})"
            )
        except Exception as e:
            logger.error(f"Worker {worker.id} 연속 실행 실패: {e}")
            task.assigned_worker = None
            worker.reset()

    async def _dispatch_to_worker(self, worker: Worker, task: Task) -> None:
        """Worker에 Task를 분배."""
        # 명령 전송 전 Worker 실제 상태 확인 (dispatch 전이므로 has_active_task=False)
        actual_state, _ = await detect_worker_state(worker.pane_id, has_active_task=False)
        # idle 또는 done 상태일 때만 dispatch 가능
        # done: 이전 작업 완료 후 ORCHAY_DONE 신호가 화면에 남아있는 상태
        if actual_state not in ("idle", "done"):
            logger.warning(
                f"Worker {worker.id} dispatch 취소: 실제 상태가 {actual_state} (idle/done 아님)"
            )
            task.assigned_worker = None
            worker.reset()
            return

        # Worker 상태 업데이트 (TaskQueue 할당은 이미 완료됨)
        await dispatch_task(worker, task, self.mode)

        # 워크플로우 명령 결정 (먼저 확인하여 /clear 낭비 방지)
        # 형식: /wf:{workflow} {project}/{task_id}
        # Task 상태에 따라 다음 workflow 결정
        next_workflow = get_next_workflow_command(task)

        # transition이 없으면 dispatch 안 함 (/clear도 전송하지 않음)
        if next_workflow is None:
            console.print(
                f"[red]Error:[/] {task.id} ({task.status.value}) - "
                f"다음 transition을 찾을 수 없음 (category: {task.category.value})"
            )
            task.assigned_worker = None
            worker.reset()
            return

        # /clear 전송 (옵션) - workflow 명령 직전에 한번만
        if self.config.dispatch.clear_before_dispatch:
            try:
                await wezterm_send_text(worker.pane_id, "/clear")
                await asyncio.sleep(3.0)  # /clear 처리 대기
                await wezterm_send_text(worker.pane_id, "\r")
                await asyncio.sleep(1.0)  # Enter 처리 대기
                await wezterm_send_text(worker.pane_id, " ")  # 추천 프롬프트 제거
            except Exception as e:
                logger.warning(f"Worker {worker.id} /clear 실패: {e}")

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
        default=None,
        help="프로젝트명 (.orchay/projects/{project}/ 사용)",
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

    # wbs.md가 있는 폴더만 프로젝트로 인식
    projects = [
        d.name
        for d in projects_dir.iterdir()
        if d.is_dir() and (d / "wbs.md").exists()
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
    wbs_path = orchay_dir / "wbs.md"
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
                    f"[dim]{projects_dir}[/] 폴더에 wbs.md 파일을 생성하세요."
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
    if args.workers != 3:  # 기본값이 아닌 경우
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
