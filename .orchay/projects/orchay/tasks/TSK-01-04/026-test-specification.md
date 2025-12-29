# 테스트 명세서 (026-test-specification.md)

**Template Version:** 1.0.0 — **Last Updated:** 2025-12-28

> **목적**: 단위 테스트, 통합 테스트 시나리오 및 테스트 데이터 정의
>
> **참조**: 이 문서는 `010-design.md`와 `025-traceability-matrix.md`와 함께 사용됩니다.
>
> **활용 단계**: `/wf:build`, `/wf:test` 단계에서 테스트 코드 생성 기준으로 사용

---

## 0. 문서 메타데이터

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-04 |
| Task명 | Worker 관리 및 WezTerm CLI 통합 |
| 설계 참조 | `010-design.md` |
| 추적성 매트릭스 참조 | `025-traceability-matrix.md` |
| 작성일 | 2025-12-28 |
| 작성자 | Claude |

---

## 1. 테스트 전략 개요

### 1.1 테스트 범위

| 테스트 유형 | 범위 | 목표 커버리지 |
|------------|------|--------------|
| 단위 테스트 | wezterm.py, worker.py | 80% 이상 |
| 통합 테스트 | Worker 상태 감지 플로우 | 주요 시나리오 100% |

### 1.2 테스트 환경

| 항목 | 내용 |
|------|------|
| 테스트 프레임워크 | pytest |
| 비동기 테스트 | pytest-asyncio |
| Mock 라이브러리 | unittest.mock |
| Python 버전 | >=3.10 |

---

## 2. 단위 테스트 시나리오

### 2.1 테스트 케이스 목록

| 테스트 ID | 대상 | 시나리오 | 예상 결과 | 요구사항 |
|-----------|------|----------|----------|----------|
| UT-001 | wezterm_list_panes | 정상 pane 목록 조회 | PaneInfo 리스트 반환 | FR-001 |
| UT-002 | wezterm_get_text | 정상 텍스트 조회 | 문자열 반환 | FR-002 |
| UT-003 | wezterm_get_text | pane 미존재 | 빈 문자열 반환 | FR-002 |
| UT-004 | wezterm_send_text | 정상 명령 전송 | None 반환 (성공) | FR-003 |
| UT-005 | detect_worker_state | idle 상태 감지 | ("idle", None) | FR-004 |
| UT-006 | detect_worker_state | busy 상태 감지 | ("busy", None) | FR-004 |
| UT-007 | detect_worker_state | done 상태 감지 | ("done", DoneInfo) | FR-004 |
| UT-008 | detect_worker_state | paused 상태 감지 | ("paused", None) | FR-004 |
| UT-009 | detect_worker_state | error 상태 감지 | ("error", None) | FR-004 |
| UT-010 | detect_worker_state | blocked 상태 감지 | ("blocked", None) | FR-004 |
| UT-011 | detect_worker_state | dead 상태 감지 | ("dead", None) | FR-004, BR-003 |
| UT-012 | parse_done_signal | ORCHAY_DONE 파싱 | DoneInfo 반환 | FR-005 |
| UT-013 | detect_worker_state | 우선순위 테스트 | 우선순위 준수 | BR-001 |
| UT-014 | wezterm_send_text | 인젝션 방지 | 안전하게 이스케이프 | BR-002 |
| UT-015 | detect_worker_state | 50줄 제한 | 최근 50줄만 검색 | BR-004 |

### 2.2 테스트 케이스 상세

#### UT-001: wezterm_list_panes 정상 조회

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_wezterm.py` |
| **테스트 블록** | `class TestWeztermListPanes → test_list_panes_success` |
| **Mock 의존성** | asyncio.create_subprocess_exec |
| **입력 데이터** | 없음 |
| **Mock 반환값** | JSON: `[{"pane_id": 1, "workspace": "default", "cwd": "/home", "title": "bash"}]` |
| **검증 포인트** | 반환 리스트 길이 1, PaneInfo 필드 확인 |
| **관련 요구사항** | FR-001 |

```python
@pytest.mark.asyncio
async def test_list_panes_success(mock_subprocess):
    mock_subprocess.return_value = (
        b'[{"pane_id": 1, "workspace": "default", "cwd": "/home", "title": "bash"}]',
        b''
    )

    result = await wezterm_list_panes()

    assert len(result) == 1
    assert result[0].pane_id == 1
    assert result[0].workspace == "default"
```

#### UT-002: wezterm_get_text 정상 조회

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_wezterm.py` |
| **테스트 블록** | `class TestWeztermGetText → test_get_text_success` |
| **Mock 의존성** | asyncio.create_subprocess_exec |
| **입력 데이터** | pane_id=1, lines=50 |
| **Mock 반환값** | `b"Hello World\n> "` |
| **검증 포인트** | 반환 문자열 내용 확인 |
| **관련 요구사항** | FR-002 |

```python
@pytest.mark.asyncio
async def test_get_text_success(mock_subprocess):
    mock_subprocess.return_value = (b"Hello World\n> ", b'')

    result = await wezterm_get_text(pane_id=1, lines=50)

    assert "Hello World" in result
    assert ">" in result
```

