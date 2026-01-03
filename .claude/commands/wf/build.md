---
subagent:
  primary: backend-architect
  parallel:
    - backend-architect
    - frontend-architect
  conditions:
    backend-only: backend-architect
    frontend-only: frontend-architect
    infrastructure: devops-architect
  description: TDD 기반 백엔드/프론트엔드 병렬 구현
mcp-servers: [context7, playwright]
hierarchy-input: true
parallel-processing: true
---

# /wf:build - TDD 기반 구현 (Lite)

> **상태 전환**: `[ap] 승인` → `[im] 구현`
> **적용 category**: `development`, `infrastructure`
> **계층 입력**: WP/ACT/Task 단위 (하위 Task 병렬 처리)

## 사용법

```bash
/wf:build [PROJECT/]<WP-ID | ACT-ID | Task-ID>
```

| 예시 | 설명 |
|------|------|
| `/wf:build TSK-01-01` | Task 단위 |
| `/wf:build ACT-01-01` | ACT 내 모든 `[ap]` Task 병렬 |
| `/wf:build WP-01` | WP 내 모든 Task 병렬 |

---

## 실행 플로우

| Task 유형 | 실행 단계 | Agent |
|----------|----------|-------|
| Backend-only | 1 → 2 → 4 → 5 → 6 → 7 → 8 | backend-architect |
| Frontend-only | 1 → 3 → 4 → 5 → 6 → 7 → 8 | frontend-architect |
| Full-stack | 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 | backend + frontend |
| infrastructure | 1 → 2(간소화) → 7 → 8 | devops-architect |

---

## 실행 과정

### 0단계: 사전 검증 ⭐

명령어 실행 전 상태 검증:

```bash
npx tsx .orchay/script/transition.ts {Task-ID} build -p {project} --start
```

| 결과 | 처리 |
|------|------|
| `canTransition: true` | 다음 단계 진행 |
| `canTransition: false` | 에러 출력 후 즉시 종료 |

**에러 출력:**
```
[ERROR] 현재 상태 [{currentStatus}]에서 'build' 명령어를 사용할 수 없습니다.
필요한 상태: [ap]
```

### 1단계: 설계 분석

```
탐색 경로 (category별):
├── development:
│   ├── 010-design.md ✅ (통합 설계 문서)
│   ├── 025-traceability-matrix.md (FR/BR → 테스트 매핑) ⭐
│   └── 026-test-specification.md (UT/E2E 시나리오) ⭐
├── 화면 자료 (Frontend 포함 시):
│   ├── ui-assets/*.png|jpg|svg ⭐ (최우선 참조)
│   ├── 011-ui-design.md (Fallback)
│   └── .orchay/{project}/ui-theme-*.md (테마 가이드)
└── infrastructure: 010-tech-design.md
```

**구현 플래그 설정**:
- `hasBackend`: "Backend", "API", "Service", "Controller" 키워드
- `hasFrontend`: "Frontend", "UI", "화면", "Vue", "React" 키워드

### 2단계: Backend 구현 (TDD)

**Agent**: backend-architect

1. **Red Phase** (`026-test-specification.md` 기반):
   - 단위 테스트 시나리오 표 → Vitest 코드 변환
   - `025-traceability-matrix.md`로 커버리지 확인

2. **Green Phase**:
   - Controller/Service/Repository 구현
   - Prisma 스키마/모델 구현

3. **Refactor Phase** ⭐:
   - **SOLID 원칙**
     - SRP: 클래스/함수 단일 책임
     - OCP: 확장에 열림, 수정에 닫힘
     - DIP: 추상화 의존
   - **클린 코드**
     - 의미있는 네이밍
     - 함수 크기 최소화 (20줄 이하 권장)
     - 중복 제거 (DRY)
   - **프로젝트 규칙** (→ `CLAUDE.md`)

### 3단계: Frontend 구현

**Agent**: frontend-architect
**MCP**: context7 + playwright

1. **UI Assets 기반 구현** ⭐:
   ```
   구현 우선순위:
   1. ui-assets/ 이미지 → 레이아웃/컴포넌트 배치 추출
   2. 011-ui-design.md → 문서 기반 화면 정보
   3. ui-theme-*.md → 색상/스타일 시스템
   ```
   - 레이아웃: 이미지 기준 그리드/플렉스 구조
   - 컴포넌트: 디자인 시안과 동일 배치
   - 색상/폰트: 테마 가이드 또는 이미지 추출

2. **API 연동**:
   - useFetch/useAsyncData 활용
   - 에러 처리 및 사용자 피드백

3. **E2E 테스트 코드** (`026-test-specification.md` 기반):
   - E2E 시나리오 표 → Playwright 코드 변환
   - data-testid 셀렉터 목록 활용
   - Fixture 데이터 생성

> ⚠️ **서버 재사용 규칙**: E2E 테스트 실행 전 기존 개발 서버가 실행 중인지 확인하세요.
> - 실행 중이면 새로 실행하지 말고 기존 서버 사용
> - 서버가 없을 때만 새로 시작 (`npm run dev` 등)
> - 테스트 완료 후 서버 종료하지 않음

### 4단계: 테스트-수정 루프 ⭐

**최대 5회 재시도** (초과 시 수동 개입 요청)

```
🔄 TDD 테스트-수정 루프:
├── 1차: 2/12 실패 → Service 로직 수정
├── 2차: 12/12 통과 ✅ (루프 종료)

🔄 E2E 테스트-수정 루프:
├── 1차: 3/8 실패 → Locator 수정
├── 2차: 1/8 실패 → waitFor 추가
├── 3차: 8/8 통과 ✅ (루프 종료)
```

