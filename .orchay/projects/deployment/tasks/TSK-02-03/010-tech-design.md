# TSK-02-03: 데이터 파일 및 리소스 번들링 - 기술설계

> **Category**: infrastructure
> **Domain**: devops
> **Status**: detail-design [dd]
> **PRD Reference**: PRD 4.7 데이터 파일

---

## 1. 개요

### 1.1 목적

PyInstaller로 빌드된 실행 파일에서 orchay가 사용하는 데이터 파일과 리소스를 정상적으로 로드할 수 있도록 번들링 설정을 구성합니다.

### 1.2 범위

| 포함 | 제외 |
|------|------|
| styles.tcss 번들링 | Hidden Imports (TSK-02-02) |
| spec 파일 datas 옵션 설정 | 빌드 테스트 (TSK-02-04) |
| 리소스 경로 헬퍼 함수 | |
| PyInstaller frozen 환경 지원 | |

---

## 2. 현재 상태

### 2.1 리소스 파일 현황

```
orchay/src/orchay/
├── ui/
│   ├── app.py           ← CSS_PATH = "styles.tcss"
│   └── styles.tcss      ← Textual CSS 스타일 파일
```

### 2.2 리소스 로딩 방식

**현재**: Textual의 `CSS_PATH` 클래스 변수 사용

```python
# orchay/src/orchay/ui/app.py:398
class OrchestratorApp(App):
    CSS_PATH = "styles.tcss"  # 상대 경로
```

Textual은 `CSS_PATH`를 클래스가 정의된 파일 기준 상대 경로로 해석합니다.

### 2.3 문제점

PyInstaller `--onefile` 모드:
- 실행 시 임시 폴더(`_MEIPASS`)에 압축 해제
- 소스 파일은 번들에 포함되나 `.tcss` 등 데이터 파일은 기본적으로 제외
- `styles.tcss` 누락 시 Textual CSS 적용 실패

---

## 3. 목표 상태

### 3.1 번들링 대상

| 파일 | 소스 경로 | 대상 경로 |
|------|----------|----------|
| styles.tcss | `src/orchay/ui/styles.tcss` | `orchay/ui/styles.tcss` |

### 3.2 리소스 접근

PyInstaller frozen 환경에서도 동일한 상대 경로로 리소스 접근 가능

---

## 4. 기술 요구사항

### 4.1 spec 파일 datas 설정

```python
# orchay.spec

datas = [
    # (소스 경로, 대상 폴더)
    ('src/orchay/ui/styles.tcss', 'orchay/ui'),
]

a = Analysis(
    ['src/orchay/__main__.py'],
    # ...
    datas=datas,
    # ...
)
```

### 4.2 Textual CSS 로딩 호환성

Textual의 `CSS_PATH` 해석 방식:
1. 클래스 정의 파일(`app.py`)의 위치 기준
2. PyInstaller에서 `sys._MEIPASS`에 압축 해제된 파일 검색

**Textual 내부 동작**:
```python
# textual/app.py (간략화)
css_path = Path(inspect.getfile(cls)).parent / cls.CSS_PATH
```

PyInstaller 번들에서 `inspect.getfile()`은 `_MEIPASS` 경로 반환 → datas 설정으로 해결

### 4.3 향후 확장을 위한 헬퍼 함수 (선택)

```python
# orchay/src/orchay/utils/resources.py (선택적 구현)

import sys
from pathlib import Path


def get_resource_path(relative_path: str) -> Path:
    """PyInstaller frozen 환경에서 리소스 경로 반환.

    Args:
        relative_path: 패키지 루트 기준 상대 경로

    Returns:
        절대 경로
    """
    if getattr(sys, 'frozen', False):
        # PyInstaller 번들 실행 중
        base_path = Path(sys._MEIPASS)  # type: ignore[attr-defined]
    else:
        # 일반 Python 실행
        base_path = Path(__file__).parent.parent
    return base_path / relative_path


def is_frozen() -> bool:
    """PyInstaller frozen 환경 여부 확인."""
    return getattr(sys, 'frozen', False)
```

---

## 5. 상세 설계

### 5.1 수정된 spec 파일

```python
# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

# 데이터 파일 번들링
datas = [
    ('src/orchay/ui/styles.tcss', 'orchay/ui'),
]

# Hidden imports (TSK-02-02)
hidden_imports = [
    # ... (TSK-02-02에서 정의)
]
hidden_imports += collect_submodules('watchdog.observers')

a = Analysis(
    ['src/orchay/__main__.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib', 'numpy', 'pandas', 'scipy',
        'PIL', 'cv2', 'tkinter',
        'PyQt5', 'PyQt6', 'PySide2', 'PySide6',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='orchay',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

### 5.2 datas 경로 규칙

| 소스 | 대상 | 설명 |
|------|------|------|
| `src/orchay/ui/styles.tcss` | `orchay/ui` | 패키지 구조 유지 |

**대상 경로 결정 기준**:
- Textual은 `CSS_PATH`를 모듈 위치 기준으로 해석
- `app.py`가 `orchay/ui/`에 위치 → `styles.tcss`도 `orchay/ui/`에 배치

### 5.3 검증 방법

```bash
# 빌드
cd orchay
pyinstaller orchay.spec

# 번들 내용 확인 (Linux/macOS)
# --onefile 모드에서는 실행 후 _MEIPASS 확인 필요

# 실행 테스트
./dist/orchay --help
./dist/orchay  # TUI 실행 시 CSS 적용 확인
```

---

## 6. 리소스 확장 가이드

### 6.1 새 리소스 추가 시

1. spec 파일 datas에 추가:
```python
datas = [
    ('src/orchay/ui/styles.tcss', 'orchay/ui'),
    ('src/orchay/config/defaults.yaml', 'orchay/config'),  # 새 리소스
]
```

2. 코드에서 접근:
```python
from orchay.utils.resources import get_resource_path

config_path = get_resource_path('orchay/config/defaults.yaml')
```

### 6.2 폴더 전체 번들링

```python
# 폴더 전체 포함
datas = [
    ('src/orchay/templates', 'orchay/templates'),
]
```

---

## 7. 수용 기준

| ID | 기준 | 검증 방법 |
|----|------|----------|
| AC-01 | spec 파일에 datas 설정 포함 | 파일 검토 |
| AC-02 | 빌드된 실행 파일에서 CSS 정상 적용 | TUI 실행 후 스타일 확인 |
| AC-03 | 리소스 경로 정상 해석 | FileNotFoundError 없음 |

---

## 8. 의존성

| Task | 상태 | 관계 |
|------|------|------|
| TSK-02-01 | [dd] | spec 파일 기본 구조 제공 |
| TSK-02-02 | [dd] | Hidden Imports 목록 통합 |
| TSK-02-04 | [dd] | 빌드 테스트로 검증 |

---

## 9. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 경로 불일치 | CSS 미적용 | datas 대상 경로 확인 |
| 파일 누락 | FileNotFoundError | 빌드 후 _MEIPASS 내용 확인 |
| Textual 버전 변경 | CSS 로딩 방식 변경 | Textual 문서 확인 |

---

## 10. 현재 리소스 목록

| 파일 | 크기 | 용도 |
|------|------|------|
| `ui/styles.tcss` | ~2KB | Textual TUI 스타일 |

> 현재 orchay는 `styles.tcss` 외에 별도 데이터 파일 없음
> 향후 설정 파일, 템플릿 등 추가 시 datas 확장

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025-12-30 | 초기 기술설계 작성 |
