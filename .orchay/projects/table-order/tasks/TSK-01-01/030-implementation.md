# TSK-01-01 구현 보고서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-01 |
| Task 제목 | SQLite 데이터베이스 설정 및 스키마 생성 |
| 문서 버전 | 1.0 |
| 작성일 | 2026-01-02 |
| 상태 | 완료 |
| 카테고리 | development |

---

## 1. 구현 개요

### 1.1 목적

테이블 오더 MVP를 위한 SQLite 데이터베이스 설정:
- better-sqlite3를 이용한 DB 연결
- PRD 섹션 4 데이터 모델 기반 5개 테이블 스키마 생성
- 개발/테스트용 시드 데이터 삽입

### 1.2 구현 범위

| 구현 항목 | 상태 |
|----------|------|
| `lib/db.ts` 모듈 구현 | ✅ |
| 5개 테이블 스키마 | ✅ |
| 시드 데이터 삽입 | ✅ |
| 유틸리티 함수 | ✅ |
| TDD 테스트 | ✅ |

---

## 2. 구현 상세

### 2.1 파일 구조

```
mvp/src/
├── lib/
│   └── db.ts              # SQLite 연결 및 초기화
├── data/
│   └── database.db        # SQLite DB 파일 (자동 생성)
└── tests/
    └── db.test.ts         # TDD 테스트
```

### 2.2 db.ts 모듈

#### Export 함수

| 함수 | 설명 |
|------|------|
| `getDb()` | DB 인스턴스 반환 (싱글톤) |
| `ensureInitialized()` | 초기화 상태 확인 |
| `reseedData()` | 시드 데이터 재삽입 (개발용) |
| `default` | DB 인스턴스 기본 export |

#### 구현 특징

1. **싱글톤 패턴**: 하나의 DB 인스턴스만 유지
2. **자동 초기화**: import 시 스키마 생성 및 시드 데이터 삽입
3. **환경 변수 지원**: `DB_PATH`로 테스트용 DB 경로 오버라이드
4. **FK 비활성화**: MVP 단순화를 위해 FK 제약 비활성화

### 2.3 테이블 스키마

#### tables
```sql
CREATE TABLE tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_number INTEGER NOT NULL,
  status TEXT DEFAULT 'available'
);
```

#### categories
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);
```

#### menus
```sql
CREATE TABLE menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  image_url TEXT,
  is_sold_out INTEGER DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

#### orders
```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id) REFERENCES tables(id)
);
```

#### order_items
```sql
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  menu_id INTEGER,
  quantity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (menu_id) REFERENCES menus(id)
);
```

### 2.4 시드 데이터

#### 테이블 (5개)
| table_number | status |
|--------------|--------|
| 1 ~ 5 | available |

#### 카테고리 (3개)
| name | sort_order |
|------|------------|
| 메인메뉴 | 1 |
| 사이드메뉴 | 2 |
| 음료 | 3 |

#### 메뉴 (10개)
| category_id | name | price |
|-------------|------|-------|
| 1 | 김치찌개 | 8000 |
| 1 | 된장찌개 | 8000 |
| 1 | 비빔밥 | 9000 |
| 1 | 제육볶음 | 10000 |
| 1 | 불고기정식 | 12000 |
| 2 | 공기밥 | 1000 |
| 2 | 계란찜 | 3000 |
| 2 | 김치 추가 | 2000 |
| 3 | 콜라 | 2000 |
| 3 | 사이다 | 2000 |

---

## 3. 사용 예시

```typescript
// DB import
import db from '@/lib/db';

// 메뉴 조회
const menus = db.prepare('SELECT * FROM menus WHERE is_sold_out = 0').all();

// 주문 생성
const stmt = db.prepare('INSERT INTO orders (table_id, status) VALUES (?, ?)');
const result = stmt.run(tableId, 'pending');
const orderId = result.lastInsertRowid;

// 주문 항목 생성
const itemStmt = db.prepare('INSERT INTO order_items (order_id, menu_id, quantity) VALUES (?, ?, ?)');
itemStmt.run(orderId, menuId, quantity);
```

---

## 4. 테스트 결과

| 항목 | 결과 |
|------|------|
| 총 테스트 | 30개 |
| 통과율 | 100% |
| 커버리지 | 94.44% |
| 함수 커버리지 | 100% |

상세 결과: `070-tdd-test-results.md` 참조

---

## 5. 설계 대비 구현

| 설계 항목 | 구현 상태 | 비고 |
|----------|----------|------|
| DB 파일 경로 `./data/database.db` | ✅ | 환경 변수 지원 추가 |
| 5개 테이블 스키마 | ✅ | |
| FK 제약 조건 | ⚠️ | MVP에서 비활성화 |
| 시드 데이터 | ✅ | |
| `ensureInitialized()` | ✅ | |
| `reseedData()` | ✅ | |

---

## 6. 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| better-sqlite3 | ^12.5.0 | SQLite 연결 |
| @types/better-sqlite3 | ^7.6.13 | 타입 정의 |

---

## 7. 다음 단계

- TSK-01-02: 카테고리/메뉴 조회 API 구현
- TSK-01-03: 주문 생성/조회 API 구현

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2026-01-02 | Claude | 최초 작성 |
