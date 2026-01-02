# TSK-01-04 테스트 명세서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-04 |
| 문서 버전 | 1.0 |
| 작성일 | 2026-01-02 |
| 상태 | 작성중 |

---

## 1. 테스트 개요

### 1.1 목적

WP-01에서 구현된 데이터베이스 및 API가 정상적으로 동작하는지 수동 테스트로 검증

### 1.2 테스트 범위

| 포함 | 제외 |
|------|------|
| DB 시드 데이터 검증 | WebSocket 실시간 통신 |
| 카테고리/메뉴 API | 프론트엔드 화면 |
| 주문 API | E2E 전체 플로우 |
| 에러 케이스 검증 | 인증/권한 |

### 1.3 테스트 환경

| 항목 | 값 |
|------|------|
| 서버 URL | http://localhost:3000 |
| 데이터베이스 | SQLite (개발용) |
| 테스트 도구 | curl, Postman |

---

## 2. 테스트 케이스 상세

### TC-01: 데이터베이스 시드 데이터 확인

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-01 |
| 테스트명 | 데이터베이스 시드 데이터 확인 |
| 우선순위 | P1 |
| 관련 요구사항 | - (사전 조건) |

**전제 조건:**
- 개발 서버 실행됨
- DB 초기화 및 시드 데이터 적재 완료

**테스트 절차:**
1. 서버 실행 로그 확인
2. 또는 각 API 호출로 데이터 존재 확인

**예상 결과:**
| 테이블 | 최소 개수 |
|--------|----------|
| tables | 5 |
| categories | 3 |
| menus | 10 |

---

### TC-02: GET /api/categories 테스트

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-02 |
| 테스트명 | 카테고리 목록 조회 |
| 우선순위 | P1 |
| 관련 요구사항 | C-010 |

**요청:**
```bash
curl http://localhost:3000/api/categories
```

**예상 응답:**
```json
{
  "categories": [
    { "id": 1, "name": "메인메뉴", "sort_order": 1 },
    { "id": 2, "name": "사이드메뉴", "sort_order": 2 },
    { "id": 3, "name": "음료", "sort_order": 3 }
  ]
}
```

**검증 항목:**
- [ ] HTTP 상태 코드 200
- [ ] categories 배열 반환
- [ ] sort_order 순 정렬
- [ ] 카테고리 3개 이상

---

### TC-03: GET /api/menus 테스트

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-03 |
| 테스트명 | 메뉴 목록 조회 |
| 우선순위 | P1 |
| 관련 요구사항 | C-010, C-011, C-012 |

**요청 (기본):**
```bash
curl http://localhost:3000/api/menus
```

**예상 응답:**
```json
{
  "menus": [
    {
      "id": 1,
      "name": "김치찌개",
      "price": 9000,
      "image_url": "/images/kimchi.jpg",
      "category": { "id": 1, "name": "메인메뉴" },
      "is_sold_out": false
    }
  ]
}
```

**검증 항목:**
- [ ] HTTP 상태 코드 200
- [ ] menus 배열 반환
- [ ] 카테고리 정보 포함 (id, name)
- [ ] 품절 메뉴(is_sold_out=true) 기본 제외

**추가 테스트 (품절 포함):**
```bash
curl "http://localhost:3000/api/menus?includeSoldOut=true"
```

**검증 항목:**
- [ ] 품절 메뉴도 포함하여 반환

---

### TC-04: POST /api/orders 테스트

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-04 |
| 테스트명 | 주문 생성 |
| 우선순위 | P1 |
| 관련 요구사항 | C-020, C-021, C-023 |

**요청:**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"tableId": 1, "items": [{"menuId": 1, "quantity": 2}]}'
```

**예상 응답:**
```json
{ "orderId": 1 }
```

**검증 항목:**
- [ ] HTTP 상태 코드 201
- [ ] orderId 반환
- [ ] order_items 테이블에 레코드 생성

#### TC-04-E1: 빈 items 에러

**요청:**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"tableId": 1, "items": []}'
```

**예상 응답:**
- HTTP 400 Bad Request
- 에러 메시지: "주문 항목이 필요합니다"

#### TC-04-E2: 존재하지 않는 menuId 에러

**요청:**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"tableId": 1, "items": [{"menuId": 9999, "quantity": 1}]}'
```

**예상 응답:**
- HTTP 400 Bad Request
- 에러 메시지: "존재하지 않는 메뉴입니다"

#### TC-04-E3: 품절 메뉴 주문 에러

**요청:**
```bash
# 품절 메뉴 ID로 주문 시도
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"tableId": 1, "items": [{"menuId": {sold_out_id}, "quantity": 1}]}'
```

**예상 응답:**
- HTTP 400 Bad Request
- 에러 메시지: "품절된 메뉴입니다"

#### TC-04-E4: 음수/초과 수량 에러

**요청 (음수):**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"tableId": 1, "items": [{"menuId": 1, "quantity": -1}]}'
```

**예상 응답:**
- HTTP 400 Bad Request
- 에러 메시지: "수량은 1 이상이어야 합니다"

