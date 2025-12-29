# WBS - orchay (Task 스케줄러)

> version: 1.0
> depth: 3
> updated: 2025-12-28
> project-root: orchay
> strategy: 부트스트래핑 (1단계 완료 후 orchay로 2단계 자동 개발)

---

## WP-01: 부트스트랩 (수동 개발)
- status: planned
- priority: critical
- schedule: 2025-12-28 ~ 2026-01-03
- progress: 0%
- note: orchay 최소 동작 버전. 이 WP 완료 후 orchay로 나머지 자동 개발

### TSK-01-01: 프로젝트 초기화 및 핵심 모델
- category: infrastructure
- domain: infra
- status: done [xx]
- priority: critical
- assignee: -
- schedule: 2025-12-28 ~ 2025-12-28
- tags: setup, pydantic, models
- depends: -

#### PRD 요구사항
- prd-ref: TRD 배포구조, TRD 의존성
- requirements:
  - pyproject.toml 생성 (uv 기반)
  - src/orchay/ 패키지 구조 생성
  - Pydantic 모델 정의 (Task, Worker, Config)
  - workflows.json 연동 모델
- acceptance:
  - `uv pip install -e .` 성공
  - `python -m orchay` 실행 가능
  - Pyright strict 모드 통과

#### 기술 스펙 (TRD)
- tech-spec:
  - Python >=3.10, Textual ^1.0, Pydantic ^2.0
  - 패키지 관리: pyproject.toml + uv
  - 린터: Ruff, 타입체커: Pyright
- data-model:
  - Task: id, category, domain, status, priority, depends, blocked_by
  - Worker: id, pane_id, state, current_task, dispatch_time
  - Config: workers, interval, detection, recovery, dispatch, history

---

### TSK-01-02: WBS 파서 구현
- category: development
- domain: backend
- status: done [xx]
- priority: critical
- assignee: -
- schedule: 2025-12-29 ~ 2025-12-29
- tags: parser, markdown, regex
- depends: TSK-01-01

#### PRD 요구사항
- prd-ref: PRD 3.1 wbs.md 모니터링, PRD 3.2 스케줄 큐 관리
- requirements:
  - wbs.md 파일 파싱 (마크다운 → Task 객체)
  - Task 속성 추출: category, domain, status, priority, depends, blocked-by
  - 상태 기호 파싱: [ ], [dd], [ap], [im], [xx] 등
  - 파일 변경 감지 (watchdog)
- acceptance:
  - wbs.md 파싱 → Task 리스트 반환
  - 상태 변경 시 자동 재파싱
  - 파싱 오류 시 이전 상태 유지

#### 기술 스펙 (TRD)
- tech-spec:
  - watchdog ^4.0 파일 모니터링
  - 정규식 기반 마크다운 파싱
  - asyncio 이벤트 기반 변경 감지
- api-spec:
  - parse_wbs(path: str) -> list[Task]
  - watch_wbs(path: str, callback: Callable)

---

### TSK-01-03: 스케줄러 코어 구현
- category: development
- domain: backend
- status: done [xx]
- priority: critical
- assignee: -
- schedule: 2025-12-30 ~ 2025-12-31
- tags: scheduler, queue, async
- depends: TSK-01-02

#### PRD 요구사항
- prd-ref: PRD 3.2 스케줄 큐 관리, PRD 3.4 작업 분배, PRD 3.8 실행 모드
- requirements:
  - 실행 가능 Task 필터링 (완료/blocked/실행중 제외)
  - 우선순위 정렬 (critical > high > medium > low)
  - 의존성 검사 (모드별 분기)
  - 모드별 워크플로우 단계 결정 (design/quick/develop/force)
  - Task 분배 로직 (idle Worker에 할당)
- acceptance:
  - 모드별 필터링 정확히 동작
  - 의존성 순서 준수
  - 동일 Task 중복 분배 방지

#### 기술 스펙 (TRD)
- tech-spec:
  - asyncio 기반 이벤트 루프
  - workflows.json executionModes 연동
- api-spec:
  - filter_executable_tasks(tasks, mode) -> list[Task]
  - get_workflow_steps(task, mode) -> list[str]
  - dispatch_task(worker, task) -> None

---

### TSK-01-04: Worker 관리 및 WezTerm CLI 통합
- category: development
- domain: backend
- status: done [xx]
- priority: critical
- assignee: -
- schedule: 2026-01-01 ~ 2026-01-03
- tags: wezterm, worker, detection
- depends: TSK-01-03

#### PRD 요구사항
- prd-ref: PRD 3.3 Worker 상태 감지, PRD 3.4 작업 분배, PRD 2.4 워커 상태
- requirements:
  - WezTerm CLI 래퍼 (list, get-text, send-text)
  - Worker 상태 감지: done, idle, busy, paused, error, blocked, dead
  - ORCHAY_DONE 패턴 파싱
  - 프롬프트/에러/일시중단 패턴 매칭
  - /clear 후 명령 전송
