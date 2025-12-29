# TSK-02-04 - 요구사항 추적 매트릭스

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-04 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-28 |

---

## 1. PRD → 설계 추적

| PRD 요구사항 | 설계 문서 섹션 | 구현 예정 모듈 | 상태 |
|-------------|--------------|--------------|------|
| PRD 5.1 설정 파일 구조 | 12.1 Config Pydantic 모델 | `models/config.py` | 설계완료 |
| PRD 5.2 기본 설정 (workers, interval) | 12.1 Config 모델 필드 | `models/config.py` | 설계완료 |
| PRD 5.2 상태 감지 설정 (detection) | 12.1 DetectionConfig | `models/config.py` | 설계완료 |
| PRD 5.2 복구 설정 (recovery) | 12.1 RecoveryConfig | `models/config.py` | 설계완료 |
| PRD 5.2 분배 설정 (dispatch) | 12.1 DispatchConfig | `models/config.py` | 설계완료 |
| PRD 5.2 히스토리 설정 (history) | 12.1 HistoryConfig | `models/config.py` | 설계완료 |
| PRD 5.2 실행 설정 (execution) | 12.1 ExecutionConfig | `models/config.py` | 설계완료 |
| PRD 6.3 CLI 옵션 (-w, -i, -m) | 12.3 CLI 파싱 함수 | `main.py` | 설계완료 |
| PRD 6.3 --dry-run 옵션 | 12.5 handle_dry_run | `main.py` | 설계완료 |
| PRD 6.3 history 서브커맨드 | 12.4 HistoryManager, 12.5 handle_history | `utils/history.py`, `main.py` | 설계완료 |
| PRD 6.3 설정 우선순위 (CLI > 파일 > 기본값) | 8.1 BR-01 | `main.py` | 설계완료 |

---

## 2. 설계 → 테스트 추적

| 설계 항목 | 테스트 케이스 ID | 테스트 유형 |
|----------|-----------------|-----------|
| Config 모델 기본값 | TC-01 | 단위 테스트 |
| Config 모델 Pydantic 검증 | TC-02 | 단위 테스트 |
| load_config() 파일 존재 | TC-03 | 단위 테스트 |
| load_config() 파일 없음 → 기본값 | TC-04 | 단위 테스트 |
| load_config() JSON 파싱 오류 | TC-05 | 단위 테스트 |
| parse_args() 기본 실행 | TC-06 | 단위 테스트 |
| parse_args() 옵션 파싱 | TC-07 | 단위 테스트 |
| parse_args() history 서브커맨드 | TC-08 | 단위 테스트 |
| HistoryManager.save() | TC-09 | 단위 테스트 |
| HistoryManager.list() | TC-10 | 단위 테스트 |
| HistoryManager.get() | TC-11 | 단위 테스트 |
| HistoryManager.clear() | TC-12 | 단위 테스트 |
| 히스토리 로테이션 (maxEntries 초과) | TC-13 | 단위 테스트 |
| CLI 옵션 오버라이드 동작 | TC-14 | 통합 테스트 |
| --dry-run 전체 흐름 | TC-15 | 통합 테스트 |
| history 명령 전체 흐름 | TC-16 | 통합 테스트 |

---

## 3. 유즈케이스 → 테스트 추적

| 유즈케이스 ID | 테스트 시나리오 | 테스트 케이스 |
|--------------|---------------|-------------|
| UC-01 | 설정 파일 로드 성공 | TC-03 |
| UC-01 | 설정 파일 없음 시 기본값 | TC-04 |
| UC-01 | 설정 검증 실패 | TC-02, TC-05 |
| UC-02 | CLI 옵션 파싱 | TC-06, TC-07, TC-08 |
| UC-02 | 잘못된 옵션 에러 | TC-07 |
| UC-03 | 히스토리 목록 조회 | TC-10, TC-16 |
| UC-03 | 히스토리 상세 조회 | TC-11, TC-16 |
| UC-03 | 히스토리 삭제 | TC-12 |
| UC-04 | Dry-run 실행 | TC-15 |

---

## 4. 비즈니스 규칙 → 테스트 추적

| 규칙 ID | 규칙 설명 | 테스트 케이스 |
|---------|----------|-------------|
| BR-01 | 설정 우선순위 (CLI > 파일 > 기본값) | TC-14 |
| BR-02 | 히스토리 maxEntries 로테이션 | TC-13 |
| BR-03 | --dry-run 시 분배 금지 | TC-15 |

---

## 5. 에러 케이스 → 테스트 추적

| 에러 상황 | 예상 동작 | 테스트 케이스 |
|----------|----------|-------------|
| 설정 파일 JSON 오류 | 에러 메시지 출력, 종료 | TC-05 |
| 설정 스키마 오류 | 검증 오류 메시지, 종료 | TC-02 |
| 히스토리 파일 없음 | 빈 목록 반환 | TC-10 |
| 존재하지 않는 Task ID 조회 | None 반환 | TC-11 |

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-12-28 | Claude | 최초 작성 |
