# 테스트 명세서 (026-test-specification.md)

**Template Version:** 1.0.0 — **Last Updated:** 2026-01-02

> **목적**: WP-04 주방 화면 통합 검증을 위한 테스트 시나리오 및 테스트 데이터 정의
>
> **참조**: 이 문서는 `010-design.md`와 `025-traceability-matrix.md`와 함께 사용됩니다.
>
> **활용 단계**: `/wf:build`, `/wf:test` 단계에서 테스트 코드 생성 기준으로 사용

---

## 0. 문서 메타데이터

| 항목 | 내용 |
|------|------|
| Task ID | TSK-04-03 |
| Task명 | WP-04 통합 확인: 주방 화면 검증 |
| 설계 문서 참조 | `010-design.md` |
| 추적성 매트릭스 참조 | `025-traceability-matrix.md` |
| 작성일 | 2026-01-02 |
| 작성자 | Claude |

---

## 1. 테스트 전략 개요

### 1.1 테스트 범위

| 테스트 유형 | 범위 | 목표 커버리지 |
|------------|------|--------------|
| E2E 테스트 | 주방 화면 전체 플로우 | PRD K-001 ~ K-012 100% |
| 매뉴얼 테스트 | UI/UX, 실시간 통신, 반응형 | 전체 화면 |

### 1.2 테스트 환경

| 항목 | 내용 |
|------|------|
| 테스트 프레임워크 | Playwright (E2E) |
| 테스트 데이터베이스 | SQLite (테스트용) |
| 브라우저 | Chromium (기본) |
| 베이스 URL | `http://localhost:3000` |
| WebSocket | Socket.io 연결 필요 |

---

## 2. 테스트 전제 조건

### 2.1 시스템 상태

| 조건 | 설명 |
|------|------|
| 서버 실행 | Next.js Custom Server (npm run dev) |
| DB 시드 | 테이블 5개, 카테고리 3개, 메뉴 10개 |
| WebSocket | Socket.io 서버 연결 가능 |

### 2.2 테스트 데이터

| 데이터 | 상태 | 용도 |
|--------|------|------|
| 테이블 1-5 | available | 주문 생성용 |
| pending 주문 2건 | table 1, 3 | 목록 표시 검증 |
| cooking 주문 1건 | table 5 | 조리중 상태 검증 |

---

## 3. E2E 테스트 시나리오

### 3.1 테스트 케이스 목록

| 테스트 ID | 시나리오 | 사전조건 | 실행 단계 | 예상 결과 | 요구사항 |
|-----------|----------|----------|----------|----------|----------|
| E2E-001 | 새 주문 실시간 표시 | /kitchen 접속 | 새 주문 생성 | 카드 즉시 추가 | K-001 |
| E2E-002 | 알림음 재생 | /kitchen 접속, 사용자 인터랙션 | 새 주문 생성 | 알림음 재생 | K-002 |
| E2E-003 | 주문 정보 표시 | pending 주문 존재 | /kitchen 접속 | 테이블번호, 메뉴, 수량, 시간 표시 | K-003 |
| E2E-004 | 조리시작 버튼 | pending 주문 존재 | 조리시작 클릭 | cooking 상태로 변경 | K-010 |
| E2E-005 | 조리완료 버튼 | cooking 주문 존재 | 조리완료 클릭 | completed 상태로 변경 | K-011 |
| E2E-006 | 완료 주문 숨김 | 주문 완료 처리 | 완료 후 화면 확인 | 카드 숨김 | K-012 |
| E2E-007 | 주문 필터링 | pending/cooking/completed 혼재 | /kitchen 접속 | pending/cooking만 표시 | K-001, K-012 |
| E2E-008 | pending→cooking 전이 | pending 주문 | 조리시작 클릭 | 성공, 카드 스타일 변경 | K-010, BR-03 |
| E2E-009 | cooking→completed 전이 | cooking 주문 | 조리완료 클릭 | 성공, 카드 숨김 | K-011, BR-04 |

