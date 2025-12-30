"""설정 모델 정의."""

from typing import Literal

from pydantic import BaseModel, Field


class DetectionConfig(BaseModel):
    """Worker 상태 감지 설정."""

    done_pattern: str = Field(
        default=r"ORCHAY_DONE:([^:]+):(\w+):(success|error)(?::(.+))?",
        description="완료 신호 패턴",
    )
    prompt_patterns: list[str] = Field(
        default_factory=lambda: [r"^>\s*$", r"╭─", r"❯"],
        description="프롬프트 감지 패턴",
    )
    pause_patterns: list[str] = Field(
        default_factory=lambda: [
            r"rate.*limit",
            r"please.*wait",
            r"try.*again",
            r"weekly.*limit.*reached",
            r"context.*limit",
            r"overloaded",
        ],
        description="일시 중단 감지 패턴",
    )
    error_patterns: list[str] = Field(
        default_factory=lambda: [r"Error:", r"Failed:", r"Exception:", r"❌", r"fatal:"],
        description="에러 감지 패턴",
    )
    question_patterns: list[str] = Field(
        default_factory=lambda: [r"\?\s*$", r"\(y/n\)", r"선택"],
        description="질문 대기 감지 패턴",
    )
    read_lines: int = Field(default=50, description="pane 출력 읽기 줄 수")


class RecoveryConfig(BaseModel):
    """복구 설정."""

    resume_text: str = Field(default="계속", description="재개 시 전송할 텍스트")
    default_wait_time: int = Field(default=60, description="기본 대기 시간 (초)")
    context_limit_wait: int = Field(default=5, description="컨텍스트 리밋 대기 시간 (초)")
    weekly_limit_default: int = Field(default=3600, description="주간 리밋 파싱 실패 시 대기 (초)")
    max_retries: int = Field(default=3, description="최대 재시도 횟수")
    retry_interval: int = Field(default=5, description="재시도 간격 (초)")


class DispatchConfig(BaseModel):
    """작업 분배 설정."""

    clear_before_dispatch: bool = Field(default=True, description="분배 전 /clear 전송")
    clear_wait_time: int = Field(default=2, description="/clear 후 대기 시간 (초)")
    grace_period: int = Field(default=20, description="dispatch 후 상태 체크 무시 시간 (초)")
    min_task_duration: int = Field(
        default=30,
        description="Task 최소 실행 시간 (초) - 이보다 빨리 끝나면 잘못된 idle 판정 의심",
    )


class HistoryConfig(BaseModel):
    """히스토리 설정."""

    enabled: bool = Field(default=True, description="히스토리 저장 활성화")
    storage_path: str = Field(
        default=".orchay/logs/orchay-history.jsonl",
        description="히스토리 파일 경로",
    )
    max_entries: int = Field(default=1000, description="최대 저장 항목 수")
    capture_lines: int = Field(default=500, description="pane 출력 캡처 줄 수")


class ExecutionConfig(BaseModel):
    """실행 모드 설정."""

    start_paused: bool = Field(default=False, description="시작 시 일시정지 상태")
    mode: Literal["design", "quick", "develop", "force"] = Field(
        default="quick",
        description="실행 모드: design, quick, develop, force",
    )
    allow_mode_switch: bool = Field(default=True, description="실행 중 모드 전환 허용")


class Config(BaseModel):
    """orchay 전체 설정."""

    workers: int = Field(default=3, ge=1, le=10, description="Worker pane 수")
    interval: int = Field(default=5, ge=1, le=60, description="모니터링 간격 (초)")
    verbose: bool = Field(default=False, description="상세 로그 출력")
    category: str | None = Field(default=None, description="카테고리 필터")
    project: str | None = Field(default=None, description="프로젝트 경로")
    detection: DetectionConfig = Field(default_factory=DetectionConfig)
    recovery: RecoveryConfig = Field(default_factory=RecoveryConfig)
    dispatch: DispatchConfig = Field(default_factory=DispatchConfig)
    history: HistoryConfig = Field(default_factory=HistoryConfig)
    execution: ExecutionConfig = Field(default_factory=ExecutionConfig)
