# /wf:auto - 자동 워크플로우 실행

> **Task 자동 선택**: `npx tsx .orchay/script/next-task.ts`로 실행 가능한 Task를 조회하여 워크플로우를 자동 실행합니다.

## 실행 절차

### 1단계: 실행 가능한 Task 조회

```bash
# 기본 (의존관계 적용)
npx tsx .orchay/script/next-task.ts -p {PROJECT}

# 설계 단계용 (의존관계 무시)
npx tsx .orchay/script/next-task.ts -p {PROJECT} --ignore-deps
```

**--until 옵션에 따른 조회 방식:**
- 설계 단계(~apply): `--ignore-deps` 사용
- 구현 단계(build~): 기본 모드 사용

**결과 JSON 파싱:**
```json
{
  "projectId": "orchay",
  "executable": [
    { "id": "TSK-XX-XX", "category": "development", "status": "[dd]", "nextAction": "build" }
  ],
  "waiting": [
    { "id": "TSK-YY-YY", "blockedBy": ["TSK-XX-XX"] }
  ]
}
```

### 2단계: Task 선택

- `executable` 배열이 비어 있으면 → `[ERROR] 실행 가능한 Task가 없습니다` 출력 후 종료
- `executable[0]` 선택 (우선순위+WBS ID 순으로 이미 정렬됨)

### 3단계: 워크플로우 실행

선택된 Task의 `nextAction`에 따라 해당 `/wf:*` 명령어 실행

---

## 사용법

```bash
/wf:auto [PROJECT] [옵션]

# 기본 실행 (프로젝트 자동 선택 + 첫 Task)
/wf:auto

# 프로젝트 명시
/wf:auto orchay              # orchay 프로젝트

# 부분 실행
/wf:auto --until detail-design   # 상세설계까지
/wf:auto 상세설계까지             # 한글 자연어
/wf:auto orchay --until build    # 프로젝트 + 부분 실행

# 옵션
/wf:auto --dry-run      # 실행 계획만 출력
/wf:auto --skip-review  # review/apply 건너뛰기
/wf:auto --skip-audit   # audit/patch 건너뛰기
```

| 예시 | 설명 |
|------|------|
| `/wf:auto` | 자동 프로젝트 (1개 또는 default) |
| `/wf:auto orchay` | 프로젝트 명시 |
| `/wf:auto orchay --until build` | 프로젝트 + 부분 실행 |

---

## 카테고리별 워크플로우

### development
```
[ ] → start → [dd]
    → review → apply → approve(사람) → [ap]
    → build → test → [im]
    → audit → patch → verify → [vf] → done(사람) → [xx]
```

### defect
```
[ ] → start → [dd]
    → review → apply → approve(사람) → [ap]
    → fix → test → [im]
    → audit → patch → verify → [vf] → done(사람) → [xx]
```

### infrastructure
```
[ ] → start/skip → [dd] → approve(사람) → [ap]
    → build → [im]
    → audit → patch → verify → [vf] → done(사람) → [xx]
```

---

## 부분 실행 옵션

| --until | 한글 자연어 | 상태 | 실행 단계 | 의존관계 |
|---------|------------|------|----------|---------|
| `design` | `설계까지` | `[dd]` | start | **무시** |
| `review` | `리뷰까지` | `[dd]` | start + review | **무시** |
| `apply` | `리뷰반영까지` | `[dd]` | start + review + apply | **무시** |
| `approve` | `승인까지` | `[ap]` | 사람 실행 (자동화 불가) | - |
| `build` | `구현까지` | `[im]` | build + test | 적용 |
| `audit` | `코드리뷰까지` | `[im]` | audit | 적용 |
| `patch` | `패치까지` | `[im]` | audit + patch | 적용 |
| `verify` | `검증까지` | `[vf]` | verify | 적용 |
| `done` | `완료까지` | `[xx]` | 사람 실행 (자동화 불가) | - |

### 의존관계 무시 규칙

