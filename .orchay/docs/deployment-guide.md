# Orchay 배포 가이드

## 개요

orchay를 **가상환경(uv, venv) 없이** Windows, Linux, Mac에서 사용할 수 있도록 배포하는 방법

---

## Part 1: 엔트리포인트 변경 (launcher.py)

### 목표
`orchay` 명령 실행 시 launcher.py의 main()이 실행되어 WezTerm 레이아웃 + 스케줄러 자동 시작

### 현재 상태
```
orchay/
├── launcher.py              ← 패키지 외부
├── pyproject.toml           ← entry point: orchay.cli:cli_main
└── src/orchay/
    ├── cli.py
    └── __main__.py
```

### 수정 사항

| 파일 | 변경 내용 |
|------|----------|
| `launcher.py` | `src/orchay/launcher.py`로 이동 |
| `pyproject.toml` | `orchay = "orchay.launcher:main"` |
| `launcher.py` | `get_orchay_cmd()` 경로 로직 수정 |
| `__main__.py` | `from orchay.launcher import main` 호출로 변경 |

### 수정 후 구조
```
orchay/
├── pyproject.toml           ← entry point: orchay.launcher:main
└── src/orchay/
    ├── launcher.py          ← 이동됨
    ├── cli.py
    └── __main__.py          ← launcher.main() 호출
```

---

## Part 2: 배포 방식

### 방식 비교

| 방식 | venv 필요 | Python 필요 | 사용자 복잡도 | 권장 대상 |
|------|----------|-------------|--------------|----------|
| **PyInstaller** | ❌ | ❌ | 낮음 | 일반 사용자 |
| **pipx** | 자동 관리 | ✅ | 낮음 | Python 개발자 |
| **shiv** | ❌ | ✅ | 낮음 | Python 환경 |
| **pip** | ✅ | ✅ | 높음 | 기여자 |

---

## Part 3: 단일 실행 파일 (PyInstaller)

### 로컬 빌드

```bash
# 모든 OS 공통
pip install pyinstaller
cd orchay
pyinstaller --onefile --name orchay src/orchay/__main__.py
```

| OS | 결과 | 비고 |
|----|------|------|
| Windows | `dist\orchay.exe` | |
| Linux | `dist/orchay` | 오래된 Linux에서 빌드 권장 |
| macOS | `dist/orchay` | Intel/Apple Silicon 각각 빌드 |

### GitHub Actions 자동화

```yaml
# .github/workflows/release.yml
name: Build & Release

on:
  push:
    tags: ['v*']

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

      - name: Build
        run: |
          pip install pyinstaller
          pip install ./orchay
          cd orchay
          pyinstaller --onefile --name orchay src/orchay/__main__.py

      - uses: actions/upload-artifact@v4
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

      - uses: softprops/action-gh-release@v2
        with:
          files: |
            orchay-linux/orchay
            orchay-windows/orchay.exe
            orchay-macos/orchay
```

---

## Part 4: PyPI 배포 (pipx install)

### 사용자 설치

```bash
# pipx 설치 (1회)
pip install pipx
pipx ensurepath

# orchay 설치
pipx install orchay
```

### GitHub Actions (Trusted Publishing)

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

      - name: Build
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

### PyPI 설정
1. https://pypi.org 계정 생성
2. Trusted Publishing 설정:
   - GitHub repository 연결
   - workflow: `pypi.yml`
   - environment: `pypi`

---

## Part 5: OS별 코드 호환성

### 확인 결과: 수정 불필요

| 파일 | 상태 | 이유 |
|------|------|------|
| `utils/wezterm.py` | ✅ | `asyncio.create_subprocess_exec("wezterm", ...)` - Windows에서 .exe 자동 검색 |
| `utils/config.py` | ✅ | `pathlib.Path` 사용 - 자동 크로스 플랫폼 |
| `models/config.py` | ✅ | Pydantic 모델 - OS 독립적 |
| `cli.py` | ✅ | `argparse` 사용 - OS 독립적 |
| `launcher.py` | ✅ | `platform.system()` 분기 처리 이미 구현됨 |

### 유일한 요구사항
- **WezTerm**이 PATH에 등록되어 있어야 함

---

## Part 6: README 설치 안내

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

### 사전 요구사항

- [WezTerm](https://wezfurlong.org/wezterm/) 터미널 설치 및 PATH 등록
```

---

## 요약

| 대상 | 권장 방법 |
|------|----------|
| Python 없는 일반 사용자 | GitHub Releases → 실행 파일 다운로드 |
| Python 개발자 | `pipx install orchay` |
| 기여자/개발 | `uv pip install -e ./orchay[dev]` |

## 참고 자료

- [PyInstaller](https://pyinstaller.org/)
- [pipx](https://pipx.pypa.io/stable/)
- [PyPI Trusted Publishing](https://packaging.python.org/en/latest/guides/publishing-package-distribution-releases-using-github-actions-ci-cd-workflows/)
- [GitHub Actions PyInstaller](https://github.com/NotCookey/Pyinstaller-Github-Actions)
- [Nuitka](https://nuitka.net/) (성능 우선 시 대안)
- [shiv](https://shiv.readthedocs.io/) (zipapp 대안)
