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


class PausedInfo(BaseModel):
    """Paused 상태 정보 (토큰 한도 등)."""

    reason: str = Field(description="일시정지 사유 (예: 'rate limit', 'hit limit')")
    resume_at: datetime = Field(description="재개 가능 시간")
    detected_at: datetime = Field(description="감지 시간")
    message: str = Field(default="", description="원본 메시지")


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
    resume_at: datetime | None = Field(default=None, description="자동 재개 시간 (토큰 한도 등)")
    paused_info: PausedInfo | None = Field(default=None, description="일시정지 상세 정보")

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
        self.resume_at = None
        self.paused_info = None
        # is_manually_paused는 유지 (수동 일시정지는 명시적 해제 필요)
