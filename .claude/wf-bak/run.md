# /wf:run - 자동 워크플로우 실행

> **auto의 경량 버전**: wbs.md에서 실행 가능한 Task를 찾아 **Subagent로 병렬 실행**합니다.

## 사용법

```bash
/wf:run [PROJECT/][범위] [부분실행] [옵션]

# 인자 없이 실행 (의존관계 분석 → 첫 Task 자동 실행)
/wf:run

# 특정 범위 지정
/wf:run WP-01              # WP-01 내 Task만 (자동 프로젝트)
/wf:run orchay/WP-01       # 프로젝트 명시
/wf:run TSK-01-01-01       # 단일 Task (자동 검색)
/wf:run orchay/TSK-01-01   # 프로젝트 명시

# 부분 실행
/wf:run TSK-XX --until detail-design   # 상세설계까지
/wf:run TSK-XX 상세설계까지             # 한글 자연어

# 옵션
/wf:run --dry-run      # 실행 계획만 출력
/wf:run --continue     # 실패해도 계속
/wf:run --max 5        # 최대 5개 Task
/wf:run --skip-review  # review/apply 건너뛰기
/wf:run --skip-audit   # audit/patch 건너뛰기
```

---

## Subagent 매핑

| 단계 | 명령어 | Subagent | 역할 |
|------|--------|----------|------|
| 기본설계 | `/wf:start` | `requirements-analyst` | 요구사항 분석 |
| 화면설계 | `/wf:ui` | `frontend-architect` | UI/UX 설계 |
| 상세설계 | `/wf:draft` | `system-architect` | 아키텍처 설계 |
| 설계리뷰 | `/wf:review` | `refactoring-expert` | 설계 품질 분석 |
| 리뷰반영 | `/wf:apply` | `refactoring-expert` | 설계리뷰 반영 |
| 구현 | `/wf:build` | `backend-architect` + `frontend-architect` | 병렬 구현 |
| 결함수정 | `/wf:fix` | `backend-architect` / `frontend-architect` | defect 수정 |
| 단위테스트 | `/wf:test` | `quality-engineer` | TDD + E2E |
| 코드리뷰 | `/wf:audit` | `refactoring-expert` | 코드 품질 분석 |
| 패치반영 | `/wf:patch` | `refactoring-expert` | 코드리뷰 반영 |
| 통합테스트 | `/wf:verify` | `quality-engineer` | 통합 테스트 |
| 완료 | `/wf:done` | `requirements-analyst` | 매뉴얼 작성, 상태 완료 |
| 설계생략 | `/wf:skip` | `devops-architect` | infra 설계 생략 |
| 인프라 | `/wf:build` | `devops-architect` | CI/CD, 배포 |

---

## 카테고리별 워크플로우

### development
```
[ ] → start(requirements-analyst) → [dd]
    → review(refactoring-expert) → apply → approve(사람) → [ap]
    → build(backend+frontend) → test → [im]
    → audit(refactoring-expert) → patch → verify(quality-engineer) → [vf]
    → done(사람) → [xx]
```

### defect
```
[ ] → start(requirements-analyst) → [dd]
    → review(refactoring-expert) → apply → approve(사람) → [ap]
    → fix(backend/frontend) → test → [im]
    → audit → patch → verify → [vf]
    → done(사람) → [xx]
```

### infrastructure
```
[ ] → start/skip(devops-architect) → [dd]
    → approve(사람) → [ap]
    → build(devops-architect) → [im]
    → audit → patch → verify → [vf]
    → done(사람) → [xx]
```

---

## 부분 실행 옵션

| --until | 한글 자연어 | 상태 | 실행 단계 |
|---------|------------|------|----------|
| `design` | `설계까지` | `[dd]` | start |
| `review` | `리뷰까지` | `[dd]` | start + review |
| `apply` | `리뷰반영까지` | `[dd]` | start + review + apply |
| `approve` | `승인까지` | `[ap]` | 사람 실행 (자동화 불가) |
| `build` | `구현까지` | `[im]` | build + test |
| `audit` | `코드리뷰까지` | `[im]` | audit |
| `patch` | `패치까지` | `[im]` | audit + patch |
| `verify` | `검증까지` | `[vf]` | verify |
| `done` | `완료까지` | `[xx]` | 사람 실행 (자동화 불가) |

