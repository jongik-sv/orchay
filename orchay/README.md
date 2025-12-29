# orchay

> **orch**estration + ok**ay** - WezTerm 기반 Task 스케줄러

wbs.md를 모니터링하여 실행 가능한 Task를 추출하고, 여러 Claude Code Worker pane에 작업을 자동 분배합니다.

## 설치

### 사전 요구사항

orchay는 다음 도구들이 필요합니다:

| 도구 | 용도 | 필수 |
|------|------|------|
| Python 3.10+ | orchay 실행 | O |
| WezTerm | 멀티 pane 터미널 | O |
| Claude Code | AI Worker | O |
| uv | Python 패키지 관리 | O |

### Windows

```powershell
# 1. WezTerm 설치
winget install wez.wezterm

# 2. Claude Code 설치 (Native)
irm https://claude.ai/install.ps1 | iex

# 3. uv 설치
irm https://astral.sh/uv/install.ps1 | iex

# 4. 새 터미널 열고 orchay 실행
cd {프로젝트 폴더}
python orchay/launcher.py project_name
```

### Linux (Ubuntu/Debian)

```bash
# 1. WezTerm 설치
curl -fsSL https://apt.fury.io/wez/gpg.key | sudo gpg --yes --dearmor -o /usr/share/keyrings/wezterm-fury.gpg
echo 'deb [signed-by=/usr/share/keyrings/wezterm-fury.gpg] https://apt.fury.io/wez/ * *' | sudo tee /etc/apt/sources.list.d/wezterm.list
sudo apt update && sudo apt install wezterm

# 2. Claude Code 설치 (Native)
curl -fsSL https://claude.ai/install.sh | bash
source ~/.bashrc  # 또는 source ~/.zshrc

# 3. uv 설치
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.local/bin/env

# 4. orchay 실행
cd {프로젝트 폴더}
python orchay/launcher.py project_name
```

### macOS

```bash
# 1. WezTerm 설치
brew install --cask wezterm

# 2. Claude Code 설치 (Native)
curl -fsSL https://claude.ai/install.sh | bash
source ~/.zshrc

# 3. uv 설치
curl -LsSf https://astral.sh/uv/install.sh | sh

# 4. orchay 실행
cd {프로젝트 폴더}
python orchay/launcher.py project_name
```

### 의존성 자동 체크

launcher.py는 시작 시 모든 의존성을 자동으로 체크합니다. 누락된 도구가 있으면 플랫폼별 설치 명령을 안내합니다.

## 실행

### 방법 1: launcher.py 사용 (권장)

**launcher.py**는 WezTerm을 자동으로 구성하고 orchay를 실행합니다:
- 스케줄러 pane (좌측)
- Worker panes (우측, Claude Code 인스턴스들)

```bash
cd {프로젝트 루트}  # .orchay 폴더가 있는 위치
python orchay/launcher.py [ORCHAY_OPTIONS] [LAUNCHER_OPTIONS]
```

**옵션 구분:**

| 구분 | 옵션 | 용도 |
|------|------|------|
| **orchay 옵션** | 모든 표준 옵션 | orchay에 그대로 전달됨 |
| **launcher 전용** | `--scheduler-cols`, `--worker-cols`, `--font-size` | WezTerm 레이아웃 설정 |

**예시:**

```bash
# 기본 실행 (orchay 프로젝트, Worker 3개, 웹서버 포함)
python orchay/launcher.py

# 다른 프로젝트 실행
python orchay/launcher.py my_project

# Worker 5개로 실행
python orchay/launcher.py my_project -w 5

# 웹서버 포함 (포트 9000)
python orchay/launcher.py my_project -w 3 --web --port 9000

# 폰트 크기와 레이아웃 조정 (launcher 전용 옵션)
python orchay/launcher.py my_project --font-size 9 --scheduler-cols 80 --worker-cols 100

# 조합 사용
python orchay/launcher.py my_project -w 5 -m quick --web --font-size 10
```

