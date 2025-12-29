# orchay 사용자 매뉴얼

## 0. 문서 메타데이터

* **문서명**: `080-manual.md`
* **Task ID**: TSK-02-05
* **Task 명**: 테스트 및 문서화
* **작성일**: 2025-12-28
* **버전**: 1.0.0
* **대상 사용자**: 개발자, 프로젝트 관리자

---

## 1. 개요

### 1.1 orchay란?

**orchay** (**orch**estration + ok**ay**)는 WezTerm 기반 Task 스케줄러입니다.
`wbs.md` 파일을 모니터링하여 실행 가능한 Task를 추출하고, 여러 Claude Code Worker pane에 작업을 자동 분배합니다.

### 1.2 주요 기능

| 기능 | 설명 |
|------|------|
| **WBS 파싱** | wbs.md 파일을 파싱하여 Task 객체로 변환 |
| **실시간 모니터링** | 파일 변경 감지 및 자동 큐 갱신 |
| **자동 분배** | idle Worker에 Task 자동 할당 |
| **상태 감지** | Worker pane 출력 분석으로 상태 파악 |
| **자동 재개** | rate limit 시 대기 후 자동 재시작 |
| **TUI 대시보드** | Textual 기반 실시간 모니터링 UI |

---

## 2. 시작하기

### 2.1 사전 요구사항

| 항목 | 버전 | 필수 |
|------|------|------|
| Python | >= 3.10 | ✅ |
| WezTerm | 최신 | ✅ |
| uv | 최신 | 권장 |

### 2.2 설치

```bash
# 1. orchay 디렉토리로 이동
cd orchay

# 2. uv 사용 (권장)
uv venv
uv pip install -e ".[dev]"

# 또는 pip 사용
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -e ".[dev]"
```

### 2.3 빠른 시작

```bash
# 프로젝트 루트로 이동 (.orchay 폴더가 있는 위치)
cd ..

# 스케줄러 실행
uv run --project orchay python -m orchay orchay --dry-run

# TUI 모드로 실행
uv run --project orchay python -m orchay orchay
```

---

## 3. 사용 방법

### 3.1 기본 사용법

```bash
# 기본 형식
python -m orchay [PROJECT] [OPTIONS]

# 예시
python -m orchay orchay           # orchay 프로젝트 스케줄링
python -m orchay orchay-flutter   # orchay-flutter 프로젝트 스케줄링
```

### 3.2 CLI 옵션

| 옵션 | 단축 | 설명 | 기본값 |
|------|------|------|--------|
| `--workers N` | `-w` | Worker 수 | 3 |
| `--interval SEC` | `-i` | 모니터링 간격(초) | 5 |
| `--mode MODE` | `-m` | 실행 모드 | quick |
| `--dry-run` | - | 분배 없이 상태만 표시 | false |
| `--verbose` | `-v` | 상세 로그 출력 | false |

### 3.3 실행 모드

| 모드 | 워크플로우 단계 | 용도 |
|------|-----------------|------|
| **design** | start | 설계 문서만 생성 |
| **quick** | start → approve → build → done | 빠른 구현 (리뷰 생략) |
| **develop** | start → review → apply → approve → build → audit → patch → test → done | 전체 워크플로우 |
| **force** | start → approve → build → done | 의존성 무시 강제 실행 |

### 3.4 사용 예시

```bash
# dry-run 모드로 큐 확인
uv run python -m orchay orchay --dry-run

# design 모드로 설계만 수행
uv run python -m orchay orchay -m design

# 5개 Worker, 10초 간격
uv run python -m orchay orchay -w 5 -i 10

# develop 모드 전체 워크플로우
uv run python -m orchay orchay -m develop

# 의존성 무시하고 강제 실행
uv run python -m orchay orchay -m force
```

---

## 4. 상세 기능

### 4.1 Task 상태

| 코드 | 상태 | 설명 |
|------|------|------|
| `[ ]` | TODO | 미시작 |
| `[bd]` | 기본설계 | 기본 설계 완료 |
| `[dd]` | 상세설계 | 상세 설계 완료 |
| `[an]` | 분석 | 분석 완료 |
| `[ds]` | 설계 | 설계 완료 |
| `[ap]` | 승인 | 설계 승인됨 |
| `[im]` | 구현 | 구현 완료 |
| `[fx]` | 수정 | 수정 중 |
| `[vf]` | 검증 | 검증 중 |
| `[xx]` | 완료 | 작업 완료 |

### 4.2 Worker 상태

