"""orchay TUI 위젯 모듈.

도움말 모달 등 커스텀 위젯들.
"""

from __future__ import annotations

from collections.abc import Generator

from textual.containers import VerticalScroll
from textual.widgets import Static


class HelpModal(VerticalScroll):
    """도움말 모달 위젯 (스크롤 가능)."""

    HELP_TEXT = """\
+---------------------------------------------------------------------+
|                          orchay Help                                |
+---------------------------------------------------------------------+

-- Function Keys -----------------------------------------------------
  F12 도움말       F5  WBS 재로드      F9   일시정지/재개
  F2  상태 정보    F6  Logs 확장       F10  종료
  F3  Queue 확장   F7  모드 전환       Q    종료

-- Schedule Queue Keys -----------------------------------------------
  Up/Down  Task 선택    U  위로 이동      S  스킵
  Enter    Task 정보    T  최우선 지정    Y  스킵 복구
  ESC      전체화면 해제

-- Worker Keys -------------------------------------------------------
  Up/Down  Worker 선택    P   Worker Pause
  1~5      Worker 직접선택  R   Worker Reset

-- Execution Modes (F7로 전환) ---------------------------------------
  design   [ ]>[dd] 설계 문서 생성만. start만 실행
  quick    [dd]>[xx] 빠른 구현. start>approve>build>done
  develop  [dd]>[xx] 전체 품질검증.
           start>review>apply>approve>build>audit>patch>test>done
  force    의존성 무시. quick과 동일 단계

-- Task Status Codes -------------------------------------------------
  [ ]   TODO          대기 중, 설계 시작 전
  [bd]  Basic Design  기본 설계 진행 중
  [dd]  Detail Design 상세 설계 완료, 구현 대기
  [an]  Analysis      분석 진행 중
  [ds]  Design        설계 진행 중
  [ap]  Approved      설계 승인 완료
  [im]  Implement     구현 중 (의존성 조건 충족)
  [fx]  Fix           수정/패치 적용 중
  [vf]  Verify        검증/테스트 중
  [xx]  Done          완료

-- Worker States -----------------------------------------------------
  * idle     준비 완료, Task 할당 대기
  o busy     Task 실행 중
  # paused   Rate limit 등으로 일시정지
  x error    오류 발생
  ! blocked  입력 대기 중 (y/n 등)
  - dead     Pane을 찾을 수 없음
  v done     Task 완료

  [Up/Down 스크롤]  [ESC 닫기]
"""

    def __init__(self) -> None:
        super().__init__(id="help-modal")

    def compose(self) -> Generator[Static, None, None]:
        """내부 Static 위젯 생성."""
        # markup=False로 [bd], [dd] 등이 마크업 태그로 해석되는 것 방지
        yield Static(self.HELP_TEXT, markup=False)
