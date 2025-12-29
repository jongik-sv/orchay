# WBS - Test Project

> version: 1.0
> depth: 3
> updated: 2025-12-28

---

## WP-01: Work Package 1
- status: planned
- priority: critical

### TSK-01-01: 프로젝트 초기화 및 핵심 모델
- category: infrastructure
- domain: infra
- status: done [xx]
- priority: critical
- assignee: -
- schedule: 2025-12-28 ~ 2025-12-28
- tags: setup, pydantic, models
- depends: -

### TSK-01-02: WBS 파서 구현
- category: development
- domain: backend
- status: approve [ap]
- priority: critical
- assignee: -
- schedule: 2025-12-29 ~ 2025-12-29
- tags: parser, markdown, regex
- depends: TSK-01-01

### TSK-01-03: 스케줄러 코어 구현
- category: development
- domain: backend
- status: design [dd]
- priority: critical
- assignee: -
- schedule: 2025-12-30 ~ 2025-12-31
- tags: scheduler, queue, async
- depends: TSK-01-02

---

## WP-02: Work Package 2
- status: planned
- priority: high

### TSK-02-01: UI 대시보드
- category: development
- domain: frontend
- status: [ ]
- priority: high
- assignee: -
- depends: TSK-01-03
