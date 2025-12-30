# TSK-03-03: PyPI Trusted Publishing 설정 - 기술설계

> **Category**: infrastructure
> **Domain**: devops
> **Status**: detail-design [dd]
> **PRD Reference**: PRD 5.3 PyPI Trusted Publishing 설정

---

## 1. 개요

### 1.1 목적

PyPI Trusted Publishing을 설정하여 GitHub Actions에서 API 토큰 없이 안전하게 PyPI에 패키지를 배포할 수 있도록 합니다. OIDC(OpenID Connect) 기반 인증을 사용하여 보안을 강화합니다.

### 1.2 범위

| 포함 | 제외 |
|------|------|
| PyPI 계정 생성 가이드 | PyPI 워크플로우 작성 (TSK-03-02) |
| 프로젝트 등록 절차 | 실제 배포 실행 |
| Trusted Publishing 구성 | CI/CD 파이프라인 테스트 |
| GitHub repository 연결 | 버전 관리 전략 |

---

## 2. 현재 상태

### 2.1 PyPI 프로젝트 상태

- PyPI에 `orchay` 프로젝트 미등록
- Trusted Publishing 미구성
- API 토큰 미발급

### 2.2 GitHub 환경

- Repository: 존재 (orchay)
- Environment: `pypi` 미생성
- Secrets: PyPI 관련 설정 없음

---

## 3. 목표 상태

### 3.1 PyPI 설정

```
PyPI (pypi.org)
└── orchay 프로젝트
    └── Trusted Publishing
        ├── Owner: {github-username}
        ├── Repository: {repo-name}
        ├── Workflow: pypi.yml
        └── Environment: pypi
```

### 3.2 GitHub 설정

```
GitHub Repository
└── Settings
    └── Environments
        └── pypi
            └── (Protection rules: 선택적)
```

---

## 4. 기술 요구사항

### 4.1 PyPI Trusted Publishing 구성 요소

| 항목 | 값 | 설명 |
|------|-----|------|
| Owner | `{github-username}` | GitHub 사용자명 또는 조직명 |
| Repository | `orchay` | GitHub 저장소 이름 |
| Workflow name | `pypi.yml` | 워크플로우 파일명 |
| Environment name | `pypi` | GitHub Environment 이름 |

### 4.2 GitHub Actions 권한 요구사항

```yaml
permissions:
  id-token: write  # OIDC 토큰 발급 필수
```

### 4.3 OIDC 인증 흐름

```
GitHub Actions
    │
    ├── 1. OIDC 토큰 요청 (id-token: write)
    │
    ▼
GitHub OIDC Provider
    │
    ├── 2. JWT 토큰 발급
    │      (iss: https://token.actions.githubusercontent.com)
    │      (sub: repo:{owner}/{repo}:environment:{env})
    │
    ▼
PyPI
    │
    ├── 3. JWT 검증
    ├── 4. Trusted Publisher 매칭 확인
    └── 5. 업로드 권한 부여
```

---

## 5. 구현 계획

### 5.1 PyPI 계정 생성 (사전 조건)

1. https://pypi.org/account/register/ 접속
2. 계정 생성 (이메일 인증 필요)
3. 2FA 활성화 권장

### 5.2 PyPI 프로젝트 생성

**방법 1: 첫 업로드로 자동 생성**
- 처음 패키지 업로드 시 프로젝트 자동 생성
- Trusted Publishing 사전 구성 가능 (Pending Publisher)

**방법 2: Pending Publisher 사용 (권장)**
1. PyPI 로그인
2. Account → Publishing → Add a new pending publisher
3. 정보 입력:
   - PyPI project name: `orchay`
   - Owner: `{github-username}`
   - Repository: `{repo-name}`
   - Workflow name: `pypi.yml`
   - Environment name: `pypi`

### 5.3 GitHub Environment 생성

1. GitHub Repository → Settings → Environments
2. "New environment" 클릭
3. Name: `pypi` 입력
4. (선택) Protection rules 설정:
   - Required reviewers
   - Wait timer
   - Deployment branches

### 5.4 워크플로우 연동 확인

TSK-03-02에서 생성한 `pypi.yml`이 다음을 포함하는지 확인:

```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # 필수
    environment:
      name: pypi
      url: https://pypi.org/p/orchay
    steps:
      - uses: pypa/gh-action-pypi-publish@release/v1
        # with 섹션 없음 (Trusted Publishing 사용)
```

---

## 6. 설정 절차 상세

### 6.1 PyPI Pending Publisher 등록

**경로**: PyPI → Account → Publishing → Add a new pending publisher

**입력 필드**:

| 필드 | 값 | 비고 |
|------|-----|------|
| PyPI project name | `orchay` | 패키지 이름 |
| Owner | `{owner}` | GitHub 사용자명/조직명 |
| Repository name | `{repo}` | 저장소 이름 |
| Workflow name | `pypi.yml` | 정확한 파일명 |
| Environment name | `pypi` | GitHub Environment |

### 6.2 검증

Trusted Publisher 등록 후:
1. PyPI → Your projects → orchay (Pending)
2. Trusted publishers 탭에서 등록 확인
3. GitHub Actions 워크플로우 실행으로 최종 검증

---

## 7. 보안 고려사항

### 7.1 장점 (API 토큰 대비)

| 항목 | Trusted Publishing | API 토큰 |
|------|-------------------|----------|
| 토큰 관리 | 불필요 | Secrets 저장 필요 |
| 유출 위험 | 없음 | 토큰 유출 가능 |
| 권한 범위 | 워크플로우 한정 | 토큰 권한에 따름 |
| 갱신 | 자동 | 수동 갱신 필요 |

### 7.2 보안 권장사항

1. **Environment Protection**:
   - main 브랜치에서만 배포 허용
   - Required reviewers 설정 (선택)

2. **버전 태그 검증**:
   - `v*` 태그 푸시 시에만 배포 실행

3. **2FA 활성화**:
   - PyPI 계정에 2FA 필수 권장

---

## 8. 수용 기준

| 기준 | 검증 방법 |
|------|----------|
| PyPI 계정 존재 | PyPI 로그인 성공 |
| 프로젝트 등록 | PyPI에서 `orchay` 프로젝트 확인 |
| Trusted Publishing 구성 | Publishing 탭에서 GitHub 연결 확인 |
| GitHub Environment 존재 | Settings → Environments → pypi 확인 |

---

## 9. 의존성

### 9.1 선행 Task

| Task | 상태 | 설명 |
|------|------|------|
| TSK-03-02 | [ ] | PyPI 배포 워크플로우 생성 |

### 9.2 후속 Task

| Task | 설명 |
|------|------|
| TSK-04-01 | README 설치 가이드 작성 |

---

## 10. 체크리스트

- [ ] PyPI 계정 생성
- [ ] PyPI 2FA 활성화
- [ ] Pending Publisher 등록
- [ ] GitHub Environment (`pypi`) 생성
- [ ] 워크플로우 `id-token: write` 권한 확인
- [ ] 테스트 배포로 연동 검증

---

## 11. 참고 자료

| 자료 | URL |
|------|-----|
| PyPI Trusted Publishing 문서 | https://docs.pypi.org/trusted-publishers/ |
| GitHub OIDC | https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect |
| pypa/gh-action-pypi-publish | https://github.com/pypa/gh-action-pypi-publish |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025-12-30 | 초기 기술설계 작성 |
