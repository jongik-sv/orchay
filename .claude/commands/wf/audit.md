---
subagent:
  primary: refactoring-expert
  description: 코드 품질 분석 및 리뷰 수행
mcp-servers: [sequential-thinking, context7]
hierarchy-input: true
parallel-processing: true
---

# /wf:audit - 코드 리뷰 (Lite)

> **상태 변경 없음**: 반복 실행 가능
> **적용 category**: development, infrastructure
> **계층 입력**: WP/ACT/Task 단위 (하위 Task 병렬 처리)

## 사용법

```bash
/wf:audit [PROJECT/]<WP-ID | ACT-ID | Task-ID>
```

| 예시 | 설명 |
|------|------|
| `/wf:audit TSK-01-01` | Task 단위 |
| `/wf:audit ACT-01-01` | ACT 내 모든 `[im]` Task 병렬 |
| `/wf:audit WP-01` | WP 내 모든 Task 병렬 |

---

## 생성 산출물

| 파일 | 내용 |
|------|------|
| `031-code-review-{llm}-{n}.md` | 코드 리뷰 결과 |

---

## 실행 과정

### 1. 구현 파일 수집

- `030-implementation.md`에서 파일 목록 추출
- 소스 코드 로드

### 2. 코드 분석

| 영역 | 검토 항목 |
|------|----------|
| 품질 | 복잡도, 중복, 네이밍, SOLID |
| 보안 | 인젝션, 인증, 암호화 |
| 성능 | 쿼리, 메모리, 캐싱 |
| 설계 | 패턴, 의존성, 아키텍처 |

### 3. 리뷰 결과 작성

- 지적사항 (심각도/우선순위)
- 개선 제안
- 코드 예시

---

## 심각도(Severity) 분류

| 심각도 | 설명 | 예시 |
|--------|------|------|
| **Critical** | 버그, 보안 취약점 | SQL Injection, NPE |
| **Major** | 성능, 아키텍처 이슈 | N+1 쿼리, 순환 의존 |
| **Minor** | 코드 스타일, 가독성 | 네이밍, 매직 넘버 |
| **Info** | 참고 사항 | 최신 패턴 제안 |

---

## 우선순위(Priority) 분류

| 우선순위 | 설명 |
|----------|------|
| **P1** | 즉시 수정 필수 (버그, 보안) |
| **P2** | 통합테스트 전 수정 |
| **P3** | 향후 개선 |

---

## 출력 예시

```
[wf:audit] 코드 리뷰

Task: TSK-01-01-01

📂 구현 파일 분석:
├── 030-implementation.md ✅
├── Backend: 5개 파일
└── Frontend: 3개 파일

🔍 분석 결과:
┌─────────┬─────────┬─────────┬──────┐
│ 영역    │ Critical│ Major   │ Minor│
├─────────┼─────────┼─────────┼──────┤
│ 품질    │ 0       │ 1       │ 2    │
│ 보안    │ 0       │ 0       │ 0    │
│ 성능    │ 0       │ 1       │ 0    │
│ 설계    │ 0       │ 0       │ 1    │
└─────────┴─────────┴─────────┴──────┘

📄 생성: 031-code-review-claude-1.md

다음: /wf:patch 또는 /wf:verify
```

---

## 에러 케이스

| 에러 | 메시지 |
|------|--------|
| 구현 문서 없음 | `[ERROR] 030-implementation.md가 없습니다` |
| 소스 파일 없음 | `[ERROR] 구현된 소스 파일이 없습니다` |

---

## 다음 명령어

- `/wf:patch` - 리뷰 내용 반영
- `/wf:verify` - 통합테스트 (리뷰 미반영 시)

---

## 완료 신호

작업 완료 후 **반드시** 다음 형식으로 출력:

**성공:**
```
ORCHAY_DONE:{task-id}:audit:success
```

**실패:**
```
ORCHAY_DONE:{task-id}:audit:error:{에러 요약}
```

> ⚠️ 이 출력은 orchay 스케줄러가 작업 완료를 감지하는 데 사용됩니다. 반드시 정확한 형식으로 출력하세요.

---

## 공통 모듈 참조

@.claude/includes/wf-common-lite.md

---

<!--
wf:audit lite
Version: 1.1
-->
