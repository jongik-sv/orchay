# TSK-02-02 - TUI 메인 화면 사용자 매뉴얼

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-02 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-28 |
| 대상 사용자 | 개발자, 프로젝트 관리자 |

---

## 1. 개요

### 1.1 기능 소개

orchay TUI(Terminal User Interface)는 스케줄러의 상태를 실시간으로 모니터링할 수 있는 터미널 기반 대시보드입니다. Textual 프레임워크를 사용하여 현대적인 UI를 제공합니다.

**주요 기능:**
- 스케줄 큐 실시간 표시
- Worker 상태 모니터링
- 전체 진행률 표시
- 실행 모드 표시 및 전환
- Function Key 기반 빠른 조작

### 1.2 대상 사용자

| 사용자 유형 | 역할 | 주요 활용 |
|------------|------|----------|
| 개발자 | Claude Code 기반 병렬 개발 수행 | Worker 상태 및 작업 현황 모니터링 |
| 프로젝트 관리자 | 전체 Task 진행률 관리 | 완료율 및 남은 작업 확인 |

---

## 2. 시작하기

### 2.1 사전 요구사항

| 항목 | 요구사항 |
|------|---------|
| Python | 3.10 이상 |
| 터미널 | 트루컬러 지원 권장 (256색 폴백 지원) |
| 화면 크기 | 최소 80x24 권장 |
| WezTerm | 설치 및 PATH 등록 |

### 2.2 설치

```bash
# orchay 디렉토리로 이동
cd orchay

# 의존성 설치 (uv 사용)
uv pip install -e ".[dev]"
```

### 2.3 접근 방법

```bash
# 프로젝트 루트에서 실행
uv run --project orchay python -m orchay [PROJECT]

# 예시
uv run --project orchay python -m orchay orchay
```

---

## 3. 사용 방법

### 3.1 화면 구성

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  orchay - Task Scheduler                   [MODE: quick]                        ║
║  Project: orchay | Workers: 3 | Queue: 5 | Completed: 4/9                       ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  ┌─────────────────────────────── Schedule Queue ────────────────────────────┐ ║
║  │  #   Task ID       Status   Category      Priority   Title                │ ║
║  │ ─────────────────────────────────────────────────────────────────────────│ ║
║  │  1   TSK-02-01     [ ]      development   high       자동 재개 메커니즘   │ ║
║  │  2   TSK-02-02     [ ]      development   high       TUI 메인 화면        │ ║
║  └───────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                 ║
║  ┌─────────────────────────────── Workers ───────────────────────────────────┐ ║
║  │  Worker 1  ●  busy    TSK-01-04 (build)  진행 중...                       │ ║
║  │  Worker 2  ●  idle    -                   Ready for next task             │ ║
║  │  Worker 3  ●  paused  TSK-02-01 (start)  Rate limit - waiting...          │ ║
║  └───────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                 ║
║  ┌─────────────────────────────── Progress ──────────────────────────────────┐ ║
║  │  Total: ████████████████████░░░░░░░░░░░░░░░░░░░░  44% (4/9 tasks)         │ ║
║  └───────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                 ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  F1:Help  F2:Status  F3:Queue  F4:Workers  F5:Reload  F7:Mode  F9:Pause  F10:Exit║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 3.2 영역별 설명

#### 헤더 영역
- **프로젝트명**: 현재 모니터링 중인 프로젝트
- **Workers**: 활성 Worker pane 수
- **Queue**: 대기 중인 Task 수
- **Completed**: 완료된 Task / 전체 Task
- **MODE**: 현재 실행 모드 (design/quick/develop/force)

#### 스케줄 큐 (Schedule Queue)
대기 중인 Task 목록을 우선순위순으로 표시합니다.

| 컬럼 | 설명 |
|------|------|
| # | 큐 내 순서 |
| Task ID | Task 식별자 |
| Status | 현재 상태 코드 |
| Category | Task 카테고리 |
| Priority | 우선순위 (critical > high > medium > low) |
| Title | Task 제목 |

#### Worker 패널 (Workers)
각 Worker의 현재 상태를 표시합니다.

| 상태 | 아이콘 | 색상 | 설명 |
|------|--------|------|------|
| idle | ● | 녹색 | 대기 중, 다음 Task 할당 가능 |
| busy | ◐ | 청색 | 작업 실행 중 |
| paused | ⏸ | 황색 | 일시 중지 (Rate limit 등) |
| error | ✗ | 적색 | 에러 발생 |
| blocked | ⊘ | 보라색 | 입력 대기 중 |
| dead | ○ | 회색 | pane 종료됨 |
| done | ✓ | 에메랄드 | 작업 완료 |

#### 진행률 (Progress)
전체 프로젝트의 완료율을 시각적으로 표시합니다.

