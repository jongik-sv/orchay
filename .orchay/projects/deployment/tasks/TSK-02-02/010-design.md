# TSK-02-02 - Hidden Imports 분석 및 설정 설계 문서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-02 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-30 |
| 상태 | 작성중 |
| 카테고리 | development |

---

## 1. 개요

### 1.1 배경 및 문제 정의

**현재 상황:**
- PyInstaller는 정적 분석을 통해 import 구문을 감지하지만, 동적으로 로딩되는 모듈은 자동 감지하지 못함
- orchay 프로젝트는 pydantic, textual, rich, watchdog 등 동적 로딩을 사용하는 패키지에 의존

**해결하려는 문제:**
- PyInstaller 빌드 후 실행 시 `ModuleNotFoundError` 발생
- 런타임에 필요한 모듈이 번들에 포함되지 않음
- 플랫폼별 구현체가 누락됨

### 1.2 목적 및 기대 효과

**목적:**
- PyInstaller 빌드 시 필요한 모든 hidden imports 식별 및 설정
- 빌드된 실행 파일에서 런타임 오류 없이 동작하도록 보장

**기대 효과:**
- 단일 실행 파일로 배포 가능
- 모든 플랫폼(Windows, Linux, macOS)에서 동일하게 동작
- 런타임 ModuleNotFoundError 완전 해결

### 1.3 범위

**포함:**
- pydantic 관련 hidden imports 분석 및 설정
- textual 관련 hidden imports 분석 및 설정
- rich 관련 hidden imports 분석 및 설정
- watchdog 관련 hidden imports 분석 및 설정
- collect_submodules 활용 방안

**제외:**
- spec 파일 전체 구조 (TSK-02-01에서 처리)
- 데이터 파일 번들링 (TSK-02-03에서 처리)
- 로컬 빌드 테스트 (TSK-02-04에서 처리)

### 1.4 참조 문서

| 문서 | 경로 | 관련 섹션 |
|------|------|----------|
| PRD | `.orchay/projects/deployment/prd.md` | 4.6 히든 임포트 |
| spec 파일 | `.orchay/projects/deployment/prd.md` | 4.5 spec 파일 설정 |

---

## 2. 대상 패키지 분석

### 2.1 동적 로딩 패턴

| 패키지 | 동적 로딩 방식 | 문제점 |
|--------|--------------|--------|
| Pydantic | 런타임 타입 검증, 데코레이터 | `pydantic_core`, deprecated 모듈 누락 |
| Textual | 위젯 동적 로딩 | `textual.widgets.*` 서브모듈 누락 |
| Rich | 콘솔 포맷터 동적 로딩 | 일부 포맷터 누락 |
| Watchdog | 플랫폼별 Observer 구현체 | 플랫폼별 구현체 누락 |

### 2.2 orchay 코드 분석

**pydantic 사용처:**
```
orchay/src/orchay/models/config.py  - Config, ExecutionConfig 모델
orchay/src/orchay/models/task.py    - Task, TaskStatus 모델
orchay/src/orchay/models/worker.py  - Worker, WorkerState 모델
```

**textual 사용처:**
- 현재 직접 사용하지 않음 (향후 TUI 구현 시 필요)

**rich 사용처:**
```
orchay/src/orchay/main.py          - Console, Table
orchay/src/orchay/cli.py           - Rich console 출력
```

**watchdog 사용처:**
```
orchay/src/orchay/wbs_parser.py    - WbsWatcher, FileSystemEventHandler
```

---

## 3. Hidden Imports 명세

### 3.1 필수 Hidden Imports

| 패키지 | 모듈 | 이유 | 우선순위 |
|--------|------|------|----------|
| pydantic | `pydantic.deprecated.decorator` | V2 호환 데코레이터 | 높음 |
| pydantic | `pydantic_core` | 핵심 검증 로직 | 높음 |
| pydantic | `pydantic.json_schema` | JSON 스키마 생성 | 중간 |
| rich | `rich.console` | 콘솔 출력 | 높음 |
| rich | `rich.table` | 테이블 출력 | 높음 |
| rich | `rich.progress` | 진행률 표시 (잠재적) | 낮음 |
| watchdog | `watchdog.observers` | 파일 감시 | 높음 |
| watchdog | `watchdog.events` | 이벤트 핸들러 | 높음 |

### 3.2 플랫폼별 Hidden Imports

