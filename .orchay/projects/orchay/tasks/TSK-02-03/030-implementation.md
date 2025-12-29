# TSK-02-03 구현 보고서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-03 |
| Task명 | TUI 인터랙티브 기능 |
| 구현일 | 2025-12-28 |
| 상태 | 완료 |

---

## 1. 구현 요약

### 1.1 구현 범위

TSK-02-03에서 정의한 TUI 인터랙티브 기능을 모두 구현했습니다:

- **Function Key 바인딩**: F1~F10, Shift+F1~F3 키 매핑
- **명령어 입력 시스템**: Input 위젯을 통한 명령어 처리
- **인터랙티브 Task 선택 UI**: QueueWidget으로 Task 선택/조작
- **큐 조정 기능**: up, top, skip, retry 명령어
- **모드 전환**: F7 키로 모드 순환

### 1.2 구현된 파일

| 파일 | 역할 | 신규/수정 |
|------|------|----------|
| `orchay/src/orchay/command.py` | CommandHandler, 명령어 처리 | 신규 |
| `orchay/src/orchay/ui/widgets.py` | QueueWidget, HelpModal, ActionMenu | 신규 |
| `orchay/src/orchay/ui/app.py` | OrchayApp 인터랙티브 기능 확장 | 수정 |
| `orchay/src/orchay/ui/styles.tcss` | 모달 위젯 스타일 | 수정 |
| `orchay/src/orchay/ui/__init__.py` | 모듈 export | 수정 |

---

## 2. 구현 상세

### 2.1 CommandHandler (`command.py`)

```python
class CommandHandler:
    """명령어 처리기."""

    async def process_command(input_str: str) -> CommandResult
    async def up_task(task_id: str) -> CommandResult
    async def top_task(task_id: str) -> CommandResult
    async def skip_task(task_id: str) -> CommandResult
    async def retry_task(task_id: str) -> CommandResult
    async def change_mode() -> CommandResult
    async def toggle_pause() -> CommandResult
```

**주요 기능:**
- `parse_command()`: 명령어 파싱 (명령어, 인자 분리)
- `process_command()`: 명령어 실행 및 결과 반환
- 큐 조정: `up_task()`, `top_task()`, `skip_task()`, `retry_task()`
- 모드/일시정지: `change_mode()`, `toggle_pause()`

### 2.2 Function Key 매핑

```python
FUNCTION_KEYS = {
    "f1": "help",
    "f2": "status",
    "f3": "queue",
    "f4": "workers",
    "f5": "reload",
    "f6": "history",
    "f7": "mode",
    "f9": "pause",
    "f10": "stop",
    "shift+f1": "worker 1",
    "shift+f2": "worker 2",
    "shift+f3": "worker 3",
}
```

### 2.3 QueueWidget (`widgets.py`)

```python
class QueueWidget(Static):
    """인터랙티브 큐 목록 위젯."""

    @property
    def selected_task(self) -> Task | None
    def select_prev(self) -> None
    def select_next(self) -> None
```

**기능:**
- Task 목록 표시 (상태별 색상)
- ↑/↓ 키로 Task 선택
- 선택된 Task 강조 표시 (▶ 마커)

### 2.4 OrchayApp 확장

**추가된 키 바인딩:**
```python
BINDINGS = [
    Binding("escape", "close_modal", "Close", show=False),
    Binding("up", "queue_up", "Up", show=False),
    Binding("down", "queue_down", "Down", show=False),
    Binding("u", "queue_move_up", "Move Up", show=False),
    Binding("t", "queue_move_top", "Top", show=False),
    Binding("s", "queue_skip", "Skip", show=False),
    Binding("r", "queue_retry", "Retry", show=False),
]
```

**추가된 액션:**
- `action_show_help()`: 도움말 모달 토글
- `action_show_queue()`: 큐 인터랙티브 UI 토글
- `action_queue_move_up()`: 선택된 Task 위로 이동
- `action_queue_move_top()`: 선택된 Task 최우선 이동
- `action_queue_skip()`: 선택된 Task 스킵
- `action_queue_retry()`: 선택된 Task 재시도

---

## 3. 테스트 결과

### 3.1 단위 테스트 (26개)

