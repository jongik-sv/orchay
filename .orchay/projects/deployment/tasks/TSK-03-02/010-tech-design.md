# TSK-03-02: PyPI 배포 워크플로우 - 기술설계

> **Category**: infrastructure
> **Domain**: devops
> **Status**: detail-design [dd]
> **PRD Reference**: PRD 5.2 PyPI 배포

---

## 1. 개요

### 1.1 목적

GitHub Actions를 사용하여 orchay 패키지를 PyPI에 자동 배포하는 CI/CD 파이프라인을 구축합니다. Trusted Publishing을 활용하여 API 토큰 없이 안전하게 배포합니다.

### 1.2 범위

| 포함 | 제외 |
|------|------|
| `.github/workflows/pypi.yml` 생성 | PyPI 계정 설정 (TSK-03-03) |
| Trusted Publishing 권한 설정 | TestPyPI 배포 |
| 태그 푸시 트리거 | 버전 자동 증가 |
| 빌드 및 배포 자동화 | |

---

## 2. 현재 상태

### 2.1 패키지 현황

```toml
# orchay/pyproject.toml
[project]
name = "orchay"
version = "0.1.0"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

### 2.2 PyPI 현황

- PyPI 계정: 미생성
- orchay 패키지: 미등록
- Trusted Publishing: 미설정

---

## 3. 목표 상태

### 3.1 워크플로우 구조

```
.github/
└── workflows/
    ├── release.yml    ← TSK-03-01
    └── pypi.yml       ← 신규 생성
```

### 3.2 배포 흐름

```
태그 푸시 (v*)
      │
      ▼
┌─────────────┐
│ Build Job   │
│ - checkout  │
│ - build pkg │
│ - upload    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Publish Job │
│ - download  │
│ - pypi pub  │
└──────┬──────┘
       │
       ▼
   PyPI에 배포
```

---

## 4. 기술 요구사항

### 4.1 워크플로우 구성

```yaml
name: Publish to PyPI

on:
  push:
    tags: ['v*']
  workflow_dispatch:
    inputs:
      test_pypi:
        description: 'Publish to TestPyPI instead'
        required: false
        default: false
        type: boolean

jobs:
  build:
    name: Build distribution
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install build tools
        run: pip install build

      - name: Build package
        working-directory: orchay
        run: python -m build

      - name: Upload distribution
        uses: actions/upload-artifact@v4
        with:
          name: python-package-distributions
          path: orchay/dist/

  publish-pypi:
    name: Publish to PyPI
    needs: build
    runs-on: ubuntu-latest
    if: github.event_name == 'push' || !inputs.test_pypi

    permissions:
      id-token: write  # OIDC 토큰 발급 (Trusted Publishing 필수)

    environment:
      name: pypi
      url: https://pypi.org/p/orchay

    steps:
      - name: Download distribution
        uses: actions/download-artifact@v4
        with:
          name: python-package-distributions
          path: dist/

      - name: Publish to PyPI
        uses: pypa/gh-action-pypi-publish@release/v1
```

### 4.2 주요 Actions 버전

| Action | 버전 | 용도 |
|--------|------|------|
| actions/checkout | v4 | 저장소 체크아웃 |
| actions/setup-python | v5 | Python 환경 |
| actions/upload-artifact | v4 | 빌드 아티팩트 업로드 |
| actions/download-artifact | v4 | 아티팩트 다운로드 |
| pypa/gh-action-pypi-publish | release/v1 | PyPI 배포 |

### 4.3 Trusted Publishing 설정

**GitHub Repository 권한**:
```yaml
permissions:
  id-token: write  # OIDC 토큰 발급
```

**GitHub Environment**:
- 이름: `pypi`
- Protection rules: 선택적 (승인 필요 여부)

**PyPI 설정** (TSK-03-03에서 수행):
- Publisher: GitHub Actions
- Repository: `{owner}/orchay`
- Workflow: `pypi.yml`
- Environment: `pypi`

---

## 5. 상세 설계

### 5.1 Build Job

```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-python@v5
      with:
        python-version: '3.12'

    - name: Install build tools
      run: pip install build

    - name: Build package
      working-directory: orchay
      run: python -m build
      # 생성물:
      # - orchay/dist/orchay-0.1.0.tar.gz (sdist)
      # - orchay/dist/orchay-0.1.0-py3-none-any.whl (wheel)

    - uses: actions/upload-artifact@v4
      with:
        name: python-package-distributions
        path: orchay/dist/