---

## 핵심 실행 로직

```
executeAutoWorkflow(taskId, options):
  task = loadTaskFromWbs(taskId)
  target = parseTarget(options.until) || 'done'

  while !isTargetReached(currentStatus, target):
    mapping = subagentMapping[task.category][currentStatus]

    // 1. preActions (review/apply, audit/patch)
    for preAction in mapping.preActions:
      if isTargetReached → STOP
      execute(preAction.subagent || mainAgent)

    // 2. mainAction (build, verify, done)
    if isTargetReached → STOP
    execute(mapping.subagent || mainAgent)

    // 3. postActions (test after build/fix)
    for postAction in mapping.postActions:
      if isTargetReached → STOP
      execute(postAction.subagent)

    currentStatus = mapping.next

  return { success, finalStatus, stoppedAt: target }
```

### 상태별 매핑

```javascript
// preAction/postAction 정의 (subagent 명시)
const review = { action: 'review', subagent: 'refactoring-expert' };
const apply = { action: 'apply', subagent: 'refactoring-expert' };
const audit = { action: 'audit', subagent: 'refactoring-expert' };
const patch = { action: 'patch', subagent: 'refactoring-expert' };
const test = { action: 'test', subagent: 'quality-engineer' };

const mapping = {
  development: {
    '[ ]':  { action: 'start', subagent: 'requirements-analyst', next: '[dd]' },
    '[dd]': { preActions: [review, apply], action: 'STOP_FOR_HUMAN_APPROVE', next: '[ap]' },
    '[ap]': { action: 'build', subagent: ['backend-architect', 'frontend-architect'], postActions: [test], next: '[im]' },
    '[im]': { preActions: [audit, patch], action: 'verify', subagent: 'quality-engineer', next: '[vf]' },
    '[vf]': { action: 'STOP_FOR_HUMAN_DONE', next: '[xx]' }
  },
  defect: {
    '[ ]':  { action: 'start', subagent: 'requirements-analyst', next: '[dd]' },
    '[dd]': { preActions: [review, apply], action: 'STOP_FOR_HUMAN_APPROVE', next: '[ap]' },
    '[ap]': { action: 'fix', subagent: ['backend-architect', 'frontend-architect'], postActions: [test], next: '[im]' },
    '[im]': { preActions: [audit, patch], action: 'verify', subagent: 'quality-engineer', next: '[vf]' },
    '[vf]': { action: 'STOP_FOR_HUMAN_DONE', next: '[xx]' }
  },
  infrastructure: {
    '[ ]':  { action: 'start', subagent: 'devops-architect', next: '[dd]' },
    '[dd]': { action: 'STOP_FOR_HUMAN_APPROVE', next: '[ap]' },
    '[ap]': { action: 'build', subagent: 'devops-architect', next: '[im]' },
    '[im]': { preActions: [audit, patch], action: 'verify', subagent: 'quality-engineer', next: '[vf]' },
    '[vf]': { action: 'STOP_FOR_HUMAN_DONE', next: '[xx]' }
  }
};
```

---

## Subagent 프롬프트 템플릿

```markdown
## Task 정보
- Task ID: {taskId}
- 프로젝트: {project}
- 카테고리: {category}
- 현재 상태: {status}

## 실행 내용
1. wbs.md에서 Task 메타데이터 확인
   - 경로: .orchay/projects/{project}/wbs.md
2. {역할별 작업 수행}
3. {산출물} 문서 생성
   - 경로: .orchay/projects/{project}/tasks/{taskId}/{문서번호}
4. wbs.md 상태 업데이트

## 참고 문서
- wf-common-lite.md
```

### 역할별 산출물

