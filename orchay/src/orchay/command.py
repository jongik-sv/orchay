"""CommandHandler 모듈 (TSK-02-03).

TUI 인터랙티브 기능의 명령어 처리를 담당합니다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Protocol

from orchay.models import Task, TaskStatus, WorkerState
from orchay.scheduler import ExecutionMode

if TYPE_CHECKING:
    from orchay.models import Worker

logger = logging.getLogger(__name__)


# ============================================================================
# 상수 정의
# ============================================================================

# Function Key → 명령어 매핑
FUNCTION_KEYS: dict[str, str] = {
    "f1": "help",
    "f2": "status",
    "f3": "queue",
    "f4": "workers",
    "f5": "reload",
    "f6": "history",
    "f7": "mode",
    "f9": "pause",
    "f10": "stop",
    "shift+f1": "worker 1",
    "shift+f2": "worker 2",
    "shift+f3": "worker 3",
}

# 지원하는 명령어 목록
COMMANDS: set[str] = {
    "help",
    "status",
    "queue",
    "workers",
    "worker",
    "reload",
    "history",
    "mode",
    "pause",
    "resume",
    "stop",
    "start",
    "up",
    "top",
    "skip",
    "retry",
    "clear",
}


# ============================================================================
# Protocol 정의
# ============================================================================


class OrchestratorProtocol(Protocol):
    """Orchestrator 인터페이스."""

    tasks: list[Task]
    workers: list[Worker]
    running_tasks: set[str]
    mode: ExecutionMode
    _paused: bool


# ============================================================================
# 결과 클래스
# ============================================================================


@dataclass
class CommandResult:
    """명령어 실행 결과."""

    success: bool
    message: str
    data: object = None  # noqa: ANN401

    @classmethod
    def ok(cls, message: str, data: object = None) -> CommandResult:
        """성공 결과 생성."""
        return cls(success=True, message=message, data=data)

    @classmethod
    def error(cls, message: str, data: object = None) -> CommandResult:
        """에러 결과 생성."""
        return cls(success=False, message=message, data=data)


# ============================================================================
# CommandHandler 클래스
# ============================================================================


class CommandHandler:
    """명령어 처리기.

    TUI에서 사용자 입력을 받아 Orchestrator를 제어합니다.
    """

    def __init__(self, orchestrator: OrchestratorProtocol) -> None:
        """초기화.

        Args:
            orchestrator: Orchestrator 인스턴스
        """
        self.orchestrator = orchestrator

    # ========================================================================
    # 명령어 파싱
    # ========================================================================

    def parse_command(self, input_str: str) -> tuple[str, str | None]:
        """명령어 문자열을 파싱합니다.

        Args:
            input_str: 입력 문자열 (예: "top TSK-01-02")

        Returns:
            (명령어, 인자) 튜플. 인자가 없으면 None.

        Raises:
            ValueError: 알 수 없는 명령어
        """
        parts = input_str.strip().split(maxsplit=1)
        if not parts:
            raise ValueError("알 수 없는 명령어: 빈 입력")

        cmd = parts[0].lower()
        arg = parts[1] if len(parts) > 1 else None

        if cmd not in COMMANDS:
            raise ValueError(f"알 수 없는 명령어: {cmd}")

        return cmd, arg

    # ========================================================================
    # 명령어 실행
    # ========================================================================

    async def process_command(self, input_str: str) -> CommandResult:
        """명령어를 파싱하고 실행합니다.

        Args:
            input_str: 입력 문자열

        Returns:
            CommandResult 실행 결과
        """
        try:
            cmd, arg = self.parse_command(input_str)
        except ValueError as e:
            return CommandResult.error(str(e))

        # 명령어별 핸들러 호출
        handlers: dict[str, Any] = {
            "help": self._cmd_help,
            "status": self._cmd_status,
            "queue": self._cmd_queue,
            "workers": self._cmd_workers,
            "worker": lambda: self._cmd_worker(arg),
            "reload": self._cmd_reload,
            "history": self._cmd_history,
            "mode": self.change_mode,
            "pause": self.toggle_pause,
            "resume": self.toggle_pause,
            "stop": self._cmd_stop,
            "start": lambda: self._cmd_start(arg),
            "up": lambda: self.up_task(arg) if arg else CommandResult.error("Task ID 필요"),
            "top": lambda: self.top_task(arg) if arg else CommandResult.error("Task ID 필요"),
            "skip": lambda: self.skip_task(arg) if arg else CommandResult.error("Task ID 필요"),
            "retry": lambda: self.retry_task(arg) if arg else CommandResult.error("Task ID 필요"),
            "clear": self._cmd_clear,
        }

        handler = handlers.get(cmd)
        if handler is None:
            return CommandResult.error(f"핸들러 없음: {cmd}")

        result = handler()
        # 비동기 핸들러 처리
        if hasattr(result, "__await__"):
            result = await result

        return result

    # ========================================================================
    # 큐 조회/조작 메서드
    # ========================================================================

    def get_queue_tasks(self) -> list[Task]:
        """대기 중인 Task 목록을 반환합니다.

        Returns:
            완료되지 않은 Task 리스트
        """
        return [t for t in self.orchestrator.tasks if t.status != TaskStatus.DONE]

    def get_prev_task_index(self, current: int, total: int) -> int:
        """이전 Task 인덱스를 반환합니다.

        Args:
            current: 현재 인덱스
            total: 전체 Task 수

        Returns:
            이전 인덱스 (경계에서는 현재 값 유지)
        """
        return max(0, current - 1)

    def get_next_task_index(self, current: int, total: int) -> int:
        """다음 Task 인덱스를 반환합니다.

        Args:
            current: 현재 인덱스
            total: 전체 Task 수

        Returns:
            다음 인덱스 (경계에서는 현재 값 유지)
        """
        return min(total - 1, current + 1)

    def get_action_options(self) -> list[dict[str, str]]:
        """액션 메뉴 옵션을 반환합니다.

        Returns:
            옵션 리스트 [{id, label, description}, ...]
        """
        return [
            {"id": "up", "label": "위로 이동 (up)", "description": "큐에서 한 칸 위로"},
            {"id": "top", "label": "최우선 (top)", "description": "큐의 맨 앞으로"},
            {"id": "skip", "label": "스킵 (skip)", "description": "이 Task 건너뛰기"},
            {"id": "retry", "label": "재시도 (retry)", "description": "스킵된 Task 복구"},
            {"id": "detail", "label": "상세 보기", "description": "Task 상세 정보"},
        ]

    async def up_task(self, task_id: str) -> CommandResult:
        """Task를 큐에서 한 칸 위로 이동합니다.

        Args:
            task_id: 이동할 Task ID

        Returns:
            CommandResult
        """
        tasks = self.orchestrator.tasks
        idx = next((i for i, t in enumerate(tasks) if t.id == task_id), -1)

        if idx == -1:
            return CommandResult.error(f"Task '{task_id}'를 찾을 수 없습니다")

        if idx == 0:
            return CommandResult.ok(f"{task_id}는 이미 첫 번째입니다")

        # 스왑
        tasks[idx], tasks[idx - 1] = tasks[idx - 1], tasks[idx]
        return CommandResult.ok(f"{task_id} → 위로 이동")

    async def top_task(self, task_id: str) -> CommandResult:
        """Task를 큐의 맨 앞으로 이동합니다.

        Args:
            task_id: 이동할 Task ID

        Returns:
            CommandResult
        """
        tasks = self.orchestrator.tasks
        idx = next((i for i, t in enumerate(tasks) if t.id == task_id), -1)

        if idx == -1:
            return CommandResult.error(f"Task '{task_id}'를 찾을 수 없습니다")

        if idx == 0:
            return CommandResult.ok(f"{task_id}는 이미 첫 번째입니다")

        # 맨 앞으로 이동
        task = tasks.pop(idx)
        tasks.insert(0, task)
        return CommandResult.ok(f"{task_id} → 최우선 이동")

    async def skip_task(self, task_id: str) -> CommandResult:
        """Task를 스킵합니다 (blocked 처리).

        Args:
            task_id: 스킵할 Task ID

        Returns:
            CommandResult
        """
        # BR-001: 실행 중인 Task는 skip 불가
        if task_id in self.orchestrator.running_tasks:
            return CommandResult.error(f"실행 중인 Task는 스킵할 수 없습니다: {task_id}")

        task = next((t for t in self.orchestrator.tasks if t.id == task_id), None)

        if task is None:
            return CommandResult.error(f"Task '{task_id}'를 찾을 수 없습니다")

        task.blocked_by = "skipped"
        return CommandResult.ok(f"{task_id} → 스킵됨")

    async def retry_task(self, task_id: str) -> CommandResult:
        """스킵된 Task를 큐로 복구합니다.

        Args:
            task_id: 복구할 Task ID

        Returns:
            CommandResult
        """
        task = next((t for t in self.orchestrator.tasks if t.id == task_id), None)

        if task is None:
            return CommandResult.error(f"Task '{task_id}'를 찾을 수 없습니다")

        if task.blocked_by is None:
            return CommandResult.ok(f"{task_id}는 스킵 상태가 아닙니다")

        task.blocked_by = None
        return CommandResult.ok(f"{task_id} → 큐로 복구")

    # ========================================================================
    # 모드/일시정지 제어
    # ========================================================================

    async def change_mode(self) -> CommandResult:
        """실행 모드를 순환합니다.

        Returns:
            CommandResult

        Note:
            BR-002: 모드 전환은 진행 중 작업에 영향 없음
        """
        modes = [
            ExecutionMode.QUICK,
            ExecutionMode.DEVELOP,
            ExecutionMode.FORCE,
            ExecutionMode.DESIGN,
        ]
        current_idx = modes.index(self.orchestrator.mode)
        next_idx = (current_idx + 1) % len(modes)
        self.orchestrator.mode = modes[next_idx]

        return CommandResult.ok(f"Mode → {self.orchestrator.mode.value}")

    async def toggle_pause(self) -> CommandResult:
        """일시정지를 토글합니다.

        Returns:
            CommandResult

        Note:
            BR-003: pause 시 진행 중 작업 계속
        """
        self.orchestrator._paused = not self.orchestrator._paused
        status = "일시 중지됨" if self.orchestrator._paused else "재개됨"
        return CommandResult.ok(f"Scheduler {status}")

    # ========================================================================
    # 정보 조회 명령어
    # ========================================================================

    async def _cmd_help(self) -> CommandResult:
        """도움말 표시."""
        help_text = "F1:Help F2:Status F3:Queue F4:Workers F5:Reload F7:Mode F9:Pause F10:Exit"
        return CommandResult.ok(help_text)

    async def _cmd_status(self) -> CommandResult:
        """상태 정보 표시."""
        tasks = self.orchestrator.tasks
        completed = sum(1 for t in tasks if t.status == TaskStatus.DONE)
        running = len(self.orchestrator.running_tasks)
        mode = self.orchestrator.mode.value
        return CommandResult.ok(
            f"Status: {completed}/{len(tasks)} done, {running} running, mode={mode}"
        )

    async def _cmd_queue(self) -> CommandResult:
        """큐 정보 표시."""
        queue_count = sum(
            1
            for t in self.orchestrator.tasks
            if t.status != TaskStatus.DONE and t.blocked_by is None
        )
        return CommandResult.ok(f"Queue: {queue_count} tasks 대기 중")

    async def _cmd_workers(self) -> CommandResult:
        """Worker 정보 표시."""
        workers = self.orchestrator.workers
        idle = sum(1 for w in workers if w.state == WorkerState.IDLE)
        busy = sum(1 for w in workers if w.state == WorkerState.BUSY)
        return CommandResult.ok(f"Workers: {len(workers)} total, {idle} idle, {busy} busy")

    async def _cmd_worker(self, arg: str | None) -> CommandResult:
        """특정 Worker 정보 표시."""
        if arg is None:
            return CommandResult.error("Worker 번호 필요")

        try:
            worker_id = int(arg)
        except ValueError:
            return CommandResult.error(f"유효하지 않은 Worker 번호: {arg}")

        worker = next((w for w in self.orchestrator.workers if w.id == worker_id), None)
        if worker is None:
            return CommandResult.error(f"Worker {worker_id}가 존재하지 않습니다")

        task_info = worker.current_task or "-"
        return CommandResult.ok(f"Worker {worker_id}: {worker.state.value}, task={task_info}")

    async def _cmd_reload(self) -> CommandResult:
        """WBS 재로드."""
        # 실제 reload는 Orchestrator에서 처리
        return CommandResult.ok("Reloaded")

    async def _cmd_history(self) -> CommandResult:
        """히스토리 표시."""
        return CommandResult.ok("History: (not implemented)")

    async def _cmd_stop(self) -> CommandResult:
        """스케줄러 종료."""
        return CommandResult.ok("Stopping scheduler...")

    async def _cmd_start(self, arg: str | None) -> CommandResult:
        """Task 시작."""
        if arg is None:
            return CommandResult.error("Task ID 필요")
        return CommandResult.ok(f"Starting {arg}...")

    async def _cmd_clear(self) -> CommandResult:
        """화면 클리어."""
        return CommandResult.ok("Cleared")


# ============================================================================
# 유틸리티 함수
# ============================================================================


def get_command_from_key(key: str) -> str | None:
    """Function Key에 매핑된 명령어를 반환합니다.

    Args:
        key: 키 이름 (예: "f1", "shift+f1")

    Returns:
        명령어 또는 None
    """
    return FUNCTION_KEYS.get(key.lower())
