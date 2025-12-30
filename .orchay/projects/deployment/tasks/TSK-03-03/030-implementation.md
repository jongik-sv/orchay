# TSK-03-03: PyPI Trusted Publishing 설정

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-03-03 |
| 상태 | implement [im] |
| Category | infrastructure |
| 작성일 | 2025-12-30 |
| 작업 유형 | 수동 설정 (웹 콘솔) |

---

## 1. 구현 개요

### 1.1 목표

PyPI에서 Trusted Publishing을 설정하여 GitHub Actions에서 API 키 없이 패키지 배포 가능하게 함

### 1.2 PRD 참조

- prd-ref: PRD 5.3 PyPI Trusted Publishing 설정

### 1.3 작업 유형

> ⚠️ **수동 설정 필요**: 이 Task는 PyPI 웹 콘솔에서 수동으로 설정해야 합니다.

---

## 2. Trusted Publishing 개요

### 2.1 개념

Trusted Publishing은 OpenID Connect (OIDC)를 사용하여 GitHub Actions가 PyPI에 직접 인증할 수 있게 합니다.

| 기존 방식 | Trusted Publishing |
|----------|-------------------|
| API 토큰 저장 | OIDC 토큰 사용 |
| Secret 관리 필요 | Secret 불필요 |
| 토큰 유출 위험 | 토큰 없음 |

### 2.2 작동 원리

```
GitHub Actions → OIDC Token → PyPI 검증 → 배포 허용
```

---

## 3. 설정 가이드

### 3.1 사전 요구사항

| 항목 | 상태 |
|------|------|
| PyPI 계정 | 필요 |
| GitHub Repository | ✅ 존재 |
| pypi.yml 워크플로우 | ✅ TSK-03-02에서 생성 |

### 3.2 PyPI 프로젝트 생성 (신규)

**방법 A: 첫 배포 시 자동 생성**
```bash
git tag v0.1.0
git push origin v0.1.0
# → GitHub Actions 실행 → PyPI 프로젝트 자동 생성
```

**방법 B: 수동 생성 (Pending Publisher)**

1. https://pypi.org 로그인
2. "Your projects" → "Publishing" 탭
3. "Add a new pending publisher" 클릭

### 3.3 Trusted Publishing 설정

#### Step 1: PyPI 접속

```
URL: https://pypi.org/manage/account/publishing/
```

#### Step 2: Pending Publisher 추가

| 필드 | 값 |
|------|-----|
| PyPI Project Name | `orchay` |
| Owner | `{GitHub 사용자명 또는 조직명}` |
| Repository name | `orchay` |
| Workflow name | `pypi.yml` |
| Environment name | `pypi` |

#### Step 3: 설정 확인

```
✅ Trusted Publisher가 추가되면:
- 해당 워크플로우에서 배포 시 자동 인증
- API 토큰 불필요
```

### 3.4 GitHub Environment 설정

GitHub Repository → Settings → Environments:

1. **pypi** environment 생성
2. (선택) Protection rules 설정
   - Required reviewers
   - Wait timer

---

## 4. 워크플로우 연동

### 4.1 pypi.yml 설정 확인 (TSK-03-02)

```yaml
publish-pypi:
  permissions:
    id-token: write  # ← 필수
  environment:
    name: pypi       # ← PyPI 설정과 일치해야 함
```

### 4.2 TestPyPI 설정 (선택)

TestPyPI도 동일하게 설정 가능:

| 필드 | 값 |
|------|-----|
| URL | https://test.pypi.org/manage/account/publishing/ |
| Environment name | `testpypi` |

---

## 5. 검증 방법

### 5.1 테스트 배포

```bash
# TestPyPI로 테스트 (수동 실행)
GitHub Actions → Publish to PyPI → Run workflow → ☑️ test_pypi

# 또는 실제 배포
git tag v0.1.0
git push origin v0.1.0
```

### 5.2 성공 확인

```
✅ GitHub Actions 로그:
   "Successfully uploaded orchay-0.1.0..."

✅ PyPI 확인:
   https://pypi.org/project/orchay/
```

---

## 6. 요구사항 충족

| 요구사항 | 구현 방법 | 상태 |
|----------|----------|------|
| PyPI 계정 생성 | 수동 (웹) | ⬜ 사용자 수행 |
| 프로젝트 생성 및 Trusted Publishing | 수동 (웹) | ⬜ 사용자 수행 |
| GitHub repository 연결 | pypi.yml + environment | ✅ 코드 완료 |

---

## 7. Acceptance Criteria

| 조건 | 검증 방법 |
|------|----------|
| PyPI에서 orchay 프로젝트 존재 | https://pypi.org/project/orchay/ 접속 |
| Trusted Publishing 활성화 상태 | GitHub Actions 배포 성공 (토큰 없이) |

---

## 8. 체크리스트

사용자가 수행해야 할 작업:

- [ ] PyPI 계정 로그인
- [ ] Trusted Publishing 설정 추가
  - Owner: `{your-github-username}`
  - Repository: `orchay`
  - Workflow: `pypi.yml`
  - Environment: `pypi`
- [ ] GitHub Environment `pypi` 생성
- [ ] 테스트 태그 푸시로 검증

---

## 9. 참고 자료

| 리소스 | URL |
|--------|-----|
| PyPI Trusted Publishing 문서 | https://docs.pypi.org/trusted-publishers/ |
| GitHub OIDC 문서 | https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-30 | 설정 가이드 작성 |