- acceptance:
  - wezterm cli list → Worker 목록 획득
  - 상태 감지 정확도 95% 이상
  - 명령 전송 후 상태 변화 확인

#### 기술 스펙 (TRD)
- tech-spec:
  - asyncio.create_subprocess_exec (비동기 CLI 호출)
  - 정규식 패턴 매칭
  - shlex.quote 인젝션 방지
- api-spec:
  - wezterm_list_panes() -> list[dict]
  - wezterm_get_text(pane_id, lines) -> str
  - wezterm_send_text(pane_id, text) -> None
  - detect_worker_state(pane_id) -> tuple[str, dict|None]

---

## WP-02: 고급 기능 (orchay 자동 개발)
- status: planned
- priority: high
- schedule: 2026-01-04 ~ 2026-01-10
- progress: 0%
- note: WP-01 완료 후 orchay가 Worker들에게 자동 분배하여 병렬 개발

### TSK-02-01: 자동 재개 메커니즘
- category: development
- domain: backend
- status: done [xx]
- priority: high
- assignee: -
- schedule: 2026-01-04 ~ 2026-01-05
- tags: recovery, rate-limit, auto-resume
- depends: TSK-01-04

#### PRD 요구사항
- prd-ref: PRD 8.6 자동 재개 메커니즘
- requirements:
  - paused 상태 유형 판별 (weekly limit, rate limit, context limit)
  - Weekly limit reset 시간 파싱 ("resets Oct 9 at 10:30am")
  - 대기 시간 계산 및 sleep
  - "계속" 텍스트 전송으로 재개
  - 재시도 횟수 관리 (최대 3회)
- acceptance:
  - reset 시간 정확히 파싱
  - 자동 재개 후 busy 상태 전환
  - 최대 재시도 초과 시 error 상태

#### 기술 스펙 (TRD)
- tech-spec:
  - datetime 파싱 (AM/PM, 월 이름)
  - 설정: recovery.resumeText, recovery.defaultWaitTime
- api-spec:
  - extract_reset_time(output) -> datetime | None
  - handle_paused_worker(worker) -> None

---

### TSK-02-02: TUI 메인 화면
- category: development
- domain: frontend
- status: done [xx]
- priority: high
- assignee: -
- schedule: 2026-01-04 ~ 2026-01-06
- tags: textual, tui, ui
- depends: TSK-01-04

#### PRD 요구사항
- prd-ref: PRD 9.1 스케줄러 시작, TRD Textual 위젯 매핑
- requirements:
  - 헤더: 프로젝트명, Worker 수, 큐 크기, 모드 표시
  - 스케줄 큐 테이블 (DataTable)
  - Worker 상태 패널 (Static/RichLog)
  - 진행률 표시 (ProgressBar)
  - 상태바 (Footer) - F-key 바인딩 표시
- acceptance:
  - 실시간 큐/Worker 상태 갱신
  - 모드별 색상 표시 (design 청색, quick 녹색 등)
  - 반응형 레이아웃

#### 기술 스펙 (TRD)
- tech-spec:
  - Textual App, DataTable, Static, Footer, ProgressBar
  - Textual CSS (.tcss) 스타일링
  - workflows.json 상태 색상 연동
- ui-spec:
  - 레이아웃: Header / (Queue | Workers) / Footer
  - 테마: dark 기본

---

### TSK-02-03: TUI 인터랙티브 기능
- category: development
- domain: frontend
- status: done [xx]
- priority: medium
- assignee: -
- schedule: 2026-01-06 ~ 2026-01-08
- tags: textual, keybinding, interactive
- depends: TSK-02-02

#### PRD 요구사항
- prd-ref: PRD 3.7 인터랙티브 명령어 시스템
- requirements:
  - Function Key 바인딩 (F1~F10, Shift+F1~F3)
  - 명령어 입력: start, stop, pause, resume, status, queue 등
  - 인터랙티브 Task 선택 UI (↑/↓ 이동, Enter 액션)
  - 큐 조정: up, top, skip, retry
  - 모드 전환 (F7)
- acceptance:
  - 모든 Function Key 동작
  - 명령어 입력 → 즉시 실행
  - Task 선택 UI 정상 동작

#### 기술 스펙 (TRD)
- tech-spec:
  - Textual key bindings (@on 데코레이터)
  - Input 위젯 (명령어 입력)
  - OptionList (액션 메뉴)
- api-spec:
  - CommandHandler.process_command(cmd) -> None
  - interactive_queue() -> None

---

