# 테스트 명세서 (026-test-specification.md)

**Template Version:** 1.0.0 — **Last Updated:** 2025-12-28

> **목적**: 단위 테스트, TUI 테스트, 매뉴얼 테스트 시나리오 및 테스트 데이터 정의
>
> **참조**: 이 문서는 `010-design.md`와 `025-traceability-matrix.md`와 함께 사용됩니다.
>
> **활용 단계**: `/wf:build`, `/wf:test` 단계에서 테스트 코드 생성 기준으로 사용

---

## 0. 문서 메타데이터

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-03 |
| Task명 | TUI 인터랙티브 기능 |
| 설계 참조 | `010-design.md` |
| 추적성 매트릭스 참조 | `025-traceability-matrix.md` |
| 작성일 | 2025-12-28 |
| 작성자 | Claude |

---

## 1. 테스트 전략 개요

### 1.1 테스트 범위

| 테스트 유형 | 범위 | 목표 커버리지 |
|------------|------|--------------|
| 단위 테스트 | CommandHandler, 명령어 파싱/실행 | 80% 이상 |
| TUI 테스트 | Textual App, 위젯, 키 바인딩 | 핵심 위젯 |
| 매뉴얼 테스트 | 인터랙티브 UI, 키보드 반응 | 전체 기능 |

### 1.2 테스트 환경

| 항목 | 내용 |
|------|------|
| 테스트 프레임워크 (단위) | pytest |
| 테스트 프레임워크 (TUI) | pytest-textual-snapshot |
| 비동기 지원 | pytest-asyncio |
| 터미널 시뮬레이션 | Textual testing |

---

## 2. 단위 테스트 시나리오

### 2.1 테스트 케이스 목록

#### CommandHandler 테스트

| 테스트 ID | 대상 | 시나리오 | 예상 결과 | 요구사항 |
|-----------|------|----------|----------|----------|
| UT-001 | CommandHandler.parse_command | 정상 명령어 파싱 | (명령어, 인자) 반환 | FR-001 |
| UT-002 | CommandHandler.parse_command | 인자 없는 명령어 | (명령어, None) 반환 | FR-001 |
| UT-003 | CommandHandler.parse_command | 잘못된 명령어 | ValueError 발생 | FR-001 |
| UT-004 | CommandHandler.process_command | 명령어 실행 | 성공 결과 반환 | FR-001 |

#### Function Key 처리 테스트

| 테스트 ID | 대상 | 시나리오 | 예상 결과 | 요구사항 |
|-----------|------|----------|----------|----------|
| UT-005 | FUNCTION_KEYS 매핑 | F1 키 | 'help' 명령 매핑 | FR-002 |
| UT-006 | FUNCTION_KEYS 매핑 | F7 키 | 'mode' 명령 매핑 | FR-002 |
| UT-007 | FUNCTION_KEYS 매핑 | F10 키 | 'stop' 명령 매핑 | FR-002 |
| UT-008 | FUNCTION_KEYS 매핑 | Shift+F1 키 | 'worker 1' 명령 매핑 | FR-002 |

#### 인터랙티브 UI 테스트

| 테스트 ID | 대상 | 시나리오 | 예상 결과 | 요구사항 |
|-----------|------|----------|----------|----------|
| UT-009 | QueueWidget | Task 목록 표시 | 모든 Task 표시됨 | FR-003 |
| UT-010 | QueueWidget | ↑ 키 | 이전 항목 선택 | FR-003 |
| UT-011 | QueueWidget | ↓ 키 | 다음 항목 선택 | FR-003 |
| UT-012 | ActionMenu | 액션 옵션 표시 | 5개 옵션 표시 | FR-003 |

#### 큐 조정 테스트

| 테스트 ID | 대상 | 시나리오 | 예상 결과 | 요구사항 |
|-----------|------|----------|----------|----------|
| UT-013 | CommandHandler.up_task | Task 위로 이동 | 순서 변경됨 | FR-004 |
| UT-014 | CommandHandler.top_task | Task 최우선 | 1번으로 이동 | FR-004 |
| UT-015 | CommandHandler.skip_task | Task 스킵 | blocked 처리됨 | FR-004 |
| UT-016 | CommandHandler.retry_task | Task 재시도 | 큐에 복귀 | FR-004 |

#### 모드 전환 테스트

| 테스트 ID | 대상 | 시나리오 | 예상 결과 | 요구사항 |
|-----------|------|----------|----------|----------|
| UT-017 | CommandHandler.change_mode | 모드 순환 | design→quick→develop→force→design | FR-005 |

