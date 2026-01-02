"""orchay TUI 위젯 모듈.

도움말 모달 등 커스텀 위젯들.
"""

from __future__ import annotations

from collections.abc import Generator
from typing import TYPE_CHECKING

from textual.containers import VerticalScroll
from textual.widgets import SelectionList, Static
from textual.widgets.selection_list import Selection

if TYPE_CHECKING:
    from orchay.models import Task, TaskStatus


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
  Up/Down  Task 선택         Enter  상세 보기
  Space    스킵/복구 토글    Y      승인/취소 ([dd]↔[ap])
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
  test     [im]+상태 Task 테스트. Space:선택  A:전체  T:실행

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


class TaskDetailModal(VerticalScroll):
    """Task 상세 정보 모달 (WBS raw content 표시)."""

    def __init__(self) -> None:
        super().__init__(id="task-detail-modal")
        self._current_task: Task | None = None  # _task는 Textual 내부에서 사용하므로 이름 변경
        self._content_widget: Static | None = None

    def set_task(self, task: Task) -> None:
        """표시할 Task 설정."""
        self._current_task = task
        self._update_content()

    def compose(self) -> Generator[Static, None, None]:
        """내부 Static 위젯 생성."""
        self._content_widget = Static("", id="task-detail-content", markup=False)
        yield self._content_widget

    def _update_content(self) -> None:
        """Task 상세 정보 업데이트."""
        if self._content_widget is None or self._current_task is None:
            return

        task = self._current_task
        lines: list[str] = []

        # 헤더
        lines.append(f"[{task.id}] {task.title}")
        lines.append("─" * 60)

        # raw_content가 있으면 사용 (MD 파서 호환)
        if task.raw_content:
            lines.append(task.raw_content)
        else:
            # YAML 필드들을 포맷하여 표시
            # 기본 정보
            lines.append(f"Status:   {task.status.value}")
            lines.append(f"Category: {task.category.value}")
            lines.append(f"Priority: {task.priority.value}")
            if task.domain:
                lines.append(f"Domain:   {task.domain}")
            if task.assignee and task.assignee != "-":
                lines.append(f"Assignee: {task.assignee}")
            if task.schedule:
                lines.append(f"Schedule: {task.schedule}")

            # 의존성
            if task.depends:
                lines.append("")
                lines.append("Dependencies:")
                for dep in task.depends:
                    lines.append(f"  - {dep}")

            # 태그
            if task.tags:
                lines.append("")
                lines.append(f"Tags: {', '.join(task.tags)}")

            # PRD 참조
            if task.prd_ref:
                lines.append("")
                lines.append(f"PRD Ref: {task.prd_ref}")

            # 요구사항
            if task.requirements:
                lines.append("")
                lines.append("Requirements:")
                for req in task.requirements:
                    lines.append(f"  • {req}")

            # 인수 조건
            if task.acceptance:
                lines.append("")
                lines.append("Acceptance Criteria:")
                for acc in task.acceptance:
                    lines.append(f"  ✓ {acc}")

            # 기술 스펙
            if task.tech_spec:
                lines.append("")
                lines.append("Tech Spec:")
                for spec in task.tech_spec:
                    lines.append(f"  - {spec}")

            # API 스펙
            if task.api_spec:
                lines.append("")
                lines.append("API Spec:")
                for api in task.api_spec:
                    lines.append(f"  - {api}")

            # UI 스펙
            if task.ui_spec:
                lines.append("")
                lines.append("UI Spec:")
                for ui in task.ui_spec:
                    lines.append(f"  - {ui}")

            # 실행 정보
            if task.execution:
                lines.append("")
                lines.append("Execution:")
                lines.append(f"  Command:   {task.execution.command}")
                if task.execution.description:
                    lines.append(f"  Desc:      {task.execution.description}")
                lines.append(f"  StartedAt: {task.execution.startedAt}")
                if task.execution.worker is not None:
                    lines.append(f"  Worker:    {task.execution.worker}")

            # Blocked 정보
            if task.blocked_by:
                lines.append("")
                lines.append(f"⚠ Blocked by: {task.blocked_by}")

        self._content_widget.update("\n".join(lines))


class TestSelectionPanel(VerticalScroll):
    """테스트 대상 Task 선택 패널.

    test 모드에서 구현 완료된 태스크([im], [vf], [xx])를 선택할 수 있는 UI.
    SelectionList를 사용하여 다중 선택을 지원합니다.
    """

    # 테스트 대상 상태 코드
    TESTABLE_STATUSES = {"[im]", "[vf]", "[xx]"}

    def __init__(self) -> None:
        super().__init__(id="test-selection-panel")
        self._selection_list: SelectionList[str] | None = None
        self._tasks: list[Task] = []

    def compose(self) -> Generator[SelectionList[str], None, None]:
        """SelectionList 위젯 생성."""
        self._selection_list = SelectionList[str](id="test-task-list")
        yield self._selection_list

    def set_tasks(self, tasks: list[Task]) -> None:
        """구현 완료 태스크로 목록 업데이트.

        Args:
            tasks: 전체 Task 목록 (내부에서 상태 필터링)
        """
        if self._selection_list is None:
            return

        # [im], [vf], [xx] 상태만 필터
        self._tasks = [
            t for t in tasks
            if t.status.value in self.TESTABLE_STATUSES
        ]

        # 기존 목록 초기화 후 재구성
        self._selection_list.clear_options()

        for task in self._tasks:
            # 상태, ID, 제목 표시
            status_display = task.status.value
            title = task.title[:35] if len(task.title) > 35 else task.title
            label = f"{status_display} {task.id}: {title}"
            self._selection_list.add_option(Selection(label, task.id, False))

    def get_selected_task_ids(self) -> list[str]:
        """선택된 Task ID 목록 반환.

        Returns:
            선택된 Task ID 리스트
        """
        if self._selection_list is None:
            return []
        return list(self._selection_list.selected)

    def select_all(self) -> None:
        """모든 항목 선택."""
        if self._selection_list is None:
            return
        self._selection_list.select_all()

    def deselect_all(self) -> None:
        """모든 항목 선택 해제."""
        if self._selection_list is None:
            return
        self._selection_list.deselect_all()

    def get_task_count(self) -> int:
        """테스트 가능한 Task 수 반환."""
        return len(self._tasks)

    def get_selected_count(self) -> int:
        """선택된 Task 수 반환."""
        if self._selection_list is None:
            return 0
        return len(self._selection_list.selected)

    def get_highlighted_task(self) -> Task | None:
        """현재 하이라이트된 Task 반환.

        Returns:
            하이라이트된 Task 또는 None
        """
        if self._selection_list is None:
            return None
        highlighted_idx = self._selection_list.highlighted
        if highlighted_idx is not None and 0 <= highlighted_idx < len(self._tasks):
            return self._tasks[highlighted_idx]
        return None
