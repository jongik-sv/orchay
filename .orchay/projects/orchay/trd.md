# orchay - 기술 요구사항 정의서 (TRD)

## 문서 정보

| 항목 | 내용 |
|------|------|
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-28 |
| PRD 버전 | 1.8 |
| 상태 | Draft |

---

## 기술 스택 결정

### 핵심 기술 스택

| 계층 | 기술 | 버전 | 선정 근거 | 대안 검토 |
|-----|------|------|----------|----------|
| 언어 | Python | >=3.10 | PRD 명시, Textual 최적 호환 | - |
| TUI 프레임워크 | Textual | ^1.0 | 현대적 TUI, CSS 스타일링, 풍부한 위젯, asyncio 기반 | curses (저수준), Urwid (구식) |
| 터미널 포맷팅 | Rich | ^14.0 | Textual 의존성, 테이블/진행바/마크다운 렌더링 | - |
| 파일 모니터링 | watchdog | ^4.0 | 크로스플랫폼 파일 시스템 이벤트 감지 | polling (비효율적) |
| 데이터 검증 | Pydantic | ^2.0 | 설정 파일 스키마 검증, 타입 안전성 | dataclasses (기능 제한) |
| Markdown 파서 | markdown-it-py | ^3.0 | GFM 호환, 플러그인 확장성, VS Code와 동일 파서 | Python-Markdown (확장성 제한) |
| 코드 하이라이팅 | Pygments | ^2.17 | 598개 언어 지원, 다양한 테마 | highlight.js (클라이언트 전용) |

### UI/스타일링 스택

| 구분 | 기술 | 버전 | 선정 근거 |
|-----|------|------|----------|
| TUI 스타일링 | Textual CSS | 내장 | CSS-like 문법, 테마 지원, 반응형 |
| 컬러 시스템 | Rich Colors | 내장 | 16.7M 트루컬러, 터미널 호환성 자동 조정 |
| 아이콘 | Unicode/Emoji | - | 터미널 호환성, 외부 의존성 없음 |

### 디자인 시스템