#### 비즈니스 규칙 테스트

| 테스트 ID | 대상 | 시나리오 | 예상 결과 | 요구사항 |
|-----------|------|----------|----------|----------|
| UT-018 | skip_task | 실행 중 Task 스킵 | 에러 반환 | BR-001 |
| UT-019 | change_mode | 진행 중 Worker | 상태 유지 | BR-002 |
| UT-020 | toggle_pause | pause 상태 | 진행 중 작업 계속 | BR-003 |

### 2.2 테스트 케이스 상세

#### UT-001: CommandHandler.parse_command 정상 파싱

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_command.py` |
| **테스트 블록** | `describe('CommandHandler') → describe('parse_command') → it('should parse command with args')` |
| **입력 데이터** | `"top TSK-01-02"` |
| **검증 포인트** | 반환값이 `("top", "TSK-01-02")` 인지 확인 |
| **커버리지 대상** | `parse_command()` 정상 분기 |
| **관련 요구사항** | FR-001 |

```python
def test_parse_command_with_args():
    handler = CommandHandler()
    cmd, arg = handler.parse_command("top TSK-01-02")
    assert cmd == "top"
    assert arg == "TSK-01-02"
```

#### UT-003: CommandHandler.parse_command 잘못된 명령어

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_command.py` |
| **테스트 블록** | `describe('CommandHandler') → describe('parse_command') → it('should raise ValueError for unknown command')` |
| **입력 데이터** | `"unknown_cmd"` |
| **검증 포인트** | `ValueError` 발생, 메시지에 "알 수 없는 명령어" 포함 |
| **커버리지 대상** | `parse_command()` 에러 분기 |
| **관련 요구사항** | FR-001 |

```python
def test_parse_command_unknown():
    handler = CommandHandler()
    with pytest.raises(ValueError, match="알 수 없는 명령어"):
        handler.parse_command("unknown_cmd")
```

#### UT-005: Function Key 매핑 테스트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_command.py` |
| **테스트 블록** | `describe('FUNCTION_KEYS') → it('should map F1 to help')` |
| **입력 데이터** | ESC 시퀀스 `'\x1bOP'` |
| **검증 포인트** | 매핑 결과가 `'help'` |
| **관련 요구사항** | FR-002 |

```python
def test_function_key_f1():
    from orchay.command import FUNCTION_KEYS
    assert FUNCTION_KEYS.get('\x1bOP') == 'help'
```

#### UT-014: top_task 테스트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_command.py` |
| **테스트 블록** | `describe('CommandHandler') → describe('top_task') → it('should move task to first position')` |
| **입력 데이터** | 큐: `[TSK-01, TSK-02, TSK-03]`, target: `TSK-03` |
| **검증 포인트** | 큐가 `[TSK-03, TSK-01, TSK-02]`로 변경 |
| **관련 요구사항** | FR-004 |

```python
async def test_top_task():
    orchestrator = MockOrchestrator(tasks=["TSK-01", "TSK-02", "TSK-03"])
    handler = CommandHandler(orchestrator)
    result = await handler.top_task("TSK-03")
    assert result.success
    assert orchestrator.queue[0].id == "TSK-03"
```

#### UT-018: 실행 중 Task skip 불가

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_command.py` |
| **테스트 블록** | `describe('CommandHandler') → describe('skip_task') → it('should reject running task skip')` |
| **입력 데이터** | 실행 중 Task: `TSK-01-01` |
| **검증 포인트** | 에러 결과 반환, 메시지: "실행 중인 Task는 스킵할 수 없습니다" |
| **관련 요구사항** | BR-001 |

```python
async def test_skip_running_task():
    orchestrator = MockOrchestrator(running_tasks={"TSK-01-01"})
    handler = CommandHandler(orchestrator)
    result = await handler.skip_task("TSK-01-01")
    assert not result.success
    assert "실행 중인 Task" in result.message
