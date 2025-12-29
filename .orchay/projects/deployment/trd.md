# TRD - deployment (orchay 배포 시스템)

> version: 1.0
> created: 2025-12-29
> project-root: orchay

---

## 1. 기술 스택

### 1.1 빌드 도구

| 도구 | 버전 | 용도 |
|------|------|------|
| PyInstaller | 6.x | 단일 실행 파일 빌드 |
| hatchling | 1.x | Python 패키지 빌드 |
| UPX | 4.x | 실행 파일 압축 (선택) |

### 1.2 CI/CD

| 도구 | 용도 |
|------|------|
| GitHub Actions | 자동 빌드 및 배포 |
| GitHub Releases | 바이너리 배포 |
| PyPI | Python 패키지 배포 |

### 1.3 런타임 의존성

| 패키지 | 버전 | 특이사항 |
|--------|------|----------|
| textual | >=1.0 | TUI 프레임워크, 동적 import 다수 |
| rich | >=14.0 | 콘솔 출력 |
| watchdog | >=4.0 | 파일 시스템 감시, OS별 백엔드 |
| pydantic | >=2.0 | 설정 검증, pydantic_core C 확장 |

---

## 2. PyInstaller 빌드 상세

### 2.1 프로젝트 구조

```
orchay/
├── orchay.spec              # PyInstaller 설정 파일
├── pyproject.toml           # Python 패키지 메타데이터
├── src/orchay/
│   ├── __init__.py
│   ├── __main__.py          # python -m orchay 진입점
│   ├── launcher.py          # 주 엔트리포인트
│   ├── cli.py               # CLI 서브커맨드
│   ├── main.py              # Orchestrator
│   ├── scheduler.py         # 스케줄러 로직
│   └── utils/
│       └── wezterm.py       # WezTerm CLI 래퍼
└── dist/
    └── orchay               # 빌드 결과물
```

### 2.2 spec 파일 구성

```python
# orchay.spec

from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# 동적 import 수집
hiddenimports = []
hiddenimports += collect_submodules('pydantic')
hiddenimports += collect_submodules('textual')
hiddenimports += collect_submodules('rich')
hiddenimports += collect_submodules('watchdog')

# 수동 추가 필요 모듈
hiddenimports += [
    'pydantic.deprecated.decorator',
    'pydantic_core._pydantic_core',
    'textual.widgets._button',
    'textual.widgets._static',
    'watchdog.observers.polling',
]

# 데이터 파일
datas = []
datas += collect_data_files('textual')
datas += collect_data_files('rich')
datas += [('src/orchay/workflows.json', 'orchay')]

a = Analysis(
    ['src/orchay/__main__.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='orchay',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # CLI 도구이므로 콘솔 모드 유지
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

### 2.3 Hidden Imports 상세

#### pydantic 관련
```python
'pydantic',
'pydantic.deprecated.decorator',
'pydantic.fields',
'pydantic.main',
'pydantic_core',
'pydantic_core._pydantic_core',
```

#### textual 관련
```python
'textual',
'textual.app',
'textual.widgets',
'textual.widgets._button',
'textual.widgets._static',
'textual.widgets._label',
'textual.widgets._data_table',
'textual.css.query',
```

#### watchdog 관련
```python
'watchdog',
'watchdog.observers',
'watchdog.observers.polling',  # fallback observer
'watchdog.events',
```

### 2.4 데이터 파일

| 소스 | 대상 | 설명 |
|------|------|------|
| `src/orchay/workflows.json` | `orchay/` | 워크플로우 설정 |
| textual CSS | `textual/` | TUI 스타일시트 |
| rich 리소스 | `rich/` | 콘솔 렌더링 데이터 |

### 2.5 제외 모듈

```python
excludes = [
    'tkinter',      # GUI 불필요
    'matplotlib',   # 그래프 불필요
    'numpy',        # 수치 연산 불필요
    'PIL',          # 이미지 처리 불필요
    'scipy',        # 과학 계산 불필요
    'pandas',       # 데이터프레임 불필요
]
```

---

## 3. 플랫폼별 빌드

### 3.1 Linux

```bash
# 빌드
pip install pyinstaller
pyinstaller orchay.spec

# 결과물
dist/orchay              # ELF 바이너리
```

**호환성 고려사항:**
- glibc 버전 의존성 (오래된 배포판에서 빌드 권장)
- manylinux 호환 빌드를 위해 Docker 사용 가능

```dockerfile
FROM quay.io/pypa/manylinux2014_x86_64
RUN pip install pyinstaller
COPY . /app
WORKDIR /app/orchay
RUN pyinstaller orchay.spec
```

### 3.2 Windows

```powershell
# 빌드
pip install pyinstaller
pyinstaller orchay.spec

# 결과물
dist\orchay.exe          # PE 실행 파일
```

**고려사항:**
- `console=True` 유지 (CMD/PowerShell 통합)
- Windows Defender 예외 등록 필요할 수 있음

### 3.3 macOS

```bash
# 빌드
pip install pyinstaller
pyinstaller orchay.spec

