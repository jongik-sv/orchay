# TSK-02-02: Hidden Imports 분석 및 설정 - 통합설계

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-02 |
| 문서 유형 | 통합설계 (Basic + Detail) |
| 작성일 | 2025-12-30 |
| 상태 | Draft |
| PRD 참조 | PRD 4.6 Hidden Imports |

---

## 1. 개요

### 1.1 목적

PyInstaller가 자동으로 감지하지 못하는 동적 import 모듈을 분석하고, `orchay.spec` 파일의 `hiddenimports` 목록을 완성하여 런타임 `ModuleNotFoundError`를 해결한다.

### 1.2 배경

- PyInstaller는 정적 분석으로 import를 감지
- 동적 import (`importlib.import_module`, `__import__`)는 감지 불가
- 런타임에 `ModuleNotFoundError` 발생 가능

### 1.3 범위

| 포함 | 제외 |
|------|------|
| Pydantic 동적 모듈 분석 | spec 파일 기본 구조 (TSK-02-01) |
| Textual 위젯 분석 | 데이터 파일 번들링 (TSK-02-03) |
| Watchdog 플랫폼별 분석 | 빌드 테스트 (TSK-02-04) |
| Rich 포맷터 분석 | |
| collect_submodules 활용 | |

---

## 2. 현재 상태 분석

### 2.1 orchay 의존성 구조

```
orchay/pyproject.toml dependencies:
├── textual>=1.0
├── rich>=14.0
├── watchdog>=4.0
├── pydantic>=2.0
└── PyYAML>=6.0
```

### 2.2 Import 사용 현황

| 파일 | 패키지 | Import 패턴 |
|------|--------|-------------|
| `models/config.py` | pydantic | `from pydantic import BaseModel, Field` |
| `models/task.py` | pydantic | `from pydantic import BaseModel, Field` |
| `models/worker.py` | pydantic | `from pydantic import BaseModel, Field` |
| `ui/app.py` | textual | `from textual.app import App, ComposeResult` |
| `ui/app.py` | textual | `from textual.containers import Container, Horizontal, Vertical, VerticalScroll` |
| `ui/app.py` | textual | `from textual.widgets import DataTable, Footer, Header, Input, RichLog, Static` |
| `ui/widgets.py` | textual | `from textual.containers import VerticalScroll` |
| `ui/widgets.py` | textual | `from textual.widgets import OptionList, Static` |
| `wbs_parser.py` | watchdog | `from watchdog.events import FileSystemEvent, FileSystemEventHandler` |
| `wbs_parser.py` | watchdog | `from watchdog.observers import Observer` |
| `main.py` | rich | `from rich.console import Console` |
| `main.py` | rich | `from rich.table import Table` |
| `cli.py` | rich | `from rich.console import Console, Table` |

### 2.3 TSK-02-01 기본 Hidden Imports

```python
# TSK-02-01에서 설정한 기본 목록
hidden_imports = [
    'pydantic',
    'pydantic.deprecated.decorator',
    'pydantic_core',
    'textual',
    'textual.widgets',
    'rich',
    'rich.console',
    'watchdog',
    'watchdog.observers',
    'watchdog.events',
]
```

---

## 3. 동적 Import 분석

### 3.1 Pydantic 동적 모듈

Pydantic v2는 런타임에 다양한 모듈을 동적으로 로드합니다.

| 모듈 | 이유 | 추가 필요 |
|------|------|----------|
| `pydantic_core` | Rust 바인딩 코어 | ✅ |
| `pydantic.deprecated.decorator` | 데코레이터 호환성 | ✅ |
| `pydantic.v1` | v1 호환 레이어 | ❌ (미사용) |
| `pydantic.fields` | Field 정의 | ✅ |
| `pydantic.functional_validators` | 검증기 | ✅ |
| `pydantic.json_schema` | JSON 스키마 | ✅ |
| `pydantic.dataclasses` | dataclass 지원 | ❌ (미사용) |

### 3.2 Textual 동적 모듈