### 5단계: 테스트 결과서 생성 ⭐

```
생성 파일:
├── 070-tdd-test-results.md (Task 폴더)
├── 070-e2e-test-results.md (Task 폴더)
└── test-results/[timestamp]/
    ├── tdd/coverage/
    └── e2e/
        ├── e2e-test-report.html ← 브라우저 열기
        └── screenshots/
```

**WBS 업데이트**: `test-result: none` → `pass` | `fail`

**테스트 결과서 필수 포함 항목**:
- 테스트 실행 요약 (총 테스트 수, 성공/실패 수, 실행 시간)
- 커버리지 리포트 (라인, 브랜치, 함수)
- 실패 테스트 상세 (실패 원인, 수정 내역)
- 테스트-수정 루프 이력 (시도 횟수, 각 시도별 결과)
- 요구사항 커버리지 매핑 (FR/BR → 테스트 ID)

### 7단계: 구현 보고서 생성

- `030-implementation.md` 생성
- 템플릿: `.orchay/templates/030-implementation.md`

**필수 포함 항목** (분할 문서 연계):
- 상세설계 테스트 시나리오 ↔ 실제 테스트 매핑
- 요구사항 커버리지 (FR/BR → 테스트 ID)

### 8단계: 상태 전환 (자동)

```bash
# {project}: 입력에서 파싱 (예: deployment/TSK-01-01 → deployment)
# 프로젝트 미명시 시 wf-common-lite.md 규칙에 따라 자동 결정
npx tsx .orchay/script/transition.ts {Task-ID} build -p {project}
```
- 성공: `{ "success": true, "newStatus": "im" }`

---

## 프로젝트 코딩 규칙 (CLAUDE.md)

### Backend
- TypeScript 필수
- 파일 접근은 Server Routes 통해서만
- Prisma ORM 사용

### Frontend
- Vue 3 Composition API (`<script setup>`)
- 일반 HTML 금지, **PrimeVue 4.x** 우선 사용
- Pinia 상태 관리

### CSS 중앙화 원칙 ⭐
- `:style` 및 HEX 하드코딩 **금지**
- `main.css` Tailwind 클래스로 통일
- **권장**: `:class="\`node-icon-${type}\`"`
- **금지**: `:style="{ backgroundColor: '#3b82f6' }"`
- **예외**: 동적 계산 필수 (paddingLeft, 드래그)

---

## 품질 기준

| 항목 | 기준 |
|------|------|
| TDD 커버리지 | 80% 이상 |
| E2E 통과율 | 100% |
| 정적 분석 | Pass |
| 요구사항 커버리지 | FR/BR 100% |

---

## 출력 예시 (Full-stack)

```
[wf:build] TDD 기반 구현

Task: TSK-01-01-01 | Full-stack
상태 전환: [ap] → [im]

📋 1단계: 설계 분석 (분할 문서 연계)
├── 025-traceability-matrix.md: FR 6, BR 6 매핑
├── 026-test-specification.md: UT 12건, E2E 8건
└── ui-assets/: 3개 이미지 분석 완료

🔧 2단계: Backend (backend-architect)
├── Red: UT-001~012 테스트 작성
├── Green: Controller/Service 구현
└── 테스트: 12/12 ✅ [2회 시도]

🎨 3단계: Frontend (frontend-architect)
├── UI Assets 기반 구현 ✅
├── 테마: ui-theme-dark.md 적용
└── E2E: 8/8 ✅ [3회 시도]

🔄 4단계: 테스트-수정 루프
├── TDD: 2회 시도 → 12/12 ✅
└── E2E: 3회 시도 → 8/8 ✅

📄 5단계: 테스트 결과서 생성
├── 070-tdd-test-results.md ✅
├── 070-e2e-test-results.md ✅
├── test-results/20250101-120000/
│   ├── tdd/coverage/ (85%)
│   └── e2e/screenshots/ (8장)
└── WBS: test-result → pass

📊 품질: TDD 85% | E2E 100% | FR/BR 100%

다음: /wf:audit 또는 /wf:verify

---
ORCHAY_DONE:{project}/TSK-01-01-01:build:success
```

---

## 에러 케이스

| 에러 | 메시지 |
|------|--------|
| 잘못된 category | `[ERROR] development/infrastructure만 지원` |
| 잘못된 상태 | `[ERROR] 승인 상태가 아닙니다. /wf:approve 실행 필요` |
| 설계 문서 없음 | `[ERROR] 설계 문서가 없습니다 (010-design.md)` |
| UI Assets 없음 | `[INFO] ui-assets/ 없음. 문서/테마 참조` |
| TDD 5회 초과 | `[ERROR] TDD 5회 시도 후 실패. 수동 개입 필요` |
| E2E 5회 초과 | `[ERROR] E2E 5회 시도 후 실패. 수동 개입 필요` |

---

## 완료 신호

작업의 **모든 출력이 끝난 후 가장 마지막에** 다음 형식으로 출력:

**성공:**
```
ORCHAY_DONE:{project}/{task-id}:build:success
```

**실패:**
```
ORCHAY_DONE:{project}/{task-id}:build:error:{에러 요약}
```

> ⚠️ 이 출력은 orchay 스케줄러가 작업 완료를 감지하는 데 사용됩니다. 반드시 정확한 형식으로 출력하세요.

---

## 공통 모듈 참조

@.claude/includes/wf-common-lite.md
@.claude/includes/wf-conflict-resolution-lite.md
@.claude/includes/wf-auto-commit-lite.md

---

<!--
wf:build lite
Version: 1.3
-->