### 3.2 테스트 케이스 상세

#### E2E-001: 새 주문 실시간 표시

| 항목 | 내용 |
|------|------|
| **파일** | `tests/e2e/kitchen.spec.ts` |
| **테스트명** | `test('새 주문이 실시간으로 주방 화면에 추가된다')` |
| **사전조건** | /kitchen 접속, WebSocket 연결됨 |
| **data-testid 셀렉터** | |
| - 페이지 컨테이너 | `[data-testid="kitchen-page"]` |
| - 주문 그리드 | `[data-testid="order-grid"]` |
| - 주문 카드 | `[data-testid="order-card"]` |
| **실행 단계** | |
| 1 | `await page.goto('/kitchen')` |
| 2 | 주문 카드 개수 확인 (초기) |
| 3 | 새 주문 API 호출 (별도 탭 또는 API 직접 호출) |
| 4 | WebSocket order:new 이벤트 대기 |
| 5 | 주문 카드 개수 확인 (증가) |
| **검증 포인트** | `expect(orderCards).toHaveCount(initialCount + 1)` |
| **스크린샷** | `e2e-001-new-order.png` |
| **관련 요구사항** | K-001 |

#### E2E-002: 알림음 재생

| 항목 | 내용 |
|------|------|
| **파일** | `tests/e2e/kitchen.spec.ts` |
| **테스트명** | `test('새 주문 시 알림음이 재생된다')` |
| **사전조건** | /kitchen 접속, 사용자 인터랙션 발생 |
| **실행 단계** | |
| 1 | `await page.goto('/kitchen')` |
| 2 | `await page.click('body')` (오디오 정책 해제) |
| 3 | Audio 재생 이벤트 리스너 설정 |
| 4 | 새 주문 생성 |
| 5 | 오디오 재생 확인 |
| **검증 포인트** | Audio play 이벤트 발생 확인 |
| **관련 요구사항** | K-002 |
| **참고** | 브라우저 오디오 정책으로 수동 테스트 권장 |

#### E2E-003: 주문 정보 표시

| 항목 | 내용 |
|------|------|
| **파일** | `tests/e2e/kitchen.spec.ts` |
| **테스트명** | `test('주문 카드에 테이블 번호, 메뉴, 수량, 시간이 표시된다')` |
| **사전조건** | pending 주문 존재 (시드 데이터) |
| **data-testid 셀렉터** | |
| - 테이블 번호 | `[data-testid="order-table-number"]` |
| - 메뉴 목록 | `[data-testid="order-menu-list"]` |
| - 메뉴 항목 | `[data-testid="order-menu-item"]` |
| - 주문 시간 | `[data-testid="order-time"]` |
| **실행 단계** | |
| 1 | `await page.goto('/kitchen')` |
| 2 | 첫 번째 주문 카드 선택 |
| 3 | 각 요소 존재 및 값 확인 |
| **검증 포인트** | |
| - 테이블 번호 | `expect(tableNumber).toContainText('테이블')` |
| - 메뉴 항목 | `expect(menuItems).toHaveCount.greaterThan(0)` |
| - 시간 | `expect(orderTime).toContainText('전')` |
| **스크린샷** | `e2e-003-order-info.png` |
| **관련 요구사항** | K-003 |

#### E2E-004: 조리시작 버튼

| 항목 | 내용 |
|------|------|
| **파일** | `tests/e2e/kitchen.spec.ts` |
| **테스트명** | `test('조리시작 버튼 클릭 시 cooking 상태로 변경된다')` |
| **사전조건** | pending 주문 존재 |
| **data-testid 셀렉터** | |
| - 조리시작 버튼 | `[data-testid="start-cooking-btn"]` |
| - 상태 배지 | `[data-testid="status-badge"]` |
| **실행 단계** | |
| 1 | `await page.goto('/kitchen')` |
| 2 | pending 주문 카드에서 조리시작 버튼 찾기 |
| 3 | `await page.click('[data-testid="start-cooking-btn"]')` |
| 4 | API 응답 대기 |
| 5 | 카드 스타일 및 버튼 변경 확인 |
| **API 확인** | `PATCH /api/orders/{id}/status` → 200 |
| **검증 포인트** | |
| - 상태 배지 | `expect(statusBadge).toContainText('조리중')` |
| - 버튼 변경 | `expect(completeBtn).toBeVisible()` |
| **스크린샷** | `e2e-004-start-cooking.png` |
| **관련 요구사항** | K-010 |