```
tests/test_command.py - 26 passed
├── TestParseCommand (4): parse_command_with_args, without_args, unknown, process_command_success
├── TestFunctionKeys (4): f1_help, f7_mode, f10_stop, shift_f1_worker_1
├── TestQueueInteractive (4): get_queue_tasks, prev_task_index, next_task_index, action_options
├── TestQueueAdjustment (4): up_task, top_task, skip_task, retry_task
├── TestModeChange (1): change_mode_cycle
├── TestBusinessRules (3): skip_running_rejected, mode_no_affect, pause_keeps_running
├── TestAdditionalCommands (4): status, queue, workers, help
└── TestCommandResult (2): success_result, error_result
```

### 3.2 TUI 테스트 (12개)

```
tests/test_tui.py - 12 passed
├── test_command_input_status (E2E-001)
├── test_f1_help (E2E-002)
├── test_queue_interactive (E2E-003)
├── test_task_top (E2E-004)
├── test_mode_change (E2E-005)
├── test_skip_running_task_rejected (E2E-006)
├── test_mode_change_keeps_running (E2E-007)
├── test_pause_keeps_running (E2E-008)
├── test_queue_navigation
├── test_f2_status
├── test_f4_workers
└── test_f5_reload
```

### 3.3 테스트 커버리지

```
============================= test session =============================
platform win32 -- Python 3.12.11, pytest-9.0.2
asyncio: mode=Mode.AUTO
collected 38 items

tests/test_command.py ... 26 passed
tests/test_tui.py ....... 12 passed

============================= 38 passed in 3.09s ======================
```

---

## 4. 비즈니스 규칙 구현

### BR-001: 실행 중인 Task는 skip 불가

```python
async def skip_task(self, task_id: str) -> CommandResult:
    if task_id in self.orchestrator.running_tasks:
        return CommandResult.error("실행 중인 Task는 스킵할 수 없습니다")
```

### BR-002: 모드 전환은 진행 중 작업에 영향 없음

```python
async def change_mode(self) -> CommandResult:
    # Worker 상태는 변경하지 않고 모드만 전환
    self.orchestrator.mode = modes[next_idx]
    return CommandResult.ok(f"Mode → {self.orchestrator.mode.value}")
```

### BR-003: pause 시 진행 중 작업 계속

```python
async def toggle_pause(self) -> CommandResult:
    # _paused 플래그만 토글, Worker 상태는 유지
    self.orchestrator._paused = not self.orchestrator._paused
```

---

## 5. 요구사항 매핑

| 요구사항 ID | 설계 섹션 | 구현 위치 | 테스트 |
|-------------|----------|----------|--------|
| FR-001 | 6.1 사용자 액션 | CommandHandler | UT-001~004, E2E-001 |
| FR-002 | 6.3 키보드/접근성 | FUNCTION_KEYS, OrchayApp.BINDINGS | UT-005~008, E2E-002 |
| FR-003 | 5.2 화면별 상세 | QueueWidget | UT-009~012, E2E-003 |
| FR-004 | 3.2 UC-03, UC-04 | up_task, top_task, skip_task, retry_task | UT-013~016, E2E-004 |
| FR-005 | 3.2 UC-05 | change_mode | UT-017, E2E-005 |

---

## 6. 아키텍처

```
orchay/src/orchay/
├── command.py           # CommandHandler (신규)
│   ├── FUNCTION_KEYS    # Function Key → 명령어 매핑
│   ├── COMMANDS         # 지원 명령어 목록
│   ├── CommandResult    # 명령어 실행 결과
│   └── CommandHandler   # 명령어 처리 클래스
│
├── ui/
│   ├── app.py           # OrchayApp (확장)
│   │   ├── _command_handler   # CommandHandler 인스턴스
│   │   ├── _queue_interactive # 인터랙티브 모드 플래그
│   │   ├── on_input_submitted # Input 이벤트 핸들러
│   │   └── action_queue_*     # 큐 조작 액션들
│   │
│   ├── widgets.py       # 커스텀 위젯 (신규)
│   │   ├── QueueWidget  # 인터랙티브 큐 목록
│   │   ├── ActionMenu   # 액션 메뉴
│   │   └── HelpModal    # 도움말 모달
│   │
│   └── styles.tcss      # 스타일시트 (확장)
│       ├── #queue-widget  # 큐 위젯 스타일
│       ├── #help-modal    # 도움말 모달 스타일
│       └── #input-section # 입력 섹션 스타일
```

---

## 7. 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-12-28 | Claude | 최초 구현 |

---

<!--
author: Claude
Template Version: 1.0
-->
