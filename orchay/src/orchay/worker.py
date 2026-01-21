"""Worker 상태 감지 모듈.

Worker pane의 출력을 분석하여 상태를 감지합니다.
"""

import logging
import re
import time
import zoneinfo
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal

from orchay.domain.constants import WORKER_DETECTION
from orchay.models.worker import PausedInfo
from orchay.utils.wezterm import pane_exists, wezterm_get_text

logger = logging.getLogger(__name__)

# 모듈 시작 시간 (idle 감지 지연용)
_startup_time: float = time.time()

# ORCHAY_DONE 패턴: ORCHAY_DONE:{task-id}:{action}:{status}[:{message}]
# action은 "wf:verify" 형식일 수 있으므로 wf: 접두사를 선택적으로 허용
DONE_PATTERN = re.compile(r"ORCHAY_DONE:([^:]+):(?:wf:)?(\w+):(success|error)(?::(.+))?")

# Fallback 완료 패턴: "Task [project/]TSK-XX-XX 완료"
# 예: "Task TSK-01-01 완료" 또는 "Task orchay/TSK-01-01 완료"
DONE_FALLBACK_PATTERN = re.compile(r"Task\s+((?:[\w-]+/)?TSK-[\w-]+)\s+완료")

# 상태 감지 패턴들
PAUSE_PATTERNS = [
    re.compile(r"rate.*limit.*exceeded", re.IGNORECASE),
    re.compile(r"rate.*limit.*reached", re.IGNORECASE),
    re.compile(r"hit.*rate.*limit", re.IGNORECASE),
    re.compile(r"hit.*limit", re.IGNORECASE),  # "hit.*limit" 추가
    re.compile(r"please.*wait", re.IGNORECASE),
    re.compile(r"try.*again.*later", re.IGNORECASE),
    re.compile(r"weekly.*limit.*reached", re.IGNORECASE),
    re.compile(r"resets.*at", re.IGNORECASE),
    re.compile(r"context.*limit.*exceeded", re.IGNORECASE),
    re.compile(r"conversation.*too.*long", re.IGNORECASE),
    re.compile(r"overloaded", re.IGNORECASE),
    re.compile(r"at.*capacity", re.IGNORECASE),
]

# 시간 파싱 패턴 (토큰 limit 재개 시간)
# "resets 6pm", "rate limit 9:30am", "hit limit resets at 8:15am" 등
TIME_PATTERNS = [
    re.compile(
        r"(?:resets?\s+(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)",
        re.IGNORECASE,
    ),
]

ERROR_PATTERNS = [
    re.compile(r"Error:", re.IGNORECASE),
    re.compile(r"Failed:", re.IGNORECASE),
    re.compile(r"Exception:", re.IGNORECASE),
    re.compile(r"❌"),
    re.compile(r"fatal:", re.IGNORECASE),
]

BLOCKED_PATTERNS = [
    re.compile(r"\?\s*$"),
    re.compile(r"\(y/n\)", re.IGNORECASE),
    re.compile(r"선택하세요", re.IGNORECASE),  # "선택" -> "선택하세요"로 변경 (optional과 구분)
    re.compile(r"선택해\s*주세요", re.IGNORECASE),
    re.compile(r"Press.*to continue", re.IGNORECASE),
]

# idle 프롬프트 패턴 (명령어 입력이 아닌 대기 상태)
# Claude Code가 프롬프트 대기 중일 때 나타나는 패턴
PROMPT_PATTERNS = [
    re.compile(r"^>\s*$", re.MULTILINE),  # ">" 만 있는 경우 (입력 대기)
    re.compile(r"^>\s+Try\s", re.MULTILINE),  # "> Try ..." 힌트 (idle 상태)
    re.compile(r"↵\s*send", re.IGNORECASE),  # 추천 프롬프트 표시 (idle 상태)
    re.compile(r"⏵⏵\s*bypass\s*permissions", re.IGNORECASE),  # bypass 표시 (idle 상태)
]

# 작업 중 패턴 (busy 상태 강제)
# Claude Code가 작업 중일 때 나타나는 패턴
BUSY_PATTERNS = [
    re.compile(r"\*\s+.+\s+중\.\.\.", re.MULTILINE),  # "* ... 중..." (Claude Code 작업 표시)
    re.compile(r"구현\s*중", re.IGNORECASE),
    re.compile(r"분석\s*중", re.IGNORECASE),
    re.compile(r"작업\s*중", re.IGNORECASE),
    re.compile(r"처리\s*중", re.IGNORECASE),
    re.compile(r"생성\s*중", re.IGNORECASE),
    re.compile(r"실행\s*중", re.IGNORECASE),
    re.compile(r"검색\s*중", re.IGNORECASE),
    re.compile(r"로딩\s*중", re.IGNORECASE),
    re.compile(r"esc to interrupt", re.IGNORECASE),  # Claude Code 작업 진행 표시
    re.compile(r"ctrl\+t to hide", re.IGNORECASE),  # Claude Code 작업 진행 표시
]


