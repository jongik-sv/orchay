"""Worker 상태 감지 모듈.

Worker pane의 출력을 분석하여 상태를 감지합니다.
"""

import re
import time
from dataclasses import dataclass
from typing import Literal

from orchay.utils.wezterm import pane_exists, wezterm_get_text

# 모듈 시작 시간 (idle 감지 지연용)
_startup_time: float = time.time()
_IDLE_DETECTION_DELAY: float = 3.0  # 시작 후 3초간 idle 감지 비활성화

# ORCHAY_DONE 패턴: ORCHAY_DONE:{task-id}:{action}:{status}[:{message}]
DONE_PATTERN = re.compile(r"ORCHAY_DONE:([^:]+):(\w+):(success|error)(?::(.+))?")

# Fallback 완료 패턴: "Task [project/]TSK-XX-XX 완료"
# 예: "Task TSK-01-01 완료" 또는 "Task orchay/TSK-01-01 완료"
DONE_FALLBACK_PATTERN = re.compile(r"Task\s+((?:[\w-]+/)?TSK-[\w-]+)\s+완료")

# 상태 감지 패턴들
PAUSE_PATTERNS = [
    re.compile(r"rate.*limit.*exceeded", re.IGNORECASE),
    re.compile(r"rate.*limit.*reached", re.IGNORECASE),
    re.compile(r"hit.*rate.*limit", re.IGNORECASE),
    re.compile(r"please.*wait", re.IGNORECASE),
    re.compile(r"try.*again.*later", re.IGNORECASE),
    re.compile(r"weekly.*limit.*reached", re.IGNORECASE),
    re.compile(r"resets.*at", re.IGNORECASE),
    re.compile(r"context.*limit.*exceeded", re.IGNORECASE),
    re.compile(r"conversation.*too.*long", re.IGNORECASE),
    re.compile(r"overloaded", re.IGNORECASE),
    re.compile(r"at.*capacity", re.IGNORECASE),
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


async def detect_worker_state(pane_id: int) -> tuple[WorkerState, DoneInfo | None]:
    """Worker 상태를 감지합니다.

    pane 출력을 분석하여 상태를 판단합니다.

    Args:
        pane_id: WezTerm pane ID

    Returns:
        (상태, DoneInfo 또는 None) 튜플
    """
    # 0. pane 존재 확인
    if not await pane_exists(pane_id):
        return "dead", None

    # 출력 텍스트 조회 (최근 50줄)
    output = await wezterm_get_text(pane_id, lines=50)

    # 빈 출력이면 busy로 간주
    if not output.strip():
        return "busy", None

    # 1. ORCHAY_DONE 체크 (최우선 - 완료 신호는 busy보다 우선)
    done_info = parse_done_signal(output)
    if done_info:
        return "done", done_info

    # 2. 일시 중단 패턴 (rate limit 등은 실제 제약이므로 우선)
    for pattern in PAUSE_PATTERNS:
        if pattern.search(output):
            return "paused", None

    # 3. 프롬프트 패턴 체크
    # 마지막 5줄에 프롬프트가 있으면 idle로 판정
    elapsed = time.time() - _startup_time
    if elapsed >= _IDLE_DETECTION_DELAY:
        last_lines = output.strip().split("\n")[-5:]
        last_text = "\n".join(last_lines)
        for pattern in PROMPT_PATTERNS:
            if pattern.search(last_text):
                return "idle", None

    # 4. 작업 중 패턴 체크 (명시적 busy 상태)
    # Claude Code가 작업 중일 때 나타나는 패턴이 있으면 busy
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

    # 7. 기본값: 작업 중
    return "busy", None
