# 요구사항 추적성 매트릭스 (025-traceability-matrix.md)

**Template Version:** 1.0.0 — **Last Updated:** 2025-12-28

> **목적**: PRD → 설계 → 테스트 양방향 추적
>
> **참조**: 이 문서는 `010-design.md`와 `026-test-specification.md`와 함께 사용됩니다.

---

## 0. 문서 메타데이터

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-04 |
| Task명 | Worker 관리 및 WezTerm CLI 통합 |
| 설계 문서 참조 | `010-design.md` |
| 테스트 명세 참조 | `026-test-specification.md` |
| 작성일 | 2025-12-28 |
| 작성자 | Claude |

---

## 1. 기능 요구사항 추적 (FR → 설계 → 테스트)

> PRD → 설계 → 테스트케이스 매핑

| 요구사항 ID | PRD 섹션 | 설계 섹션 | 단위 테스트 | 통합 테스트 | 상태 |
|-------------|----------|----------|-------------|-------------|------|
| FR-001 | PRD 3.3 | 010-design 3.2 UC-01 | UT-001 | IT-001 | 설계완료 |
| FR-002 | PRD 3.3 | 010-design 3.2 UC-02 | UT-002, UT-003 | IT-001 | 설계완료 |
| FR-003 | PRD 3.4 | 010-design 3.2 UC-03 | UT-004 | IT-002 | 설계완료 |
| FR-004 | PRD 3.3 | 010-design 3.2 UC-04 | UT-005~UT-011 | IT-003 | 설계완료 |
| FR-005 | PRD 3.3 | 010-design 3.2 UC-05 | UT-012 | IT-003 | 설계완료 |

### 1.1 요구사항별 상세 매핑

#### FR-001: pane 목록 조회

| 설계 단계 | 문서 | 섹션 | 구현 항목 |
|----------|------|------|----------|
| PRD | prd.md | 3.3 | `wezterm cli list --format json` 실행 |
| 설계 | 010-design.md | UC-01 | wezterm_list_panes() 함수 |
| 단위 테스트 | 026-test-specification.md | 2.1 | UT-001 |
| 통합 테스트 | 026-test-specification.md | 3.1 | IT-001 |

#### FR-002: pane 출력 읽기

| 설계 단계 | 문서 | 섹션 | 구현 항목 |
|----------|------|------|----------|
| PRD | prd.md | 3.3 | `wezterm cli get-text --pane-id N` |
| 설계 | 010-design.md | UC-02 | wezterm_get_text() 함수 |
| 단위 테스트 | 026-test-specification.md | 2.1 | UT-002, UT-003 |
| 통합 테스트 | 026-test-specification.md | 3.1 | IT-001 |

#### FR-003: pane에 명령 전송

| 설계 단계 | 문서 | 섹션 | 구현 항목 |
|----------|------|------|----------|
| PRD | prd.md | 3.4 | `/clear` 후 명령 전송 |
| 설계 | 010-design.md | UC-03 | wezterm_send_text() 함수 |
| 단위 테스트 | 026-test-specification.md | 2.1 | UT-004 |
| 통합 테스트 | 026-test-specification.md | 3.1 | IT-002 |

#### FR-004: Worker 상태 감지

| 설계 단계 | 문서 | 섹션 | 구현 항목 |
|----------|------|------|----------|
| PRD | prd.md | 3.3 | 상태: done, idle, busy, paused, error, blocked, dead |
| 설계 | 010-design.md | UC-04 | detect_worker_state() 함수 |
| 단위 테스트 | 026-test-specification.md | 2.1 | UT-005~UT-011 |
| 통합 테스트 | 026-test-specification.md | 3.1 | IT-003 |

#### FR-005: ORCHAY_DONE 파싱

| 설계 단계 | 문서 | 섹션 | 구현 항목 |
|----------|------|------|----------|
| PRD | prd.md | 3.3 | `ORCHAY_DONE:{task-id}:{action}:{status}` |
| 설계 | 010-design.md | UC-05 | parse_done_signal() 함수 |
| 단위 테스트 | 026-test-specification.md | 2.1 | UT-012 |
| 통합 테스트 | 026-test-specification.md | 3.1 | IT-003 |

---

## 2. 비즈니스 규칙 추적 (BR → 구현 → 검증)

| 규칙 ID | PRD 출처 | 설계 섹션 | 구현 위치 | 단위 테스트 | 검증 방법 | 상태 |
|---------|----------|----------|----------|-------------|----------|------|
| BR-001 | PRD 3.3 | 010-design 8.1 | detect_worker_state() | UT-013 | 우선순위 테스트 | 설계완료 |
| BR-002 | PRD 3.4 | 010-design 8.1 | wezterm_send_text() | UT-014 | 인젝션 테스트 | 설계완료 |
| BR-003 | PRD 3.3 | 010-design 8.1 | detect_worker_state() | UT-011 | pane 미존재 테스트 | 설계완료 |
| BR-004 | PRD 3.3 | 010-design 8.1 | detect_worker_state() | UT-015 | 50줄 제한 테스트 | 설계완료 |

