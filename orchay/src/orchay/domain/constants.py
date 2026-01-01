"""중앙 상수 정의 (Phase 1.3).

프로젝트 전체에서 사용되는 매직 넘버를 중앙화합니다.
설정 파일을 통한 커스터마이징이 필요한 경우 Config 모델로 이동할 수 있습니다.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class DispatchTimings:
    """Task 분배 관련 타이밍 상수.

    Attributes:
        CLEAR_WAIT_SECONDS: /clear 명령어 처리 대기 시간
        COMMAND_WAIT_SECONDS: 명령어 입력 대기 시간
        ENTER_WAIT_SECONDS: Enter 키 처리 대기 시간
        GRACE_PERIOD_SECONDS: 분배 후 상태 체크 유예 기간
        MIN_TASK_DURATION_SECONDS: 최소 Task 실행 시간 (너무 빠른 완료 경고)
    """

    CLEAR_WAIT_SECONDS: float = 5.0
    COMMAND_WAIT_SECONDS: float = 1.0
    ENTER_WAIT_SECONDS: float = 1.0
    GRACE_PERIOD_SECONDS: float = 20.0
    MIN_TASK_DURATION_SECONDS: float = 30.0


@dataclass(frozen=True)
class WorkerDetection:
    """Worker 상태 감지 관련 상수.

    Attributes:
        OUTPUT_LINES: 상태 감지를 위해 읽어올 pane 출력 라인 수
        IDLE_DETECTION_DELAY: 시작 후 idle 감지 지연 시간 (초)
        RETRY_WAIT_SECONDS: 재시도 대기 시간 (자동 재개 등)
    """

    OUTPUT_LINES: int = 50
    IDLE_DETECTION_DELAY: float = 3.0
    RETRY_WAIT_SECONDS: float = 3.0


@dataclass(frozen=True)
class UITimings:
    """UI 관련 타이밍 상수.

    Attributes:
        REFRESH_INTERVAL_SECONDS: UI 갱신 주기
        MODAL_DISMISS_SECONDS: 모달 자동 닫기 시간
    """

    REFRESH_INTERVAL_SECONDS: float = 1.0
    MODAL_DISMISS_SECONDS: float = 3.0


# 싱글톤 인스턴스 (전역 접근용)
DISPATCH_TIMINGS = DispatchTimings()
WORKER_DETECTION = WorkerDetection()
UI_TIMINGS = UITimings()


# 하위 호환성을 위한 개별 상수 (deprecated, 직접 dataclass 사용 권장)
# 추후 제거 예정
CLEAR_WAIT_SECONDS = DISPATCH_TIMINGS.CLEAR_WAIT_SECONDS
COMMAND_WAIT_SECONDS = DISPATCH_TIMINGS.COMMAND_WAIT_SECONDS
ENTER_WAIT_SECONDS = DISPATCH_TIMINGS.ENTER_WAIT_SECONDS
OUTPUT_LINES = WORKER_DETECTION.OUTPUT_LINES
IDLE_DETECTION_DELAY = WORKER_DETECTION.IDLE_DETECTION_DELAY
