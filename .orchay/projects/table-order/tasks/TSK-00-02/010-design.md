# TSK-00-02 - 프로젝트 구조 및 타입 정의 설계 문서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-00-02 |
| 문서 버전 | 1.0 |
| 작성일 | 2026-01-02 |
| 상태 | 작성중 |
| 카테고리 | infrastructure |

---

## 1. 개요

### 1.1 배경 및 문제 정의

**현재 상황:**
- TSK-00-01에서 Next.js 프로젝트가 초기화됨
- 의존성은 설치되었으나 구체적인 폴더 구조와 타입 정의가 없음

**해결하려는 문제:**
- 일관된 프로젝트 구조 없이 개발 시 코드 관리 어려움
- 타입 정의 없이 개발 시 런타임 오류 발생 가능성

### 1.2 목적 및 기대 효과

**목적:**
- TRD에 명시된 표준 폴더 구조 생성
- PRD 데이터 모델 기반 TypeScript 타입 정의

**기대 효과:**
- 모든 개발자가 동일한 구조로 작업
- 타입 안정성 확보로 개발 생산성 향상

### 1.3 범위

**포함:**
- TRD 섹션 3에 명시된 폴더 구조 생성 (`app/`, `components/`, `lib/`, `types/`)
- PRD 섹션 4 데이터 모델 기반 공통 타입 정의 (Table, Category, Menu, Order, OrderItem)

**제외:**
- 실제 컴포넌트 구현
- API 엔드포인트 구현
- 데이터베이스 스키마 (TSK-01-01에서 처리)

### 1.4 참조 문서

| 문서 | 경로 | 관련 섹션 |
|------|------|----------|
| TRD | `.orchay/projects/table-order/trd.md` | 섹션 3 (프로젝트 구조) |
| PRD | `.orchay/projects/table-order/prd.md` | 섹션 4 (데이터 모델) |

---

## 2. 폴더 구조

TRD 섹션 3에 따른 표준 구조:

```
table-order/
├── app/
│   ├── order/              # 고객: 메뉴/주문
│   │   └── page.tsx        # /order?table={id}
│   ├── status/             # 고객: 주문 상태
│   │   └── page.tsx        # /status?table={id}
│   ├── kitchen/            # 주방: KDS
│   │   └── page.tsx        # /kitchen
│   ├── api/
│   │   ├── categories/     # 카테고리 API
│   │   │   └── route.ts
│   │   ├── menus/          # 메뉴 API
│   │   │   └── route.ts
│   │   ├── orders/         # 주문 API
│   │   │   └── route.ts
│   │   └── kitchen/        # 주방 API
│   │       └── orders/
│   │           └── route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── MenuCard.tsx        # 메뉴 카드 (빈 파일)
│   ├── CartItem.tsx        # 장바구니 아이템 (빈 파일)
│   ├── OrderCard.tsx       # 주문 카드 - KDS (빈 파일)
│   └── StatusBadge.tsx     # 상태 배지 (빈 파일)
├── lib/
│   ├── db.ts               # SQLite 연결 & 쿼리 (빈 파일)
│   └── socket.ts           # Socket.io 설정 (빈 파일)
├── types/
│   └── index.ts            # 타입 정의
└── data/                   # SQLite DB 파일 저장 위치
    └── .gitkeep
```

---

## 3. 타입 정의

PRD 섹션 4 데이터 모델 기반:

### 3.1 Table (테이블)

```typescript
export interface Table {
  id: number;
  table_number: number;
  status: TableStatus;
}

export type TableStatus = 'available' | 'occupied';
```

### 3.2 Category (카테고리)

```typescript
export interface Category {
  id: number;
  name: string;
  sort_order: number;
}
```

### 3.3 Menu (메뉴)

```typescript
export interface Menu {
  id: number;
  category_id: number;
  name: string;
  price: number;
  image_url: string | null;
  is_sold_out: boolean;
}

// 카테고리 정보 포함 조인 타입
export interface MenuWithCategory extends Menu {
  category_name: string;
}
```

### 3.4 Order (주문)

```typescript
export interface Order {
  id: number;
  table_id: number;
  status: OrderStatus;
  created_at: string;
}

export type OrderStatus = 'pending' | 'cooking' | 'completed';

// 주문 항목 포함 타입
export interface OrderWithItems extends Order {
  items: OrderItem[];
  table_number: number;
}
```

### 3.5 OrderItem (주문 항목)

```typescript
export interface OrderItem {
  id: number;
  order_id: number;
  menu_id: number;
  quantity: number;
  status: OrderItemStatus;
}

export type OrderItemStatus = 'pending' | 'cooking' | 'completed';

// 메뉴 정보 포함 타입
export interface OrderItemWithMenu extends OrderItem {
  menu_name: string;
  menu_price: number;
}
```

### 3.6 API 요청/응답 타입

```typescript
// POST /api/orders 요청
export interface CreateOrderRequest {
  tableId: number;
  items: {
    menuId: number;
    quantity: number;
  }[];
}

// PATCH /api/orders/{id}/status 요청
export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

// WebSocket 이벤트 페이로드
export interface OrderNewEvent {
  orderId: number;
  tableNumber: number;
  items: OrderItemWithMenu[];
  createdAt: string;
}

export interface OrderStatusEvent {
  orderId: number;
  status: OrderStatus;
}
```

---

## 4. 구현 범위

### 4.1 생성할 폴더

| 폴더 | 용도 |
|------|------|
| `app/order/` | 고객 메뉴/주문 페이지 |
| `app/status/` | 고객 주문 상태 페이지 |
| `app/kitchen/` | 주방 KDS 페이지 |
| `app/api/categories/` | 카테고리 API |
| `app/api/menus/` | 메뉴 API |
| `app/api/orders/` | 주문 API |
| `app/api/kitchen/orders/` | 주방용 주문 API |
| `components/` | 공통 컴포넌트 |
| `lib/` | 유틸리티 |
| `types/` | 타입 정의 |
| `data/` | SQLite DB 저장 |

### 4.2 생성할 파일

| 파일 | 내용 |
|------|------|
| `types/index.ts` | 전체 타입 정의 |
| `components/*.tsx` | 빈 placeholder 파일 |
| `lib/*.ts` | 빈 placeholder 파일 |
| `app/**/page.tsx` | 빈 placeholder 페이지 |
| `app/api/**/route.ts` | 빈 placeholder API |
| `data/.gitkeep` | 폴더 유지용 |

### 4.3 의존성

| 의존 항목 | 이유 | 상태 |
|----------|------|------|
| TSK-00-01 | Next.js 프로젝트 초기화 필요 | 진행중 |

---

## 5. 수용 기준

- [ ] 모든 폴더 구조 생성 완료
- [ ] `types/index.ts` 파일에서 import 가능
- [ ] TypeScript 컴파일 에러 없음

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2026-01-02 | Claude | 최초 작성 |