#### UT-003: wezterm_get_text pane 미존재

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_wezterm.py` |
| **테스트 블록** | `class TestWeztermGetText → test_get_text_pane_not_found` |
| **Mock 의존성** | asyncio.create_subprocess_exec |
| **입력 데이터** | pane_id=999 |
| **Mock 반환값** | 빈 stdout, 에러 stderr |
| **검증 포인트** | 빈 문자열 반환 |
| **관련 요구사항** | FR-002 |

```python
@pytest.mark.asyncio
async def test_get_text_pane_not_found(mock_subprocess):
    mock_subprocess.return_value = (b'', b'pane not found')

    result = await wezterm_get_text(pane_id=999)

    assert result == ""
```

#### UT-005: detect_worker_state idle 감지

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_worker.py` |
| **테스트 블록** | `class TestDetectWorkerState → test_detect_idle` |
| **Mock 의존성** | wezterm_get_text |
| **입력 데이터** | pane_id=1 |
| **Mock 반환값** | `"작업 완료\n> "` |
| **검증 포인트** | 상태 "idle", done_info None |
| **관련 요구사항** | FR-004 |

```python
@pytest.mark.asyncio
async def test_detect_idle(mock_get_text):
    mock_get_text.return_value = "작업 완료\n> "

    state, done_info = await detect_worker_state(pane_id=1)

    assert state == "idle"
    assert done_info is None
```

#### UT-007: detect_worker_state done 감지

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_worker.py` |
| **테스트 블록** | `class TestDetectWorkerState → test_detect_done` |
| **Mock 의존성** | wezterm_get_text |
| **입력 데이터** | pane_id=1 |
| **Mock 반환값** | `"ORCHAY_DONE:TSK-01-04:build:success\n> "` |
| **검증 포인트** | 상태 "done", done_info 필드 확인 |
| **관련 요구사항** | FR-004 |

```python
@pytest.mark.asyncio
async def test_detect_done(mock_get_text):
    mock_get_text.return_value = "ORCHAY_DONE:TSK-01-04:build:success\n> "

    state, done_info = await detect_worker_state(pane_id=1)

    assert state == "done"
    assert done_info is not None
    assert done_info.task_id == "TSK-01-04"
    assert done_info.action == "build"
    assert done_info.status == "success"
```

#### UT-008: detect_worker_state paused 감지

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_worker.py` |
| **테스트 블록** | `class TestDetectWorkerState → test_detect_paused` |
| **Mock 의존성** | wezterm_get_text |
| **입력 데이터** | pane_id=1 |
| **Mock 반환값** | `"rate limit exceeded, please wait..."` |
| **검증 포인트** | 상태 "paused" |
| **관련 요구사항** | FR-004 |

```python
@pytest.mark.asyncio
async def test_detect_paused(mock_get_text):
    mock_get_text.return_value = "rate limit exceeded, please wait..."

    state, done_info = await detect_worker_state(pane_id=1)

    assert state == "paused"
```

#### UT-012: parse_done_signal 파싱

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_worker.py` |
| **테스트 블록** | `class TestParseDoneSignal → test_parse_success` |
| **입력 데이터** | `"ORCHAY_DONE:TSK-01-04:start:success"` |
| **검증 포인트** | DoneInfo 필드 정확성 |
| **관련 요구사항** | FR-005 |

```python
def test_parse_done_signal_success():
    text = "some output\nORCHAY_DONE:TSK-01-04:start:success\n> "

    result = parse_done_signal(text)

    assert result is not None
    assert result.task_id == "TSK-01-04"
    assert result.action == "start"
    assert result.status == "success"
    assert result.message is None
```

#### UT-013: 상태 감지 우선순위

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_worker.py` |
| **테스트 블록** | `class TestDetectWorkerState → test_priority_done_over_idle` |
| **입력 데이터** | pane_id=1 |
| **Mock 반환값** | `"ORCHAY_DONE:TSK-01-04:build:success\n> "` (done + idle 동시) |
| **검증 포인트** | done이 idle보다 우선 |
| **관련 요구사항** | BR-001 |

```python
@pytest.mark.asyncio
async def test_priority_done_over_idle(mock_get_text):
    # done 패턴과 idle 패턴 동시 존재
    mock_get_text.return_value = "ORCHAY_DONE:TSK-01-04:build:success\n> "

    state, done_info = await detect_worker_state(pane_id=1)

    # done이 idle보다 우선
    assert state == "done"
```

#### UT-014: 명령 인젝션 방지

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_wezterm.py` |
| **테스트 블록** | `class TestWeztermSendText → test_injection_prevention` |
| **입력 데이터** | text=`"; rm -rf /"` |
| **검증 포인트** | shlex.quote 호출 확인 |
| **관련 요구사항** | BR-002 |

```python
@pytest.mark.asyncio
async def test_injection_prevention(mock_subprocess, mocker):
    quote_spy = mocker.spy(shlex, 'quote')

    await wezterm_send_text(pane_id=1, text="; rm -rf /")

    quote_spy.assert_called()