### 2.1 비즈니스 규칙별 상세 매핑

#### BR-001: 상태 감지 우선순위

| 구분 | 내용 |
|------|------|
| **PRD 원문** | 상태 판정 우선순위: dead > done > paused > error > blocked > idle > busy |
| **설계 표현** | 010-design.md 8.1 규칙 상세 설명 |
| **구현 위치** | detect_worker_state() 내 if-elif 순서 |
| **검증 방법** | 복합 패턴 입력 시 우선순위 확인 |
| **관련 테스트** | UT-013 |

#### BR-002: 명령 인젝션 방지

| 구분 | 내용 |
|------|------|
| **PRD 원문** | WezTerm CLI 명령어 인젝션 방지 (shlex.quote 사용) |
| **설계 표현** | 010-design.md 8.2 BR-02 상세 |
| **구현 위치** | wezterm_send_text() |
| **검증 방법** | 악의적 입력 테스트 |
| **관련 테스트** | UT-014 |

---

## 3. 테스트 역추적 매트릭스

> 테스트 결과 → 요구사항 역추적용

| 테스트 ID | 테스트 유형 | 검증 대상 요구사항 | 검증 대상 비즈니스 규칙 | 상태 |
|-----------|------------|-------------------|----------------------|------|
| UT-001 | 단위 | FR-001 | - | 미실행 |
| UT-002 | 단위 | FR-002 | - | 미실행 |
| UT-003 | 단위 | FR-002 | - | 미실행 |
| UT-004 | 단위 | FR-003 | - | 미실행 |
| UT-005 | 단위 | FR-004 | - | 미실행 |
| UT-006 | 단위 | FR-004 | - | 미실행 |
| UT-007 | 단위 | FR-004 | - | 미실행 |
| UT-008 | 단위 | FR-004 | - | 미실행 |
| UT-009 | 단위 | FR-004 | - | 미실행 |
| UT-010 | 단위 | FR-004 | - | 미실행 |
| UT-011 | 단위 | FR-004 | BR-003 | 미실행 |
| UT-012 | 단위 | FR-005 | - | 미실행 |
| UT-013 | 단위 | - | BR-001 | 미실행 |
| UT-014 | 단위 | - | BR-002 | 미실행 |
| UT-015 | 단위 | - | BR-004 | 미실행 |
| IT-001 | 통합 | FR-001, FR-002 | - | 미실행 |
| IT-002 | 통합 | FR-003 | - | 미실행 |
| IT-003 | 통합 | FR-004, FR-005 | BR-001 | 미실행 |

---

## 4. 모듈 추적

> 설계 → 모듈 → API 매핑

| 설계 컴포넌트 | 모듈 경로 | 함수/클래스 | 요구사항 |
|--------------|----------|------------|----------|
| WezTerm CLI 래퍼 | src/orchay/utils/wezterm.py | wezterm_list_panes() | FR-001 |
| WezTerm CLI 래퍼 | src/orchay/utils/wezterm.py | wezterm_get_text() | FR-002 |
| WezTerm CLI 래퍼 | src/orchay/utils/wezterm.py | wezterm_send_text() | FR-003 |
| Worker 관리 | src/orchay/worker.py | detect_worker_state() | FR-004 |
| Worker 관리 | src/orchay/worker.py | parse_done_signal() | FR-005 |
| 모델 | src/orchay/models/worker.py | DoneInfo, PaneInfo | - |

---

## 5. 추적성 검증 요약

### 5.1 커버리지 통계

| 구분 | 총 항목 | 매핑 완료 | 미매핑 | 커버리지 |
|------|---------|----------|--------|---------|
| 기능 요구사항 (FR) | 5 | 5 | 0 | 100% |
| 비즈니스 규칙 (BR) | 4 | 4 | 0 | 100% |
| 단위 테스트 (UT) | 15 | 15 | 0 | 100% |
| 통합 테스트 (IT) | 3 | 3 | 0 | 100% |

### 5.2 미매핑 항목 (있는 경우)

| 구분 | ID | 설명 | 미매핑 사유 |
|------|-----|------|-----------|
| - | - | - | - |

---

## 관련 문서

- 설계: `010-design.md`
- 테스트 명세: `026-test-specification.md`
- PRD: `.orchay/projects/orchay/prd.md`
- TRD: `.orchay/projects/orchay/trd.md`

---

<!--
TSK-01-04 요구사항 추적성 매트릭스
Version: 1.0
Created: 2025-12-28
-->