#### E2E-005: 조리완료 버튼

| 항목 | 내용 |
|------|------|
| **파일** | `tests/e2e/kitchen.spec.ts` |
| **테스트명** | `test('조리완료 버튼 클릭 시 completed 상태로 변경되고 카드가 숨겨진다')` |
| **사전조건** | cooking 주문 존재 |
| **data-testid 셀렉터** | |
| - 조리완료 버튼 | `[data-testid="complete-cooking-btn"]` |
| **실행 단계** | |
| 1 | `await page.goto('/kitchen')` |
| 2 | cooking 주문 카드에서 조리완료 버튼 찾기 |
| 3 | `await page.click('[data-testid="complete-cooking-btn"]')` |
| 4 | API 응답 대기 |
| 5 | 카드 숨김 확인 |
| **API 확인** | `PATCH /api/orders/{id}/status` → 200 |
| **검증 포인트** | `expect(orderCard).not.toBeVisible()` |
| **스크린샷** | `e2e-005-complete-cooking.png` |
| **관련 요구사항** | K-011 |

#### E2E-006: 완료 주문 숨김

| 항목 | 내용 |
|------|------|
| **파일** | `tests/e2e/kitchen.spec.ts` |
| **테스트명** | `test('완료된 주문은 메인 그리드에서 제거된다')` |
| **사전조건** | cooking 주문 존재 |
| **실행 단계** | |
| 1 | 초기 카드 개수 확인 |
| 2 | 조리완료 버튼 클릭 |
| 3 | 카드 개수 확인 (감소) |
| **검증 포인트** | `expect(orderCards).toHaveCount(initialCount - 1)` |
| **관련 요구사항** | K-012 |

#### E2E-007: 주문 필터링

| 항목 | 내용 |
|------|------|
| **파일** | `tests/e2e/kitchen.spec.ts` |
| **테스트명** | `test('pending/cooking 상태만 메인 그리드에 표시된다')` |
| **사전조건** | pending, cooking, completed 주문 혼재 |
| **실행 단계** | |
| 1 | DB에 completed 주문 추가 (시드) |
| 2 | `await page.goto('/kitchen')` |
| 3 | 표시된 모든 카드의 상태 확인 |
| **검증 포인트** | 모든 카드가 pending 또는 cooking 상태 |
| **관련 요구사항** | K-001, K-012, BR-01 |

---

## 4. UI 테스트케이스 (매뉴얼)

### 4.1 테스트 케이스 목록

| TC-ID | 테스트 항목 | 사전조건 | 테스트 단계 | 예상 결과 | 우선순위 | 요구사항 |
|-------|-----------|---------|-----------|----------|---------|----------|
| TC-001 | 새 주문 실시간 추가 | /kitchen 접속 | 고객 화면에서 주문 | 카드 즉시 추가 | Critical | K-001 |
| TC-002 | 알림음 재생 | /kitchen 접속 | 새 주문 생성 | 알림음 들림 | High | K-002 |
| TC-003 | 주문 정보 표시 | 주문 존재 | 카드 확인 | 모든 정보 표시 | High | K-003 |
| TC-004 | 조리시작 버튼 | pending 주문 | 버튼 클릭 | cooking 상태 변경 | Critical | K-010 |
| TC-005 | 조리완료 버튼 | cooking 주문 | 버튼 클릭 | completed 상태 변경 | Critical | K-011 |
| TC-006 | 완료 주문 숨김 | 주문 완료 | 화면 확인 | 카드 사라짐 | High | K-012 |
| TC-007 | 그리드 반응형 | - | 창 크기 조절 | 열 수 변경 | Medium | - |
| TC-008 | 연결 상태 표시 | - | 연결/끊김 | 헤더 배지 변경 | Medium | - |
| TC-009 | 에러 처리 | 네트워크 오류 | 버튼 클릭 | 에러 메시지 | Medium | - |
| TC-010 | 경과 시간 표시 | 주문 존재 | 시간 경과 | "N분 전" 업데이트 | Low | K-003 |

