# TSK-02-03 TUI 인터랙티브 기능 사용 매뉴얼

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-03 |
| Task명 | TUI 인터랙티브 기능 |
| 버전 | 1.0 |
| 작성일 | 2025-12-28 |

---

## 1. 개요

### 1.1 기능 소개

orchay TUI 인터랙티브 기능은 스케줄러 실행 중 실시간으로 Task 큐를 조작하고 실행 모드를 변경할 수 있는 기능입니다.

**주요 기능:**
- Function Key를 통한 빠른 조작
- 명령어 입력을 통한 세밀한 제어
- 인터랙티브 Task 선택 UI
- 큐 순서 조정 (up, top, skip, retry)
- 실행 모드 전환

### 1.2 대상 사용자

- orchay 스케줄러를 사용하는 개발자
- 다중 Task를 관리하는 DevOps 엔지니어
- WezTerm 기반 개발 환경 사용자

---

## 2. 시작하기

### 2.1 사전 요구사항

- orchay 스케줄러 실행 중
- WezTerm 터미널 환경
- 유효한 `wbs.md` 파일

### 2.2 접근 방법

orchay 스케줄러를 실행하면 자동으로 TUI 인터페이스가 활성화됩니다:

```bash
cd orchay
uv run python -m orchay [PROJECT]
```

---

## 3. 사용 방법

### 3.1 Function Key 바인딩

| 키 | 기능 | 설명 |
|----|------|------|
| F1 | help | 도움말 모달 표시 |
| F2 | status | 스케줄러 상태 표시 |
| F3 | queue | 인터랙티브 큐 UI 토글 |
| F4 | workers | Worker 상태 표시 |
| F5 | reload | WBS 파일 재로드 |
| F6 | history | 실행 이력 표시 |
| F7 | mode | 실행 모드 순환 (design→quick→develop→force) |
| F9 | pause | 스케줄러 일시정지/재개 |
| F10 | stop | 스케줄러 종료 |
| Shift+F1 | worker 1 | Worker 1 상세 정보 |
| Shift+F2 | worker 2 | Worker 2 상세 정보 |
| Shift+F3 | worker 3 | Worker 3 상세 정보 |

### 3.2 명령어 입력

하단 입력 필드에서 직접 명령어를 입력할 수 있습니다:

| 명령어 | 인자 | 설명 |
|--------|------|------|
| `help` | - | 도움말 표시 |
| `status` | - | 현재 상태 표시 |
| `queue` | - | 큐 목록 표시 |
| `workers` | - | Worker 목록 표시 |
| `worker` | `<N>` | Worker N 상세 정보 |
| `reload` | - | WBS 재로드 |
| `history` | `[ID]` | 실행 이력 조회 |
| `mode` | `[모드명]` | 모드 전환 |
| `pause` | - | 일시정지 토글 |
| `resume` | - | 재개 |
| `stop` | - | 종료 |
| `up` | `<Task-ID>` | Task 한 칸 위로 |
| `top` | `<Task-ID>` | Task 최우선 순위로 |
| `skip` | `<Task-ID>` | Task 스킵 |
| `retry` | `<Task-ID>` | Task 재시도 |
| `clear` | - | 화면 정리 |

### 3.3 인터랙티브 큐 UI

F3을 눌러 인터랙티브 큐 UI를 활성화한 후:

| 키 | 기능 |
|----|------|
| ↑ / ↓ | Task 선택 이동 |
| U | 선택한 Task 한 칸 위로 |
| T | 선택한 Task 최우선 순위로 |
| S | 선택한 Task 스킵 |
| R | 선택한 Task 재시도 |
| Enter | 액션 메뉴 열기 |
| Escape | 인터랙티브 모드 종료 |

---

## 4. FAQ

### Q1: 실행 중인 Task를 스킵할 수 있나요?

**A:** 아니요. 실행 중인 Task는 스킵할 수 없습니다. 스킵 시도 시 에러 메시지가 표시됩니다. 대기 중인 Task만 스킵 가능합니다.

### Q2: 모드 전환 시 진행 중인 작업은 어떻게 되나요?

**A:** 모드 전환은 진행 중인 작업에 영향을 주지 않습니다. 다음 Task 분배부터 새 모드가 적용됩니다.

### Q3: pause 후 Worker가 작업 중이면 어떻게 되나요?

**A:** pause는 새로운 Task 분배만 중지합니다. 이미 진행 중인 작업은 계속 실행됩니다.

### Q4: 모드 순환 순서는 어떻게 되나요?

**A:** design → quick → develop → force → design 순서로 순환합니다.

---

## 5. 문제 해결

### 증상: Function Key가 작동하지 않음

**원인:** 터미널 또는 OS에서 Function Key를 가로채는 경우

**해결:**
1. WezTerm 설정에서 Function Key 매핑 확인
2. 명령어 입력으로 대체 사용

### 증상: 큐 조정 명령이 실패함

**원인:** 잘못된 Task ID 또는 실행 중인 Task

**해결:**
1. `queue` 명령으로 정확한 Task ID 확인
2. 실행 중인 Task는 완료 후 조작

### 증상: 모드 전환 후 기대한 워크플로우가 실행되지 않음

**원인:** 이미 진행 중인 Task는 기존 모드로 계속 실행

**해결:**
1. 새 Task 분배부터 새 모드 적용됨을 이해
2. 필요시 현재 작업 완료 대기

---

## 6. 참고 자료

### 관련 문서

| 문서 | 경로 |
|------|------|
| 설계 문서 | `tasks/TSK-02-03/010-design.md` |
| 추적성 매트릭스 | `tasks/TSK-02-03/025-traceability-matrix.md` |
| 테스트 명세 | `tasks/TSK-02-03/026-test-specification.md` |
| 구현 보고서 | `tasks/TSK-02-03/030-implementation.md` |

### 관련 모듈

| 모듈 | 역할 |
|------|------|
| `orchay/command.py` | CommandHandler, 명령어 처리 |
| `orchay/ui/widgets.py` | QueueWidget, HelpModal, ActionMenu |
| `orchay/ui/app.py` | OrchayApp TUI 애플리케이션 |

---

<!--
TSK-02-03 Manual
Version: 1.0
Author: Claude
-->
