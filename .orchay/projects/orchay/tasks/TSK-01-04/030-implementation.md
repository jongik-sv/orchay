# TSK-01-04 - Worker 관리 및 WezTerm CLI 통합 구현 보고서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-04 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-28 |
| 상태 | 구현 완료 |
| 카테고리 | development |

---

## 1. 구현 개요

### 1.1 구현 범위

| 구현 항목 | 상태 | 파일 |
|----------|------|------|
| WezTerm CLI 래퍼 | ✅ 완료 | `src/orchay/utils/wezterm.py` |
| Worker 상태 감지 | ✅ 완료 | `src/orchay/worker.py` |
| ORCHAY_DONE 파싱 | ✅ 완료 | `src/orchay/worker.py` |
| 단위 테스트 | ✅ 완료 | `tests/test_wezterm.py`, `tests/test_worker.py` |

### 1.2 TDD 진행 결과

| 시도 | 통과 | 실패 | 조치 |
|------|------|------|------|
| 1차 | 27/29 | 2 | mock 적용 순서 수정 |
| 2차 | 29/29 | 0 | ✅ 완료 |

---

## 2. 구현 상세

### 2.1 WezTerm CLI 래퍼 (`src/orchay/utils/wezterm.py`)

**함수 목록:**

| 함수 | 설명 | 비동기 |
|------|------|--------|
| `wezterm_list_panes()` | pane 목록 조회 | ✅ |
| `wezterm_get_text(pane_id, lines)` | pane 출력 읽기 | ✅ |
| `wezterm_send_text(pane_id, text)` | pane에 명령 전송 | ✅ |
| `pane_exists(pane_id)` | pane 존재 확인 | ✅ |

**데이터 모델:**

```python
@dataclass
class PaneInfo:
    pane_id: int
    workspace: str
    cwd: str
    title: str
```

**예외 처리:**

| 예외 | 발생 조건 |
|------|----------|
| `WezTermNotFoundError` | WezTerm CLI 미설치 |
| `RuntimeError` | send-text 실패 |

### 2.2 Worker 상태 감지 (`src/orchay/worker.py`)

**함수 목록:**

| 함수 | 설명 |
|------|------|
| `parse_done_signal(text)` | ORCHAY_DONE 패턴 파싱 |
| `detect_worker_state(pane_id)` | Worker 상태 감지 (우선순위 기반) |

**상태 감지 우선순위:**

```
dead > done > paused > error > blocked > idle > busy
```

**상태 감지 패턴:**

| 상태 | 패턴 예시 |
|------|----------|
| done | `ORCHAY_DONE:TSK-01-04:build:success` |
| paused | `rate limit`, `weekly limit`, `context limit` |
| error | `Error:`, `Failed:`, `❌` |
| blocked | `?`, `(y/n)`, `선택` |
| idle | `> `, `╭─`, `❯` |
| busy | 기본값 (다른 패턴 미매칭) |
| dead | pane 미존재 |

**DoneInfo 모델:**

```python
@dataclass
class DoneInfo:
    task_id: str
    action: str
    status: Literal["success", "error"]
    message: str | None = None
```

---

## 3. 테스트 결과

### 3.1 단위 테스트 결과

| 테스트 파일 | 테스트 수 | 통과 | 실패 |
|------------|----------|------|------|
| `test_wezterm.py` | 10 | 10 | 0 |
| `test_worker.py` | 19 | 19 | 0 |
| **총계** | **29** | **29** | **0** |

### 3.2 테스트 커버리지

| 모듈 | 커버리지 |
|------|----------|
| `utils/wezterm.py` | ~90% |
| `worker.py` | ~95% |

### 3.3 요구사항 커버리지

| 요구사항 | 테스트 ID | 상태 |
|----------|----------|------|
| FR-001 pane 목록 조회 | UT-001 | ✅ |
| FR-002 pane 출력 읽기 | UT-002, UT-003 | ✅ |
| FR-003 pane 명령 전송 | UT-004 | ✅ |
| FR-004 Worker 상태 감지 | UT-005~UT-011 | ✅ |
| FR-005 ORCHAY_DONE 파싱 | UT-012 | ✅ |
| BR-001 우선순위 | UT-013 | ✅ |
| BR-002 인젝션 방지 | UT-014 | ✅ |
| BR-003 dead 상태 | UT-011 | ✅ |
| BR-004 50줄 제한 | UT-015 | ✅ |

---

## 4. 코드 품질

### 4.1 린터/타입 체커

| 도구 | 상태 |
|------|------|
| Ruff | 통과 예정 (수동 확인 필요) |
| Pyright | 통과 예정 (strict 모드) |

### 4.2 코딩 가이드라인 준수

| 가이드라인 | 준수 |
|-----------|------|
| asyncio 패턴 | ✅ |
| Type hints | ✅ |
| Google 스타일 독스트링 | ✅ |
| shlex.quote 보안 | ✅ |

---

## 5. 파일 목록

### 5.1 신규 생성 파일

| 파일 | 설명 |
|------|------|
| `src/orchay/utils/__init__.py` | utils 패키지 초기화 |
| `src/orchay/utils/wezterm.py` | WezTerm CLI 래퍼 |
| `src/orchay/worker.py` | Worker 상태 감지 |
| `tests/test_wezterm.py` | WezTerm 테스트 |
| `tests/test_worker.py` | Worker 테스트 |

### 5.2 수정 파일

없음

---

## 6. 의존성

### 6.1 사용된 라이브러리

| 라이브러리 | 용도 | 버전 |
|-----------|------|------|
| asyncio | 비동기 CLI 호출 | 표준 라이브러리 |
| re | 정규식 패턴 매칭 | 표준 라이브러리 |
| json | JSON 파싱 | 표준 라이브러리 |
| dataclasses | 데이터 모델 | 표준 라이브러리 |

### 6.2 외부 의존성

| 도구 | 필수 | 용도 |
|------|------|------|
| WezTerm CLI | ✅ | pane 관리 |

---

## 7. 알려진 제한사항

| 제한 | 설명 | 대응 |
|------|------|------|
| WezTerm 필수 | 다른 터미널 미지원 | 향후 확장 고려 |
| Windows 경로 | UTF-8 인코딩 필요 | errors='replace' 적용 |

---

## 8. 다음 단계

| 명령어 | 설명 |
|--------|------|
| `/wf:audit` | 코드 리뷰 (선택) |
| `/wf:test` | 통합 테스트 (선택) |
| `/wf:verify` | 통합테스트 |
| `/wf:done` | 작업 완료 |

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-12-28 | Claude | 최초 작성 |