| 플랫폼 | 패키지 | 모듈 | 이유 |
|--------|--------|------|------|
| Linux | watchdog | `watchdog.observers.inotify` | inotify 기반 감시 |
| macOS | watchdog | `watchdog.observers.fsevents` | FSEvents 기반 감시 |
| Windows | watchdog | `watchdog.observers.read_directory_changes_async` | Windows API 기반 감시 |
| 공통 | watchdog | `watchdog.observers.polling` | 폴링 폴백 |

### 3.3 collect_submodules 활용

효율적인 서브모듈 수집을 위해 PyInstaller 유틸리티 사용:

```python
from PyInstaller.utils.hooks import collect_submodules

# 전체 서브모듈 수집이 필요한 패키지
collected_modules = (
    collect_submodules('pydantic') +
    collect_submodules('watchdog.observers')
)
```

**collect_submodules 사용 기준:**
| 패키지 | 개별 지정 | collect_submodules | 이유 |
|--------|----------|-------------------|------|
| pydantic | - | O | 내부 구조 복잡, 버전별 차이 |
| rich | O | - | 필요 모듈 명확 |
| watchdog.observers | - | O | 플랫폼별 구현체 자동 포함 |
| watchdog.events | O | - | 단일 모듈 |

---

## 4. 구현 설계

### 4.1 spec 파일 수정 위치

```
orchay/orchay.spec
├── hidden_imports = [...]  ← 수정 대상
└── Analysis(...)
```

### 4.2 Hidden Imports 설정 코드

```python
# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules

# 동적 로딩 모듈 수집
pydantic_imports = collect_submodules('pydantic')
watchdog_observer_imports = collect_submodules('watchdog.observers')

# 명시적 hidden imports
hidden_imports = [
    # Pydantic 핵심
    'pydantic_core',

    # Rich 콘솔
    'rich.console',
    'rich.table',
    'rich.text',
    'rich.style',

    # Watchdog 이벤트
    'watchdog.events',

    # collect_submodules로 수집된 모듈 병합
    *pydantic_imports,
    *watchdog_observer_imports,
]
```

### 4.3 검증 방법

**빌드 후 검증 단계:**

1. **Import 테스트 스크립트:**
```python
# verify_imports.py
import pydantic
from pydantic import BaseModel
from rich.console import Console
from rich.table import Table
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

print("All imports successful")
```

2. **실행 테스트:**
```bash
./dist/orchay --help
./dist/orchay --dry-run
```

3. **런타임 오류 확인:**
- Pydantic 모델 검증 동작
- Rich 테이블 출력 정상
- Watchdog 파일 감시 정상

---

## 5. 의존성 및 제약사항

### 5.1 의존성

| 의존 항목 | 이유 | 상태 |
|----------|------|------|
| TSK-02-01 | spec 파일 기본 구조 필요 | 대기 |

### 5.2 제약 사항

| 제약 | 설명 | 대응 방안 |
|------|------|----------|
| pydantic 버전 | V2와 V1 호환 모듈 구조 다름 | pydantic>=2.0 가정 |
| 플랫폼 특성 | 각 OS별 watchdog 구현체 상이 | collect_submodules로 전체 포함 |
| 빌드 크기 증가 | 불필요 모듈 포함 가능 | excludes로 제외 목록 관리 |

---

## 6. 수용 기준

### 6.1 기능적 요구사항

| ID | 요구사항 | 검증 방법 |
|----|----------|----------|
| AC-01 | 빌드된 실행 파일에서 import 오류 없음 | `./dist/orchay --help` 정상 실행 |
| AC-02 | 모든 Pydantic 모델 정상 동작 | Config, Task 모델 로드 성공 |
| AC-03 | Rich 콘솔 출력 정상 | 테이블, 컬러 출력 확인 |
| AC-04 | Watchdog 파일 감시 정상 | WBS 파일 변경 감지 확인 |

### 6.2 비기능적 요구사항

| ID | 요구사항 | 기준 |
|----|----------|------|
| NF-01 | 빌드 시간 | 기존 대비 10% 이내 증가 |
| NF-02 | 실행 파일 크기 | 30MB 이하 |

---

## 7. 체크리스트

### 7.1 설계 완료 확인

- [x] 문제 정의 및 목적 명확화
- [x] 대상 패키지 분석 완료
- [x] Hidden imports 명세 완료
- [x] 구현 설계 완료
- [x] 수용 기준 정의 완료

### 7.2 구현 준비

- [x] 의존성 확인 완료
- [x] 제약 사항 검토 완료
- [ ] TSK-02-01 완료 대기

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-12-30 | Claude | 최초 작성 |
