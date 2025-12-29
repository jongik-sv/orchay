# TSK-01-04 - Worker 관리 및 WezTerm CLI 통합 매뉴얼

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-04 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-28 |

---

## 1. 개요

### 1.1 기능 소개

이 모듈은 WezTerm 터미널의 pane을 관리하고 Worker(Claude Code 인스턴스) 상태를 자동으로 감지하는 기능을 제공합니다.

**주요 기능:**
- WezTerm CLI 래퍼 (pane 목록 조회, 출력 읽기, 명령 전송)
- Worker 상태 자동 감지 (idle, busy, done, paused, error, blocked, dead)
- ORCHAY_DONE 완료 신호 파싱

### 1.2 대상 사용자

| 사용자 | 용도 |
|--------|------|
| orchay 스케줄러 | Worker 상태 모니터링 및 Task 분배 |
| 개발자 | 디버깅 및 모니터링 |

---

## 2. 시작하기

### 2.1 사전 요구사항

| 항목 | 요구사항 |
|------|----------|
| WezTerm | 설치 및 PATH 등록 필수 |
| Python | 3.10 이상 |
| 패키지 | orchay 패키지 설치됨 |

### 2.2 설치 확인

```bash
# WezTerm CLI 확인
wezterm cli list

# Python 패키지 확인
cd orchay
python -c "from orchay.utils import wezterm_list_panes; print('OK')"
```

---

## 3. 사용 방법

### 3.1 WezTerm CLI 래퍼

#### pane 목록 조회

```python
import asyncio
from orchay.utils import wezterm_list_panes

async def main():
    panes = await wezterm_list_panes()
    for pane in panes:
        print(f"Pane {pane.pane_id}: {pane.title}")

asyncio.run(main())
```

**반환값:**
```python
[
    PaneInfo(pane_id=1, workspace="default", cwd="/home", title="bash"),
    PaneInfo(pane_id=2, workspace="default", cwd="/project", title="python"),
]
```

#### pane 출력 읽기

```python
from orchay.utils import wezterm_get_text

async def main():
    # 마지막 50줄 읽기 (기본값)
    output = await wezterm_get_text(pane_id=1)
    print(output)

    # 마지막 100줄 읽기
    output = await wezterm_get_text(pane_id=1, lines=100)
```

#### pane에 명령 전송

```python
from orchay.utils import wezterm_send_text

async def main():
    # 컨텍스트 초기화
    await wezterm_send_text(pane_id=1, text="/clear\r")

    # 워크플로우 명령 전송
    await wezterm_send_text(pane_id=1, text="/wf:start TSK-01-04\r")
```

### 3.2 Worker 상태 감지

#### 상태 감지

```python
from orchay.worker import detect_worker_state

async def main():
    state, done_info = await detect_worker_state(pane_id=1)

    print(f"상태: {state}")  # idle, busy, done, paused, error, blocked, dead

    if done_info:
        print(f"Task: {done_info.task_id}")
        print(f"Action: {done_info.action}")
        print(f"Status: {done_info.status}")
```

#### 상태별 의미

| 상태 | 의미 | 스케줄러 대응 |
|------|------|-------------|
| `idle` | 입력 대기 중 | Task 분배 가능 |
| `busy` | 작업 진행 중 | 대기 |
| `done` | 작업 완료 | 다음 단계 또는 Task |
| `paused` | 일시 중단 (rate limit 등) | 대기 후 재개 |
| `error` | 에러 발생 | 로그 기록, 스킵 |
| `blocked` | 사용자 입력 대기 | 타임아웃 후 스킵 |
| `dead` | pane 미존재 | Worker 풀에서 제거 |

#### ORCHAY_DONE 파싱

```python
from orchay.worker import parse_done_signal

text = "ORCHAY_DONE:TSK-01-04:build:success"
done_info = parse_done_signal(text)

if done_info:
    print(f"Task: {done_info.task_id}")    # TSK-01-04
    print(f"Action: {done_info.action}")    # build
    print(f"Status: {done_info.status}")    # success
    print(f"Message: {done_info.message}")  # None
```

---

## 4. FAQ

### Q1: WezTermNotFoundError가 발생합니다

**원인:** WezTerm CLI가 PATH에 등록되지 않음

**해결:**
1. WezTerm 설치 확인
2. PATH 환경변수에 WezTerm 경로 추가
3. 터미널 재시작

### Q2: 상태 감지가 정확하지 않습니다

**원인:** 출력 패턴이 예상과 다름

**해결:**
1. `wezterm_get_text()`로 실제 출력 확인
2. 패턴 매칭 확인 (정규식)
3. 필요시 패턴 추가 요청

### Q3: 명령 전송 후 반응이 없습니다

**원인:** pane이 입력을 받을 수 없는 상태

**해결:**
1. `detect_worker_state()`로 상태 확인
2. idle 상태에서만 명령 전송
3. `/clear\r` 먼저 전송

---

## 5. 문제 해결

### 5.1 에러 메시지

| 에러 | 원인 | 해결 |
|------|------|------|
| `WezTermNotFoundError` | CLI 미설치 | WezTerm 설치 및 PATH 등록 |
| `RuntimeError: send-text 실패` | 전송 실패 | pane 존재 및 상태 확인 |
| 빈 문자열 반환 | pane 미존재 | pane_id 확인 |

### 5.2 디버깅

```python
# 상세 로깅
import logging
logging.basicConfig(level=logging.DEBUG)

# 수동 상태 확인
import asyncio
from orchay.utils import wezterm_get_text

async def debug():
    output = await wezterm_get_text(pane_id=1)
    print("=== Pane Output ===")
    print(output)
    print("==================")

asyncio.run(debug())
```

---

## 6. 참고 자료

### 6.1 관련 문서

| 문서 | 경로 |
|------|------|
| 설계 문서 | `010-design.md` |
| 구현 보고서 | `030-implementation.md` |
| 테스트 명세 | `026-test-specification.md` |
| PRD | `.orchay/projects/orchay/prd.md` |

### 6.2 API 레퍼런스

**wezterm.py:**
- `wezterm_list_panes() -> list[PaneInfo]`
- `wezterm_get_text(pane_id: int, lines: int = 50) -> str`
- `wezterm_send_text(pane_id: int, text: str) -> None`
- `pane_exists(pane_id: int) -> bool`

**worker.py:**
- `parse_done_signal(text: str) -> DoneInfo | None`
- `detect_worker_state(pane_id: int) -> tuple[WorkerState, DoneInfo | None]`

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-12-28 | Claude | 최초 작성 |