**launcher 전용 옵션:**

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--scheduler-cols N` | 100 | 스케줄러 pane 너비 (columns) |
| `--worker-cols N` | 120 | 각 Worker pane 너비 (columns) |
| `--font-size F` | 11.0 | WezTerm 폰트 크기 (pt) |

**내부 동작:**

```
launcher.py
    │
    ├─ 1. 의존성 체크 (wezterm, claude, uv)
    ├─ 2. 기존 WezTerm 프로세스 종료
    ├─ 3. WezTerm 실행
    └─ 4. WezTerm CLI로 레이아웃 생성
          │
          ├─ 왼쪽: 스케줄러 pane (orchay 실행)
          └─ 오른쪽: Worker panes (Claude Code 실행)
```

**레이아웃:**

```
+------------+-----------+
|            |  Worker 1 |
| Scheduler  +-----------+
|    (0)     |  Worker 2 |
|            +-----------+
|            |  Worker 3 |
+------------+-----------+
```

---

### 방법 2: 직접 실행 (수동 pane 관리)

WezTerm pane을 직접 구성한 경우:

```bash
# uv 사용 (권장)
cd {프로젝트 루트}  # .orchay 폴더가 있는 위치
uv run --project orchay python -m orchay [PROJECT] [OPTIONS]

# 또는 venv 활성화 후
cd orchay
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # Linux/Mac
cd ..  # 프로젝트 루트로 이동
python -m orchay [PROJECT] [OPTIONS]
```

### CLI 옵션

```
usage: orchay [-h] [-w WORKERS] [-i INTERVAL]
              [-m {design,quick,develop,force}] [--dry-run] [-v] [--no-tui]
              [--web | --web-only] [--port PORT]
              [project]

positional arguments:
  project               프로젝트명 (.orchay/projects/{project}/ 사용, 기본: orchay)

options:
  -w, --workers N       Worker 수 (기본: 3)
  -i, --interval SEC    모니터링 간격 초 (기본: 5)
  -m, --mode MODE       실행 모드: design, quick, develop, force (기본: quick)
  --dry-run             분배 없이 상태만 표시
  -v, --verbose         상세 로그 출력
  --no-tui              TUI 없이 CLI 모드로 실행

웹서버 옵션:
  --web                 웹서버 포함 실행 (TUI/CLI + 웹 동시)
  --web-only            웹서버만 실행 (스케줄링 비활성화)
  --port PORT           웹서버 포트 (기본: 8080)
```

> **Note:** 기본적으로 TUI(Textual UI) 모드로 실행됩니다. CLI 모드가 필요하면 `--no-tui` 옵션을 사용하세요.

### 사용 예시

```bash
# TUI 모드로 실행 (기본)
uv run python -m orchay orchay

# dry-run 모드 (분배 없이 상태만 표시)
uv run python -m orchay orchay --dry-run

# CLI 모드로 실행 (TUI 없이)
uv run python -m orchay orchay --no-tui

# orchay-flutter 프로젝트 실행
uv run python -m orchay orchay-flutter

# develop 모드로 실행
uv run python -m orchay orchay -m develop

# 5개 Worker로 실행
uv run python -m orchay orchay -w 5

# 모니터링 간격 10초
uv run python -m orchay orchay -i 10
```

### 실행 화면

```
orchay - Task Scheduler v0.1.0

WBS: C:\project\wbs.md
Mode: quick
Workers: 3개
Tasks: 9개

스케줄러 시작 (Ctrl+C로 종료)

                    Worker Status
┌──────┬────────┬────────────┬──────────────────────┐
│ ID   │ Pane   │ State      │ Task                 │
├──────┼────────┼────────────┼──────────────────────┤
│ 1    │ 0      │ busy       │ TSK-02-01            │
│ 2    │ 2      │ idle       │ -                    │
│ 3    │ 1      │ idle       │ -                    │
└──────┴────────┴────────────┴──────────────────────┘

Queue: 5 pending, 1 running, 3 done
```

---

## Web UI

orchay에 내장된 웹서버를 통해 브라우저에서 WBS 진행 상황을 모니터링할 수 있습니다.

### 시작하기

```bash
# 스케줄러 + 웹서버 동시 실행
uv run python -m orchay orchay --web

# 웹서버만 실행 (스케줄링 없음, WezTerm 불필요)
uv run python -m orchay orchay --web-only

# 포트 지정 (기본: 8080)
uv run python -m orchay orchay --web --port 3000