| 상태 | 설명 | 다음 액션 |
|------|------|----------|
| **idle** | 대기 중 | Task 분배 가능 |
| **busy** | 작업 중 | 대기 |
| **done** | 완료 신호 | 결과 처리 후 다음 Task |
| **paused** | 일시 중단 | 자동 재개 대기 |
| **error** | 오류 발생 | 수동 개입 필요 |
| **blocked** | 입력 대기 | 수동 개입 필요 |
| **dead** | pane 없음 | Worker 재생성 필요 |

### 4.3 완료 신호 형식

Worker가 작업을 완료하면 다음 형식으로 신호를 출력해야 합니다:

```
ORCHAY_DONE:{task-id}:{action}:{status}[:{message}]
```

**예시:**
```
ORCHAY_DONE:TSK-01-01:build:success
ORCHAY_DONE:TSK-02-01:test:error:테스트 3개 실패
```

| 필드 | 설명 | 예시 |
|------|------|------|
| task-id | Task ID | TSK-01-01 |
| action | 수행한 액션 | start, build, done |
| status | 결과 상태 | success, error |
| message | 추가 메시지 (선택) | 테스트 실패 |

### 4.4 자동 재개 메커니즘

orchay는 다음 상황에서 자동 재개를 시도합니다:

| 일시 중단 유형 | 감지 패턴 | 대기 시간 |
|---------------|----------|----------|
| Rate Limit | "rate limit", "capacity" | 파싱된 시간 또는 5분 |
| Weekly Limit | "weekly limit exceeded" | reset 시간까지 대기 |
| Context Limit | "context limit", "session limit" | 2분 후 재시도 |

**재개 프로세스:**
1. paused 상태 감지
2. reset 시간 파싱 (있는 경우)
3. 대기 시간 계산
4. 대기 후 "계속" 텍스트 전송
5. 최대 3회 재시도

---

## 5. FAQ

### Q1: Worker를 어떻게 설정하나요?

WezTerm에서 여러 pane을 생성하고, 각 pane에서 Claude Code를 실행하세요.
orchay는 자동으로 pane을 감지하여 Worker로 사용합니다.

```bash
# WezTerm에서 pane 분할
Ctrl+Shift+Alt+%   # 세로 분할
Ctrl+Shift+Alt+"   # 가로 분할
```

### Q2: Task가 분배되지 않아요

다음을 확인하세요:
1. wbs.md 파일 경로가 올바른지 확인
2. Task의 status가 `[ ]`(TODO)인지 확인
3. depends의 모든 Task가 완료(`[xx]`)되었는지 확인
4. blocked-by가 설정되지 않았는지 확인

### Q3: dry-run 모드는 언제 사용하나요?

실제 분배 없이 현재 큐 상태만 확인하고 싶을 때 사용합니다:
```bash
python -m orchay orchay --dry-run
```

### Q4: rate limit이 발생하면 어떻게 되나요?

orchay는 자동으로:
1. paused 상태로 전환
2. reset 시간 파싱 (가능한 경우)
3. 대기 후 자동 재개 시도
4. 최대 3회 재시도 후 error 상태로 전환

---

## 6. 문제 해결

### 6.1 일반적인 문제

| 문제 | 원인 | 해결 방법 |
|------|------|----------|
| "wezterm not found" | PATH에 wezterm 없음 | WezTerm 설치 및 PATH 등록 |
| "No workers found" | WezTerm pane 없음 | pane 생성 후 재실행 |
| "wbs.md not found" | 경로 오류 | 프로젝트 루트에서 실행 |
| "Task not executable" | 의존성 미완료 | 의존 Task 완료 후 재시도 |

### 6.2 디버깅

```bash
# 상세 로그 출력
python -m orchay orchay -v

# dry-run으로 큐 확인
python -m orchay orchay --dry-run -v
```

### 6.3 로그 파일

실행 로그는 다음 위치에 저장됩니다:
```
.orchay/logs/orchay-active.json    # 활성 Task 상태
```

---

## 7. 참고 자료

### 7.1 관련 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| README | `orchay/README.md` | 기술 문서 |
| PRD | `.orchay/projects/orchay/prd.md` | 제품 요구사항 |
| WBS | `.orchay/projects/orchay/wbs.md` | 작업 분류 체계 |

### 7.2 API 참조

```python
# WBS 파싱
from orchay.wbs_parser import parse_wbs, watch_wbs
tasks = await parse_wbs("path/to/wbs.md")

# WezTerm 통합
from orchay.utils.wezterm import wezterm_list_panes, wezterm_send_text
panes = await wezterm_list_panes()
await wezterm_send_text(pane_id=1, text="/wf:build TSK-01-01\n")

# Worker 상태 감지
from orchay.worker import detect_worker_state
state, info = await detect_worker_state(pane_id=1)
```

---

## 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0.0 | 2025-12-28 | Claude | 최초 작성 |