**설계 단계(design ~ apply)까지**는 의존관계를 **무시**합니다:
- 설계 문서는 코드 구현이 없어 병렬 작성 가능
- WP 내 모든 Task의 설계를 동시에 진행 가능
- `waiting` 목록도 대상에 포함

**구현 단계(build) 이후**부터 의존관계 **적용**:
- 실제 코드가 선행 Task 산출물에 의존
- `executable` 목록만 대상

---

## 핵심 실행 로직

```
1. npx tsx .orchay/script/next-task.ts [-p PROJECT] 실행 → JSON 결과 획득
2. --until 옵션 확인:
   - 설계 단계(basic-design ~ apply): executable + waiting 모두 대상
   - 구현 단계(build ~): executable만 대상
3. 대상 Task 선택 (우선순위 + WBS ID 순)
4. projectId 추출 → 후속 명령에 사용
5. task.nextAction 확인
6. 해당 /wf:{action} {project}/{taskId} 실행
7. target 도달까지 반복 (기본: done)
```

### 상태별 명령어 매핑

| 상태 | nextAction | 실행 명령어 |
|------|-----------|------------|
| `[ ]` | start | `/wf:start {project}/{taskId}` |
| `[dd]` | approve | `/wf:review` → `/wf:apply` → **사람 승인** |
| `[ap]` | build | `/wf:build {project}/{taskId}` (development, infra) |
| `[ap]` | fix | `/wf:fix {project}/{taskId}` (defect) |
| `[im]` | verify | `/wf:audit` → `/wf:patch` → `/wf:verify {project}/{taskId}` |
| `[vf]` | done | **사람 실행** |

---

## 출력 형식

### 시작
```
[wf:auto] Task 자동 선택

실행: npx tsx .orchay/script/next-task.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 실행 가능한 Task (3개)
  1. TSK-09-01 [development] [ ] → start
  2. TSK-08-07 [development] [dd] → build
  3. TSK-03-01 [infrastructure] [im] → done

⏳ 대기 중 (1개)
  - TSK-10-01: TSK-09-01 완료 대기

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶️ 선택: TSK-09-01 (development, start)
```

### 완료
```
[wf:auto] 자동 워크플로우 완료

대상: TSK-09-01
실행 시간: 25분 18초

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[OK] [ ] → [dd] 설계
   └── start: 010-design.md

[OK] [dd] 리뷰
   ├── review: 021-design-review-claude-1.md
   └── apply: 반영 완료

[STOP] [dd] → 사람 승인 필요 (/wf:approve)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏸️ 대기 중: TSK-09-01 [dd] → /wf:approve 필요
```

---

## 옵션 정리

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--until <target>` | 특정 단계까지만 실행 | done |
| `<한글>까지` | 한글 자연어 지원 | done |
| `--dry-run` | 실행 계획만 출력 | false |
| `--skip-review` | review/apply 건너뛰기 | false |
| `--skip-audit` | audit/patch 건너뛰기 | false |

---

## 에러 케이스

| 에러 | 메시지 | 처리 |
|------|--------|------|
| Task 없음 | `[ERROR] 실행 가능한 Task가 없습니다` | 종료 |
| 스크립트 실패 | `[ERROR] next-task.ts 실행 실패` | 종료 |
| JSON 파싱 실패 | `[ERROR] 결과 파싱 실패` | 종료 |

---

## 완료 신호

작업 완료 후 **반드시** 다음 형식으로 출력:

**성공:**
```
ORCHAY_DONE:{task-id}:auto:success
```

**실패:**
```
ORCHAY_DONE:{task-id}:auto:error:{에러 요약}
```

> ⚠️ 이 출력은 orchay 스케줄러가 작업 완료를 감지하는 데 사용됩니다. 반드시 정확한 형식으로 출력하세요.

---

## 공통 모듈 참조

@.claude/includes/wf-common-lite.md

---

<!--
orchay 프로젝트 - Workflow Command
author: 장종익
Command: wf:auto
Version: 1.0
-->