# launcher.py와 함께 사용
python orchay/launcher.py my_project --web --port 9000
```

웹서버 시작 후 http://localhost:8080 (또는 지정한 포트)로 접속합니다.

### 웹서버 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--web` | 스케줄러 + 웹서버 동시 실행 | 비활성화 |
| `--web-only` | 웹서버만 실행 (스케줄링 없음) | - |
| `--port PORT` | 웹서버 포트 번호 | 8080 |

> **Note:** `--web`과 `--web-only`는 상호 배타적 옵션입니다.

### 웹 UI 기능

- **WBS 트리**: 계층적 Task 구조 표시 (WP → ACT → Task)
- **Task 상세**: 선택한 Task의 상세 정보 확인
- **Worker 상태**: 각 Worker의 현재 상태 및 작업 표시
- **실시간 갱신**: 5초마다 자동으로 상태 업데이트

### 사용 시나리오

**시나리오 1: 원격 모니터링**
```bash
# 서버에서 웹서버만 실행
uv run python -m orchay orchay --web-only --port 8080

# 브라우저에서 http://server-ip:8080 접속
```

**시나리오 2: 로컬 개발 + 웹 모니터링**
```bash
# TUI + 웹서버 동시 실행
python orchay/launcher.py orchay --web

# 터미널에서는 TUI로, 브라우저에서는 웹 UI로 모니터링
```

---

## 아키텍처

```
orchay/
├── src/orchay/
│   ├── main.py          # 진입점
│   ├── scheduler.py     # 스케줄러 코어 (Task 필터링, 분배 로직)
│   ├── wbs_parser.py    # WBS 파일 파싱 및 감시
│   ├── worker.py        # Worker 상태 감지
│   ├── models/
│   │   ├── task.py      # Task 모델
│   │   ├── worker.py    # Worker 모델
│   │   └── config.py    # 설정 모델
│   ├── utils/
│   │   └── wezterm.py   # WezTerm CLI 래퍼
│   └── web/             # 웹서버 모듈
│       ├── server.py    # FastAPI 앱, 라우트 정의
│       ├── static/      # 정적 파일 (CSS, JS)
│       └── templates/   # Jinja2 템플릿
│           ├── base.html    # 기본 레이아웃
│           ├── index.html   # 메인 페이지
│           └── partials/    # HTMX 파셜 템플릿
│               ├── tree.html    # WBS 트리
│               ├── detail.html  # Task 상세
│               └── workers.html # Worker 상태
└── tests/               # 테스트 코드
```

## 핵심 기능

### 1. WBS 파싱 (`wbs_parser.py`)

wbs.md 파일을 파싱하여 Task 객체 리스트로 변환합니다.

```python
from orchay.wbs_parser import parse_wbs, watch_wbs

# 단일 파싱
tasks = await parse_wbs(".orchay/projects/orchay/wbs.md")
for task in tasks:
    print(f"{task.id}: {task.status}")

# 파일 변경 감시
async def on_change(tasks):
    print(f"Tasks updated: {len(tasks)}")

watcher = watch_wbs("wbs.md", on_change, debounce=0.5)
watcher.start()
# ... 작업 ...
await watcher.stop()
```

**WBS 파일 형식:**

```markdown
### TSK-01-01: Task 제목
- category: development
- domain: backend
- status: todo [ ]
- priority: high
- assignee: -
- schedule:
- tags: api, auth
- depends: TSK-01-00
- blocked-by: -
```

### 2. Task 모델 (`models/task.py`)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | Task ID (예: TSK-01-01) |
| title | string | Task 제목 |
| category | enum | development, defect, infrastructure, simple-dev |
| domain | string | 기술 도메인 (backend, frontend 등) |
| status | enum | 현재 상태 (아래 표 참조) |
| priority | enum | critical, high, medium, low |
| depends | list | 의존 Task ID 목록 |
| blocked_by | string? | 블로킹 사유 |

**Task 상태 (status):**