### 4.2 매뉴얼 테스트 상세

#### TC-001: 새 주문 실시간 추가

**테스트 목적**: 고객이 주문하면 주방 화면에 즉시 표시되는지 확인

**테스트 단계**:
1. /kitchen 페이지 접속
2. 현재 주문 카드 개수 확인 (N개)
3. 별도 브라우저/탭에서 /order?table=1 접속
4. 메뉴 선택 후 주문하기 클릭
5. 주방 화면에서 새 카드 추가 확인

**예상 결과**:
- 1초 이내에 새 주문 카드 추가
- 카드에 테이블 1, 주문 메뉴 정보 표시
- 카드 개수 N+1개

**검증 기준**:
- [ ] 새 주문 카드가 1초 이내 표시됨
- [ ] 주문 정보가 정확히 표시됨
- [ ] 카드가 목록 맨 앞에 추가됨

#### TC-002: 알림음 재생

**테스트 목적**: 새 주문 시 알림음이 재생되는지 확인

**테스트 단계**:
1. /kitchen 페이지 접속
2. 화면 아무 곳이나 클릭 (오디오 정책 해제)
3. 새 주문 생성
4. 알림음 확인

**예상 결과**:
- 알림음이 정상 재생됨
- 연속 주문 시 각각 알림음 재생

**검증 기준**:
- [ ] 첫 클릭 후 알림음 활성화
- [ ] 새 주문마다 알림음 재생
- [ ] 음량이 적절함

#### TC-004: 조리시작 버튼

**테스트 목적**: 조리시작 버튼 클릭 시 상태가 cooking으로 변경되는지 확인

**테스트 단계**:
1. pending 주문 카드 확인
2. [조리시작] 버튼 클릭
3. 카드 스타일 변경 확인
4. 버튼 텍스트 변경 확인

**예상 결과**:
- 카드 배경색이 앰버 계열로 변경
- "조리중" 배지 표시
- 버튼이 [조리완료]로 변경

**검증 기준**:
- [ ] 버튼 클릭 시 로딩 표시
- [ ] 상태 변경 성공 후 UI 업데이트
- [ ] 고객 화면에도 상태 반영 (별도 확인)

#### TC-007: 그리드 반응형

**테스트 목적**: 화면 크기에 따라 그리드 열 수가 변경되는지 확인

**테스트 단계**:
1. 데스크톱 크기 (1280px+) 에서 확인 → 4열
2. 태블릿 크기 (1024px) 로 조절 → 3열
3. 작은 태블릿 (768px) 로 조절 → 2열
4. 모바일 크기 (375px) 로 조절 → 1열

**예상 결과**:
- 각 브레이크포인트에서 열 수 정상 변경
- 카드 크기 적절히 조절
- 내용 잘림 없음

**검증 기준**:
- [ ] 1280px+: 4열
- [ ] 1024-1279px: 3열
- [ ] 768-1023px: 2열
- [ ] 767px-: 1열

---

## 5. 테스트 데이터 (Fixture)

### 5.1 E2E 테스트용 시드 데이터

| 시드 ID | 용도 | 생성 방법 | 포함 데이터 |
|---------|------|----------|------------|
| SEED-KITCHEN-BASE | 기본 주방 테스트 | 자동 시드 | pending 2개, cooking 1개 |
| SEED-KITCHEN-EMPTY | 빈 화면 테스트 | 자동 시드 | 대기 주문 없음 |
| SEED-KITCHEN-MIXED | 필터링 테스트 | 자동 시드 | pending/cooking/completed 각 1개 |

