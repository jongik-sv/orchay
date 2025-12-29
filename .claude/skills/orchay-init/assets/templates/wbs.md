# WBS - {{PROJECT_NAME}}

> version: 1.0
> depth: 4
> updated: {{CREATED_AT}}

---

## WP-01: Platform Foundation
- status: planned
- priority: high
- schedule: {{START_DATE}} ~ {{END_DATE}}
- progress: 0%
- description: 프로젝트의 기반이 되는 핵심 플랫폼 구축

### ACT-01-01: Data & Storage
- status: todo
- schedule: {{START_DATE}} ~ {{END_DATE}}
- description: 데이터 저장 및 관리 기능 구현

#### TSK-01-01-01: 디렉토리 구조 초기화
- category: infrastructure
- status: [xx]
- priority: high
- assignee: -
- schedule: {{START_DATE}} ~ {{END_DATE}}
- tags: setup, init
- depends: -
- note: .orchay/ 폴더 구조 생성, settings/templates 초기화

#### TSK-01-01-02: JSON 파일 CRUD 서비스
- category: development
- status: [im]
- priority: high
- assignee: -
- schedule: {{START_DATE}} ~ {{END_DATE}}
- tags: backend, api
- depends: TSK-01-01-01
- note: project.json, team.json, wbs.md 읽기/쓰기 구현

---

## WP-02: Workflow Engine
- status: planned
- priority: high
- schedule: {{START_DATE}} ~ {{END_DATE}}
- progress: 0%
- description: 워크플로우 상태 전환 엔진 구현

### TSK-02-01: 워크플로우 규칙 파서
- category: development
- status: [bd]
- priority: high
- assignee: -
- schedule: {{START_DATE}} ~ {{END_DATE}}
- tags: parser, backend
- depends: -
- note: 3단계 구조 예시 (ACT 없이 WP 아래 직접 TSK)

---

<!--
WBS Syntax Reference:

## WP-XX: Work Package Name
- status: planned | in_progress | completed
- priority: critical | high | medium | low
- schedule: YYYY-MM-DD ~ YYYY-MM-DD
- progress: 0-100%
- description: Work Package 설명

### ACT-XX-XX: Activity Name (4-level structure)
- status: todo | in_progress | completed
- schedule: YYYY-MM-DD ~ YYYY-MM-DD
- description: Activity 설명

#### TSK-XX-XX-XX: Task Name (4-level)
- category: development | defect | infrastructure
- status: [  ]    # todo [ ] | design [bd] | detail [dd] | implement [im] | verify [vf] | done [xx]
- priority: critical | high | medium | low
- assignee: member_id | -
- schedule: YYYY-MM-DD ~ YYYY-MM-DD
- tags: tag1, tag2
- depends: TSK-XX-XX-XX | -
- blocked-by: TSK-XX-XX-XX | -
- note: free text

### TSK-XX-XX: Task Name (3-level, no ACT)
- (same as above)

Category별 워크플로우:
- development: [ ] → [bd] → [dd] → [im] → [vf] → [xx]
- defect: [ ] → [an] → [fx] → [vf] → [xx]
- infrastructure: [ ] → [ds]? → [im] → [xx]

칸반 컬럼 매핑:
- Todo: [ ]
- Design: [bd]
- Detail: [dd], [an], [ds]
- Implement: [im], [fx]
- Verify: [vf]
- Done: [xx]
-->
