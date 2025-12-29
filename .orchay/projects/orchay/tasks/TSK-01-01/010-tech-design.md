# TSK-01-01: 프로젝트 초기화 및 핵심 모델

## 1. 목적

orchay 프로젝트의 기반 구조를 설정하고, 핵심 데이터 모델(Task, Worker, Config)을 Pydantic으로 정의합니다.

## 2. 현재 상태

- orchay 프로젝트 폴더 미존재
- Python 패키지 구조 미생성
- 데이터 모델 미정의

## 3. 목표 상태

```
orchay_flutter/
└── orchay/                        # 프로젝트 루트
    ├── pyproject.toml             # 패키지 설정 (uv 기반)
    ├── README.md                  # 프로젝트 문서
    └── src/
        └── orchay/                # Python 패키지
            ├── __init__.py
            ├── __main__.py        # 진입점
            ├── main.py            # 메인 앱
            └── models/            # Pydantic 모델
                ├── __init__.py
                ├── task.py        # Task 모델
                ├── worker.py      # Worker 모델
                └── config.py      # Config 모델
```

## 4. 구현 계획

### 4.1 pyproject.toml 생성

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
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
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

[tool.pyright]
pythonVersion = "3.10"
typeCheckingMode = "strict"
```

### 4.2 핵심 모델 정의

#### Task 모델 (`models/task.py`)

```python
from enum import Enum
from pydantic import BaseModel

class TaskCategory(str, Enum):
    DEVELOPMENT = "development"
    DEFECT = "defect"
    INFRASTRUCTURE = "infrastructure"

class TaskStatus(str, Enum):
    TODO = "[ ]"
    BASIC_DESIGN = "[bd]"
    DETAIL_DESIGN = "[dd]"
    ANALYSIS = "[an]"
    APPROVED = "[ap]"
    IMPLEMENT = "[im]"
    FIX = "[fx]"
    VERIFY = "[vf]"
    DONE = "[xx]"

class TaskPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class Task(BaseModel):
    id: str                              # TSK-01-01
    title: str                           # Task 제목
    category: TaskCategory
    domain: str                          # backend, frontend, infra 등
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    depends: list[str] = []              # 의존 Task ID 목록
    blocked_by: str | None = None        # 블로킹 사유
    is_running: bool = False             # 현재 실행 중 여부
```

#### Worker 모델 (`models/worker.py`)

```python
from enum import Enum
from datetime import datetime
from pydantic import BaseModel

class WorkerState(str, Enum):
    IDLE = "idle"
    BUSY = "busy"
    PAUSED = "paused"
    ERROR = "error"
    BLOCKED = "blocked"
    DEAD = "dead"

class Worker(BaseModel):
    id: int                              # Worker 번호 (1, 2, 3...)
    pane_id: int                         # WezTerm pane ID
    state: WorkerState = WorkerState.IDLE
    current_task: str | None = None      # 현재 작업 중인 Task ID
    current_step: str | None = None      # 현재 workflow 단계
    dispatch_time: datetime | None = None
    retry_count: int = 0
```

#### Config 모델 (`models/config.py`)

```python
from pydantic import BaseModel

class DetectionConfig(BaseModel):
    done_pattern: str = r"ORCHAY_DONE:([^:]+):(\w+):(success|error)(?::(.+))?"
    prompt_patterns: list[str] = [r"^>\s*$", r"╭─", r"❯"]
    pause_patterns: list[str] = [r"rate.*limit", r"please.*wait"]
    error_patterns: list[str] = [r"Error:", r"Failed:", r"❌"]
    read_lines: int = 50

class RecoveryConfig(BaseModel):
    resume_text: str = "계속"
    default_wait_time: int = 60
    max_retries: int = 3

class DispatchConfig(BaseModel):
    clear_before_dispatch: bool = True
    clear_wait_time: int = 2

class HistoryConfig(BaseModel):
    enabled: bool = True
    storage_path: str = ".orchay/logs/orchay-history.jsonl"
    max_entries: int = 1000

class ExecutionConfig(BaseModel):
    mode: str = "quick"  # design, quick, develop, force
    allow_mode_switch: bool = True

class Config(BaseModel):
    workers: int = 3
    interval: int = 5
    category: str | None = None
    project: str | None = None
    detection: DetectionConfig = DetectionConfig()
    recovery: RecoveryConfig = RecoveryConfig()
    dispatch: DispatchConfig = DispatchConfig()
    history: HistoryConfig = HistoryConfig()
    execution: ExecutionConfig = ExecutionConfig()
```

### 4.3 진입점 설정

#### `__main__.py`

```python
from orchay.main import main

if __name__ == "__main__":
    main()
```

#### `main.py`

```python
def main() -> None:
    """orchay 스케줄러 진입점"""
    print("orchay - Task Scheduler v0.1.0")
    print("Coming soon...")

if __name__ == "__main__":
    main()
```

## 5. 수용 기준

| 항목 | 기준 |
|------|------|
| 패키지 설치 | `uv pip install -e .` 성공 |
| 실행 | `python -m orchay` 실행 가능 |
| 타입 체크 | Pyright strict 모드 통과 |
| 린트 | Ruff 검사 통과 |

## 6. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-28 | 초기 설계 |