### TSK-02-04: CLI 및 설정 관리
- category: development
- domain: backend
- status: done [xx]
- priority: medium
- assignee: -
- schedule: 2026-01-04 ~ 2026-01-05
- tags: cli, argparse, config
- depends: TSK-01-04

#### PRD 요구사항
- prd-ref: PRD 5 설정, PRD 6 CLI
- requirements:
  - orchay.json 설정 파일 로드
  - CLI 옵션: -w workers, -i interval, -c category, --dry-run
  - 우선순위: CLI > 설정파일 > 기본값
  - 히스토리 조회: orchay history [ID]
- acceptance:
  - 설정 파일 정상 로드
  - CLI 옵션 오버라이드 동작
  - --dry-run 시 분배 없이 큐만 표시

#### 기술 스펙 (TRD)
- tech-spec:
  - argparse 또는 click
  - Pydantic 설정 검증
  - JSON Lines 히스토리 파일
- api-spec:
  - load_config() -> Config
  - parse_args() -> Namespace
  - list_history(limit) -> list[dict]

---

### TSK-02-05: 테스트 및 문서화
- category: development
- domain: test
- status: done [xx]
- priority: medium
- assignee: -
- schedule: 2026-01-08 ~ 2026-01-10
- tags: pytest, docs, testing
- depends: TSK-02-01, TSK-02-02, TSK-02-03, TSK-02-04

#### PRD 요구사항
- prd-ref: TRD 테스트 전략
- requirements:
  - 단위 테스트: 파서, 스케줄러, Worker 감지
  - 통합 테스트: 주요 플로우
  - TUI 테스트: textual.testing
  - README.md 작성
- acceptance:
  - 테스트 커버리지 80% 이상
  - 모든 테스트 통과
  - README 설치/사용법 포함

#### 기술 스펙 (TRD)
- tech-spec:
  - pytest, pytest-asyncio, pytest-textual-snapshot
  - Google 스타일 독스트링
- api-spec:
  - tests/test_wbs_parser.py
  - tests/test_scheduler.py
  - tests/conftest.py (fixtures)

---

### TSK-02-06: 워커 단위 Pause/Resume 및 스케줄러 상태 표시
- category: development
- domain: frontend
- status: done [xx]
- priority: medium
- assignee: -
- schedule: 2025-12-28 ~ 2025-12-28
- tags: tui, worker-control, scheduler-state
- depends: TSK-02-03

#### PRD 요구사항
- prd-ref: PRD 3.10 스케줄러 상태 및 워커 제어
- requirements:
  - SchedulerState 열거형 (running, paused, stopped)
  - TUI 헤더에 스케줄러 상태 아이콘(▶/⏸/⏹) 표시
  - 워커 단위 수동 일시정지/재개 (is_manually_paused 필드)
  - TUI에서 F4 또는 1~5 키로 워커 선택, P 키로 pause/resume
  - 상태 파일 확장: pausedWorkers, schedulerState 필드
- acceptance:
  - 스케줄러 상태가 TUI 헤더에 실시간 표시
  - 워커 수동 일시정지 시 Task 분배 안 됨
  - 파일에 상태 영속화 (orchay-active.json)

#### 기술 스펙 (TRD)
- tech-spec:
  - Textual Static 위젯 (SchedulerStateIndicator)
  - WorkerPanel 인터랙티브 선택 기능
  - active_tasks.py 확장 (pausedWorkers, schedulerState)
- api-spec:
  - SchedulerState (Enum): running, paused, stopped
  - Worker.is_manually_paused (bool): 수동 일시정지 상태
  - Worker.pause() / Worker.resume(): 일시정지/재개 메서드
  - pause_worker(id) / resume_worker(id): 파일 저장 함수

---

## 요약

| 단계 | Task 수 | 개발 방식 | 예상 기간 |
|------|---------|----------|----------|
| WP-01 (부트스트랩) | 4개 | 수동 순차 | 7일 |
| WP-02 (고급 기능) | 6개 | orchay 자동 병렬 | 7일 |
| **총합** | **10개** | - | **14일** |

### 의존성 그래프

```
TSK-01-01 (초기화)
    │
    ▼
TSK-01-02 (파서)
    │
    ▼
TSK-01-03 (스케줄러)
    │
    ▼
TSK-01-04 (Worker/WezTerm)  ← 여기까지 완료 = orchay 동작!
    │
    ├──────┬──────┬──────┐
    ▼      ▼      ▼      ▼
TSK-02-01 TSK-02-02 TSK-02-04  (병렬)
(자동재개) (TUI메인) (CLI)
              │
              ▼
          TSK-02-03
          (TUI인터랙티브)
              │
    ┌─────────┴─────────┐
    ▼                   ▼
         TSK-02-05
         (테스트/문서)
```
