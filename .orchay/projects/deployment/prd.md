# PRD: orchay 배포 시스템

## 문서 정보

| 항목 | 내용 |
|------|------|
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-29 |
| 상태 | Draft |
| 프로젝트 경로 | `./orchay` |

---

## 1. 제품 개요

### 1.1 목표

orchay를 **가상환경(uv, venv) 없이** Windows, Linux, macOS에서 사용할 수 있도록 배포 시스템 구축

### 1.2 핵심 가치

| 가치 | 설명 |
|------|------|
| 간편한 설치 | Python 환경 없이 실행 파일만 다운로드하여 사용 |
| 크로스 플랫폼 | Windows, Linux, macOS 모두 지원 |
| 자동화 | GitHub Actions를 통한 빌드/배포 자동화 |
| 다양한 배포 채널 | 실행 파일, PyPI, zipapp 등 다양한 방식 지원 |

### 1.3 배경

현재 orchay는 다음 방식으로만 실행 가능:
```bash
uv run --project orchay python -m orchay
```

이 방식의 문제점:
- Python 설치 필요
- uv 설치 필요
- 가상환경 이해 필요
- 일반 사용자에게 진입 장벽이 높음

---

## 2. 배포 방식 비교

### 2.1 방식별 특성

| 방식 | venv 필요 | Python 필요 | 사용자 복잡도 | 권장 대상 |
|------|----------|-------------|--------------|----------|
| **PyInstaller** | ❌ | ❌ | 낮음 | 일반 사용자 |
| **pipx** | 자동 관리 | ✅ | 낮음 | Python 개발자 |
| **shiv** | ❌ | ✅ | 낮음 | Python 환경 |
| **pip** | ✅ | ✅ | 높음 | 기여자 |

### 2.2 권장 전략

| 대상 | 권장 방법 |
|------|----------|
| Python 없는 일반 사용자 | GitHub Releases → 실행 파일 다운로드 |
| Python 개발자 | `pipx install orchay` |
| 기여자/개발 | `uv pip install -e ./orchay[dev]` |

---

## 3. 아키텍처

### 3.1 엔트리포인트 변경

#### 현재 구조
```
orchay/
├── launcher.py              ← 패키지 외부 (독립 스크립트)
├── pyproject.toml           ← entry point: orchay.cli:cli_main
└── src/orchay/
    ├── cli.py               ← 현재 엔트리포인트
    └── __main__.py
```

#### 목표 구조
```
orchay/
├── pyproject.toml           ← entry point: orchay.launcher:main
└── src/orchay/
    ├── launcher.py          ← 새 엔트리포인트 (이동됨)
    ├── cli.py               ← 스케줄러 CLI (내부 호출)
    └── __main__.py          ← launcher.main() 호출
```

### 3.2 실행 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                        실행 흐름                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  사용자: orchay 또는 python -m orchay                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │  launcher.main() │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ├── 1. 의존성 체크 (wezterm, claude, uv)              │
│           │                                                     │
│           ├── 2. WezTerm mux-server 종료                        │
│           │                                                     │
│           ├── 3. WezTerm 실행                                   │
│           │                                                     │
│           ├── 4. 레이아웃 생성 (스케줄러 + Workers)              │
│           │                                                     │
│           └── 5. 스케줄러 명령 전송                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 launcher.py 주요 기능

| 기능 | 설명 |
|------|------|
| 의존성 체크 | wezterm, claude, uv 설치 여부 확인 |
| 플랫폼 감지 | Windows/Linux/macOS 구분하여 명령어 조정 |
| 프로세스 관리 | 기존 mux-server 종료 후 새 세션 시작 |
| 레이아웃 생성 | 스케줄러 + N개 Worker pane 자동 구성 |
| 명령 전송 | 스케줄러 pane에 orchay 실행 명령 전송 |

---

## 4. 단일 실행 파일 (PyInstaller)

### 4.1 도구 선택

| 도구 | 특징 | 복잡도 | 선택 |
|------|------|--------|------|
| **PyInstaller** | 널리 사용, 커뮤니티 지원 우수 | 낮음 | ✅ 권장 |
| Nuitka | Python→C 컴파일, 성능 향상 | 중간 | 대안 |
| PyOxidizer | Rust 기반, 설정 복잡 | 높음 | - |

