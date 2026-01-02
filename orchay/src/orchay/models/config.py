"""설정 모델 정의."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator


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


class WorkerCommandConfig(BaseModel):
    """워커 명령어 설정."""

    startup: str = Field(
        default="claude --dangerously-skip-permissions",
        description="워커 pane 시작 시 실행할 기본 명령어",
    )
    pane_startup: dict[int, str] = Field(
        default_factory=dict,
        description="특정 pane 번호(1-6)에 적용할 startup 명령어 (기본값 오버라이드)",
    )

    def get_startup_for_worker(self, worker_id: int) -> str:
        """Worker ID에 맞는 startup 명령어 반환.

        Args:
            worker_id: Worker 번호 (1-6)

        Returns:
            해당 Worker의 startup 명령어 (pane_startup에 없으면 기본값)

        Raises:
            ValueError: worker_id가 1-6 범위를 벗어날 때
        """
        if not 1 <= worker_id <= 6:
            raise ValueError(f"worker_id는 1-6 사이여야 함: {worker_id}")
        return self.pane_startup.get(worker_id, self.startup)

    @field_validator("pane_startup")
    @classmethod
    def validate_pane_startup(cls, v: dict[int, str]) -> dict[int, str]:
        """pane_startup 유효성 검증."""
        for worker_id in v.keys():
            if not 1 <= worker_id <= 6:
                raise ValueError(f"pane_startup 키는 1-6 사이여야 함: {worker_id}")
        return v


class LauncherConfig(BaseModel):
    """Launcher 설정 (WezTerm 레이아웃)."""

    width: int = Field(default=1920, ge=800, le=7680, description="창 너비 픽셀")
    height: int = Field(default=1080, ge=600, le=4320, description="창 높이 픽셀")
    max_rows: int = Field(default=3, ge=1, le=6, description="열당 최대 worker 수")
    scheduler_cols: int = Field(default=100, ge=50, le=300, description="스케줄러 pane 너비 columns")
    worker_cols: int = Field(default=120, ge=50, le=300, description="Worker pane 너비 columns")
    font_size: float = Field(default=11.0, ge=6.0, le=24.0, description="폰트 크기")

    # 플랫폼별 타이밍 설정
    startup_delay_windows: float = Field(
        default=1.5,
        ge=0.5,
        le=10.0,
        description="Windows WezTerm 시작 대기 시간 (초)",
    )
    startup_delay_linux: float = Field(
        default=2.0,
        ge=0.5,
        le=10.0,
        description="Linux/macOS WezTerm 시작 대기 시간 (초)",
    )

    # 설정 파일 경로
    config_filename: str = Field(
        default="orchay-startup.json",
        description="WezTerm startup config 파일명",
    )
    lua_config_file: str = Field(
        default="wezterm-orchay.lua",
        description="WezTerm Lua 설정 파일명",
    )


class Config(BaseModel):
    """orchay 전체 설정."""

    workers: int = Field(default=0, ge=0, description="Worker pane 수 (0=자동, 무제한)")
    interval: int = Field(default=5, ge=1, le=60, description="모니터링 간격 (초)")
    verbose: bool = Field(default=False, description="상세 로그 출력")
    category: str | None = Field(default=None, description="카테고리 필터")
    project: str | None = Field(default=None, description="프로젝트 경로")
    detection: DetectionConfig = Field(default_factory=DetectionConfig)
    recovery: RecoveryConfig = Field(default_factory=RecoveryConfig)
    dispatch: DispatchConfig = Field(default_factory=DispatchConfig)
    history: HistoryConfig = Field(default_factory=HistoryConfig)
    execution: ExecutionConfig = Field(default_factory=ExecutionConfig)
    worker_command: WorkerCommandConfig = Field(default_factory=WorkerCommandConfig)
    launcher: LauncherConfig = Field(default_factory=LauncherConfig)
