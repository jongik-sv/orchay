# TSK-02-01: PyInstaller spec 파일 생성 - 기술설계

> **Category**: infrastructure
> **Domain**: devops
> **Status**: detail-design [dd]
> **PRD Reference**: PRD 4.5 spec 파일 설정

---

## 1. 개요

### 1.1 목적

PyInstaller를 사용하여 orchay를 단일 실행 파일로 빌드하기 위한 spec 파일을 생성합니다. spec 파일은 빌드 설정을 명시적으로 관리하고, 히든 임포트, 데이터 파일, 최적화 옵션 등을 제어합니다.

### 1.2 범위

| 포함 | 제외 |
|------|------|
| orchay.spec 파일 생성 | Hidden Imports 상세 분석 (TSK-02-02) |
| 기본 hidden imports 설정 | 데이터 파일 상세 설정 (TSK-02-03) |
| 콘솔 모드 설정 | 로컬 빌드 테스트 (TSK-02-04) |
| 불필요 모듈 제외 설정 | UPX 압축 설정 (TSK-02-05) |

---

## 2. 현재 상태

### 2.1 빌드 환경

- PyInstaller 미설치
- spec 파일 없음
- 명령행 빌드만 가능: `pyinstaller --onefile --name orchay src/orchay/__main__.py`

### 2.2 의존성 현황

```
orchay 주요 의존성:
├── pydantic (런타임 검증)
├── textual (TUI 프레임워크)
├── rich (콘솔 출력)
├── watchdog (파일 감시)
├── typer (CLI)
└── asyncio (비동기)
```

### 2.3 엔트리포인트

- **현재**: `orchay/src/orchay/__main__.py`
- **의존**: TSK-01-02 (pyproject.toml 엔트리포인트 변경) 완료 필요

---

## 3. 목표 상태

### 3.1 생성 파일

```
orchay/
└── orchay.spec          ← 신규 생성
```

### 3.2 spec 파일 구성

| 항목 | 설정 |
|------|------|
| 엔트리포인트 | `src/orchay/__main__.py` |
| 출력 형식 | 단일 파일 (onefile) |
| 실행 모드 | 콘솔 (CLI 도구) |
| 히든 임포트 | pydantic, textual, rich, watchdog 관련 |
| 제외 모듈 | matplotlib, numpy, pandas, GUI 프레임워크 |
| UPX 압축 | 활성화 (기본값) |

---

## 4. 기술 요구사항

### 4.1 Hidden Imports 기본 목록

```python
hidden_imports = [
    # Pydantic
    'pydantic',
    'pydantic.deprecated.decorator',
    'pydantic_core',

    # Textual
    'textual',
    'textual.widgets',

    # Rich
    'rich',
    'rich.console',

    # Watchdog
    'watchdog',
    'watchdog.observers',
    'watchdog.events',
]
```

### 4.2 제외 모듈

```python
excludes = [
    # 불필요한 대형 패키지
    'matplotlib',
    'numpy',
    'pandas',
    'scipy',
    'PIL',
    'cv2',

    # GUI 프레임워크
    'tkinter',
    'PyQt5',
    'PyQt6',
    'PySide2',
    'PySide6',
]
```

### 4.3 빌드 옵션

| 옵션 | 값 | 설명 |
|------|-----|------|
| `name` | `orchay` | 출력 파일명 |
| `onefile` | True | 단일 실행 파일 |
| `console` | True | CLI 도구용 콘솔 모드 |
| `strip` | False | 디버그 정보 유지 (플랫폼별 조정) |
| `upx` | True | UPX 압축 활성화 |

---

## 5. 구현 계획

### 5.1 spec 파일 구조

```python
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

# 히든 임포트 목록
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

# 데이터 파일 (TSK-02-03에서 상세 설정)
datas = []

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

### 5.2 빌드 명령어

```bash
cd orchay
pyinstaller orchay.spec
```

### 5.3 결과물 위치

| OS | 경로 |
|----|------|
| Windows | `orchay/dist/orchay.exe` |
| Linux/macOS | `orchay/dist/orchay` |

---

## 6. 수용 기준

| 기준 | 검증 방법 |
|------|----------|
| spec 파일 존재 | `orchay/orchay.spec` 파일 확인 |
| 빌드 성공 | `pyinstaller orchay.spec` 실행 후 dist 폴더에 실행 파일 생성 |
| 모든 런타임 의존성 포함 | 실행 파일 실행 시 ModuleNotFoundError 없음 |

---

## 7. 의존성

| Task | 상태 | 설명 |
|------|------|------|
| TSK-01-02 | [dd] | pyproject.toml 엔트리포인트 변경 필요 |

---

## 8. 후속 작업

| Task | 설명 |
|------|------|
| TSK-02-02 | Hidden Imports 상세 분석 및 추가 |
| TSK-02-03 | 데이터 파일 및 리소스 번들링 |
| TSK-02-04 | 로컬 빌드 테스트 (Linux) |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025-12-30 | 초기 기술설계 작성 |