Textual은 위젯을 동적으로 로드합니다.

| 모듈 | 이유 | 추가 필요 |
|------|------|----------|
| `textual.widgets._data_table` | DataTable 내부 | ✅ |
| `textual.widgets._header` | Header 내부 | ✅ |
| `textual.widgets._footer` | Footer 내부 | ✅ |
| `textual.widgets._input` | Input 내부 | ✅ |
| `textual.widgets._static` | Static 내부 | ✅ |
| `textual.widgets._rich_log` | RichLog 내부 | ✅ |
| `textual.widgets._option_list` | OptionList 내부 | ✅ |
| `textual.css.stylesheet` | CSS 파서 | ✅ |
| `textual.screen` | Screen 관리 | ✅ |
| `textual.driver` | 터미널 드라이버 | ✅ |

### 3.3 Watchdog 플랫폼별 모듈

Watchdog는 플랫폼에 따라 다른 Observer를 사용합니다.

| 모듈 | 플랫폼 | 추가 필요 |
|------|--------|----------|
| `watchdog.observers.inotify` | Linux | ✅ |
| `watchdog.observers.inotify_buffer` | Linux | ✅ |
| `watchdog.observers.fsevents` | macOS | ✅ |
| `watchdog.observers.kqueue` | macOS/BSD | ✅ |
| `watchdog.observers.read_directory_changes` | Windows | ✅ |
| `watchdog.observers.polling` | 폴백 | ✅ |

### 3.4 Rich 동적 모듈

| 모듈 | 이유 | 추가 필요 |
|------|------|----------|
| `rich.table` | 테이블 렌더링 | ✅ |
| `rich.text` | 텍스트 스타일링 | ✅ |
| `rich.panel` | 패널 렌더링 | ✅ |
| `rich.syntax` | 코드 하이라이팅 | ❌ (미사용) |
| `rich.markdown` | 마크다운 렌더링 | ❌ (미사용) |
| `rich.progress` | 프로그레스 바 | ❌ (미사용) |

---

## 4. 상세 설계

### 4.1 완성된 Hidden Imports 목록

```python
hidden_imports = [
    # ===== Pydantic (런타임 검증) =====
    'pydantic',
    'pydantic_core',
    'pydantic_core._pydantic_core',
    'pydantic.deprecated.decorator',
    'pydantic.fields',
    'pydantic.functional_validators',
    'pydantic.json_schema',
    'pydantic.main',
    'pydantic.config',

    # ===== Textual (TUI 프레임워크) =====
    'textual',
    'textual.app',
    'textual.screen',
    'textual.driver',
    'textual.css.stylesheet',
    'textual.containers',
    'textual.message',
    'textual.binding',
    'textual.widgets',
    'textual.widgets._data_table',
    'textual.widgets._header',
    'textual.widgets._footer',
    'textual.widgets._input',
    'textual.widgets._static',
    'textual.widgets._rich_log',
    'textual.widgets._option_list',

    # ===== Rich (콘솔 출력) =====
    'rich',
    'rich.console',
    'rich.table',
    'rich.text',
    'rich.panel',
    'rich.style',
    'rich.theme',

    # ===== Watchdog (파일 감시) =====
    'watchdog',
    'watchdog.events',
    'watchdog.observers',
    'watchdog.observers.polling',
    # Linux
    'watchdog.observers.inotify',
    'watchdog.observers.inotify_buffer',
    # macOS
    'watchdog.observers.fsevents',
    'watchdog.observers.kqueue',
    # Windows
    'watchdog.observers.read_directory_changes',

    # ===== PyYAML =====
    'yaml',
]
```

### 4.2 collect_submodules 활용

spec 파일에서 `collect_submodules`를 사용하여 전체 서브모듈을 자동 수집:

```python
from PyInstaller.utils.hooks import collect_submodules

hidden_imports = []

# Textual 전체 서브모듈 수집 (크기 증가 주의)
hidden_imports += collect_submodules('textual')

# Pydantic 전체 서브모듈 수집
hidden_imports += collect_submodules('pydantic')

# Watchdog observers 수집
hidden_imports += collect_submodules('watchdog.observers')
```

