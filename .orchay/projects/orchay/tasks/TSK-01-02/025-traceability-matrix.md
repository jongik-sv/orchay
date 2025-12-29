# TSK-01-02 - 요구사항 추적 매트릭스

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-02 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-28 |

---

## 요구사항 → 설계 추적

| 요구사항 ID | 요구사항 설명 | 설계 섹션 | 구현 파일 |
|------------|-------------|----------|----------|
| REQ-01 | wbs.md 파일 파싱 | 5.2, 6.1 | `wbs_parser.py:parse_wbs()` |
| REQ-02 | Task 속성 추출 (category, domain, status, priority, depends, blocked-by) | 6.3, 7.2 | `wbs_parser.py:_parse_task_block()` |
| REQ-03 | 상태 기호 파싱 | 5.3, 7.3 | `wbs_parser.py:extract_status_code()` |
| REQ-04 | 파일 변경 감지 (watchdog) | 5.2, 6.2 | `wbs_parser.py:watch_wbs()` |

---

## 설계 → 테스트 추적

| 설계 항목 | 테스트 케이스 ID | 테스트 설명 |
|----------|----------------|------------|
| parse_wbs() | TC-01 | 정상 wbs.md 파싱 |
| parse_wbs() | TC-02 | 파일 없음 처리 |
| parse_wbs() | TC-03 | 파싱 오류 시 캐시 반환 |
| watch_wbs() | TC-04 | 파일 변경 감지 및 콜백 |
| watch_wbs() | TC-05 | 디바운싱 동작 |
| Task 모델 | TC-06 | 모든 속성 파싱 |
| 상태 코드 | TC-07 | 모든 상태 기호 인식 |

---

## PRD 참조 추적

| PRD 섹션 | 요구사항 ID | 설명 |
|---------|------------|------|
| PRD 3.1 wbs.md 모니터링 | REQ-01, REQ-04 | 파일 변경 감지, 파싱, Task 상태 추적 |
| PRD 3.2 스케줄 큐 관리 | REQ-02, REQ-03 | 실행 가능 Task 필터링, 상태 기호 해석 |

---

## TRD 참조 추적

| TRD 섹션 | 구현 항목 | 설명 |
|---------|---------|------|
| 배포 구조 | `src/orchay/wbs_parser.py` | 파서 모듈 위치 |
| 의존성 목록 | watchdog ^4.0 | 파일 모니터링 |
| 의존성 목록 | Pydantic ^2.0 | Task 모델 검증 |

---

## Acceptance Criteria 추적

| 수락 기준 | 테스트 케이스 | 검증 방법 |
|----------|-------------|----------|
| wbs.md 파싱 → Task 리스트 반환 | TC-01 | 단위 테스트 |
| 상태 변경 시 자동 재파싱 | TC-04 | 통합 테스트 |
| 파싱 오류 시 이전 상태 유지 | TC-03 | 단위 테스트 |