| 항목 | 설정 | 설명 |
|-----|------|------|
| 기본 테마 | dark | 터미널 환경 최적화 |
| 컬러 팔레트 | workflows.json 연동 | 상태별 색상 (예: #3b82f6 설계, #22c55e 완료) |
| 컴포넌트 우선순위 | **Textual 위젯 > Custom** | 내장 위젯 최우선 사용 |
| 키 바인딩 | PRD 3.7절 준수 | F1~F10, Shift+F1~F3 |

#### 디자인 시스템 가이드라인 (AI 코딩 시 필수 준수)

- **컴포넌트 사용 원칙**: Textual 내장 위젯을 최우선 사용
- **커스텀 스타일링 금지**: 내장 위젯으로 해결 가능한 경우 직접 스타일링 금지
- **테마 일관성**: 프로젝트 전체에 동일한 테마 시스템 적용
- **workflows.json 연동**: 상태 색상, 아이콘은 workflows.json에서 참조

---

## 인프라 및 운영 스택

| 구성요소 | 기술 | 선정 근거 |
|---------|------|----------|
| 패키지 관리 | pyproject.toml + uv | PEP 621 표준, 빠른 의존성 해결 |
| 가상환경 | uv venv | 속도, 호환성 |
| 린터/포매터 | Ruff | All-in-one, 빠른 속도 |
| 타입 체커 | Pyright | 엄격한 타입 검사 |
| 테스트 | pytest | 표준 테스트 프레임워크 |

### 배포 구조

```
orchay_flutter/                    # 프로젝트 루트
├── orchay/                        # orchay 개발 폴더
│   ├── pyproject.toml             # 패키지 설정
│   ├── README.md                  # 프로젝트 문서
│   ├── src/
│   │   └── orchay/                # Python 패키지
│   │       ├── __init__.py
│   │       ├── __main__.py        # 진입점
│   │       ├── main.py            # 메인 앱
│   │       ├── scheduler.py       # 스케줄러 로직
│   │       ├── worker.py          # 워커 관리
│   │       ├── wbs_parser.py      # wbs.md 파서
│   │       ├── ui/                # TUI 컴포넌트
│   │       │   ├── __init__.py
│   │       │   ├── app.py         # Textual App
│   │       │   ├── widgets.py     # 커스텀 위젯
│   │       │   └── styles.tcss    # Textual CSS
│   │       ├── web/               # 웹 서버 컴포넌트
│   │       │   ├── __init__.py
│   │       │   ├── server.py      # FastAPI 앱
│   │       │   ├── markdown_renderer.py  # MD→HTML 렌더링
│   │       │   ├── static/        # 정적 파일
│   │       │   │   └── markdown.css  # Markdown 스타일
│   │       │   └── templates/     # Jinja2 템플릿
│   │       ├── models/            # Pydantic 모델
│   │       │   ├── __init__.py
│   │       │   ├── config.py      # 설정 모델
│   │       │   ├── task.py        # Task 모델
│   │       │   └── worker.py      # Worker 모델
│   │       └── utils/             # 유틸리티
│   │           ├── __init__.py
│   │           ├── wezterm.py     # WezTerm CLI 래퍼
│   │           └── history.py     # 히스토리 관리
│   └── tests/                     # 테스트
│       ├── __init__.py
│       ├── conftest.py
│       ├── test_scheduler.py
│       └── test_wbs_parser.py
└── .orchay/
    ├── settings/
    │   └── orchay.json            # 설정 파일
    └── logs/
        └── orchay-history.jsonl   # 작업 히스토리
```

### 실행 방법

**개발 모드 (editable install)**
```bash
cd orchay
uv venv
uv pip install -e ".[dev]"
python -m orchay
```

**직접 실행**
```bash
cd orchay
uv run python -m orchay
```

**설치 후 실행**
```bash
cd orchay
uv pip install .
orchay
```

---

## 기술 선택 근거

### 주요 기술 결정 사항

| 결정 항목 | 선택 | 이유 | 트레이드오프 |
|----------|------|------|-------------|
| TUI 라이브러리 | Textual | 현대적 API, CSS 스타일링, 활발한 개발, 웹 브라우저 실행 가능 | 외부 의존성 추가 |
| 파일 감시 | watchdog | 효율적 이벤트 기반, 크로스플랫폼 | polling 대비 복잡도 증가 |
| 비동기 | asyncio | Textual 네이티브, WezTerm CLI 호출 효율 | 동기 코드 대비 복잡도 |
| 설정 검증 | Pydantic | 스키마 기반 검증, 자동 타입 변환, JSON 직렬화 | 의존성 추가 |

### 기술 호환성 검증

| 조합 | 호환성 | 검증 방법 |
|-----|--------|----------|
| Textual + Rich | ✅ 완전 호환 | Textual이 Rich 기반으로 구축됨 |
| Textual + asyncio | ✅ 완전 호환 | Textual 네이티브 지원 |
| watchdog + asyncio | ✅ 호환 | watchdog.observers.polling 또는 asyncio 래퍼 |
| Python 3.10 + Textual | ✅ 완전 호환 | Textual 최소 요구사항 충족 |
| Pydantic v2 + Python 3.10 | ✅ 완전 호환 | Pydantic v2 최소 요구사항 충족 |

---

## 품질 요구사항

### 성능 목표

| 지표 | 목표값 | 측정 기준 |
|-----|--------|----------|
| 시작 시간 | <2초 | 초기 로드 완료까지 |
| 상태 감지 간격 | 5초 (설정 가능) | Worker pane 폴링 주기 |
| 메모리 사용량 | <100MB | Worker 3개 기준 |
| CPU 사용량 | <5% (idle) | 모니터링 상태 |
| UI 응답성 | <100ms | 키 입력 → 화면 갱신 |

### 보안 요구사항

- [ ] 설정 파일 권한 검증 (Unix: 600)
- [ ] 히스토리 파일 민감 정보 제외
- [ ] WezTerm CLI 명령어 인젝션 방지 (shlex.quote 사용)
- [ ] 외부 입력 검증 (Pydantic 활용)

### 테스트 전략

| 유형 | 커버리지 목표 | 도구 |
|-----|-------------|------|
| 단위 테스트 | 80% | pytest |
| 통합 테스트 | 주요 플로우 | pytest + pytest-asyncio |
| TUI 테스트 | 핵심 위젯 | textual.testing |
| 스냅샷 테스트 | UI 레이아웃 | pytest-textual-snapshot |

---

## AI 코딩 가이드라인

### 권장 사항

- Textual 내장 위젯 우선 사용 (Button, DataTable, Input, ListView, Static, Label 등)
- Textual CSS (`.tcss`)로 스타일링 (인라인 스타일 지양)
- asyncio 패턴 준수 (async/await, asyncio.create_task)
- Pydantic 모델로 설정/데이터 검증
- workflows.json 상태/색상 연동
- Type hints 필수 (Pyright strict 모드)
- 독스트링 작성 (Google 스타일)

### 금지 사항

- Raw curses 직접 사용 금지 (Textual 사용)
- 동기 블로킹 I/O 금지 (asyncio 사용)
- 하드코딩된 색상/상태 금지 (workflows.json 참조)
- print() 직접 사용 금지 (Rich/Textual 사용)
- subprocess.run() 블로킹 금지 (asyncio.create_subprocess_exec 사용)
- Global mutable state 금지 (의존성 주입 사용)

### 코드 스타일

```python
# Good: asyncio + Textual 패턴
async def dispatch_task(worker: Worker, task: Task) -> None:
    """Task를 Worker에 분배합니다."""
    await self.send_to_pane(worker.pane_id, f"/clear\r")
    await asyncio.sleep(2)
    await self.send_to_pane(worker.pane_id, f"/wf:start {task.id}\r")

# Bad: 동기 블로킹
def dispatch_task(worker: Worker, task: Task) -> None:
    subprocess.run(["wezterm", "cli", "send-text", ...])  # 블로킹!
    time.sleep(2)  # 블로킹!
```

---

## 의존성 목록

### pyproject.toml

```toml
[project]
name = "orchay"
version = "0.1.0"
description = "WezTerm 기반 Task 스케줄러"
readme = "README.md"
requires-python = ">=3.10"
dependencies = [
    "textual>=1.0",
    "rich>=14.0",
    "watchdog>=4.0",
    "pydantic>=2.0",
    "fastapi>=0.115",
    "uvicorn[standard]",
    "jinja2>=3.0",
    "markdown-it-py[plugins,linkify]>=3.0",
    "pygments>=2.17",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "pytest-textual-snapshot>=1.0",
    "ruff>=0.5",
    "pyright>=1.1",
]

[project.scripts]
orchay = "orchay.main:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/orchay"]

[tool.ruff]
line-length = 100
target-version = "py310"
src = ["src", "tests"]

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP", "ANN", "B", "C4", "SIM"]

[tool.pyright]
pythonVersion = "3.10"
pythonPlatform = "All"
typeCheckingMode = "strict"
venvPath = "."
venv = ".venv"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

---

## Textual 위젯 매핑

PRD에서 정의한 UI 요소를 Textual 위젯으로 매핑합니다.

| PRD UI 요소 | Textual 위젯 | 용도 |
|------------|-------------|------|
| 스케줄 큐 테이블 | DataTable | Task 목록 표시 |
| Worker 상태 패널 | Static / RichLog | Worker 출력 표시 |
| 명령어 입력 | Input | 인터랙티브 명령어 |
| 상태바 | Footer | F-key 바인딩, 모드 표시 |
| 헤더 | Header | 프로젝트명, 통계 |
| 진행률 | ProgressBar | 전체 작업 진행률 |
| 모드 표시 | Static (색상) | design/quick/develop/force |
| 액션 메뉴 | OptionList | Task 액션 선택 |

---

## workflows.json 연동

### 상태 색상 매핑

```python
from pydantic import BaseModel

class StateConfig(BaseModel):
    id: str
    label: str
    color: str  # hex color
    icon: str

# workflows.json에서 로드
states = {
    "[ ]": StateConfig(id="todo", label="시작 전", color="#6b7280", icon="pi-inbox"),
    "[dd]": StateConfig(id="detail-design", label="상세설계", color="#8b5cf6", icon="pi-file-edit"),
    # ...
}
```

### 실행 모드 연동

```python
class ExecutionMode(BaseModel):
    label: str
    description: str
    workflow_scope: Literal["design-only", "transitions-only", "full"]
    dependency_check: Literal["ignore", "check-implemented"]
    color: str

# workflows.json executionModes 섹션 활용
```

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-28 | 초기 TRD 작성 |
| 1.1 | 2025-12-28 | 배포 구조 수정: 프로젝트 루트에 `orchay/` 폴더 생성, src 레이아웃 적용 |
| 1.2 | 2025-12-28 | Markdown 렌더링 고도화 |
|     |            | - 기술 스택 추가: markdown-it-py (GFM 파서), Pygments (코드 하이라이팅) |
|     |            | - 배포 구조: web/markdown_renderer.py, static/markdown.css 추가 |
|     |            | - 의존성: markdown-it-py[plugins,linkify]>=3.0, pygments>=2.17 추가 |