**요청 (초과):**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"tableId": 1, "items": [{"menuId": 1, "quantity": 1000}]}'
```

**예상 응답:**
- HTTP 400 Bad Request
- 에러 메시지: "수량이 너무 많습니다"

---

### TC-05: GET /api/orders?table={id} 테스트

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-05 |
| 테스트명 | 테이블별 주문 조회 |
| 우선순위 | P1 |
| 관련 요구사항 | C-030 |

**요청:**
```bash
curl "http://localhost:3000/api/orders?table=1"
```

**예상 응답:**
```json
{
  "orders": [
    {
      "id": 1,
      "table_id": 1,
      "status": "pending",
      "items": [
        { "menuId": 1, "menuName": "김치찌개", "quantity": 2 }
      ],
      "created_at": "2026-01-02T12:00:00Z"
    }
  ]
}
```

**검증 항목:**
- [ ] HTTP 상태 코드 200
- [ ] orders 배열 반환
- [ ] 최신 순 정렬 (created_at DESC)
- [ ] 해당 테이블 주문만 조회

---

### TC-06: GET /api/kitchen/orders 테스트

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-06 |
| 테스트명 | 주방 주문 목록 조회 |
| 우선순위 | P1 |
| 관련 요구사항 | K-001, K-003, K-012 |

**요청:**
```bash
curl http://localhost:3000/api/kitchen/orders
```

**예상 응답:**
```json
{
  "orders": [
    {
      "id": 1,
      "table_number": 1,
      "status": "pending",
      "items": [
        { "menuId": 1, "menuName": "김치찌개", "quantity": 2 }
      ],
      "created_at": "2026-01-02T12:00:00Z"
    }
  ]
}
```

**검증 항목:**
- [ ] HTTP 상태 코드 200
- [ ] orders 배열 반환
- [ ] pending/cooking 상태만 조회
- [ ] completed 상태 제외

---

### TC-07: PATCH /api/orders/{id}/status 테스트

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-07 |
| 테스트명 | 주문 상태 변경 |
| 우선순위 | P1 |
| 관련 요구사항 | K-010, K-011 |

#### TC-07-1: pending → cooking

**요청:**
```bash
curl -X PATCH http://localhost:3000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "cooking"}'
```

**예상 응답:**
```json
{ "success": true }
```

**검증 항목:**
- [ ] HTTP 상태 코드 200
- [ ] 주문 상태가 cooking으로 변경됨

#### TC-07-2: cooking → completed

**요청:**
```bash
curl -X PATCH http://localhost:3000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

**예상 응답:**
```json
{ "success": true }
```

**검증 항목:**
- [ ] HTTP 상태 코드 200
- [ ] 주문 상태가 completed로 변경됨
- [ ] /api/kitchen/orders에서 제외됨

#### TC-07-E1: 존재하지 않는 orderId

**요청:**
```bash
curl -X PATCH http://localhost:3000/api/orders/9999/status \
  -H "Content-Type: application/json" \
  -d '{"status": "cooking"}'
```

**예상 응답:**
- HTTP 404 Not Found
- 에러 메시지: "주문을 찾을 수 없습니다"

#### TC-07-E2: 잘못된 status 값

**요청:**
```bash
curl -X PATCH http://localhost:3000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "invalid"}'
```

**예상 응답:**
- HTTP 400 Bad Request
- 에러 메시지: "유효하지 않은 상태입니다"

#### TC-07-E3: 허용되지 않는 상태 전이

**요청 (pending → completed 시도):**
```bash
curl -X PATCH http://localhost:3000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

**예상 응답 (현재 상태가 pending인 경우):**
- HTTP 400 Bad Request
- 에러 메시지: "상태 변경이 허용되지 않습니다"

---

## 3. 테스트 시나리오

### 시나리오 1: 정상 주문 플로우

| 단계 | TC ID | 액션 | 기대 결과 |
|------|-------|------|----------|
| 1 | TC-02 | GET /api/categories | 카테고리 목록 반환 |
| 2 | TC-03 | GET /api/menus | 메뉴 목록 반환 |
| 3 | TC-04 | POST /api/orders | orderId 반환 |
| 4 | TC-05 | GET /api/orders?table=1 | 생성한 주문 포함 |
| 5 | TC-06 | GET /api/kitchen/orders | 생성한 주문 표시 |
| 6 | TC-07-1 | PATCH status=cooking | 성공 |
| 7 | TC-07-2 | PATCH status=completed | 성공 |
| 8 | TC-06 | GET /api/kitchen/orders | 완료 주문 제외 |

### 시나리오 2: 에러 케이스 검증

| 단계 | TC ID | 액션 | 기대 결과 |
|------|-------|------|----------|
| 1 | TC-04-E1 | POST (빈 items) | 400 |
| 2 | TC-04-E2 | POST (잘못된 menuId) | 400 |
| 3 | TC-04-E4 | POST (음수 수량) | 400 |
| 4 | TC-07-E1 | PATCH (잘못된 orderId) | 404 |
| 5 | TC-07-E2 | PATCH (잘못된 status) | 400 |

---

## 4. 테스트 결과 기록 양식

### 테스트 실행 기록

| TC ID | 실행일시 | 결과 | 비고 |
|-------|---------|------|------|
| TC-01 | | PASS/FAIL | |
| TC-02 | | PASS/FAIL | |
| TC-03 | | PASS/FAIL | |
| TC-04 | | PASS/FAIL | |
| TC-04-E1 | | PASS/FAIL | |
| TC-04-E2 | | PASS/FAIL | |
| TC-04-E3 | | PASS/FAIL | |
| TC-04-E4 | | PASS/FAIL | |
| TC-05 | | PASS/FAIL | |
| TC-06 | | PASS/FAIL | |
| TC-07-1 | | PASS/FAIL | |
| TC-07-2 | | PASS/FAIL | |
| TC-07-E1 | | PASS/FAIL | |
| TC-07-E2 | | PASS/FAIL | |
| TC-07-E3 | | PASS/FAIL | |

### 결함 기록

| 결함 ID | TC ID | 심각도 | 설명 | 상태 |
|---------|-------|--------|------|------|
| | | | | |

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2026-01-02 | Claude | 최초 작성 (/wf:apply 리뷰 반영) |
