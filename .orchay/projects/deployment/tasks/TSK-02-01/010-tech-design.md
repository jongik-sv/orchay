# TSK-02-01: PyInstaller spec 파일 생성

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-01 |
| Category | infrastructure |
| Status | 상세설계 [dd] |
| PRD 참조 | PRD 4.5 spec 파일 구성 |
| 작성일 | 2025-12-30 |

---

## 1. 목적

PyInstaller를 사용하여 orchay를 단일 실행 파일로 빌드하기 위한 spec 파일을 생성합니다. spec 파일은 빌드 설정을 코드로 관리하여 일관된 빌드 결과를 보장합니다.

---

## 2. 현재 상태

- orchay는 현재 `uv run --project orchay python -m orchay` 방식으로만 실행 가능
- Python 및 가상환경 설정이 필요하여 일반 사용자 진입 장벽이 높음
- PyInstaller 빌드 설정이 존재하지 않음

---

## 3. 목표 상태

- `orchay/orchay.spec` 파일 생성
- spec 파일 기반 빌드로 단일 실행 파일(`dist/orchay`) 생성 가능
- 모든 런타임 의존성(hidden imports, data files) 포함

---

## 4. 구현 계획

### 4.1 spec 파일 위치

```
orchay/
├── orchay.spec          # 생성할 spec 파일
├── pyproject.toml
└── src/orchay/
    └── __main__.py      # 엔트리포인트
```

### 4.2 Hidden Imports 설정

동적으로 로딩되어 PyInstaller가 자동 감지하지 못하는 모듈:

| 패키지 | 히든 임포트 | 이유 |
|--------|------------|------|
| Pydantic | `pydantic`, `pydantic.deprecated.decorator`, `pydantic_core` | 런타임 검증 |
| Textual | `textual`, `textual.widgets` | 동적 위젯 로딩 |
| Rich | `rich`, `rich.console` | 콘솔 포맷터 |
| Watchdog | `watchdog`, `watchdog.observers`, `watchdog.events` | 플랫폼별 구현 |

### 4.3 Data Files 설정

현재 orchay는 외부 데이터 파일이 없으나, 향후 확장을 위해 datas 옵션 준비:

```python
datas = [
    # 향후 추가 예정
    # ('src/orchay/templates', 'templates'),
]
```

### 4.4 제외 모듈 설정

불필요한 대형 패키지를 제외하여 실행 파일 크기 최적화:

- matplotlib, numpy, pandas, scipy
- PIL, cv2
- tkinter, PyQt5, PyQt6, PySide2, PySide6

### 4.5 콘솔 모드 설정

orchay는 CLI 도구이므로 `console=True` 설정 유지.

### 4.6 UPX 압축 설정

- `upx=True`: 30-50% 크기 감소 (UPX 설치 시)
- Windows에서 가장 효과적

---

## 5. spec 파일 구조

```python
# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

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

---

## 6. 수용 기준

| 기준 | 검증 방법 |
|------|----------|
| spec 파일로 빌드 성공 | `pyinstaller orchay.spec` 실행 후 `dist/orchay` 생성 확인 |
| 모든 런타임 의존성 포함 | 빌드된 실행 파일 실행 시 ModuleNotFoundError 없음 |

---

## 7. 의존성

| Task | 상태 | 설명 |
|------|------|------|
| TSK-01-02 | 필수 선행 | pyproject.toml 엔트리포인트 변경 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-30 | 초기 기술 설계 문서 작성 |
