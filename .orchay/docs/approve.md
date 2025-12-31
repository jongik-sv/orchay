---
subagent:
  primary: refactoring-expert
  description: 설계 품질 검증 및 승인 처리
---

# /wf:approve - 설계승인 (Lite)

> **상태 전환**: `[dd] 상세설계` → `[ap] 승인`
> **적용 category**: `development`, `defect`, `infrastructure`

## 사용법

```bash
/wf:approve [PROJECT/]<Task-ID>
```

| 예시 | 설명 |
|------|------|
| `/wf:approve TSK-01-01` | 자동 검색 |
| `/wf:approve orchay/TSK-01-01` | 프로젝트 명시 |

---

## 상태 전환 규칙

| category | 현재 상태 | 다음 상태 | 검증 문서 |
|----------|----------|----------|----------|
| development | `[dd]` | `[ap]` | `010-design.md` |
| defect | `[dd]` | `[ap]` | `010-defect-analysis.md` |
| infrastructure | `[dd]` | `[ap]` | `010-tech-design.md` |

---

## 승인 모드

| 모드 | 동작 | 설정 |
|------|------|------|
| `manual` | 사용자 확인 후 승인 | 기본값 |
| `auto` | 조건 충족 시 자동 승인 | `project.json`에 `"approvalMode": "auto"` |

---

## 실행 과정

### Manual 모드 (기본)

1. **문서 존재 확인**
   - `010-design.md` 확인

2. **리뷰 현황 표시**
   - `021-design-review-*.md` 파일 목록
   - 적용완료 여부 표시

3. **사용자 확인 프롬프트**
   ```
   [INFO] 설계 문서 준비 완료
   - 설계: 010-design.md ✅
   - 리뷰: 021-design-review-claude-1(적용완료).md ✅

   설계승인을 진행하시겠습니까? (y/n)
   ```

4. **상태 전환**
   ```bash
   # {project}: 입력에서 파싱 (예: deployment/TSK-01-01 → deployment)
   # 프로젝트 미명시 시 wf-common-lite.md 규칙에 따라 자동 결정
   npx tsx .orchay/script/transition.ts {Task-ID} approve -p {project} --force
   ```
   - `--force`: manual 모드에서 확인 없이 실행

### Auto 모드

1. **자동 승인** (스크립트가 조건 검증)
   ```bash
   # {project}: 입력에서 파싱 (예: deployment/TSK-01-01 → deployment)
   # 프로젝트 미명시 시 wf-common-lite.md 규칙에 따라 자동 결정
   npx tsx .orchay/script/transition.ts {Task-ID} approve -p {project}
   ```
   - 스크립트가 `project.json`의 `approvalMode` 확인
   - 조건 충족 시 자동 전환
   - 조건 미충족 시 실패 JSON 반환

---

## Auto 모드 승인 조건

| 조건 | 설명 |
|------|------|
| 설계 문서 존재 | `010-design.md` 필수 |
| 리뷰 1건 이상 | `021-design-review-*.md` 존재 |
| P1 이슈 없음 | Critical/P1 미해결 이슈 0건 |

---

## 에러 케이스

| 에러 | 메시지 |
|------|--------|
| 잘못된 상태 | `[ERROR] 설계 상태가 아닙니다` |
| 설계 문서 없음 | `[ERROR] 설계/분석 문서가 없습니다` |
| Auto 조건 미충족 | `[WARN] Auto 승인 조건 미충족. 수동 모드로 전환` |

---

## 다음 명령어

| category | 다음 명령어 |
|----------|-----------|
| development | `/wf:build` |
| defect | `/wf:fix` |
| infrastructure | `/wf:build` |

---

## 완료 신호

작업 완료 후 **반드시** 다음 형식으로 출력:

**성공:**
```
ORCHAY_DONE:{task-id}:approve:success
```

**실패:**
```
ORCHAY_DONE:{task-id}:approve:error:{에러 요약}
```

> ⚠️ 이 출력은 orchay 스케줄러가 작업 완료를 감지하는 데 사용됩니다. 반드시 정확한 형식으로 출력하세요.

---

## 공통 모듈 참조

@.claude/includes/wf-common-lite.md
@.claude/includes/wf-conflict-resolution-lite.md
@.claude/includes/wf-auto-commit-lite.md

---

<!--
wf:approve lite
Version: 1.0
-->
