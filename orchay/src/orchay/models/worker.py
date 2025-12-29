"""Worker 모델 정의."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class SchedulerState(str, Enum):
    """스케줄러 상태."""

    RUNNING = "running"  # 정상 동작 중
    PAUSED = "paused"  # 일시정지 (새 Task 분배 안 함)
    STOPPED = "stopped"  # 중지됨


class WorkerState(str, Enum):
    """Worker 상태."""

    IDLE = "idle"
    BUSY = "busy"
    PAUSED = "paused"
    ERROR = "error"
    BLOCKED = "blocked"
    DEAD = "dead"
    DONE = "done"


class Worker(BaseModel):
    """Claude Code Worker 모델."""

    id: int = Field(description="Worker 번호 (1, 2, 3...)")
    pane_id: int = Field(description="WezTerm pane ID")
    state: WorkerState = Field(default=WorkerState.IDLE, description="현재 상태")
    current_task: str | None = Field(default=None, description="현재 작업 중인 Task ID")
    current_step: str | None = Field(default=None, description="현재 workflow 단계")
    dispatch_time: datetime | None = Field(default=None, description="Task 분배 시간")
    retry_count: int = Field(default=0, description="재시도 횟수")
    is_manually_paused: bool = Field(default=False, description="수동 일시정지 여부")

    def is_available(self) -> bool:
        """작업 할당 가능 여부.

        수동 일시정지 상태이거나 IDLE이 아니면 할당 불가.
        """
        if self.is_manually_paused:
            return False
        return self.state == WorkerState.IDLE

    def pause(self) -> None:
        """Worker 수동 일시정지."""
        self.is_manually_paused = True

    def resume(self) -> None:
        """Worker 수동 일시정지 해제."""
        self.is_manually_paused = False

    def reset(self) -> None:
        """Worker 상태 초기화."""
        self.state = WorkerState.IDLE
        self.current_task = None
        self.current_step = None
        self.dispatch_time = None
        self.retry_count = 0
        # is_manually_paused는 유지 (수동 일시정지는 명시적 해제 필요)