```

### 5.2 Publish Job

```yaml
publish-pypi:
  needs: build
  runs-on: ubuntu-latest
  permissions:
    id-token: write  # 핵심: OIDC 토큰 발급

  environment:
    name: pypi
    url: https://pypi.org/p/orchay

  steps:
    - uses: actions/download-artifact@v4
      with:
        name: python-package-distributions
        path: dist/

    - uses: pypa/gh-action-pypi-publish@release/v1
      # Trusted Publishing 사용 시 추가 설정 불필요
```

### 5.3 버전 관리

현재 `pyproject.toml`에서 수동 버전 관리:

```toml
[project]
version = "0.1.0"
```

**버전 규칙**:
| 태그 | PyPI 버전 |
|------|----------|
| v0.1.0 | 0.1.0 |
| v1.0.0 | 1.0.0 |
| v1.0.0-alpha | 1.0.0a0 (PEP 440) |

---

## 6. 트리거 조건

### 6.1 자동 트리거

```yaml
on:
  push:
    tags: ['v*']
```

| 태그 | 동작 |
|------|------|
| v0.1.0 | ✅ 배포 실행 |
| v1.0.0-beta | ✅ 배포 실행 |
| release-1.0 | ❌ 트리거 안됨 |

### 6.2 수동 트리거

```yaml
on:
  workflow_dispatch:
    inputs:
      test_pypi:
        description: 'Publish to TestPyPI instead'
        required: false
        default: false
        type: boolean
```

---

## 7. 에러 처리

### 7.1 일반적인 배포 오류

| 오류 | 원인 | 해결 |
|------|------|------|
| `403 Forbidden` | Trusted Publishing 미설정 | PyPI에서 설정 확인 |
| `400 Bad Request` | 버전 중복 | pyproject.toml 버전 증가 |
| `Invalid distribution` | 빌드 오류 | build 로그 확인 |

### 7.2 OIDC 관련 오류

| 오류 | 원인 | 해결 |
|------|------|------|
| `No matching publisher` | 워크플로우명 불일치 | PyPI 설정 확인 |
| `Environment not found` | environment 미설정 | GitHub 설정 확인 |

---

## 8. 수용 기준

| ID | 기준 | 검증 방법 |
|----|------|----------|
| AC-01 | v* 태그 푸시 시 워크플로우 실행 | 태그 푸시 테스트 |
| AC-02 | PyPI에 패키지 배포 성공 | https://pypi.org/p/orchay 확인 |
| AC-03 | `pipx install orchay` 동작 | 설치 테스트 |
| AC-04 | `pip install orchay` 동작 | 설치 테스트 |

---

## 9. 의존성

| Task | 상태 | 관계 |
|------|------|------|
| TSK-02-04 | [dd] | 로컬 빌드 테스트 완료 필요 |
| TSK-03-03 | [ ] | PyPI Trusted Publishing 설정 필요 |

---

## 10. 보안 고려사항

### 10.1 Trusted Publishing 장점

| 항목 | API 토큰 | Trusted Publishing |
|------|---------|-------------------|
| 시크릿 관리 | 필요 | 불필요 |
| 토큰 만료 | 관리 필요 | 자동 |
| 권한 범위 | 프로젝트 전체 | 워크플로우 한정 |
| 감사 추적 | 제한적 | GitHub Actions 로그 |

### 10.2 Environment Protection

```yaml
environment:
  name: pypi
```

GitHub Settings > Environments > pypi에서:
- Required reviewers: 선택적
- Wait timer: 선택적
- Deployment branches: `main` 또는 태그만

---

## 11. 후속 작업

| Task | 설명 |
|------|------|
| TSK-03-03 | PyPI Trusted Publishing 설정 |
| TestPyPI | 테스트 배포 파이프라인 (선택) |
| 버전 자동화 | git tag 기반 버전 추출 (선택) |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025-12-30 | 초기 기술설계 작성 |
