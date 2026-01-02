# TSK-01-04 요구사항 추적성 매트릭스

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-04 |
| 문서 버전 | 1.0 |
| 작성일 | 2026-01-02 |
| 상태 | 작성중 |

---

## 1. 추적성 매트릭스 개요

### 1.1 목적

- PRD 요구사항과 테스트 케이스 간 매핑 관계 명확화
- 요구사항 누락 방지 및 테스트 커버리지 확인
- 변경 영향도 분석 지원

### 1.2 범위

- WP-01 통합 확인 (TSK-01-04) 관련 요구사항
- 대상 API: 카테고리/메뉴 API, 주문 API

---

## 2. 요구사항 → 테스트 케이스 매핑

### 2.1 고객 화면 요구사항

| PRD ID | 요구사항 | 테스트 케이스 | 검증 방법 | 상태 |
|--------|----------|---------------|----------|------|
| C-010 | 메뉴 목록 표시 | TC-02, TC-03 | GET /api/categories, GET /api/menus | 대기 |
| C-011 | 메뉴 정보 (이름, 가격, 이미지) | TC-03 | 응답 필드 확인 | 대기 |
| C-012 | 품절 표시/비활성화 | TC-03 | includeSoldOut 파라미터 검증 | 대기 |
| C-020 | 메뉴 담기 | TC-04 | POST /api/orders items 필드 | 대기 |
| C-021 | 수량 조절 | TC-04 | items[].quantity 검증 | 대기 |
| C-022 | 장바구니 확인 | - | 프론트엔드 (WP-03) | 제외 |
| C-023 | 주문 전송 | TC-04 | POST /api/orders | 대기 |
| C-030 | 주문 내역 | TC-05 | GET /api/orders?table={id} | 대기 |
| C-031 | 실시간 상태 반영 | - | WebSocket (WP-02) | 제외 |

### 2.2 주방 화면 요구사항

| PRD ID | 요구사항 | 테스트 케이스 | 검증 방법 | 상태 |
|--------|----------|---------------|----------|------|
| K-001 | 실시간 주문 표시 | TC-06 | GET /api/kitchen/orders | 대기 |
| K-002 | 알림음 | - | 프론트엔드 (WP-04) | 제외 |
| K-003 | 주문 정보 표시 | TC-06 | 응답 필드 확인 | 대기 |
| K-010 | 조리 시작 | TC-07 | PATCH status=cooking | 대기 |
| K-011 | 조리 완료 | TC-07 | PATCH status=completed | 대기 |
| K-012 | 완료 주문 숨김 | TC-06 | pending/cooking만 조회 확인 | 대기 |

---

## 3. 테스트 케이스 → 요구사항 역매핑

| TC ID | 테스트 케이스명 | 관련 PRD ID | 검증 영역 |
|-------|----------------|-------------|----------|
| TC-01 | DB 시드 데이터 확인 | - | 사전 조건 |
| TC-02 | GET /api/categories | C-010 | 카테고리 |
| TC-03 | GET /api/menus | C-010, C-011, C-012 | 메뉴 |
| TC-04 | POST /api/orders | C-020, C-021, C-023 | 주문 생성 |
| TC-05 | GET /api/orders?table | C-030 | 주문 조회 |
| TC-06 | GET /api/kitchen/orders | K-001, K-003, K-012 | 주방 조회 |
| TC-07 | PATCH /api/orders/{id}/status | K-010, K-011 | 상태 변경 |

---

## 4. 커버리지 분석

### 4.1 요구사항 커버리지

| 영역 | 총 요구사항 | 매핑됨 | 제외 | 커버리지 |
|------|------------|--------|------|----------|
| 고객 화면 (C-0xx) | 9 | 7 | 2 | 78% |
| 주방 화면 (K-0xx) | 6 | 5 | 1 | 83% |
| **전체** | **15** | **12** | **3** | **80%** |

### 4.2 제외 항목 상세

| PRD ID | 제외 사유 | 검증 위치 |
|--------|----------|----------|
| C-022 | 프론트엔드 UI 기능 | WP-03 고객 화면 |
| C-031 | WebSocket 실시간 통신 | WP-02 실시간 통신 |
| K-002 | 프론트엔드 알림음 | WP-04 주방 화면 |

---

## 5. 데이터 모델 매핑

### 5.1 API 응답 ↔ 데이터 모델

| API | 응답 필드 | 데이터 모델 | 비고 |
|-----|----------|------------|------|
| GET /api/categories | id, name, sort_order | Categories | 전체 필드 |
| GET /api/menus | id, name, price, image_url, category, is_sold_out | Menus + Categories | JOIN |
| POST /api/orders | orderId | Orders.id | 생성된 ID |
| GET /api/orders | id, table_id, status, items[], created_at | Orders + OrderItems | JOIN |
| GET /api/kitchen/orders | id, table_number, status, items[], created_at | Orders + OrderItems + Tables | JOIN |

---

## 6. 의존성 매핑

| TSK-01-04 TC | 의존 Task | 의존 내용 |
|--------------|----------|----------|
| TC-01 | TSK-01-01 | DB 스키마, 시드 데이터 |
| TC-02, TC-03 | TSK-01-02 | 카테고리/메뉴 API |
| TC-04~TC-07 | TSK-01-03 | 주문 API |

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2026-01-02 | Claude | 최초 작성 (/wf:apply 리뷰 반영) |
