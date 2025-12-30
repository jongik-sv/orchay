# 기술설계: TSK-01-01 launcher.py 패키지 이동

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-01 |
| Task명 | launcher.py 패키지 이동 |
| Category | infrastructure |
| 상태 | 상세설계 [dd] |
| 작성일 | 2025-12-30 |

---

## 1. 개요

### 1.1 목적

launcher.py를 패키지 외부 독립 스크립트에서 `orchay/src/orchay/` 내부 모듈로 이동하여, PyInstaller 빌드 및 pipx 배포 시 엔트리포인트로 활용할 수 있도록 구조를 개선합니다.

### 1.2 PRD 참조

- **PRD 3.1**: 엔트리포인트 변경

### 1.3 범위

| 범위 | 내용 |
|------|------|
| 포함 | launcher.py 이동, get_orchay_cmd() 경로 로직 수정, 상대 경로 조정 |
| 제외 | pyproject.toml 수정 (TSK-01-02), __main__.py 수정 (TSK-01-03) |

---

## 2. 현재 상태

### 2.1 현재 파일 구조

```
orchay/
├── launcher.py              ← 패키지 외부 (독립 스크립트)
├── pyproject.toml           ← entry point: orchay.cli:cli_main
└── src/orchay/
    ├── cli.py               ← 현재 엔트리포인트
    ├── main.py
    └── __main__.py
```

### 2.2 현재 get_orchay_cmd() 구현

```python
def get_orchay_cmd() -> str:
    """orchay 실행 명령 반환 (uv run 사용)."""
    launcher_dir = os.path.dirname(os.path.abspath(__file__))
    return f"uv run --project {launcher_dir} python -m orchay"
```

**문제점**:
- `__file__`이 `orchay/launcher.py`를 가리킴
- `launcher_dir`이 `orchay/` 디렉토리가 됨
- 패키지 내부로 이동 시 경로가 `orchay/src/orchay/`가 되어 잘못된 경로 참조

---

## 3. 목표 상태

### 3.1 목표 파일 구조

```
orchay/
├── pyproject.toml           ← (TSK-01-02) entry point: orchay.launcher:main
└── src/orchay/
    ├── launcher.py          ← 새 위치 (이동됨)
    ├── cli.py               ← 스케줄러 CLI (내부 호출)
    ├── main.py
    └── __main__.py          ← (TSK-01-03) launcher.main() 호출
```

### 3.2 수정된 get_orchay_cmd() 구현

```python
def get_orchay_cmd() -> str:
    """orchay 실행 명령 반환 (uv run 사용)."""
    # 패키지 루트 디렉토리 찾기 (src/orchay → orchay)
    package_dir = Path(__file__).parent  # src/orchay
    project_dir = package_dir.parent.parent  # orchay (pyproject.toml 위치)
    return f"uv run --project {project_dir} python -m orchay"
```

---

## 4. 구현 계획

### 4.1 작업 순서

| 순서 | 작업 | 상세 |
|------|------|------|
| 1 | 파일 이동 | `orchay/launcher.py` → `orchay/src/orchay/launcher.py` |
| 2 | import 경로 수정 | pathlib.Path 사용으로 변경 |
| 3 | get_orchay_cmd() 수정 | 프로젝트 디렉토리 경로 계산 로직 변경 |
| 4 | 타입 힌트 추가 | Pyright strict 모드 대응 |
| 5 | 테스트 | import 및 경로 해석 검증 |

### 4.2 경로 계산 로직

```python
from pathlib import Path

def _get_project_dir() -> Path:
    """pyproject.toml이 위치한 프로젝트 디렉토리 반환."""
    # __file__: orchay/src/orchay/launcher.py
    # parent[0]: orchay/src/orchay/
    # parent[1]: orchay/src/
    # parent[2]: orchay/ (프로젝트 루트)
    return Path(__file__).parent.parent.parent

def get_orchay_cmd() -> str:
    """orchay 실행 명령 반환 (uv run 사용)."""
    project_dir = _get_project_dir()
    return f"uv run --project {project_dir} python -m orchay"
```

### 4.3 PyInstaller 호환성

PyInstaller frozen 환경에서는 `__file__` 경로가 달라질 수 있으므로 조건 분기 필요:

```python
import sys
from pathlib import Path

def _get_project_dir() -> Path:
    """pyproject.toml이 위치한 프로젝트 디렉토리 반환."""
    if getattr(sys, 'frozen', False):
        # PyInstaller frozen: uv 없이 직접 실행
        # 이 경우 get_orchay_cmd()는 다른 로직 사용
        return Path(sys.executable).parent
    else:
        return Path(__file__).parent.parent.parent
```

---

## 5. 수용 기준

| 기준 | 검증 방법 |
|------|----------|
| launcher.py가 src/orchay/ 내에 위치 | `ls orchay/src/orchay/launcher.py` |
| import 오류 없이 모듈 로드 가능 | `python -c "from orchay.launcher import main"` |
| Pyright strict 모드 통과 | `pyright orchay/src/orchay/launcher.py` |
| 기존 launcher.py 삭제 | `orchay/launcher.py` 파일 없음 |

---

## 6. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 경로 계산 오류 | 스케줄러 실행 실패 | 상대 경로 .parent 체인 검증 |
| 순환 import | 모듈 로드 실패 | launcher → cli 의존성 분리 |
| Pyright 오류 | 타입 체크 실패 | 명시적 타입 힌트 추가 |

---

## 7. 의존성

### 7.1 선행 작업

- 없음 (첫 번째 Task)

### 7.2 후행 작업

- **TSK-01-02**: pyproject.toml 엔트리포인트 변경
- **TSK-01-03**: __main__.py 수정

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-30 | 초기 기술설계 작성 |