@dataclass
class DoneInfo:
    """ORCHAY_DONE 파싱 결과."""

    task_id: str
    action: str
    status: Literal["success", "error"]
    message: str | None = None


def parse_resume_time(text: str, detected_at: datetime) -> datetime:
    """텍스트에서 재개 시간을 파싱합니다.

    시간 + 10분에 재개합니다 (예: 6pm → 6:10pm).
    분이 있으면 올림 처리합니다 (예: 5:59pm → 6pm → 6:10pm).

    시간이 이미 지났으면 즉시 재시도합니다 (1분 뒤).
    (다음날로 설정하면 이미 해제된 rate limit을 24시간 기다리게 됨)

    Args:
        text: "resets 6pm", "rate limit 9:30am" 등
        detected_at: 감지 시간 (현재 시간)

    Returns:
        재개 시간 (timezone-aware datetime, Asia/Seoul)

    Raises:
        ValueError: 시간을 파싱할 수 없는 경우

    Examples:
        >>> detected_at = datetime(2025, 1, 2, 14, 0, tzinfo=ZoneInfo("Asia/Seoul"))
        >>> parse_resume_time("resets 6pm", detected_at)
        datetime(2025, 1, 2, 18, 10, tzinfo=ZoneInfo("Asia/Seoul"))  # 6pm + 10분

        >>> detected_at = datetime(2025, 1, 2, 18, 15, tzinfo=ZoneInfo("Asia/Seoul"))
        >>> parse_resume_time("resets 6pm", detected_at)
        datetime(2025, 1, 2, 18, 16, tzinfo=ZoneInfo("Asia/Seoul"))  # 이미 지남 → 1분 뒤
    """
    for pattern in TIME_PATTERNS:
        match = pattern.search(text)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2)) if match.group(2) else 0
            ampm = match.group(3)

            # 12시간제 → 24시간제 변환
            if ampm.lower() == "pm" and hour != 12:
                hour += 12
            elif ampm.lower() == "am" and hour == 12:
                hour = 0

            # 분이 있으면 한 시간 올림 (5:59pm → 6pm)
            if minute > 0:
                hour += 1
                # 23:59 → 00:00 (자정 넘기면)
                if hour >= 24:
                    hour -= 24

            # 타임존 처리 (Asia/Seoul)
            tz = zoneinfo.ZoneInfo("Asia/Seoul")

            # 재개 시간 = 지정된 시간 + 10분
            resume_time = detected_at.replace(
                hour=hour, minute=10, second=0, microsecond=0, tzinfo=tz
            )

            # 시간이 이미 지났으면 즉시 재시도 (1분 뒤)
            # (다음날로 설정하면 이미 해제된 rate limit을 24시간 기다리게 됨)
            if resume_time <= detected_at:
                resume_time = detected_at + timedelta(minutes=1)

            return resume_time

    raise ValueError(f"Cannot parse resume time from: {text}")


def get_fallback_resume_time(detected_at: datetime) -> datetime:
    """시간 파싱 실패 시 fallback: 30분 뒤.

    Args:
        detected_at: 감지 시간 (현재 시간)

    Returns:
        30분 뒤의 시간 (timezone-aware datetime)
    """
    return detected_at + timedelta(minutes=30)


def parse_done_signal(text: str) -> DoneInfo | None:
    """ORCHAY_DONE 신호를 파싱합니다.

    Args:
        text: pane 출력 텍스트

    Returns:
        DoneInfo 또는 None (패턴 미매칭 시)
    """
    # 1. 정규 ORCHAY_DONE 패턴 체크
    matches = list(DONE_PATTERN.finditer(text))
    if matches:
        # 마지막 매치 사용 (가장 최근 완료 신호)
        match = matches[-1]
        return DoneInfo(
            task_id=match.group(1),
            action=match.group(2),
            status=match.group(3),  # type: ignore[arg-type]
            message=match.group(4),
        )

    # 2. Fallback 패턴 체크: "Task TSK-XX-XX 완료"
    fallback_matches = list(DONE_FALLBACK_PATTERN.finditer(text))
    if fallback_matches:
        match = fallback_matches[-1]
        return DoneInfo(
            task_id=match.group(1),
            action="done",
            status="success",
            message="fallback pattern",
        )

    return None


WorkerState = Literal["dead", "done", "paused", "error", "blocked", "idle", "busy"]