| 코드 | 의미 | 설명 |
|------|------|------|
| `[ ]` | TODO | 미시작 |
| `[bd]` | BASIC_DESIGN | 기본 설계 |
| `[dd]` | DETAIL_DESIGN | 상세 설계 |
| `[an]` | ANALYSIS | 분석 |
| `[ds]` | DESIGN | 설계 완료 |
| `[ap]` | APPROVED | 승인됨 |
| `[im]` | IMPLEMENT | 구현됨 |
| `[fx]` | FIX | 수정 중 |
| `[vf]` | VERIFY | 검증 중 |
| `[xx]` | DONE | 완료 |

### 3. 실행 모드 (`scheduler.py`)

| 모드 | 워크플로우 단계 | 설명 |
|------|-----------------|------|
| **design** | start | 설계만 수행 |
| **quick** | start → approve → build → done | 빠른 구현 |
| **develop** | start → review → apply → approve → build → audit → patch → test → done | 전체 워크플로우 |
| **force** | start → approve → build → done | 의존성 무시하고 강제 실행 |

**비즈니스 규칙:**

- BR-01: 완료 Task(`[xx]`)는 항상 제외
- BR-02: `blocked-by` 설정된 Task 제외
- BR-03: 실행 중 Task 중복 분배 금지
- BR-04: design 모드: `[ ]` 상태만 표시
- BR-05: develop/quick: 구현 단계에서 의존성 검사
- BR-06: force 모드: 의존성 무시
- BR-07: 우선순위 정렬: critical > high > medium > low

### 4. Worker 관리 (`worker.py`)

Worker pane의 출력을 분석하여 상태를 감지합니다.

**Worker 상태:**

| 상태 | 우선순위 | 설명 |
|------|----------|------|
| dead | 1 | pane이 존재하지 않음 |
| done | 2 | ORCHAY_DONE 신호 수신 |
| paused | 3 | rate limit, capacity 등 |
| error | 4 | Error, Failed, Exception 등 |
| blocked | 5 | 사용자 입력 대기 중 |
| idle | 6 | 프롬프트 대기 상태 |
| busy | 7 | 작업 실행 중 |

**완료 신호 형식:**

```
ORCHAY_DONE:{task-id}:{action}:{status}[:{message}]

예:
ORCHAY_DONE:TSK-01-01:build:success
ORCHAY_DONE:TSK-01-02:test:error:테스트 실패
```

### 5. WezTerm 통합 (`utils/wezterm.py`)

WezTerm CLI를 통한 pane 관리 기능:

```python
from orchay.utils.wezterm import (
    wezterm_list_panes,
    wezterm_get_text,
    wezterm_send_text,
    pane_exists,
)

# pane 목록 조회
panes = await wezterm_list_panes()
for p in panes:
    print(f"Pane {p.pane_id}: {p.title} @ {p.cwd}")

# pane 출력 조회 (최근 50줄)
text = await wezterm_get_text(pane_id=1, lines=50)

# pane에 텍스트 전송
await wezterm_send_text(pane_id=1, text="/wf:build TSK-01-01\n")

# pane 존재 확인
if await pane_exists(pane_id=1):
    print("Pane 1 exists")
```

## 개발

### 테스트 실행

```bash
# 전체 테스트
pytest

# 특정 모듈 테스트
pytest tests/test_wbs_parser.py
pytest tests/test_scheduler.py
pytest tests/test_worker.py
pytest tests/test_wezterm.py

# 커버리지 포함
pytest --cov=orchay
```

### 린트 및 타입 검사

```bash
# Ruff 린터
ruff check src tests

# Ruff 포매터
ruff format src tests

# Pyright 타입 검사
pyright src tests
```

## 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| textual | >=1.0 | TUI 프레임워크 |
| rich | >=14.0 | 터미널 출력 포매팅 |
| watchdog | >=4.0 | 파일 변경 감시 |
| pydantic | >=2.0 | 데이터 모델 검증 |
| fastapi | >=0.115 | 웹서버 프레임워크 |
| uvicorn[standard] | - | ASGI 서버 |
| jinja2 | >=3.0 | HTML 템플릿 엔진 |

### 개발 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| pytest | >=8.0 | 테스트 프레임워크 |
| pytest-asyncio | >=0.23 | 비동기 테스트 지원 |
| ruff | >=0.5 | 린터/포매터 |
| pyright | >=1.1 | 타입 검사 |

## 라이선스

MIT