### 4.2 빌드 명령어

#### 기본 빌드 (간단)

```bash
# 모든 OS 공통
pip install pyinstaller
cd orchay
pyinstaller --onefile --name orchay src/orchay/__main__.py
```

#### 고급 빌드 (spec 파일 사용)

```bash
# spec 파일 생성 후 빌드
pyinstaller orchay.spec
```

### 4.3 플랫폼별 결과

| OS | 결과 파일 | 예상 크기 | 비고 |
|----|----------|----------|------|
| Windows | `dist\orchay.exe` | ~15-25MB | UPX 압축 가능 |
| Linux | `dist/orchay` | ~20-30MB | glibc 버전 의존성 |
| macOS | `dist/orchay` | ~20-30MB | Intel/Apple Silicon 별도 빌드 |

### 4.4 크로스 컴파일 제약

**PyInstaller는 크로스 컴파일을 지원하지 않음**

- Windows 빌드 → Windows에서만 가능
- Linux 빌드 → Linux에서만 가능
- macOS 빌드 → macOS에서만 가능

**해결책**: GitHub Actions matrix 전략으로 각 플랫폼에서 빌드

### 4.5 spec 파일 설정

`orchay/orchay.spec` 파일을 사용하여 빌드 설정을 관리합니다.

```python
# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# 히든 임포트 (동적 로딩 모듈)
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

# 데이터 파일 수집
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
        # 불필요한 대형 패키지 제외
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'PIL',
        'cv2',
        'tkinter',
        'PyQt5',
        'PyQt6',
        'PySide2',
        'PySide6',
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
    strip=False,  # Linux/macOS에서 True로 변경 가능
    upx=True,     # UPX 압축 활성화
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # CLI 도구이므로 콘솔 모드
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # Windows 아이콘 (선택)
    # icon='assets/orchay.ico',
)
```

### 4.6 히든 임포트 (Hidden Imports)

동적으로 로딩되어 PyInstaller가 자동 감지하지 못하는 모듈:

| 패키지 | 히든 임포트 | 이유 |
|--------|------------|------|
| Pydantic | `pydantic.deprecated.decorator`, `pydantic_core` | 런타임 검증 |
| Textual | `textual.widgets.*` | 동적 위젯 로딩 |
| Rich | `rich.console`, `rich.table` | 포맷터 |
| Watchdog | `watchdog.observers`, `watchdog.events` | 플랫폼별 구현 |

### 4.7 데이터 파일 포함

현재 orchay는 외부 데이터 파일이 없으나, 향후 필요시:

```python
# spec 파일에서
datas = [
    ('src/orchay/templates', 'templates'),  # 템플릿 폴더
    ('assets/config.json', '.'),             # 설정 파일
]
```

**PyInstaller 환경에서 리소스 접근:**

```python
import sys
from pathlib import Path

def get_resource_path(relative_path: str) -> Path:
    """PyInstaller frozen 환경에서 리소스 경로 반환."""
    if getattr(sys, 'frozen', False):
        # PyInstaller 번들 실행 중
        base_path = Path(sys._MEIPASS)
    else:
        # 일반 Python 실행
        base_path = Path(__file__).parent
    return base_path / relative_path
```

### 4.8 UPX 압축

UPX(Ultimate Packer for eXecutables)로 실행 파일 크기 감소:

| 설정 | 효과 | 비고 |
|------|------|------|
| `upx=True` | 30-50% 크기 감소 | Windows에서 효과적 |
| `upx=False` | 원본 크기 | 빠른 빌드 |

**UPX 설치:**

```bash
# Windows (winget)
winget install upx.upx

# macOS (Homebrew)
brew install upx

# Linux (apt)
sudo apt install upx-ucl
```

**주의**: macOS/Linux에서 일부 바이너리는 UPX로 압축 시 오류 발생 가능

### 4.9 빌드 최적화

#### 파일 크기 최적화

```bash
# strip 옵션 (Linux/macOS)
pyinstaller --onefile --strip --name orchay src/orchay/__main__.py

# 불필요 모듈 제외
pyinstaller --onefile \
  --exclude-module matplotlib \
  --exclude-module numpy \
  --exclude-module pandas \
  --name orchay src/orchay/__main__.py
```

#### 시작 시간 최적화

