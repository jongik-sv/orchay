# TSK-03-02: PyPI 배포 워크플로우 구현

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-03-02 |
| 상태 | implement [im] |
| Category | infrastructure |
| 작성일 | 2025-12-30 |

---

## 1. 구현 개요

### 1.1 목표

GitHub Actions를 사용하여 PyPI 자동 배포 워크플로우 구현 (Trusted Publishing)

### 1.2 PRD 참조

- prd-ref: PRD 5.2 PyPI 배포

---

## 2. 구현 결과

### 2.1 생성된 파일

| 파일 | 설명 |
|------|------|
| `.github/workflows/pypi.yml` | PyPI 배포 워크플로우 |

### 2.2 워크플로우 구조

```yaml
pypi.yml
├── Trigger
│   ├── push: tags ['v*']
│   └── workflow_dispatch (수동 실행, TestPyPI 옵션)
├── Jobs
│   ├── build
│   │   ├── python -m build
│   │   └── upload artifact
│   ├── publish-pypi (태그 푸시 시)
│   │   └── pypa/gh-action-pypi-publish
│   └── publish-testpypi (수동 실행 시)
│       └── test.pypi.org 배포
```

### 2.3 주요 기능

| 기능 | 구현 |
|------|------|
| Trusted Publishing | `permissions: id-token: write` |
| 태그 기반 배포 | `push: tags: ['v*']` |
| TestPyPI 지원 | `workflow_dispatch` + `test_pypi` 옵션 |
| Environment 설정 | `pypi`, `testpypi` 환경 분리 |
| 빌드 분리 | build → publish 2단계 구조 |

---

## 3. 요구사항 충족

| 요구사항 | 충족 | 구현 방법 |
|----------|------|----------|
| .github/workflows/pypi.yml 생성 | ✅ | 파일 생성 완료 |
| Trusted Publishing 설정 | ✅ | `id-token: write` + environment |
| 태그 푸시 시 자동 배포 | ✅ | `push: tags: ['v*']` |

---

## 4. Acceptance Criteria

| 조건 | 상태 | 비고 |
|------|------|------|
| v* 태그 푸시 → PyPI 배포 성공 | ⬜ | PyPI Trusted Publishing 설정 필요 (TSK-03-03) |
| `pipx install orchay` 동작 | ⬜ | 배포 후 확인 |

> **참고**: Acceptance Criteria는 TSK-03-03 (PyPI Trusted Publishing 설정) 완료 후 검증 가능

---

## 5. 워크플로우 상세

### 5.1 Build Job

```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - checkout
    - setup-python 3.12
    - pip install build
    - python -m build (orchay 디렉토리)
    - upload artifact
```

### 5.2 Publish-PyPI Job

```yaml
publish-pypi:
  needs: build
  if: startsWith(github.ref, 'refs/tags/') && !inputs.test_pypi
  permissions:
    id-token: write
  environment:
    name: pypi
    url: https://pypi.org/p/orchay
```

### 5.3 Publish-TestPyPI Job

```yaml
publish-testpypi:
  needs: build
  if: inputs.test_pypi
  permissions:
    id-token: write
  environment:
    name: testpypi
```

---

## 6. 사용 방법

### 6.1 PyPI 배포 (자동)

```bash
# 버전 태그 생성 및 푸시
git tag v0.1.0
git push origin v0.1.0
```

### 6.2 TestPyPI 배포 (수동)

GitHub Actions → Publish to PyPI → Run workflow → ☑️ test_pypi

### 6.3 설치 확인

```bash
# PyPI
pipx install orchay

# TestPyPI
pipx install --index-url https://test.pypi.org/simple/ orchay
```

---

## 7. 사전 요구사항 (TSK-03-03)

PyPI에서 Trusted Publishing 설정 필요:

| 설정 | 값 |
|------|-----|
| Repository | `{owner}/orchay` |
| Workflow name | `pypi.yml` |
| Environment name | `pypi` |

---

## 8. 다음 단계

| 다음 Task | 설명 |
|-----------|------|
| TSK-03-03 | PyPI Trusted Publishing 설정 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-30 | 초기 구현 |