### 4.3 권장 접근 방식

**선택지 비교**:

| 방식 | 장점 | 단점 |
|------|------|------|
| 명시적 목록 | 최소 크기 | 누락 가능성 |
| collect_submodules | 완전성 | 파일 크기 증가 |
| 혼합 | 균형 | 관리 복잡 |

**권장**: 혼합 방식
- Watchdog: `collect_submodules` (플랫폼별 차이)
- Textual/Pydantic: 명시적 목록 (사용하는 것만)

### 4.4 수정된 spec 파일 (hiddenimports 섹션)

```python
# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

# 명시적 히든 임포트
hidden_imports = [
    # Pydantic
    'pydantic',
    'pydantic_core',
    'pydantic_core._pydantic_core',
    'pydantic.deprecated.decorator',
    'pydantic.fields',
    'pydantic.functional_validators',
    'pydantic.json_schema',
    'pydantic.main',
    'pydantic.config',

    # Textual 핵심 모듈
    'textual',
    'textual.app',
    'textual.screen',
    'textual.driver',
    'textual.css.stylesheet',
    'textual.containers',
    'textual.message',
    'textual.binding',
    'textual.widgets',
    'textual.widgets._data_table',
    'textual.widgets._header',
    'textual.widgets._footer',
    'textual.widgets._input',
    'textual.widgets._static',
    'textual.widgets._rich_log',
    'textual.widgets._option_list',

    # Rich
    'rich',
    'rich.console',
    'rich.table',
    'rich.text',
    'rich.panel',
    'rich.style',
    'rich.theme',

    # PyYAML
    'yaml',
]

# Watchdog은 플랫폼별 차이가 크므로 collect_submodules 사용
hidden_imports += collect_submodules('watchdog.observers')
```

---

## 5. 검증 계획

### 5.1 빌드 전 검증

```bash
# import 테스트
python -c "
from pydantic import BaseModel
from textual.app import App
from textual.widgets import DataTable, Header, Footer
from watchdog.observers import Observer
from rich.console import Console
print('All imports OK')
"
```

### 5.2 빌드 후 검증

```bash
# 빌드
cd orchay
pyinstaller orchay.spec

# 실행 테스트
./dist/orchay --help

# import 오류 확인
./dist/orchay 2>&1 | grep -i "ModuleNotFoundError"
```

### 5.3 플랫폼별 검증

| 플랫폼 | 검증 항목 |
|--------|----------|
| Linux | inotify observer 동작 |
| macOS | fsevents observer 동작 |
| Windows | read_directory_changes observer 동작 |

---

## 6. 수용 기준

| ID | 기준 | 검증 방법 |
|----|------|----------|
| AC-01 | 빌드된 실행 파일에서 import 오류 없음 | `./dist/orchay --help` 실행 |
| AC-02 | 모든 Pydantic 모델 정상 동작 | Config, Task, Worker 모델 생성 |
| AC-03 | Textual UI 정상 렌더링 | TUI 화면 표시 |
| AC-04 | Watchdog 파일 감시 동작 | wbs.md 변경 감지 |

---

## 7. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 누락된 hidden import | 런타임 오류 | 오류 메시지로 추가 후 재빌드 |
| collect_submodules 크기 증가 | 파일 크기 +10-20MB | 명시적 목록으로 전환 |
| 플랫폼별 차이 | 특정 OS에서 오류 | CI/CD에서 3개 플랫폼 테스트 |

---

## 8. 의존성

| Task | 상태 | 관계 |
|------|------|------|
| TSK-02-01 | [dd] | spec 파일 기본 구조 제공 |
| TSK-02-03 | [ ] | 데이터 파일 설정 후 통합 |
| TSK-02-04 | [ ] | 빌드 테스트로 검증 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-30 | 초기 통합설계 작성 |