### 3.3 키보드 단축키

| 키 | 기능 | 설명 |
|---|------|------|
| F1 | Help | 도움말 표시 |
| F2 | Status | 전체 현황 표시 |
| F3 | Queue | 스케줄 큐 상세 보기 |
| F4 | Workers | Worker 상태 상세 보기 |
| F5 | Reload | wbs.md 새로고침 |
| F7 | Mode | 실행 모드 전환 |
| F9 | Pause | 일시정지/재개 토글 |
| F10 | Exit | 스케줄러 종료 |

### 3.4 실행 모드

| 모드 | 색상 | 워크플로우 | 의존성 체크 |
|------|------|-----------|------------|
| design | 청색 | start만 실행 | 없음 |
| quick | 녹색 | start → approve → build → done | [dd]+ 상태만 |
| develop | 보라색 | 전체 워크플로우 (리뷰 포함) | [dd]+ 상태만 |
| force | 황색 | start → approve → build → done | 무시 |

F7 키를 눌러 모드를 순환 전환할 수 있습니다:
`design → quick → develop → force → design`

---

## 4. FAQ

### Q1. Worker가 모두 busy 상태일 때 새 Task는?
**A:** 스케줄 큐에 대기하며, Worker가 idle 상태가 되면 자동 분배됩니다.

### Q2. Rate limit으로 paused 상태가 되면?
**A:** orchay가 자동으로 reset 시간을 감지하고 대기 후 재개합니다 (TSK-02-01 자동 재개 기능).

### Q3. wbs.md를 수정하면 즉시 반영되나요?
**A:** 예, wbs.md 파일 변경이 감지되면 자동으로 스케줄 큐가 갱신됩니다.

### Q4. 터미널 색상이 이상하게 보입니다.
**A:** 트루컬러 지원 터미널(WezTerm, iTerm2, Windows Terminal 등) 사용을 권장합니다. 256색 터미널에서는 자동 폴백됩니다.

### Q5. 화면이 작아서 잘리는 경우?
**A:** 최소 80x24 크기의 터미널을 사용하세요. 더 넓은 화면(120 컬럼 이상)에서 최적의 경험을 제공합니다.

---

## 5. 문제 해결

### 5.1 일반적인 문제

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| "wbs.md not found" | 잘못된 프로젝트 경로 | 프로젝트 루트에서 실행, 경로 확인 |
| "WezTerm CLI not found" | WezTerm 미설치 | WezTerm 설치 후 PATH 등록 |
| "No worker panes" | Worker pane 없음 | WezTerm에서 pane 생성 |
| Worker가 감지되지 않음 | pane이 다른 탭에 있음 | 동일 탭 내 pane 사용 |
| 색상 미표시 | 터미널 색상 미지원 | 트루컬러 터미널 사용 |

### 5.2 에러 메시지 해석

| 에러 메시지 | 의미 | 조치 |
|------------|------|------|
| "Config error" | orchay.json 파싱 실패 | 설정 파일 JSON 문법 확인 |
| "Parse error in wbs.md" | WBS 문법 오류 | wbs.md 마크다운 문법 확인 |
| "Worker pane lost" | pane이 예기치 않게 종료됨 | pane 재생성 |

### 5.3 로그 확인

```bash
# 상세 로그 모드로 실행
uv run --project orchay python -m orchay orchay --debug

# 로그 파일 확인
cat .orchay/logs/orchay.log
```

---

## 6. 참고 자료

### 6.1 관련 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| PRD | `.orchay/projects/orchay/prd.md` | 프로젝트 요구사항 정의 |
| 설계서 | `.orchay/projects/orchay/tasks/TSK-02-02/010-design.md` | TUI 설계 상세 |
| WBS | `.orchay/projects/orchay/wbs.md` | 작업 분해 구조 |
| README | `orchay/README.md` | 프로젝트 개요 및 CLI 사용법 |

### 6.2 관련 Task

| Task ID | 제목 | 관련 기능 |
|---------|------|----------|
| TSK-02-01 | 자동 재개 메커니즘 | paused 상태 자동 복구 |
| TSK-02-03 | TUI 인터랙티브 기능 | 키보드 상호작용 확장 |
| TSK-02-04 | CLI 및 설정 관리 | 명령줄 옵션 및 설정 파일 |

### 6.3 기술 참고

- [Textual Documentation](https://textual.textualize.io/)
- [Rich Documentation](https://rich.readthedocs.io/)
- [WezTerm CLI](https://wezfurlong.org/wezterm/cli/)

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-12-28 | Claude | 최초 작성 |

---

<!--
orchay 프로젝트 - User Manual
Task: TSK-02-02 TUI 메인 화면
Version: 1.0
-->