| Subagent | 산출물 |
|----------|--------|
| requirements-analyst | 010-basic-design.md |
| frontend-architect (ui) | 011-ui-design.md |
| system-architect | 020, 025, 026 |
| refactoring-expert (review) | 021-design-review-{llm}-{n}.md |
| backend/frontend | 030-implementation.md |
| refactoring-expert (audit) | 031-code-review-{llm}-{n}.md |
| quality-engineer (verify) | 070-integration-test.md |

---

## 안정성 메커니즘

### 실행 전 검증

| 검증 항목 | 실패 시 |
|----------|--------|
| Task 존재 | 에러 종료 |
| Subagent 파일 존재 | 에러 종료 |
| 의존성 충족 | 스킵/대기 |
| 상태 유효성 | 에러 종료 |

### Subagent 타임아웃

| Subagent | 타임아웃 |
|----------|---------|
| requirements-analyst | 15분 |
| system-architect | 20분 |
| backend/frontend-architect | 30분 |
| quality-engineer | 25분 |
| refactoring-expert | 15분 |
| devops-architect | 20분 |

### 재시도 정책
- Subagent 실패: 1회 재시도
- 테스트 실패: 5회 자동 수정 시도
- 영구적 오류: 즉시 중단

### 리뷰 적용 완료 표시
- apply 완료 → `021-design-review-{llm}-{n}(적용완료).md`
- patch 완료 → `031-code-review-{llm}-{n}(적용완료).md`

---

## 출력 형식

### 실행 결과 예시

```
[wf:run] 자동 워크플로우 실행 완료

대상: TSK-02-03-03
실행 시간: 25분 18초
Subagent 호출: 5회

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

실행 결과:

[OK] [ap] → [im] 구현
   ├── build (backend-architect): TDD 12/12 (100%)
   └── build (frontend-architect): E2E 8/8 (100%)

[OK] [im] → [vf] 검증
   ├── audit (refactoring-expert): 2건 지적
   ├── patch (메인): 2건 반영
   └── verify (quality-engineer): Pass

[STOP] [vf] → 사람 승인 필요 (/wf:done)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 완료: TSK-02-03-03 [xx]
```

---

## 옵션 정리

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--until <target>` | 특정 단계까지만 실행 | done |
| `<한글>까지` | 한글 자연어 지원 | done |
| `--dry-run` | 실행 계획만 출력 | false |
| `--continue` | 실패해도 계속 | false |
| `--max N` | 최대 N개 Task | 무제한 |
| `--skip-review` | review/apply 건너뛰기 | false |
| `--skip-audit` | audit/patch 건너뛰기 | false |
| `--timeout M` | Subagent 타임아웃(분) | 30 |
| `--parallel N` | 병렬 Subagent 수 | 3 |

---

## 에러 케이스

| 에러 | 메시지 | 처리 |
|------|--------|------|
| Task 없음 | `[ERROR] 실행 가능한 Task가 없습니다` | 종료 |
| Subagent 없음 | `[ERROR] Subagent 파일 없음: {agent}` | 종료 |
| 의존성 미충족 | `[WARN] 의존성 미충족: {deps}` | 스킵 |
| 타임아웃 | `[ERROR] Subagent 타임아웃: {agent}` | 종료 |
| 테스트 실패 | `[ERROR] 테스트 5회 재시도 초과` | 종료/continue |

---

## 완료 신호

작업 완료 후 **반드시** 다음 형식으로 출력:

**성공:**
```
ORCHAY_DONE:{task-id}:run:success
```

**실패:**
```
ORCHAY_DONE:{task-id}:run:error:{에러 요약}
```

> ⚠️ 이 출력은 orchay 스케줄러가 작업 완료를 감지하는 데 사용됩니다. 반드시 정확한 형식으로 출력하세요.

---

## 공통 모듈 참조

@.claude/includes/wf-common-lite.md

---

<!--
orchay 프로젝트 - Workflow Command
author: 장종익
Command: wf:run
Version: 1.0
-->
