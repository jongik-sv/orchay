# TSK-03-01: PyInstaller 빌드 워크플로우 - 기술설계

> **Category**: infrastructure
> **Domain**: devops
> **Status**: detail-design [dd]
> **PRD Reference**: PRD 5.1 실행 파일 빌드 및 릴리스

---

## 1. 개요

### 1.1 목적

GitHub Actions를 사용하여 Windows, Linux, macOS에서 PyInstaller 빌드를 자동화하고, GitHub Releases에 실행 파일을 업로드하는 CI/CD 파이프라인을 구축합니다.

### 1.2 범위

| 포함 | 제외 |
|------|------|
| `.github/workflows/release.yml` 생성 | PyPI 배포 (TSK-03-02) |
| matrix 전략으로 3개 플랫폼 빌드 | Trusted Publishing 설정 (TSK-03-03) |
| 태그 푸시 트리거 | UPX 압축 최적화 (선택) |
| GitHub Releases 아티팩트 업로드 | |
| spec 파일 기반 빌드 | |

---

## 2. 현재 상태

### 2.1 GitHub Actions 현황

- `.github/workflows/` 디렉토리: 없음
- 기존 워크플로우: 없음

### 2.2 빌드 환경

- 로컬 빌드: TSK-02-04에서 Linux 테스트 예정
- spec 파일: TSK-02-01에서 설계됨
- Hidden Imports: TSK-02-02에서 분석됨

---

## 3. 목표 상태

### 3.1 워크플로우 구조

```
.github/
└── workflows/
    └── release.yml    ← 신규 생성
```

### 3.2 빌드 매트릭스

| OS | Runner | 아티팩트 | 실행 파일 |
|----|--------|----------|----------|
| Linux | ubuntu-latest | orchay-linux | `orchay` |
| Windows | windows-latest | orchay-windows | `orchay.exe` |
| macOS | macos-latest | orchay-macos | `orchay` |

### 3.3 트리거 조건

| 이벤트 | 조건 |
|--------|------|
| push | `tags: ['v*']` (예: v0.1.0, v1.0.0) |
| workflow_dispatch | 수동 실행 |

---

## 4. 기술 요구사항

### 4.1 워크플로우 구성

```yaml
name: Build & Release

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: ubuntu-latest
            artifact: orchay-linux
            binary: orchay
          - os: windows-latest
            artifact: orchay-windows
            binary: orchay.exe
          - os: macos-latest
            artifact: orchay-macos
            binary: orchay

    runs-on: ${{ matrix.os }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'

      - name: Install dependencies
        run: |
          pip install pyinstaller
          pip install ./orchay

      - name: Build with PyInstaller
        working-directory: orchay
        run: pyinstaller orchay.spec

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: orchay/dist/${{ matrix.binary }}
          retention-days: 5

  release:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts

      - name: Prepare release files
        run: |
          mkdir -p release
          cp artifacts/orchay-linux/orchay release/orchay-linux
          cp artifacts/orchay-windows/orchay.exe release/orchay-windows.exe
          cp artifacts/orchay-macos/orchay release/orchay-macos
          chmod +x release/orchay-linux release/orchay-macos

      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            release/orchay-linux
            release/orchay-windows.exe
            release/orchay-macos
          generate_release_notes: true
          draft: false
          prerelease: ${{ contains(github.ref, 'alpha') || contains(github.ref, 'beta') || contains(github.ref, 'rc') }}
```

### 4.2 주요 Actions 버전

| Action | 버전 | 용도 |
|--------|------|------|
| actions/checkout | v4 | 저장소 체크아웃 |
| actions/setup-python | v5 | Python 환경 설정 |
| actions/upload-artifact | v4 | 빌드 아티팩트 업로드 |
| actions/download-artifact | v4 | 아티팩트 다운로드 |
| softprops/action-gh-release | v2 | GitHub Release 생성 |

### 4.3 Python 버전

- **3.12** 권장 (최신 안정 버전)
- 최소 요구: 3.10 (orchay 요구사항)

### 4.4 캐싱 전략

```yaml
- uses: actions/setup-python@v5
  with:
    python-version: '3.12'
    cache: 'pip'  # pip 캐시 활성화
```

---

## 5. 상세 설계

### 5.1 Build Job 상세

```yaml
build:
  strategy:
    fail-fast: false  # 한 플랫폼 실패해도 다른 플랫폼 계속 빌드
    matrix:
      include:
        - os: ubuntu-latest
          artifact: orchay-linux
          binary: orchay
        - os: windows-latest
          artifact: orchay-windows
          binary: orchay.exe
        - os: macos-latest
          artifact: orchay-macos
          binary: orchay
```