```

---

## 3. TUI 테스트 시나리오

### 3.1 테스트 케이스 목록

| 테스트 ID | 시나리오 | 사전조건 | 실행 단계 | 예상 결과 | 요구사항 |
|-----------|----------|----------|----------|----------|----------|
| E2E-001 | 명령어 입력 | TUI 실행 중 | 1. Input에 "status" 입력 2. Enter | 상태 정보 표시 | FR-001 |
| E2E-002 | F1 키 도움말 | TUI 실행 중 | 1. F1 키 입력 | 도움말 패널 표시 | FR-002 |
| E2E-003 | 큐 인터랙티브 | TUI 실행 중 | 1. F3 입력 2. ↓ 이동 3. Enter | 액션 메뉴 표시 | FR-003 |
| E2E-004 | Task top | 큐에 3개 Task | 1. F3 2. 마지막 Task 선택 3. T 키 | 1번으로 이동 | FR-004 |
| E2E-005 | 모드 전환 | design 모드 | 1. F7 입력 | quick 모드로 전환 | FR-005 |
| E2E-006 | 실행 중 skip 거부 | Worker busy | 1. "skip TSK-XX" 입력 | 에러 메시지 | BR-001 |
| E2E-007 | 모드 전환 후 분배 | Worker 진행 중 | 1. F7로 모드 변경 | 진행 중 작업 유지 | BR-002 |
| E2E-008 | pause 후 작업 유지 | Worker busy | 1. F9 pause | 진행 중 작업 계속 | BR-003 |

### 3.2 테스트 케이스 상세

#### E2E-001: 명령어 입력 테스트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_tui.py` |
| **테스트명** | `test_command_input_status` |
| **사전조건** | OrchayApp 실행 |
| **실행 단계** | |
| 1 | `await pilot.press("tab")` (Input 포커스) |
| 2 | `await pilot.type("status")` |
| 3 | `await pilot.press("enter")` |
| **검증 포인트** | Footer에 상태 정보 표시됨 |
| **관련 요구사항** | FR-001 |

```python
async def test_command_input_status():
    async with OrchayApp().run_test() as pilot:
        await pilot.press("tab")
        await pilot.type("status")
        await pilot.press("enter")
        assert "Workers" in pilot.app.footer.text
```

#### E2E-002: F1 도움말 테스트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_tui.py` |
| **테스트명** | `test_f1_help` |
| **사전조건** | OrchayApp 실행 |
| **실행 단계** | `await pilot.press("f1")` |
| **검증 포인트** | HelpScreen 또는 HelpModal 표시됨 |
| **관련 요구사항** | FR-002 |

```python
async def test_f1_help():
    async with OrchayApp().run_test() as pilot:
        await pilot.press("f1")
        assert pilot.app.query_one(HelpModal).display
```

#### E2E-003: 큐 인터랙티브 UI

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_tui.py` |
| **테스트명** | `test_queue_interactive` |
| **사전조건** | 큐에 Task 3개 |
| **실행 단계** | |
| 1 | `await pilot.press("f3")` |
| 2 | `await pilot.press("down")` |
| 3 | `await pilot.press("enter")` |
| **검증 포인트** | ActionMenu 표시, 5개 옵션 |
| **관련 요구사항** | FR-003 |

#### E2E-004: Task top 기능

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_tui.py` |
| **테스트명** | `test_task_top` |
| **사전조건** | 큐: `[TSK-01, TSK-02, TSK-03]` |
| **실행 단계** | |
| 1 | `await pilot.press("f3")` |
| 2 | `await pilot.press("down", "down")` (TSK-03 선택) |
| 3 | `await pilot.press("t")` |
| **검증 포인트** | 큐 첫 번째가 TSK-03 |
| **관련 요구사항** | FR-004 |

---

## 4. UI 테스트케이스 (매뉴얼)

### 4.1 테스트 케이스 목록

| TC-ID | 테스트 항목 | 사전조건 | 테스트 단계 | 예상 결과 | 우선순위 | 요구사항 |
|-------|-----------|---------|-----------|----------|---------|----------|
| TC-001 | 명령어 입력 | TUI 실행 | 1. Input에 명령 입력 2. Enter | 결과 표시 | High | FR-001 |
| TC-002 | Function Key | TUI 실행 | 1. F1~F10 각각 입력 | 해당 기능 실행 | High | FR-002 |
| TC-003 | 큐 네비게이션 | 큐에 Task 존재 | 1. F3 2. ↑/↓ 이동 | 선택 이동 | High | FR-003 |
| TC-004 | 큐 조정 | 큐에 Task 3개 | 1. Task 선택 2. U/T/S 키 | 순서/상태 변경 | High | FR-004 |
| TC-005 | 모드 전환 | TUI 실행 | 1. F7 반복 입력 | 모드 순환 | Medium | FR-005 |

### 4.2 매뉴얼 테스트 상세

#### TC-001: 명령어 입력

**테스트 목적**: 사용자가 텍스트 명령어를 입력하여 스케줄러를 제어할 수 있는지 확인

**테스트 단계**:
1. orchay 실행
2. Tab 키로 Input 위젯 포커스
3. "pause" 입력 후 Enter
4. Footer에 "일시 중지됨" 메시지 확인
5. "resume" 입력 후 Enter
6. Footer에 "재개됨" 메시지 확인