async def detect_worker_state(
    pane_id: int,
    has_active_task: bool = False,
) -> tuple[WorkerState, DoneInfo | PausedInfo | None]:
    """Worker 상태를 감지합니다.

    pane 출력을 분석하여 상태를 판단합니다.

    Args:
        pane_id: WezTerm pane ID
        has_active_task: Worker가 현재 Task를 실행 중인지 여부.
            True면 프롬프트로 idle 감지하지 않음 (ORCHAY_DONE만으로 완료 판정).
            False면 프롬프트로 idle 감지 허용 (시작 시, Task 완료 후).

    Returns:
        (상태, DoneInfo/PausedInfo 또는 None) 튜플
        - done: DoneInfo
        - paused: PausedInfo (시간 정보 포함)
        - 그 외: None
    """
    # 0. pane 존재 확인
    if not await pane_exists(pane_id):
        return "dead", None

    # 1. pane 텍스트 조회 (100줄 - DONE 신호 + 기본 상태 모두 처리)
    # 성능 최적화: 한 번의 wezterm_get_text 호출로 두 용도 모두 처리
    output = await wezterm_get_text(
        pane_id, lines=WORKER_DETECTION.DONE_DETECTION_LINES
    )

    # 빈 출력이면 busy로 간주
    if not output.strip():
        return "busy", None

    # 2. ORCHAY_DONE 체크 (최우선 - 완료 신호는 busy보다 우선)
    done_info = parse_done_signal(output)
    if done_info:
        return "done", done_info

    # 이하 기본 상태 감지 (100줄 전체에서 패턴 검색)

    # 3. 일시 중단 패턴 (rate limit 등은 실제 제약이므로 우선)
    for pattern in PAUSE_PATTERNS:
        if pattern.search(output):
            # 시간 파싱 시도
            detected_at = datetime.now(zoneinfo.ZoneInfo("Asia/Seoul"))
            try:
                resume_at = parse_resume_time(output, detected_at)
                paused_info = PausedInfo(
                    reason="rate limit",
                    resume_at=resume_at,
                    detected_at=detected_at,
                    message=output[:200],  # 처음 200자만 저장
                )
                logger.info(f"Token limit detected, resuming at {resume_at}")
                return "paused", paused_info
            except ValueError:
                # 시간 파싱 실패 시 fallback: 30분 뒤
                resume_at = get_fallback_resume_time(detected_at)
                paused_info = PausedInfo(
                    reason="rate limit",
                    resume_at=resume_at,
                    detected_at=detected_at,
                    message="fallback: 30 minutes",
                )
                logger.info(f"Token limit detected (no time), using fallback: {resume_at}")
                return "paused", paused_info

    # 4. 작업 중 패턴 체크 (명시적 busy 상태)
    # Claude Code가 작업 중일 때 나타나는 패턴이 있으면 busy
    # "esc to interrupt", "ctrl+t to hide" 등은 작업 중에만 표시됨
    for pattern in BUSY_PATTERNS:
        if pattern.search(output):
            return "busy", None

    # 5. 에러 패턴
    for pattern in ERROR_PATTERNS:
        if pattern.search(output):
            return "error", None

    # 6. 질문/입력 대기 패턴
    for pattern in BLOCKED_PATTERNS:
        if pattern.search(output):
            return "blocked", None

    # 7. 프롬프트 패턴 체크
    # - Task 실행 중(has_active_task=True): 프롬프트로 idle 감지 안 함
    # - Task 없음(has_active_task=False): 프롬프트로 idle 감지 허용
    # - 시작 후 지연 시간 이내: 무조건 프롬프트로 idle 감지 (Worker 초기화용)
    elapsed = time.time() - _startup_time
    if elapsed < WORKER_DETECTION.IDLE_DETECTION_DELAY or not has_active_task:
        last_lines = output.strip().split("\n")[-5:]
        last_text = "\n".join(last_lines)
        for pattern in PROMPT_PATTERNS:
            if pattern.search(last_text):
                return "idle", None

    # 8. 기본값: 작업 중
    return "busy", None


# /wf: 명령어 패턴에서 Task ID 추출
# 예: "/wf:build orchay/TSK-01-01" → "orchay/TSK-01-01"
WF_COMMAND_PATTERN = re.compile(r"/wf:\w+\s+((?:[\w-]+/)?(TSK-[\w-]+))")


async def extract_running_task_from_pane(pane_id: int) -> str | None:
    """pane 텍스트에서 현재 실행 중인 Task ID를 추출합니다.

    가장 최근의 /wf:xxx 명령어에서 Task ID를 찾습니다.
    ORCHAY_DONE 신호가 있으면 해당 Task는 완료된 것으로 간주하여 None 반환.

    Args:
        pane_id: WezTerm pane ID

    Returns:
        Task ID (예: "TSK-01-01") 또는 None
    """
    output = await wezterm_get_text(pane_id, lines=WORKER_DETECTION.OUTPUT_LINES)

    if not output.strip():
        return None

    # ORCHAY_DONE 신호가 있으면 Task 완료로 간주
    if DONE_PATTERN.search(output):
        return None

    # /wf:xxx 명령어에서 Task ID 추출 (가장 최근 것)
    matches = list(WF_COMMAND_PATTERN.finditer(output))
    if matches:
        full_id = matches[-1].group(1)
        # "project/TSK-XX-XX" 형식이면 "/" 뒤 부분만 반환
        return full_id.split("/")[-1]

    return None