**fail-fast: false 사용 이유**:
- 한 플랫폼 빌드 실패 시에도 다른 플랫폼 빌드 완료
- 디버깅 시 모든 플랫폼 로그 확인 가능

### 5.2 Release Job 상세

```yaml
release:
  needs: build  # build job 완료 후 실행
  runs-on: ubuntu-latest
  permissions:
    contents: write  # Release 생성 권한
```

**권한 설정**:
- `contents: write`: GitHub Releases 생성 필수

### 5.3 아티팩트 명명 규칙

| 플랫폼 | 아티팩트명 | 릴리스 파일명 |
|--------|-----------|--------------|
| Linux | orchay-linux | `orchay-linux` |
| Windows | orchay-windows | `orchay-windows.exe` |
| macOS | orchay-macos | `orchay-macos` |

### 5.4 Pre-release 조건

```yaml
prerelease: ${{ contains(github.ref, 'alpha') || contains(github.ref, 'beta') || contains(github.ref, 'rc') }}
```

| 태그 패턴 | 릴리스 유형 |
|----------|------------|
| v1.0.0 | 정식 릴리스 |
| v1.0.0-alpha | Pre-release |
| v1.0.0-beta.1 | Pre-release |
| v1.0.0-rc.1 | Pre-release |

---

## 6. 릴리스 흐름

```
개발자: git tag v1.0.0 && git push origin v1.0.0
                    │
                    ▼
           ┌────────────────┐
           │ GitHub Actions │
           │   Triggered    │
           └────────┬───────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ Linux   │ │ Windows │ │ macOS   │
   │  Build  │ │  Build  │ │  Build  │
   └────┬────┘ └────┬────┘ └────┬────┘
        │           │           │
        └───────────┼───────────┘
                    ▼
           ┌────────────────┐
           │ Release Job    │
           │ - Download all │
           │ - Create Release│
           └────────┬───────┘
                    ▼
           ┌────────────────┐
           │ GitHub Release │
           │ v1.0.0         │
           │ - orchay-linux │
           │ - orchay.exe   │
           │ - orchay-macos │
           └────────────────┘
```

---

## 7. 에러 처리

### 7.1 일반적인 빌드 오류

| 오류 | 원인 | 해결 |
|------|------|------|
| `ModuleNotFoundError` | Hidden imports 누락 | spec 파일에 추가 |
| `Permission denied` | 실행 권한 없음 | `chmod +x` 추가 |
| `Artifact not found` | 업로드 실패 | 경로 확인 |

### 7.2 플랫폼별 이슈

| 플랫폼 | 잠재 이슈 | 대응 |
|--------|----------|------|
| Windows | 긴 경로 | 짧은 경로 사용 |
| macOS | ARM/Intel 차이 | universal2 또는 별도 빌드 |
| Linux | glibc 버전 | ubuntu-latest 사용 |

---

## 8. 수용 기준

| ID | 기준 | 검증 방법 |
|----|------|----------|
| AC-01 | v* 태그 푸시 시 워크플로우 자동 실행 | 태그 푸시 테스트 |
| AC-02 | 3개 플랫폼 모두 빌드 성공 | Actions 로그 확인 |
| AC-03 | GitHub Releases에 3개 파일 업로드 | Releases 페이지 확인 |
| AC-04 | 다운로드한 파일 실행 가능 | 각 플랫폼에서 테스트 |

---

## 9. 의존성

| Task | 상태 | 관계 |
|------|------|------|
| TSK-02-01 | [dd] | spec 파일 생성 |
| TSK-02-02 | [dd] | Hidden Imports 분석 |
| TSK-02-04 | [ ] | 로컬 빌드 테스트 (선행 필요) |

---

## 10. 보안 고려사항

### 10.1 권한 최소화

```yaml
permissions:
  contents: write  # Release 생성에만 필요
```

### 10.2 시크릿 관리

- 현재 워크플로우에서는 시크릿 불필요
- GitHub Token은 자동 제공 (`GITHUB_TOKEN`)

---

## 11. 후속 작업

| Task | 설명 |
|------|------|
| TSK-03-02 | PyPI 배포 워크플로우 |
| 모니터링 | 빌드 시간 최적화 |
| 코드 서명 | macOS/Windows 서명 (선택) |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025-12-30 | 초기 기술설계 작성 |