**예상 결과**:
- 명령어 입력 후 즉시 실행됨
- 결과 메시지가 Footer에 표시됨
- Input이 클리어됨

**검증 기준**:
- [ ] pause 명령 정상 동작
- [ ] resume 명령 정상 동작
- [ ] 에러 명령 시 에러 메시지 표시

#### TC-002: Function Key 바인딩

**테스트 목적**: 모든 Function Key가 정상 동작하는지 확인

**테스트 단계**:

| 키 | 예상 동작 | 확인 |
|----|----------|------|
| F1 | 도움말 표시 | [ ] |
| F2 | 상태 정보 표시 | [ ] |
| F3 | 큐 인터랙티브 UI | [ ] |
| F4 | Worker 상태 표시 | [ ] |
| F5 | wbs.md 재로드 | [ ] |
| F6 | 히스토리 표시 | [ ] |
| F7 | 모드 순환 | [ ] |
| F9 | pause/resume 토글 | [ ] |
| F10 | 종료 확인 | [ ] |
| Shift+F1 | Worker 1 출력 | [ ] |
| Shift+F2 | Worker 2 출력 | [ ] |
| Shift+F3 | Worker 3 출력 | [ ] |

#### TC-003: 큐 네비게이션

**테스트 목적**: 인터랙티브 큐 UI에서 Task를 선택하고 이동할 수 있는지 확인

**테스트 단계**:
1. F3으로 큐 UI 열기
2. ↓ 키로 다음 Task 이동 (선택 표시 확인)
3. ↑ 키로 이전 Task 이동 (선택 표시 확인)
4. 첫 번째 Task에서 ↑ → 무반응 확인
5. 마지막 Task에서 ↓ → 무반응 확인
6. ESC로 닫기

**검증 기준**:
- [ ] 선택 표시(▶)가 정확히 이동
- [ ] 경계에서 추가 이동 불가
- [ ] ESC로 정상 종료

---

## 5. 테스트 데이터 (Fixture)

### 5.1 단위 테스트용 Mock 데이터

| 데이터 ID | 용도 | 값 |
|-----------|------|-----|
| MOCK-TASK-01 | 일반 Task | `Task(id="TSK-01-01", status=TaskStatus.TODO, priority=Priority.HIGH)` |
| MOCK-TASK-02 | 진행 중 Task | `Task(id="TSK-01-02", status=TaskStatus.IMPLEMENT, priority=Priority.MEDIUM)` |
| MOCK-WORKER-IDLE | 유휴 Worker | `Worker(id=1, pane_id=1, state=WorkerState.IDLE)` |
| MOCK-WORKER-BUSY | 작업 중 Worker | `Worker(id=2, pane_id=2, state=WorkerState.BUSY, current_task="TSK-01-02")` |

### 5.2 TUI 테스트용 Mock Orchestrator

```python
class MockOrchestrator:
    def __init__(
        self,
        tasks: list[str] | None = None,
        workers: int = 3,
        running_tasks: set[str] | None = None,
    ):
        self.tasks = [Task(id=t) for t in (tasks or ["TSK-01", "TSK-02", "TSK-03"])]
        self.workers = [Worker(id=i+1, pane_id=i+1) for i in range(workers)]
        self.running_tasks = running_tasks or set()
        self.mode = ExecutionMode.QUICK
        self._paused = False
```

---

## 6. 테스트 커버리지 목표

### 6.1 단위 테스트 커버리지

| 대상 | 목표 | 최소 |
|------|------|------|
| Lines | 80% | 70% |
| Branches | 75% | 65% |
| Functions | 85% | 75% |
| Statements | 80% | 70% |

### 6.2 TUI 테스트 커버리지

| 구분 | 목표 |
|------|------|
| Function Key 바인딩 | 100% |
| 명령어 파싱 | 100% |
| 큐 조정 기능 | 100% |
| 비즈니스 규칙 | 100% |
| 에러 케이스 | 80% |

---

## 관련 문서

- 설계: `010-design.md`
- 추적성 매트릭스: `025-traceability-matrix.md`
- PRD: `.orchay/projects/orchay/prd.md`

---

<!--
author: Claude
Template Version History:
- v1.0.0 (2025-12-28): 신규 생성
  - TSK-02-03 TUI 인터랙티브 기능 테스트 명세서
  - 단위 테스트, TUI 테스트, 매뉴얼 테스트 시나리오 포함
-->
