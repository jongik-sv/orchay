"""자동 재개 모듈.

TSK-02-01: paused 상태의 Worker를 자동으로 재개하는 메커니즘.

지원하는 paused 유형:
- weekly_limit: 주간 사용량 제한 (reset 시간까지 대기)
- rate_limit: 요청 빈도 제한 (기본 60초 대기)
- context_limit: 컨텍스트 길이 제한 (5초 대기)
"""

import asyncio
import re
from datetime import datetime
from typing import TYPE_CHECKING, Literal

from orchay.utils.wezterm import wezterm_get_text, wezterm_send_text
from orchay.worker import detect_worker_state

if TYPE_CHECKING:
    from orchay.models.config import RecoveryConfig
    from orchay.models.worker import Worker

# paused 유형 정의
PausedType = Literal["weekly_limit", "rate_limit", "context_limit", "unknown"]

# 월 이름 → 월 번호 매핑
MONTH_MAP: dict[str, int] = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

# Reset 시간 파싱 패턴들
# "resets Oct 9 at 10:30am", "resets Oct 9 at 2pm", "resets Oct 6, 1pm"
RESET_PATTERNS = [
    # resets Oct 9 at 10:30am / resets Oct 9 at 2:30pm
    re.compile(
        r"resets?\s+(\w{3})\s+(\d{1,2})\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)",
        re.IGNORECASE,
    ),
    # resets Oct 6, 1pm / reset at Oct 6, 1pm
    re.compile(
        r"resets?\s+(?:at\s+)?(\w{3})\s+(\d{1,2}),?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)",
        re.IGNORECASE,
    ),
    # reset at Dec 15, 9:45am
    re.compile(
        r"reset\s+at\s+(\w{3})\s+(\d{1,2}),?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)",
        re.IGNORECASE,
    ),
]

# paused 유형 감지 패턴
WEEKLY_LIMIT_PATTERNS = [
    re.compile(r"weekly\s*limit", re.IGNORECASE),
    re.compile(r"resets?\s+\w{3}\s+\d+", re.IGNORECASE),
]

RATE_LIMIT_PATTERNS = [
    re.compile(r"rate\s*limit", re.IGNORECASE),
    re.compile(r"please\s*wait", re.IGNORECASE),
    re.compile(r"too\s*many\s*requests", re.IGNORECASE),
    re.compile(r"try\s*again\s*later", re.IGNORECASE),
]

CONTEXT_LIMIT_PATTERNS = [
    re.compile(r"context\s*limit", re.IGNORECASE),
    re.compile(r"conversation\s*(is\s*)?too\s*long", re.IGNORECASE),
]


async def extract_reset_time(output: str) -> datetime | None:
    """Claude Code 출력에서 reset 시간 추출.

    Args:
        output: pane 출력 텍스트

    Returns:
        reset datetime 또는 None (파싱 실패 시)

    지원 형식:
        - "Weekly limit reached · resets Oct 9 at 10:30am"
        - "resets Oct 6, 1pm"
        - "reset at Oct 6, 1pm"
    """
    if not output:
        return None

    for pattern in RESET_PATTERNS:
        match = pattern.search(output)
        if match:
            month_str = match.group(1).lower()
            day = int(match.group(2))
            hour = int(match.group(3))
            minute = int(match.group(4)) if match.group(4) else 0
            am_pm = match.group(5).lower()

            # 월 이름 변환
            month = MONTH_MAP.get(month_str)
            if month is None:
                continue

            # AM/PM 변환
            if am_pm == "pm" and hour < 12:
                hour += 12
            elif am_pm == "am" and hour == 12:
                hour = 0

            # 연도 결정 (현재 또는 다음 연도)
            now = datetime.now()
            year = now.year

            try:
                result = datetime(year, month, day, hour, minute)

                # 과거 날짜면 다음 연도로
                if result < now:
                    result = datetime(year + 1, month, day, hour, minute)

                return result
            except ValueError:
                # 잘못된 날짜 (예: 2월 31일)
                continue

    return None


def calculate_wait_seconds(reset_time: datetime) -> int:
    """reset 시간까지 대기할 초 계산.

    Args:
        reset_time: 목표 시간

    Returns:
        대기할 초 (최소 0)
    """
    now = datetime.now()
    diff = (reset_time - now).total_seconds()
    return max(0, int(diff))


def detect_paused_type(output: str) -> PausedType:
    """paused 상태의 세부 유형 판별.

    Args:
        output: pane 출력 텍스트

    Returns:
        PausedType (weekly_limit, rate_limit, context_limit, unknown)
    """
    if not output:
        return "unknown"

    # Weekly limit 우선 (reset 시간 정보가 있으면 weekly)
    for pattern in WEEKLY_LIMIT_PATTERNS:
        if pattern.search(output):
            return "weekly_limit"

    # Context limit (rate limit보다 우선)
    for pattern in CONTEXT_LIMIT_PATTERNS:
        if pattern.search(output):
            return "context_limit"

    # Rate limit
    for pattern in RATE_LIMIT_PATTERNS:
        if pattern.search(output):
            return "rate_limit"

    return "unknown"


async def handle_paused_worker(
    worker: "Worker",
    config: "RecoveryConfig",
) -> bool:
    """일시 중단된 Worker 자동 재개.

    Args:
        worker: Worker 객체 (상태 및 pane_id 포함)
        config: 재개 설정

    Returns:
        재개 성공 여부
    """
    from orchay.models.worker import WorkerState

    # 현재 pane 출력 조회
    output = await wezterm_get_text(worker.pane_id, lines=50)

    # paused 유형 판별
    paused_type = detect_paused_type(output)

    # 유형별 대기 시간 결정
    wait_seconds: int
    if paused_type == "weekly_limit":
        reset_time = await extract_reset_time(output)
        # 파싱 실패 시 기본값 (1시간)
        wait_seconds = calculate_wait_seconds(reset_time) if reset_time else 3600
    elif paused_type == "context_limit":
        wait_seconds = config.context_limit_wait
    else:
        # rate_limit 또는 unknown
        wait_seconds = config.default_wait_time

    # 대기
    await asyncio.sleep(wait_seconds)

    # "계속" 텍스트 전송
    await wezterm_send_text(worker.pane_id, f"{config.resume_text}\n")

    # 잠시 대기 후 상태 재확인
    await asyncio.sleep(3)

    # 상태 재확인
    new_state, _ = await detect_worker_state(worker.pane_id)

    if new_state == "busy":
        # 재개 성공
        worker.state = WorkerState.BUSY
        worker.retry_count = 0
        return True
    else:
        # 재개 실패
        worker.retry_count += 1

        if worker.retry_count >= config.max_retries:
            # 최대 재시도 초과 → error 상태
            worker.state = WorkerState.ERROR
        # else: 상태 유지 (paused)

        return False
