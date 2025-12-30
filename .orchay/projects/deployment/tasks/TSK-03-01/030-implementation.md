# TSK-03-01: PyInstaller 빌드 워크플로우 구현

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-03-01 |
| 상태 | implement [im] |
| Category | infrastructure |
| 작성일 | 2025-12-30 |

---

## 1. 구현 개요

### 1.1 목표

GitHub Actions를 사용하여 크로스 플랫폼(Windows, Linux, macOS) PyInstaller 빌드 자동화 및 GitHub Releases 배포

### 1.2 PRD 참조

- prd-ref: PRD 5.1 실행 파일 빌드 및 릴리스

---

## 2. 구현 결과

### 2.1 생성된 파일

| 파일 | 설명 |
|------|------|
| `.github/workflows/release.yml` | PyInstaller 빌드 및 릴리스 워크플로우 |

### 2.2 워크플로우 구조

```yaml
release.yml
├── Trigger
│   ├── push: tags ['v*']
│   └── workflow_dispatch (수동 실행)
├── Jobs
│   ├── build (matrix strategy)
│   │   ├── ubuntu-latest → orchay-linux-x64.tar.gz
│   │   ├── windows-latest → orchay-windows-x64.zip
│   │   └── macos-latest → orchay-macos-x64.tar.gz
│   └── release
│       └── GitHub Releases 업로드
```

### 2.3 주요 기능

| 기능 | 구현 |
|------|------|
| 크로스 플랫폼 빌드 | matrix 전략으로 3개 OS 동시 빌드 |
| spec 파일 기반 빌드 | `pyinstaller orchay.spec` 사용 |
| one-folder 모드 지원 | 폴더를 tar.gz/zip으로 압축 |
| 자동 릴리스 노트 | `generate_release_notes: true` |
| 프리릴리스 감지 | 태그에 `-` 포함 시 prerelease |
| 수동 실행 지원 | `workflow_dispatch` |

---

## 3. 요구사항 충족

| 요구사항 | 충족 | 구현 방법 |
|----------|------|----------|
| .github/workflows/release.yml 생성 | ✅ | 파일 생성 완료 |
| matrix 전략으로 3개 플랫폼 빌드 | ✅ | ubuntu/windows/macos-latest |
| 태그 푸시 시 자동 빌드 | ✅ | `push: tags: ['v*']` |
| GitHub Releases 아티팩트 업로드 | ✅ | softprops/action-gh-release@v2 |
| spec 파일 기반 빌드 | ✅ | `pyinstaller orchay.spec` |

---

## 4. Acceptance Criteria

| 조건 | 상태 | 비고 |
|------|------|------|
| v* 태그 푸시 → 3개 플랫폼 빌드 성공 | ⬜ | GitHub에서 검증 필요 |
| GitHub Releases에 아티팩트 업로드 | ⬜ | 태그 푸시 후 확인 |

> **참고**: Acceptance Criteria는 실제 태그 푸시 후 검증 가능

---

## 5. 워크플로우 상세

### 5.1 Build Job

```yaml
build:
  strategy:
    fail-fast: false
    matrix:
      include:
        - os: ubuntu-latest
          artifact: orchay-linux-x64
          archive: tar.gz
        - os: windows-latest
          artifact: orchay-windows-x64
          archive: zip
        - os: macos-latest
          artifact: orchay-macos-x64
          archive: tar.gz
```

### 5.2 Release Job

- `needs: build` - 빌드 완료 후 실행
- `if: startsWith(github.ref, 'refs/tags/')` - 태그 푸시 시만 실행
- `permissions: contents: write` - 릴리스 생성 권한

### 5.3 아티팩트 구조 (one-folder 모드)

```
orchay-linux-x64.tar.gz
└── orchay/
    ├── orchay (실행 파일)
    └── _internal/
        ├── libpython3.12.so
        └── ... (의존성 라이브러리)
```

---

## 6. 사용 방법

### 6.1 릴리스 생성

```bash
# 버전 태그 생성 및 푸시
git tag v0.1.0
git push origin v0.1.0
```

### 6.2 프리릴리스 생성

```bash
# 프리릴리스 태그 (하이픈 포함)
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1
```

### 6.3 수동 실행

GitHub Actions → Release → Run workflow

---

## 7. 다음 단계

| 다음 Task | 설명 |
|-----------|------|
| TSK-03-02 | PyPI 배포 워크플로우 (pypi.yml) |
| TSK-03-03 | PyPI Trusted Publishing 설정 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-30 | 초기 구현 |