# 결과물
dist/orchay              # Mach-O 바이너리
```

**고려사항:**
- Apple Silicon (arm64) / Intel (x86_64) 각각 빌드
- 코드 서명이 없으면 Gatekeeper 경고 발생
- Universal Binary 생성은 복잡하므로 별도 배포 권장

---

## 4. GitHub Actions 워크플로우

### 4.1 release.yml (PyInstaller 빌드)

```yaml
name: Build & Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: ubuntu-20.04
            artifact: orchay-linux-x64
            suffix: ""
          - os: windows-latest
            artifact: orchay-windows-x64
            suffix: ".exe"
          - os: macos-13
            artifact: orchay-macos-x64
            suffix: ""
          - os: macos-14
            artifact: orchay-macos-arm64
            suffix: ""

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'

      - name: Install dependencies
        run: |
          pip install pyinstaller
          pip install ./orchay

      - name: Build
        working-directory: orchay
        run: pyinstaller orchay.spec

      - name: Rename artifact
        run: |
          mv orchay/dist/orchay${{ matrix.suffix }} \
             orchay/dist/${{ matrix.artifact }}${{ matrix.suffix }}

      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: orchay/dist/${{ matrix.artifact }}${{ matrix.suffix }}

  release:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts

      - name: Prepare release files
        run: |
          mkdir -p release
          find artifacts -type f -exec cp {} release/ \;

      - uses: softprops/action-gh-release@v2
        with:
          files: release/*
          generate_release_notes: true
```

### 4.2 pypi.yml (PyPI 배포)

```yaml
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

      - name: Build wheel
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
      id-token: write
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

---

## 5. 엔트리포인트 변경 상세

### 5.1 현재 상태

```python
# pyproject.toml
[project.scripts]
orchay = "orchay.cli:cli_main"  # 현재

# src/orchay/__main__.py
from orchay.cli import cli_main
if __name__ == "__main__":
    cli_main()
```

### 5.2 변경 후 상태

```python
# pyproject.toml
[project.scripts]
orchay = "orchay.launcher:main"  # 변경

# src/orchay/launcher.py (이동됨)
def main() -> int:
    """메인 함수 - WezTerm 레이아웃 생성 및 스케줄러 시작."""
    # ... 기존 launcher.py 코드 ...

# src/orchay/__main__.py
from orchay.launcher import main
if __name__ == "__main__":
    import sys
    sys.exit(main())
```

### 5.3 launcher.py 수정 사항

```python
# 변경 전 (패키지 외부)
def get_orchay_cmd() -> str:
    launcher_dir = os.path.dirname(os.path.abspath(__file__))
    return f"uv run --project {launcher_dir} python -m orchay"

# 변경 후 (패키지 내부)
def get_orchay_cmd() -> str:
    """orchay CLI 명령 반환."""
    # PyInstaller 번들 여부 확인
    if getattr(sys, 'frozen', False):
        # 번들된 실행 파일
        return sys.executable
    else:
        # 개발 모드
        return "python -m orchay"
```

---

## 6. 트러블슈팅

### 6.1 ModuleNotFoundError

**증상:** 빌드된 바이너리 실행 시 모듈을 찾을 수 없음

**해결:**
1. `--debug=imports` 옵션으로 빌드
2. 누락된 모듈을 hiddenimports에 추가
3. `collect_submodules()` 사용

```bash
pyinstaller --onefile --debug=imports src/orchay/__main__.py 2>&1 | grep "import"
```

### 6.2 리소스 파일 로드 실패

**증상:** workflows.json 또는 CSS 파일 로드 오류

**해결:**
1. datas 옵션에 파일 추가
2. 런타임 경로 해결 코드 추가

```python
import sys
import os

def get_resource_path(relative_path: str) -> str:
    """리소스 파일 경로 반환 (PyInstaller 호환)."""
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(__file__)
    return os.path.join(base_path, relative_path)
```

### 6.3 Windows 안티바이러스 오탐

**증상:** Windows Defender가 실행 파일을 차단

**해결:**
1. 코드 서명 추가
2. VirusTotal 검사 후 false positive 리포트
3. 사용자에게 예외 등록 안내

### 6.4 macOS Gatekeeper 차단

**증상:** "확인되지 않은 개발자" 경고

**해결 (임시):**
```bash
xattr -d com.apple.quarantine ./orchay
```

**해결 (영구):**
- Apple Developer 계정으로 코드 서명
- notarization 수행

---

## 7. 테스트 매트릭스

| OS | 아키텍처 | Python | 테스트 항목 |
|----|----------|--------|-------------|
| Ubuntu 20.04 | x64 | 3.12 | 빌드, 실행, WezTerm 연동 |
| Ubuntu 22.04 | x64 | 3.12 | 빌드, 실행, WezTerm 연동 |
| Windows 10 | x64 | 3.12 | 빌드, 실행, WezTerm 연동 |
| Windows 11 | x64 | 3.12 | 빌드, 실행, WezTerm 연동 |
| macOS 13 | x64 | 3.12 | 빌드, 실행, WezTerm 연동 |
| macOS 14 | arm64 | 3.12 | 빌드, 실행, WezTerm 연동 |

---

## 8. 릴리스 체크리스트

- [ ] pyproject.toml 버전 업데이트
- [ ] CHANGELOG.md 작성
- [ ] 로컬 빌드 테스트 (Linux)
- [ ] 태그 생성 및 푸시
- [ ] GitHub Actions 빌드 성공 확인
- [ ] GitHub Releases 아티팩트 확인
- [ ] PyPI 배포 확인
- [ ] README 설치 안내 업데이트

---

## 9. 참고 문서

- [PyInstaller 공식 문서](https://pyinstaller.org/en/stable/)
- [PyInstaller Hooks](https://pyinstaller.org/en/stable/hooks.html)
- [GitHub Actions PyInstaller](https://github.com/marketplace/actions/pyinstaller-action)
- [PyPI Trusted Publishing](https://docs.pypi.org/trusted-publishers/)
- [hatchling 빌드 백엔드](https://hatch.pypa.io/latest/)
