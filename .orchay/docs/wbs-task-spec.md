# WBS Task 속성 스펙

> **공통 참조 문서**: wbs.md 명령어와 orchay 스케줄러에서 공통으로 사용하는 Task 속성 정의

---

## 1. 기본 속성

모든 Task에 필수적으로 포함되는 속성입니다.

| 속성 | 필수 | 설명 | 예시 |
|------|------|------|------|
| category | O | 작업 유형 | `development`, `defect`, `infrastructure` |
| domain | O | 기술 영역 | `frontend`, `backend`, `database`, `infra`, `fullstack`, `docs`, `test` |
| status | O | 상태 + 기호 | `[ ]`, `[dd]`, `[ap]`, `[im]`, `[xx]` 등 |
| priority | O | 우선순위 | `critical`, `high`, `medium`, `low` |
| assignee | - | 담당자 ID | `hong`, `-` (미지정) |
| schedule | - | 일정 | `2026-01-15 ~ 2026-01-21` |
| tags | - | 태그 목록 | `auth, crud, validation` |
| depends | - | 선행 Task | `TSK-01-01-01` |
| blocked-by | - | 차단 Task | `TSK-01-01-01` |
| note | - | 비고 | 자유 텍스트 |

### 1.1 category (작업 유형)

| category | 설명 | 워크플로우 |
|----------|------|------------|
| `development` | 신규 기능 개발 | `[ ]` → `[dd]` → `[ap]` → `[im]` → `[xx]` |
| `defect` | 결함 수정 | `[ ]` → `[an]` → `[fx]` → `[vf]` → `[xx]` |
| `infrastructure` | 인프라/기술 작업 | `[ ]` → `[dd]?` → `[im]` → `[xx]` |

### 1.2 domain (기술 영역)

| domain | 설명 | 대표 작업 |
|--------|------|----------|
| `frontend` | 클라이언트 UI/UX | Vue 컴포넌트, 페이지, 스타일링, 상태관리 |
| `backend` | 서버 비즈니스 로직 | API 엔드포인트, 서비스, 미들웨어 |
| `database` | 데이터 계층 | 스키마, 마이그레이션, 쿼리 최적화 |
| `infra` | 인프라/DevOps | 배포, CI/CD, 모니터링, 환경설정 |
| `fullstack` | 전체 스택 | E2E 기능, 통합 작업 |
| `docs` | 문서화 | API 문서, 사용자 가이드, README |
| `test` | 테스트 전용 | 단위/통합/E2E 테스트 작성 |

### 1.3 status (상태 기호)

#### 칸반 컬럼 매핑

| 칸반 컬럼 | 통합 상태 | 의미 |
|-----------|-----------|------|
| Todo | `[ ]` | 대기 |
| Design | `[dd]`, `[an]` | 설계/분석 |
| Approve | `[ap]` | 승인 |
| Implement | `[im]`, `[fx]` | 구현/수정 |
| Verify | `[vf]` | 검증 |
| Done | `[xx]` | 완료 |

#### 카테고리별 세부 상태

| 기호 | 의미 | 사용 카테고리 |
|------|------|--------------|
| `[ ]` | Todo (대기) | 공통 |
| `[dd]` | 설계 | development, infrastructure |
| `[an]` | 분석 | defect |
| `[ap]` | 승인 | development |
| `[im]` | 구현 | development, infrastructure |
| `[fx]` | 수정 | defect |
| `[vf]` | 검증/테스트 | defect |
| `[xx]` | 완료 | 공통 |

### 1.4 priority (우선순위)

| 우선순위 | 설명 | 스케줄링 순서 |
|----------|------|--------------|
| `critical` | 긴급, 차단 이슈 | 최우선 |
| `high` | 중요 기능 | 2순위 |
| `medium` | 일반 기능 | 3순위 |
| `low` | 낮은 우선순위 | 4순위 |

---

## 2. PRD 연동 속성

PRD(Product Requirements Document)에서 추출한 요구사항 컨텍스트입니다.

| 속성 | 필수* | 설명 | 예시 |
|------|-------|------|------|
| prd-ref | O | PRD 요구사항 ID | `FR-AUTH-001`, `US-001` |
| requirements | O | 기능 요구사항 목록 | 구현해야 할 기능 상세 |
| acceptance | O | 인수 조건 (AC) | 완료 판정 기준 |
| constraints | - | 제약사항/비기능 요구사항 | 성능, 보안, 규격 제한 |
| test-criteria | - | 테스트 기준 | 검증해야 할 시나리오 |

*standard 레벨 이상에서 필수

### PRD → Task 매핑 규칙

| PRD 섹션 | Task 속성 | 추출 방법 |
|----------|----------|----------|
| 기능 요구사항 (FR-XXX) | prd-ref, requirements | 해당 기능 ID 및 상세 내용 |
| 인수 조건 (AC) | acceptance | 완료 판정 기준 목록 |
| 비기능 요구사항 (NFR) | constraints | 성능, 보안, 규격 제한 |
| 사용자 스토리 | note | 요약 또는 참조 |

---

## 3. TRD 연동 속성

TRD(Technical Requirements Document)에서 추출한 기술 컨텍스트입니다.