```

---

## 3. 통합 테스트 시나리오

### 3.1 테스트 케이스 목록

| 테스트 ID | 시나리오 | 사전조건 | 예상 결과 | 요구사항 |
|-----------|----------|----------|----------|----------|
| IT-001 | pane 목록 → 텍스트 조회 | WezTerm 실행 중 | 정상 조회 | FR-001, FR-002 |
| IT-002 | 명령 전송 → 상태 변화 | idle Worker 존재 | busy로 전환 | FR-003 |
| IT-003 | 상태 감지 전체 플로우 | Worker 실행 중 | 상태 정확 감지 | FR-004, FR-005 |

### 3.2 테스트 케이스 상세

#### IT-001: pane 목록 및 텍스트 조회 통합

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_integration.py` |
| **테스트명** | `test_list_and_get_text_integration` |
| **사전조건** | WezTerm Mock 또는 실제 환경 |
| **실행 단계** | 1. pane 목록 조회 2. 첫 번째 pane 텍스트 조회 |
| **검증 포인트** | 텍스트가 비어있지 않음 |
| **관련 요구사항** | FR-001, FR-002 |

#### IT-002: 명령 전송 통합

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_integration.py` |
| **테스트명** | `test_send_command_integration` |
| **사전조건** | idle Worker 존재 |
| **실행 단계** | 1. /clear 전송 2. 상태 확인 3. 명령 전송 4. busy 상태 확인 |
| **검증 포인트** | 상태 전이 정상 |
| **관련 요구사항** | FR-003 |

#### IT-003: 상태 감지 전체 플로우

| 항목 | 내용 |
|------|------|
| **파일** | `tests/test_integration.py` |
| **테스트명** | `test_state_detection_flow` |
| **사전조건** | 다양한 상태의 Worker |
| **실행 단계** | 1. 각 Worker 상태 감지 2. 상태별 정확성 확인 |
| **검증 포인트** | 모든 상태 정확히 감지 |
| **관련 요구사항** | FR-004, FR-005, BR-001 |

---

## 4. 테스트 데이터 (Fixture)

### 4.1 단위 테스트용 Mock 데이터

| 데이터 ID | 용도 | 값 |
|-----------|------|-----|
| MOCK-PANE-LIST | pane 목록 | `[{"pane_id": 1, "workspace": "default", "cwd": "/home", "title": "bash"}]` |
| MOCK-IDLE-OUTPUT | idle 상태 출력 | `"작업 완료\n> "` |
| MOCK-BUSY-OUTPUT | busy 상태 출력 | `"[wf:build] 구현 중..."` |
| MOCK-DONE-OUTPUT | done 상태 출력 | `"ORCHAY_DONE:TSK-01-04:build:success\n> "` |
| MOCK-PAUSED-OUTPUT | paused 상태 출력 | `"rate limit exceeded, please wait..."` |
| MOCK-ERROR-OUTPUT | error 상태 출력 | `"Error: Task failed\n❌ 실패"` |
| MOCK-BLOCKED-OUTPUT | blocked 상태 출력 | `"계속하시겠습니까? (y/n)"` |

### 4.2 상태 감지 패턴 테스트 데이터

| 패턴 유형 | 테스트 입력 |
|----------|------------|
| idle (프롬프트) | `"> "`, `"╭─"`, `"❯"` |
| done (완료 신호) | `"ORCHAY_DONE:TSK-01-04:start:success"` |
| done (에러 포함) | `"ORCHAY_DONE:TSK-01-04:build:error:TDD 5회 초과"` |
| paused (레이트 리밋) | `"rate limit", "please wait", "try again"` |
| paused (Weekly) | `"weekly limit reached", "resets Oct 9 at 10:30am"` |
| paused (컨텍스트) | `"context limit", "conversation too long"` |
| error | `"Error:", "Failed:", "Exception:", "❌"` |
| blocked | `"?", "(y/n)", "선택하세요"` |

---

## 5. 테스트 커버리지 목표

### 5.1 단위 테스트 커버리지

| 대상 | 목표 | 최소 |
|------|------|------|
| Lines | 80% | 70% |
| Branches | 75% | 65% |
| Functions | 85% | 75% |

### 5.2 통합 테스트 커버리지

| 구분 | 목표 |
|------|------|
| 주요 시나리오 | 100% |
| 기능 요구사항 (FR) | 100% 커버 |
| 비즈니스 규칙 (BR) | 100% 커버 |

---

## 6. 테스트 실행 명령어

```bash
# 전체 테스트
pytest tests/

# 단위 테스트만
pytest tests/test_wezterm.py tests/test_worker.py

# 통합 테스트만
pytest tests/test_integration.py

# 커버리지 포함
pytest --cov=src/orchay --cov-report=html tests/

# 특정 테스트만
pytest tests/test_worker.py::TestDetectWorkerState::test_detect_idle
```

---

## 관련 문서

- 설계: `010-design.md`
- 추적성 매트릭스: `025-traceability-matrix.md`
- PRD: `.orchay/projects/orchay/prd.md`
- TRD: `.orchay/projects/orchay/trd.md`

---

<!--
TSK-01-04 테스트 명세서
Version: 1.0
Created: 2025-12-28
-->