### 5.2 테스트 주문 데이터

| 주문 ID | 테이블 | 상태 | 메뉴 | 용도 |
|---------|--------|------|------|------|
| ORDER-001 | 1 | pending | 김치찌개 x1, 공기밥 x2 | 조리시작 테스트 |
| ORDER-002 | 3 | pending | 비빔밥 x1 | 목록 표시 테스트 |
| ORDER-003 | 5 | cooking | 된장찌개 x2 | 조리완료 테스트 |
| ORDER-004 | 7 | completed | 불고기 x1 | 필터링 테스트 |

---

## 6. data-testid 목록

> 프론트엔드 컴포넌트에 적용할 `data-testid` 속성 정의

### 6.1 /kitchen 페이지

| data-testid | 요소 | 용도 |
|-------------|------|------|
| `kitchen-page` | 페이지 컨테이너 | 페이지 로드 확인 |
| `kitchen-header` | 헤더 영역 | 타이틀 및 연결 상태 |
| `connection-status` | 연결 상태 배지 | 연결 상태 확인 |
| `order-grid` | 주문 그리드 | 목록 컨테이너 |
| `empty-state` | 빈 상태 | 주문 없음 표시 |
| `loading-spinner` | 로딩 스피너 | 초기 로딩 |

### 6.2 OrderCard 컴포넌트

| data-testid | 요소 | 용도 |
|-------------|------|------|
| `order-card` | 카드 컨테이너 | 카드 선택 |
| `order-card-{id}` | 특정 카드 | 특정 주문 선택 |
| `order-table-number` | 테이블 번호 | 테이블 확인 |
| `order-menu-list` | 메뉴 목록 | 메뉴 영역 |
| `order-menu-item` | 메뉴 항목 | 개별 메뉴 |
| `order-time` | 주문 시간 | 경과 시간 |
| `status-badge` | 상태 배지 | 조리중 표시 |
| `start-cooking-btn` | 조리시작 버튼 | pending → cooking |
| `complete-cooking-btn` | 조리완료 버튼 | cooking → completed |

---

## 7. 테스트 커버리지 목표

### 7.1 E2E 테스트 커버리지

| 구분 | 목표 |
|------|------|
| PRD 요구사항 (K-001 ~ K-012) | 100% 커버 |
| 비즈니스 규칙 (BR) | 100% 커버 |
| 에러 케이스 | 80% 커버 |

### 7.2 매뉴얼 테스트 커버리지

| 구분 | 목표 |
|------|------|
| 핵심 기능 | 100% 통과 |
| UI/UX 검증 | 전체 화면 |
| 반응형 검증 | 4개 브레이크포인트 |

---

## 8. 테스트 실행 순서

| 순서 | 테스트 ID | 의존성 | 비고 |
|------|----------|--------|------|
| 1 | E2E-003 | 없음 | 기본 렌더링 확인 |
| 2 | E2E-007 | E2E-003 | 필터링 확인 |
| 3 | E2E-001 | E2E-003 | 실시간 추가 확인 |
| 4 | E2E-002 | E2E-001 | 알림음 확인 |
| 5 | E2E-004 | E2E-003 | 조리시작 확인 |
| 6 | E2E-008 | E2E-004 | 상태 전이 확인 |
| 7 | E2E-005 | E2E-004 | 조리완료 확인 |
| 8 | E2E-009 | E2E-005 | 상태 전이 확인 |
| 9 | E2E-006 | E2E-005 | 숨김 확인 |

---

## 관련 문서

- 설계 문서: `010-design.md`
- 추적성 매트릭스: `025-traceability-matrix.md`
- TSK-04-01 설계: `../TSK-04-01/010-design.md`
- TSK-04-02 설계: `../TSK-04-02/010-design.md`

---

<!--
author: Claude
Version History:
- v1.0 (2026-01-02): 최초 작성
-->
