# orchay

> **orch**estration + ok**ay** - WezTerm 기반 Task 스케줄러

wbs.md를 모니터링하여 실행 가능한 Task를 추출하고, 여러 Claude Code Worker pane에 작업을 자동 분배합니다.

## 설치

### 사전 요구사항

orchay는 다음 도구들이 필요합니다:

| 도구 | 용도 | 필수 |
|------|------|------|
| WezTerm | 멀티 pane 터미널 | ✅ |
| Claude Code | AI Worker | ✅ |
| Python 3.10+ | orchay 실행 (pip/pipx 설치 시) | 조건부 |

> **Note:** 실행 파일 다운로드 방식은 Python 설치가 불필요합니다.

---

### 설치 방법

#### 방법 1: 실행 파일 다운로드 (권장)

Python 설치 없이 바로 사용할 수 있습니다.

1. [GitHub Releases](https://github.com/your-username/orchay/releases/latest)에서 플랫폼에 맞는 파일 다운로드:
   - **Linux**: `orchay-linux-x64.tar.gz`
   - **Windows**: `orchay-windows-x64.zip`
   - **macOS**: `orchay-macos-x64.tar.gz`

2. 압축 해제 및 실행:

```bash
# Linux/macOS
tar -xzf orchay-linux-x64.tar.gz  # 또는 orchay-macos-x64.tar.gz
cd orchay
./orchay --help

# Windows (PowerShell)
Expand-Archive orchay-windows-x64.zip -DestinationPath .
cd orchay
.\orchay.exe --help
```

3. (선택) PATH에 추가:

```bash
# Linux/macOS - ~/.bashrc 또는 ~/.zshrc에 추가
export PATH="$PATH:/path/to/orchay"

# Windows - 시스템 환경 변수에 orchay 폴더 경로 추가
```

---

#### 방법 2: pipx 설치 (권장)

격리된 환경에서 설치되어 시스템 Python과 충돌하지 않습니다.

```bash
# pipx 설치 (없는 경우)
pip install pipx
pipx ensurepath

# orchay 설치
pipx install orchay

# 실행
orchay --help
```

---

#### 방법 3: pip 설치

```bash
# 전역 설치
pip install orchay

# 또는 가상환경에서 설치
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install orchay

# 실행
orchay --help
```

---

#### 방법 4: 소스에서 실행 (개발용)

uv를 사용하여 소스 코드에서 직접 실행합니다.

```bash
# uv 설치 (없는 경우)
curl -LsSf https://astral.sh/uv/install.sh | sh  # Linux/macOS
# Windows: irm https://astral.sh/uv/install.ps1 | iex

# 소스 클론 및 실행
git clone https://github.com/your-username/orchay.git
cd orchay
uv run python -m orchay --help
```

---

### 사전 요구사항 설치

#### Windows

```powershell
# 1. WezTerm 설치
winget install wez.wezterm

# 2. Claude Code 설치 (Native)
irm https://claude.ai/install.ps1 | iex

# 새 터미널 열고 orchay 실행
cd {프로젝트 폴더}
orchay project_name
```

#### Linux (Ubuntu/Debian)

```bash
# 1. WezTerm 설치
curl -fsSL https://apt.fury.io/wez/gpg.key | sudo gpg --yes --dearmor -o /usr/share/keyrings/wezterm-fury.gpg
echo 'deb [signed-by=/usr/share/keyrings/wezterm-fury.gpg] https://apt.fury.io/wez/ * *' | sudo tee /etc/apt/sources.list.d/wezterm.list
sudo apt update && sudo apt install wezterm

# 2. Claude Code 설치 (Native)
curl -fsSL https://claude.ai/install.sh | bash
source ~/.bashrc  # 또는 source ~/.zshrc

# orchay 실행
cd {프로젝트 폴더}
orchay project_name
```

#### macOS

```bash
# 1. WezTerm 설치
brew install --cask wezterm

# 2. Claude Code 설치 (Native)
curl -fsSL https://claude.ai/install.sh | bash
source ~/.zshrc

# orchay 실행
cd {프로젝트 폴더}
orchay project_name
```

---

### 의존성 자동 체크

orchay는 시작 시 모든 의존성을 자동으로 체크합니다. 누락된 도구가 있으면 플랫폼별 설치 명령을 안내합니다.

## 실행

### 기본 사용법

orchay 명령은 WezTerm을 자동으로 구성하고 실행합니다:
- 스케줄러 pane (좌측)
- Worker panes (우측, Claude Code 인스턴스들)

```bash
cd {프로젝트 루트}  # .orchay 폴더가 있는 위치
orchay [PROJECT] [OPTIONS]
```

**예시:**

```bash
# 기본 실행 (orchay 프로젝트, Worker 3개)
orchay

# 다른 프로젝트 실행
orchay my_project

# Worker 5개로 실행
orchay my_project -w 5

# 웹서버 포함 (포트 9000)
orchay my_project -w 3 --web --port 9000

# 폰트 크기와 레이아웃 조정
orchay my_project --font-size 9 --scheduler-cols 80 --worker-cols 100

# 조합 사용
orchay my_project -w 5 -m quick --web --font-size 10
```

**레이아웃 옵션:**

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--scheduler-cols N` | 100 | 스케줄러 pane 너비 (columns) |
| `--worker-cols N` | 120 | 각 Worker pane 너비 (columns) |
| `--font-size F` | 11.0 | WezTerm 폰트 크기 (pt) |

**내부 동작:**

```
orchay
  │
  ├─ 1. 의존성 체크 (wezterm, claude)
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

### 직접 실행 (수동 pane 관리)

WezTerm pane을 직접 구성한 경우, 스케줄러만 실행할 수 있습니다:

```bash
# pip/pipx로 설치한 경우
orchay run [PROJECT] [OPTIONS]

# 소스에서 실행 (uv 사용)
cd {프로젝트 루트}
uv run --project orchay python -m orchay [PROJECT] [OPTIONS]
```

### CLI 옵션

```
usage: orchay [-h] [-w WORKERS] [-i INTERVAL]
              [-m {design,quick,develop,force}] [--dry-run] [-v]
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

웹서버 옵션:
  --web                 웹서버 포함 실행 (TUI + 웹 동시)
  --web-only            웹서버만 실행 (스케줄링 비활성화)
  --port PORT           웹서버 포트 (기본: 8080)
```

### 사용 예시

```bash
# TUI 모드로 실행 (기본)
orchay orchay

# dry-run 모드 (분배 없이 상태만 표시)
orchay orchay --dry-run

# orchay-flutter 프로젝트 실행
orchay orchay-flutter

# develop 모드로 실행
orchay orchay -m develop

# 5개 Worker로 실행
orchay orchay -w 5

# 모니터링 간격 10초
orchay orchay -i 10
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
orchay orchay --web

# 웹서버만 실행 (스케줄링 없음, WezTerm 불필요)
orchay orchay --web-only

# 포트 지정 (기본: 8080)
orchay orchay --web --port 3000
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