```python
# --onefile 대신 --onedir 사용 (빠른 시작)
# 단, 배포 시 폴더 전체 복사 필요
```

| 모드 | 시작 시간 | 배포 편의성 |
|------|----------|------------|
| `--onefile` | 느림 (압축 해제) | 높음 (단일 파일) |
| `--onedir` | 빠름 | 낮음 (폴더 배포) |

### 4.10 로컬 빌드 테스트

```bash
# 1. 가상환경에서 의존성 설치
cd orchay
pip install -e .
pip install pyinstaller

# 2. 빌드
pyinstaller --onefile --name orchay src/orchay/__main__.py

# 3. 테스트
./dist/orchay --help

# 4. 정상 동작 확인
./dist/orchay -w 3 --dry-run
```

### 4.11 macOS 코드 서명 (선택)

배포 시 Gatekeeper 경고 방지:

```bash
# 서명
codesign --force --deep --sign "Developer ID Application: Your Name" dist/orchay

# 공증 (notarization)
xcrun notarytool submit dist/orchay.zip --apple-id "your@email.com" --wait
```

### 4.12 문제 해결

#### 일반적인 빌드 오류

| 오류 | 원인 | 해결 |
|------|------|------|
| `ModuleNotFoundError` | 히든 임포트 누락 | spec에 `hiddenimports` 추가 |
| `FileNotFoundError` | 데이터 파일 누락 | spec에 `datas` 추가 |
| `ImportError: DLL load failed` | Windows DLL 누락 | 의존성 재설치 |
| `OSError: [Errno 8] Exec format error` | 아키텍처 불일치 | 대상 플랫폼에서 빌드 |

#### 디버그 빌드

```bash
# 상세 로그 출력
pyinstaller --onefile --debug=all --name orchay src/orchay/__main__.py

# 생성된 spec 파일 확인
pyinstaller --onefile --name orchay --specpath=. src/orchay/__main__.py
```

---

## 5. GitHub Actions CI/CD

### 5.1 실행 파일 빌드 및 릴리스

```yaml
# .github/workflows/release.yml
name: Build & Release

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            artifact: orchay-linux
            suffix: ""
          - os: windows-latest
            artifact: orchay-windows
            suffix: ".exe"
          - os: macos-latest
            artifact: orchay-macos
            suffix: ""

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install and build
        run: |
          pip install pyinstaller
          pip install ./orchay
          cd orchay
          pyinstaller --onefile --name orchay src/orchay/__main__.py

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: orchay/dist/orchay${{ matrix.suffix }}

  release:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@v4

      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            orchay-linux/orchay
            orchay-windows/orchay.exe
            orchay-macos/orchay
```

### 5.2 PyPI 배포 (Trusted Publishing)

```yaml
# .github/workflows/pypi.yml
name: Publish to PyPI

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Build package
        run: |
          pip install build
          cd orchay
          python -m build

      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: orchay/dist/

  publish:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # Trusted Publishing 필수
    environment:
      name: pypi
      url: https://pypi.org/p/orchay
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - uses: pypa/gh-action-pypi-publish@release/v1
```

### 5.3 PyPI Trusted Publishing 설정

1. https://pypi.org 계정 생성
2. 프로젝트 생성 후 **Trusted Publishing** 설정:
   - **GitHub repository**: 연결
   - **Workflow name**: `pypi.yml`
   - **Environment name**: `pypi`

---

## 6. pipx 배포

### 6.1 사용자 설치 방법

```bash
# pipx 설치 (1회)
pip install pipx
pipx ensurepath

# orchay 설치
pipx install orchay

# 사용
orchay --help
orchay run -w 3 -m quick
```

### 6.2 pipx의 장점

| 장점 | 설명 |
|------|------|
| 자동 격리 | 내부적으로 venv 자동 생성/관리 |
| 사용자 투명성 | 사용자가 venv를 직접 다룰 필요 없음 |
| 충돌 방지 | 다른 패키지와 의존성 충돌 없음 |
| 쉬운 업그레이드 | `pipx upgrade orchay` |

---

## 7. shiv (zipapp)

### 7.1 개요

Python이 설치된 환경에서 단일 `.pyz` 파일로 실행. venv 불필요.

### 7.2 빌드

```bash
pip install shiv
shiv -o orchay.pyz -e orchay.launcher:main ./orchay
```

### 7.3 실행

