# 배포 가이드

이 문서는 orchay 프로젝트의 세 가지 모듈(orchay-init, orchay, orchay_web)의 배포 방법을 설명합니다.

---

## 목차

1. [orchay-init (npm 패키지)](#1-orchay-init-npm-패키지)
2. [orchay (Python CLI)](#2-orchay-python-cli)
3. [orchay_web (데스크톱 앱)](#3-orchay_web-데스크톱-앱)
4. [요약](#요약)

---

## 1. orchay-init (npm 패키지)

| 항목 | 내용 |
|------|------|
| **타입** | npm CLI 패키지 |
| **사용법** | `npx orchay-init` |
| **레지스트리** | https://www.npmjs.com/package/orchay-init |

### 로컬 빌드

```bash
cd orchay-init
npm run build    # 상위 폴더의 .claude, .orchay를 templates/로 복사
```

### 배포 절차

```bash
cd orchay-init

# 1. 버전 업데이트
npm version patch    # x.x.0 → x.x.1
npm version minor    # x.0.x → x.1.0
npm version major    # 0.x.x → 1.0.0

# 2. npm 로그인 (최초 1회)
npm login

# 3. 배포 (prepublishOnly가 자동으로 빌드 실행)
npm publish

# 4. 배포 확인
npm view orchay-init version
```

### Access Token 사용 (2FA 설정 시)

1. https://www.npmjs.com 로그인
2. 프로필 → **Access Tokens** → **Generate New Token**
3. **Classic Token** → **Automation** 선택
4. 토큰 복사 후 사용:

```bash
npm publish --token=YOUR_ACCESS_TOKEN
```

### GitHub Actions

- **없음** (수동 배포)

---

## 2. orchay (Python CLI)

| 항목 | 내용 |
|------|------|
| **타입** | Python 패키지 + 실행 파일 |
| **빌드 도구** | hatchling (wheel), PyInstaller (실행파일) |
| **PyPI** | https://pypi.org/project/orchay |

### 배포 방법 A: PyPI (pip/pipx 설치용)

#### 자동 배포 (GitHub Actions)

**트리거**: `v*` 태그 push 시 자동 실행

```bash
cd orchay

# 1. pyproject.toml에서 버전 수정
# version = "0.2.0"

# 2. 커밋
git add orchay/pyproject.toml
git commit -m "chore: bump version to 0.2.0"

# 3. 태그 생성 및 push
git tag v0.2.0
git push origin main
git push origin v0.2.0
```

**워크플로우**: `.github/workflows/pypi.yml`

- 빌드: `python -m build`
- PyPI 배포: Trusted Publishing 사용 (토큰 불필요)
- TestPyPI 지원: Actions 탭에서 workflow_dispatch 실행 시 선택 가능

#### 수동 배포

```bash
cd orchay

# 1. 빌드 도구 설치
pip install build twine

# 2. 빌드
python -m build

# 3. TestPyPI에 테스트 배포 (선택)
twine upload --repository testpypi dist/*

# 4. PyPI에 배포
twine upload dist/*
```

### 배포 방법 B: 실행 파일 (PyInstaller)

#### 자동 배포 (GitHub Actions)

**트리거**: `orchay/**` 경로 변경 시 자동 실행

**워크플로우**: `.github/workflows/release.yml`

- 3개 플랫폼 빌드: Linux, Windows, macOS
- UPX 압축 적용
- GitHub Releases `latest` 태그로 배포

**결과물**:
| 플랫폼 | 파일명 |
|--------|--------|
| Linux | `orchay-linux-x64.zip` |
| Windows | `orchay-windows-x64.zip` |
| macOS | `orchay-macos-x64.zip` |

#### 수동 빌드 (로컬)

```bash
cd orchay

# 1. 의존성 설치
pip install pyinstaller
pip install .

# 2. 빌드
pyinstaller orchay.spec

# 3. 결과 확인
ls dist/orchay/
```

---

## 3. orchay_web (데스크톱 앱)

| 항목 | 내용 |
|------|------|
| **타입** | Nuxt 3 + 데스크톱 앱 |
| **프레임워크** | Electron + **Tauri** (마이그레이션 중) |

### 배포 방법 A: Electron

#### 자동 배포 (GitHub Actions)

**트리거**: `orchay_web/**` 경로 변경 시 자동 실행

**워크플로우**: `.github/workflows/release-electron.yml`

**결과물**:
| 플랫폼 | 파일 형식 |
|--------|-----------|
| Windows | `.exe` (portable, installer) |
| macOS | `.dmg` |
| Linux | `.AppImage`, `.deb` |

#### 수동 빌드 (로컬)

```bash
cd orchay_web

# 1. 의존성 설치
npm ci

# 2. Nuxt + Electron 빌드
npm run electron:build

# 3. 플랫폼별 패키징
npm run dist:win      # Windows
npm run dist:mac      # macOS
npm run dist:linux    # Linux
npm run dist:all      # 전체 플랫폼

# 4. 결과 확인
ls dist-electron/release/
```

### 배포 방법 B: Tauri (권장)

> Tauri는 Electron보다 번들 크기가 작고 메모리 사용량이 낮습니다.

#### 자동 배포 (GitHub Actions)

**트리거**: `orchay_web/**` 경로 변경 시 자동 실행

**워크플로우**: `.github/workflows/release-tauri.yml`

**결과물**:
| 플랫폼 | 파일 형식 |
|--------|-----------|
| Windows | `.msi`, `.exe` (NSIS) |
| macOS ARM64 (M1/M2/M3) | `.dmg` |
| macOS Intel | `.dmg` |
| Linux | `.AppImage`, `.deb` |

#### 수동 빌드 (로컬)

**사전 요구사항**: Rust 설치 필요

```bash
# Rust 설치 (없는 경우)
# Windows: https://rustup.rs 에서 설치
# Linux/macOS:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Linux 추가 의존성
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

```bash
cd orchay_web

# 1. 의존성 설치
npm ci

# 2. 개발 모드
npm run tauri:dev

# 3. 프로덕션 빌드
npm run tauri:build

# 4. 디버그 빌드
npm run tauri:build:debug

# 5. 결과 확인
ls src-tauri/target/release/bundle/
```

---

## 요약

### 배포 트리거 요약

| 프로젝트 | 배포 대상 | 트리거 | 워크플로우 |
|----------|-----------|--------|------------|
| orchay-init | npm | **수동** (`npm publish`) | 없음 |
| orchay | PyPI | 태그 `v*` push | `pypi.yml` |
| orchay | GitHub Releases | `orchay/**` 변경 | `release.yml` |
| orchay_web | GitHub Releases (Electron) | `orchay_web/**` 변경 | `release-electron.yml` |
| orchay_web | GitHub Releases (Tauri) | `orchay_web/**` 변경 | `release-tauri.yml` |

### 필요한 설정

#### npm (orchay-init)
- npm 계정 로그인 필요
- 2FA 사용 시 Access Token 필요

#### PyPI (orchay)
- GitHub Repository Settings → Environments에 `pypi`, `testpypi` 생성
- PyPI에서 Trusted Publishing 구성:
  1. https://pypi.org/manage/account/publishing/ 접속
  2. GitHub repository, workflow, environment 정보 등록

#### GitHub Releases (orchay, orchay_web)
- 자동 설정 (GITHUB_TOKEN 사용)
- 별도 설정 불필요

### 버전 관리 규칙

| 프로젝트 | 버전 파일 | 예시 |
|----------|-----------|------|
| orchay-init | `package.json` | `npm version patch` |
| orchay | `pyproject.toml` | 수동 편집 후 태그 |
| orchay_web | `package.json` | 수동 편집 |

---

## 문제 해결

### npm publish 실패

```bash
# 로그인 상태 확인
npm whoami

# 캐시 정리
npm cache clean --force

# 재로그인
npm logout
npm login
```

### PyInstaller 빌드 실패

```bash
# 의존성 재설치
pip uninstall orchay
pip install .

# spec 파일 확인
cat orchay/orchay.spec
```

### Tauri 빌드 실패

```bash
# Rust 업데이트
rustup update

# 타겟 추가 (크로스 컴파일 시)
rustup target add x86_64-pc-windows-msvc
rustup target add aarch64-apple-darwin
```