| 속성 | 필수* | 설명 | 예시 |
|------|-------|------|------|
| tech-spec | O | 기술 스펙 요약 | 프레임워크, 라이브러리, 패턴 |
| api-spec | - | API 명세 | 엔드포인트, 요청/응답 스키마 |
| data-model | - | 관련 데이터 모델 | 엔티티, 필드, 관계 |
| ui-spec | - | UI 스펙 (프론트엔드) | 컴포넌트, 레이아웃, 인터랙션 |

*detailed 레벨 이상에서 필수

### TRD → Task 매핑 규칙

| TRD 섹션 | Task 속성 | 추출 방법 |
|----------|----------|----------|
| 기술 스택 | tech-spec | 해당 Task에 사용할 기술 |
| API 설계 | api-spec | 엔드포인트, 스키마, 에러코드 |
| 데이터 모델 | data-model | 관련 엔티티, 필드, 관계 |
| UI/컴포넌트 설계 | ui-spec | 컴포넌트, 레이아웃, 스타일 |
| 성능 요구사항 | constraints | 응답시간, 처리량 제한 |

---

## 4. Task 상세도 레벨

Task의 복잡도와 중요도에 따라 포함할 속성 범위를 결정합니다.

| 레벨 | 포함 속성 | 사용 시점 |
|------|----------|----------|
| `minimal` | 기본 속성만 | 단순 작업, 인프라 |
| `standard` | + prd-ref, requirements, acceptance | 일반 개발 |
| `detailed` | + tech-spec, api-spec, data-model | 복잡한 기능 |
| `full` | 모든 속성 포함 | 핵심 기능, 신규 개발 |

### 레벨 결정 기준

| Task 특성 | 권장 레벨 |
|----------|----------|
| 인프라/설정 작업 | minimal |
| 단순 CRUD | standard |
| 비즈니스 로직 | detailed |
| 핵심 기능/신규 개발 | full |

---

## 5. Task 예시

### 5.1 minimal 레벨 (인프라 작업)

```markdown
### TSK-00-01: orchay 프로젝트 구조 초기화
- category: infrastructure
- domain: infra
- status: [ ]
- priority: critical
- note: orchay-init 스킬 실행 필요
```

### 5.2 standard 레벨 (일반 개발)

```markdown
#### TSK-01-02-01: 프로젝트 목록 조회 API
- category: development
- domain: backend
- status: [ ]
- priority: high
- depends: TSK-01-01-01

##### PRD 요구사항
- prd-ref: FR-PROJ-001
- requirements:
  - 사용자별 프로젝트 목록 조회
  - 페이지네이션 지원
- acceptance:
  - 200 응답 + 프로젝트 배열 반환
  - 빈 목록 시 빈 배열 반환
```

### 5.3 detailed 레벨 (복잡한 기능)

```markdown
#### TSK-01-01-01: 이메일/비밀번호 로그인 구현
- category: development
- domain: backend
- status: [ ]
- priority: high

##### PRD 요구사항
- prd-ref: FR-AUTH-001
- requirements:
  - 이메일/비밀번호로 로그인
  - JWT 액세스 토큰 + 리프레시 토큰 발급
- acceptance:
  - 유효한 자격증명 → 토큰 발급 성공
  - 잘못된 이메일 → "존재하지 않는 계정" 에러
- constraints:
  - 비밀번호 최소 8자
  - 응답시간 < 500ms

##### 기술 스펙 (TRD)
- tech-spec:
  - Framework: Flutter + Riverpod
  - Auth: Supabase Auth
- api-spec:
  - POST /api/v1/auth/login
  - Request: { email: string, password: string }
  - Response: { accessToken, refreshToken, user }
- data-model:
  - User: id, email, passwordHash, createdAt
```

### 5.4 full 레벨 (핵심 기능)

```markdown
#### TSK-01-01-02: 로그인 화면 UI 구현
- category: development
- domain: frontend
- status: [ ]
- priority: high
- depends: TSK-01-01-01

##### PRD 요구사항
- prd-ref: FR-AUTH-001, UI-AUTH-001
- requirements:
  - 이메일/비밀번호 입력 폼
  - 실시간 유효성 검사 피드백
  - 로딩 상태 표시
- acceptance:
  - 이메일 형식 오류 시 즉시 피드백
  - 비밀번호 8자 미만 시 경고
  - 로그인 중 버튼 비활성화 + 스피너
- constraints:
  - 모바일 최적화 (터치 영역 최소 44px)
  - 접근성: 스크린리더 호환
- test-criteria:
  - 정상 로그인 성공
  - 이메일 형식 검증 실패
  - 비밀번호 불일치

##### 기술 스펙 (TRD)
- tech-spec:
  - Widget: StatefulWidget + Riverpod
  - Validation: flutter_form_builder
  - State: AsyncValue 패턴
- api-spec:
  - 로그인 API 호출 (TSK-01-01-01 참조)
- data-model:
  - LoginFormState: email, password, isLoading, error
- ui-spec:
  - 컴포넌트: EmailField, PasswordField, SubmitButton
  - 레이아웃: Column, 중앙 정렬, 패딩 24px
  - 테마: 앱 기본 테마 적용
```

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-27 | 초기 스펙 분리 (wbs.md, orchay-prd.md에서 추출) |
