"""orchay TUI 위젯 모듈 (TSK-02-03).

인터랙티브 기능을 위한 커스텀 위젯들.
"""

from __future__ import annotations

from collections.abc import Generator
from typing import TYPE_CHECKING, ClassVar

from rich.text import Text
from textual.containers import VerticalScroll
from textual.message import Message
from textual.widgets import OptionList, Static
from textual.widgets.option_list import Option

if TYPE_CHECKING:
    from orchay.models import Task


class TaskSelected(Message):
    """Task 선택 메시지."""

    def __init__(self, task: Task) -> None:
        self.task = task
        super().__init__()


class ActionSelected(Message):
    """액션 선택 메시지."""

    def __init__(self, action: str, task: Task) -> None:
        self.action = action
        self.task = task
        super().__init__()


class QueueWidget(Static):
    """인터랙티브 큐 목록 위젯.

    Task를 선택하고 액션을 실행할 수 있습니다.
    """

    # 상태별 색상
    STATUS_COLORS: ClassVar[dict[str, str]] = {
        "[ ]": "#6b7280",
        "[bd]": "#3b82f6",
        "[dd]": "#8b5cf6",
        "[an]": "#f59e0b",
        "[ds]": "#3b82f6",
        "[ap]": "#10b981",
        "[im]": "#f59e0b",
        "[fx]": "#ef4444",
        "[vf]": "#22c55e",
        "[xx]": "#10b981",
    }

    def __init__(self, tasks: list[Task] | None = None) -> None:
        super().__init__()
        self._tasks = tasks or []
        self._selected_index = 0
        self.id = "queue-widget"

    @property
    def tasks(self) -> list[Task]:
        """Task 목록."""
        return self._tasks

    @tasks.setter
    def tasks(self, value: list[Task]) -> None:
        self._tasks = value
        self._selected_index = min(self._selected_index, max(0, len(value) - 1))
        self.refresh()

    @property
    def selected_task(self) -> Task | None:
        """현재 선택된 Task."""
        if 0 <= self._selected_index < len(self._tasks):
            return self._tasks[self._selected_index]
        return None

    def select_prev(self) -> None:
        """이전 Task 선택."""
        if self._selected_index > 0:
            self._selected_index -= 1
            self.refresh()

    def select_next(self) -> None:
        """다음 Task 선택."""
        if self._selected_index < len(self._tasks) - 1:
            self._selected_index += 1
            self.refresh()

    def render(self) -> Text:
        """위젯 렌더링."""
        if not self._tasks:
            return Text("  대기 중인 Task가 없습니다", style="dim")

        lines: list[Text] = []
        lines.append(Text(f"  📋 Task Queue ({len(self._tasks)} items)\n", style="bold"))

        for i, task in enumerate(self._tasks):
            is_selected = i == self._selected_index
            prefix = "  ▶ " if is_selected else "    "
            status_color = self.STATUS_COLORS.get(task.status.value, "#6b7280")

            line = Text()
            line.append(prefix)
            line.append(f"{i + 1}. ", style="dim")
            line.append(f"{task.id:12}", style="cyan bold" if is_selected else "cyan")
            line.append(f"  {task.status.value:6}", style=status_color)
            line.append(f"  {task.category.value:14}", style="white")
            line.append(f"  {task.title[:25]}", style="white")

            if is_selected:
                line.stylize("bold")

            lines.append(line)

        # 도움말
        help_text = "\n  ↑/↓: 이동  Enter: 액션  U: 위로  T: 최우선  S: 스킵  ESC: 닫기"
        lines.append(Text(help_text, "dim"))

        result = Text()
        for line in lines:
            result.append_text(line)
            result.append("\n")

        return result


class ActionMenu(OptionList):
    """액션 메뉴 위젯.

    선택된 Task에 대한 액션을 선택합니다.
    """

    def __init__(self, task: Task | None = None) -> None:
        super().__init__()
        self._task = task
        self.id = "action-menu"

    @property
    def task(self) -> Task | None:
        """대상 Task."""
        return self._task

    @task.setter
    def task(self, value: Task | None) -> None:
        self._task = value
        self._populate_options()

    def _populate_options(self) -> None:
        """옵션 목록 채우기."""
        self.clear_options()

        if self._task is None:
            return

        options = [
            ("up", "위로 이동 (U)", "큐에서 한 칸 위로"),
            ("top", "최우선 (T)", "큐의 맨 앞으로"),
            ("skip", "스킵 (S)", "이 Task 건너뛰기"),
            ("retry", "재시도 (R)", "스킵된 Task 복구"),
            ("detail", "상세 보기", "Task 상세 정보"),
        ]

        for action_id, label, description in options:
            self.add_option(Option(f"{label} - {description}", id=action_id))

    def on_mount(self) -> None:
        """마운트 시 옵션 채우기."""
        self._populate_options()


class HelpModal(VerticalScroll):
    """도움말 모달 위젯 (스크롤 가능)."""

    HELP_TEXT = """\
+---------------------------------------------------------------------+
|                          orchay Help                                |
+---------------------------------------------------------------------+

-- Function Keys -----------------------------------------------------
  F12 도움말       F5  WBS 재로드      F9   일시정지/재개
  F2  상태 정보    F6  히스토리        F10  종료
  F3  큐 UI        F7  모드 전환       Q    종료
  F4  Worker 상태  P   Worker Pause    R    Worker Reset

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

-- Queue Commands (명령어 입력창) ------------------------------------
  help            도움말 표시
  status          현재 상태 요약
  mode [MODE]     모드 변경 (design/quick/develop/force)
  up <TASK-ID>    해당 Task 우선순위 올림
  top <TASK-ID>   해당 Task 최우선 지정
  skip <TASK-ID>  해당 Task 스킵 (실행 제외)
  retry <TASK-ID> 스킵된 Task 복구
  pause / resume  스케줄러 일시정지/재개
  reload          WBS 파일 다시 로드

-- Queue Interactive (F3) --------------------------------------------
  Up/Down  Task 선택    U  위로 이동      S  스킵
  Enter    액션 메뉴    T  최우선 지정    R  스킵 복구
  ESC      닫기

  [Up/Down 스크롤]  [ESC 닫기]
"""

    def __init__(self) -> None:
        super().__init__(id="help-modal")

    def compose(self) -> Generator[Static, None, None]:
        """내부 Static 위젯 생성."""
        # markup=False로 [bd], [dd] 등이 마크업 태그로 해석되는 것 방지
        yield Static(self.HELP_TEXT, markup=False)