```bash
./orchay.pyz run --help

# 또는
python orchay.pyz run --help
```

### 7.4 제약사항

- Python 설치 필요
- shebang 지원 필요 (Windows에서 제한적)

---

## 8. OS별 코드 호환성

### 8.1 분석 결과

**현재 orchay 코드는 대부분 OS 독립적으로 작성되어 있음**

| 파일 | 상태 | 이유 |
|------|------|------|
| `utils/wezterm.py` | ✅ | `asyncio.create_subprocess_exec("wezterm", ...)` - Windows에서 .exe 자동 검색 |
| `utils/config.py` | ✅ | `pathlib.Path` 사용 - 자동 크로스 플랫폼 |
| `models/config.py` | ✅ | Pydantic 모델 - OS 독립적 |
| `cli.py` | ✅ | `argparse` 사용 - OS 독립적 |
| `launcher.py` | ✅ | `platform.system()` 분기 처리 이미 구현 |

### 8.2 launcher.py 플랫폼 분기

```python
# 이미 구현된 플랫폼별 처리
def kill_mux_server() -> None:
    if platform.system() == "Windows":
        subprocess.run(["taskkill", "/f", "/im", "wezterm-mux-server.exe"], ...)
        subprocess.run(["taskkill", "/f", "/im", "wezterm-gui.exe"], ...)
    else:
        subprocess.run(["pkill", "-f", "wezterm-mux-server"], ...)
        subprocess.run(["pkill", "-f", "wezterm-gui"], ...)
```

### 8.3 유일한 요구사항

- **WezTerm**이 PATH에 등록되어 있어야 함
- **Claude Code** (`claude` 명령) 설치 필요
- **uv** (현재 스케줄러 실행용) - 향후 제거 예정

---

## 9. 파일 변경 계획

### 9.1 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `orchay/launcher.py` | `orchay/src/orchay/launcher.py`로 이동 |
| `orchay/pyproject.toml` | entry point 변경: `orchay.launcher:main` |
| `orchay/src/orchay/__main__.py` | `from orchay.launcher import main` 호출 |
| `orchay/src/orchay/launcher.py` | `get_orchay_cmd()` 경로 로직 수정 |

### 9.2 신규 생성 파일

| 파일 | 설명 |
|------|------|
| `.github/workflows/release.yml` | PyInstaller 빌드 + GitHub Releases |
| `.github/workflows/pypi.yml` | PyPI 배포 워크플로우 |

### 9.3 pyproject.toml 변경

```toml
# Before
[project.scripts]
orchay = "orchay.cli:cli_main"

# After
[project.scripts]
orchay = "orchay.launcher:main"
```

### 9.4 __main__.py 변경

```python
# Before
from orchay.cli import cli_main

if __name__ == "__main__":
    cli_main()

# After
from orchay.launcher import main

if __name__ == "__main__":
    main()
```

---

## 10. README 설치 안내

배포 완료 후 README.md에 추가할 내용:

```markdown
## 설치

### 방법 1: 실행 파일 다운로드 (권장)

[Releases](https://github.com/xxx/orchay/releases)에서 OS에 맞는 파일 다운로드:
- Windows: `orchay.exe`
- Linux: `orchay`
- macOS: `orchay`

### 방법 2: pipx (Python 환경)

\`\`\`bash
pipx install orchay
\`\`\`

### 방법 3: pip (개발용)

\`\`\`bash
pip install orchay

# 또는 개발 모드
pip install -e ./orchay[dev]
\`\`\`

### 사전 요구사항

- [WezTerm](https://wezfurlong.org/wezterm/) 터미널 설치 및 PATH 등록
- [Claude Code](https://claude.ai/code) 설치
```

---

## 11. 참고 자료

| 도구 | 링크 |
|------|------|
| PyInstaller | https://pyinstaller.org/ |
| pipx | https://pipx.pypa.io/stable/ |
| PyPI Trusted Publishing | https://packaging.python.org/en/latest/guides/publishing-package-distribution-releases-using-github-actions-ci-cd-workflows/ |
| GitHub Actions PyInstaller | https://github.com/NotCookey/Pyinstaller-Github-Actions |
| Nuitka | https://nuitka.net/ |
| shiv | https://shiv.readthedocs.io/ |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-29 | 초기 PRD 작성 |
