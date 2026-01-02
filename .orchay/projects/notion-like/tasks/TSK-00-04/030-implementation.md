# TSK-00-04: SQLite 데이터베이스 초기화 - 구현 보고서

## 0. 문서 메타데이터

* **문서명**: `030-implementation.md`
* **Task ID**: TSK-00-04
* **Task 명**: SQLite 데이터베이스 초기화
* **작성일**: 2026-01-02
* **작성자**: devops-architect (Claude Agent)
* **참조 기술설계서**: `./010-tech-design.md`
* **구현 기간**: 2026-01-02
* **구현 상태**: ✅ 완료

### 문서 위치
```
projects/notion-like/tasks/TSK-00-04/
├── 010-tech-design.md     ← 기술 설계
├── 030-implementation.md  ← 구현 보고서 (본 문서)
└── test-results/
    └── tdd/
```

---

## 1. 구현 개요

### 1.1 구현 목적
- better-sqlite3를 사용하여 SQLite 데이터베이스 파일 생성
- 페이지 관리를 위한 스키마 정의 및 CRUD 유틸리티 구현
- 타입 안전한 데이터베이스 연동 레이어 제공

### 1.2 구현 범위
- **포함된 기능**:
  - SQLite 데이터베이스 파일 자동 생성 (`data/database.db`)
  - pages 테이블 스키마 정의 (id, title, icon, cover_url, parent_id, content, is_favorite, sort_order, created_at, updated_at)
  - DatabaseManager 클래스 (싱글톤 패턴)
  - CRUD 함수 (createPage, getPageById, getAllPages, getChildPages, getFavoritePages, updatePage, deletePage)
  - 외래 키 제약조건 (ON DELETE CASCADE)
  - WAL 모드 활성화 (concurrent read)
  - 단위 테스트 22건 (100% 통과)

- **제외된 기능** (향후 구현 예정):
  - 마이그레이션 시스템 (MVP 단계에서 스킵)
  - 비동기 API 래퍼 (성능 이슈 시 고려)

### 1.3 구현 유형
- [x] Infrastructure Only
- [ ] Backend Only
- [ ] Frontend Only
- [ ] Full-stack

### 1.4 기술 스택
- **Database**: SQLite 3
- **Driver**: better-sqlite3 ^11.0.0
- **UUID**: uuid ^11.0.0
- **API 스타일**: 동기 API (blocking)
- **Testing**: Vitest 2.x
- **Language**: TypeScript 5.x

---

## 2. 구현된 컴포넌트

### 2.1 DatabaseManager 클래스

**파일**: `src/lib/db.ts`

**주요 메서드**:
| 메서드 | 설명 | 반환 타입 |
|--------|------|-----------|
| `createPage(input)` | 페이지 생성 | `Page` |
| `getPageById(id)` | ID로 페이지 조회 | `Page \| undefined` |
| `getAllPages()` | 모든 페이지 조회 | `Page[]` |
| `getChildPages(parentId)` | 자식 페이지 조회 | `Page[]` |
| `getFavoritePages()` | 즐겨찾기 페이지 조회 | `Page[]` |
| `updatePage(input)` | 페이지 업데이트 | `Page \| undefined` |
| `deletePage(id)` | 페이지 삭제 | `boolean` |
| `close()` | DB 연결 종료 | `void` |

### 2.2 데이터베이스 스키마

```sql
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled',
  icon TEXT,
  cover_url TEXT,
  parent_id TEXT,
  content TEXT,                    -- JSON string (BlockNote content)
  is_favorite INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE CASCADE
);

CREATE INDEX idx_pages_parent_id ON pages(parent_id);
CREATE INDEX idx_pages_is_favorite ON pages(is_favorite);
CREATE INDEX idx_pages_sort_order ON pages(sort_order);
```

### 2.3 TypeScript 인터페이스

```typescript
export interface Page {
  id: string;
  title: string;
  icon?: string;
  cover_url?: string;
  parent_id?: string;
  content?: string;                 // JSON string
  is_favorite: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePageInput {
  id?: string;                      // UUID 생성 (선택)
  title?: string;
  icon?: string;
  cover_url?: string;
  parent_id?: string;
  content?: string;
  is_favorite?: boolean;
  sort_order?: number;
}

export interface UpdatePageInput extends Partial<CreatePageInput> {
  id: string;                       // 필수
}
```

### 2.4 싱글톤 패턴 구현

```typescript
export let dbInstance: DatabaseManager | null = null;

export function getDb(): DatabaseManager {
  if (!dbInstance) {
    dbInstance = new DatabaseManager();
  }
  return dbInstance;
}

export function resetDb(): void {   // 테스트용
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// CRUD 함수들 export
export const db = {
  createPage: (input: CreatePageInput) => getDb().createPage(input),
  getPageById: (id: string) => getDb().getPageById(id),
  getAllPages: () => getDb().getAllPages(),
  getChildPages: (parentId: string) => getDb().getChildPages(parentId),
  getFavoritePages: () => getDb().getFavoritePages(),
  updatePage: (input: UpdatePageInput) => getDb().updatePage(input),
  deletePage: (id: string) => getDb().deletePage(id),
};
```

---

## 3. TDD 테스트 결과

### 3.1 테스트 커버리지

```
File           | % Stmts | % Branch | % Funcs | % Lines |
---------------|---------|----------|---------|---------|
db.ts          |  100.00 |   100.00 |  100.00 |  100.00|
---------------|---------|----------|---------|---------|
전체            |  100.00 |   100.00 |  100.00 |  100.00|
```

**품질 기준 달성 여부**:
- ✅ 테스트 커버리지 80% 이상: **100%**
- ✅ 모든 테스트 통과: **22/22 통과**
- ✅ 정적 분석 통과: TypeScript strict mode

### 3.2 테스트 실행 결과

```bash
$ npm test -- src/lib/__tests__/db.test.ts --run

✓ src/lib/__tests__/db.test.ts (22 tests) 1011ms

Test Files  1 passed (1)
Tests       22 passed (22)
Duration    3.27s
```

### 3.3 테스트 시나리오 상세

#### CREATE 테스트 (5건)
| 테스트 ID | 시나리오 | 결과 |
|-----------|----------|------|
| CREATE-001 | 새 페이지 생성 | ✅ Pass |
| CREATE-002 | ID 명시하여 생성 | ✅ Pass |
| CREATE-003 | 기본값 Untitled 설정 | ✅ Pass |
| CREATE-004 | 부모 페이지 ID 설정 | ✅ Pass |
| CREATE-005 | content JSON 저장 | ✅ Pass |

#### READ 테스트 (5건)
| 테스트 ID | 시나리오 | 결과 |
|-----------|----------|------|
| READ-001 | ID로 페이지 조회 | ✅ Pass |
| READ-002 | 없는 ID로 조회 (undefined) | ✅ Pass |
| READ-003 | 모든 페이지 조회 | ✅ Pass |
| READ-004 | 자식 페이지 조회 | ✅ Pass |
| READ-005 | 즐겨찾기 페이지 조회 | ✅ Pass |

#### UPDATE 테스트 (4건)
| 테스트 ID | 시나리오 | 결과 |
|-----------|----------|------|
| UPDATE-001 | 페이지 업데이트 | ✅ Pass |
| UPDATE-002 | 여러 필드 동시 업데이트 | ✅ Pass |
| UPDATE-003 | updated_at 자동 변경 | ✅ Pass |
| UPDATE-004 | 없는 페이지 업데이트 (undefined) | ✅ Pass |

#### DELETE 테스트 (3건)
| 테스트 ID | 시나리오 | 결과 |
|-----------|----------|------|
| DELETE-001 | 페이지 삭제 | ✅ Pass |
| DELETE-002 | 없는 페이지 삭제 (false) | ✅ Pass |
| DELETE-003 | CASCADE (부모 삭제 시 자식도 삭제) | ✅ Pass |

#### Sort Order 테스트 (2건)
| 테스트 ID | 시나리오 | 결과 |
|-----------|----------|------|
| SORT-001 | sort_order 순서대로 정렬 | ✅ Pass |
| SORT-002 | sort_order 같으면 created_at 순서 | ✅ Pass |

#### Edge Cases 테스트 (3건)
| 테스트 ID | 시나리오 | 결과 |
|-----------|----------|------|
| EDGE-001 | 빈 문자열 title (Untitled 기본값) | ✅ Pass |
| EDGE-002 | null 값 필드 처리 | ✅ Pass |
| EDGE-003 | 대용량 content 저장 (10,000자) | ✅ Pass |

---

## 4. 요구사항 커버리지

### 4.1 기술설계 수용 기준 매핑

| 수용 기준 | 테스트 ID | 결과 |
|-----------|-----------|------|
| `data/database.db` 파일 생성 확인 | CREATE-001 | ✅ |
| pages 테이블 스키마 생성 확인 | READ-001 | ✅ |
| `db.createPage()` 함수 동작 확인 | CREATE-001 | ✅ |
| `db.getPageById()` 함수 동작 확인 | READ-001 | ✅ |
| `db.getAllPages()` 함수 동작 확인 | READ-003 | ✅ |
| `db.updatePage()` 함수 동작 확인 | UPDATE-001 | ✅ |
| `db.deletePage()` 함수 동작 확인 | DELETE-001 | ✅ |
| 타입 에러 없음 | 전체 | ✅ |

---

## 5. 주요 기술적 결정사항

### 5.1 아키텍처 결정

1. **싱글톤 패턴 사용**
   - 배경: DB 연결은 전체 애플리케이션에서 하나의 인스턴스만 필요
   - 선택: 싱글톤 패턴 + `getDb()` 함수
   - 대안: 의존성 주입 (DI) 패턴
   - 근거:
     - 간단한 유틸리티 모듈로 DI 오버헤드 불필요
     - Vitest 테스트에서 `resetDb()`로 쉽게 초기화 가능
     - 레거시 함수와의 호환성 유지

2. **동기 API (better-sqlite3) 선택**
   - 배경: SQLite 드라이버 선택 필요
   - 선택: better-sqlite3 (동기 API)
   - 대안: sql.js (비동기 WebAssembly)
   - 근거:
     - Node.js 환경에서 차단 시간이 미미함 (DB 작업이 빠름)
     - API가 간단하고 직관적임
     - WAL 모드로 동시 읽기 지원

3. **레거시 함수 호환성 유지**
   - 배경: 기존 코드에서 비동기 함수 사용 (`async/await`)
   - 선택: 동기 함수를 `async` 래퍼로 export
   - 근거:
     - 기존 코드 (`src/app/page.tsx`)와의 호환성
     - Migration 비용 최소화
     - 내부 구현은 동기 API 유지 (성능)

### 5.2 구현 패턴
- **디자인 패턴**: Singleton (DatabaseManager)
- **코드 컨벤션**:
  - Google-style JSDoc 주석
  - TypeScript strict mode
  - 함수 길이 20줄 이하 권장
- **에러 핸들링**:
  - `undefined` 반환 (예: 없는 페이지 조회)
  - `boolean` 반환 (예: 삭제 성공/실패)
  - 예외 throw 지양 (SQLite 내부 에러만 전파)

---

## 6. 구현 완료 체크리스트

### 6.1 Infrastructure 체크리스트
- [x] `data/` 디렉토리 생성 완료
- [x] `src/lib/db.ts` 구현 완료
- [x] DatabaseManager 클래스 구현 완료
- [x] Page 인터페이스 정의 완료
- [x] CRUD 함수 구현 완료
- [x] 싱글톤 패턴 적용 완료
- [x] uuid 패키지 설치 완료
- [x] 데이터베이스 파일 생성 확인 완료
- [x] 타입 에러 확인 완료 (0건)
- [x] 단위 테스트 작성 및 통과 (22/22)
- [x] 테스트 커버리지 100% 달성
- [x] WAL 모드 활성화 완료
- [x] 외래 키 CASCADE 설정 완료

### 6.2 통합 체크리스트
- [x] 기술설계서 요구사항 충족 확인
- [x] 수용 기준 100% 달성 (8/8)
- [x] 문서화 완료 (구현 보고서)
- [x] WBS 상태 업데이트 (`[im]` 구현)

---

## 7. 알려진 이슈 및 제약사항

### 7.1 알려진 이슈
없음

### 7.2 기술적 제약사항
- **동기 API**: better-sqlite3는 동기 API이므로 대용량 DB 작업 시 Node.js 메인 스레드 차단 가능
  - **대응**: 현재 MVP 단계에서 DB 작업이 빠르므로 문제 없음, 성능 이슈 시 비동기 라이브러리 고려
- **마이그레이션 부족**: 현재 스키마 변경 시 기존 데이터 처리 필요
  - **대응**: 추후 마이그레이션 시스템 구현 계획 (현재 MVP 단계에서 스킵)

### 7.3 향후 개선 필요 사항
- 마이그레이션 시스템 구현 (스키마 버전 관리)
- 비동기 API 래퍼 (성능 최적화 필요 시)
- 쿼리 빌더 (복잡한 쿼리 지원)
- 트랜잭션 지원 (여러 작업 원자적 실행)

---

## 8. 참고 자료

### 8.1 관련 문서
- 기술설계서: `./010-tech-design.md`
- better-sqlite3 문서: https://github.com/WiseLibs/better-sqlite3
- uuid 문서: https://github.com/uuidjs/uuid

### 8.2 테스트 결과 파일
- 단위 테스트: `src/lib/__tests__/db.test.ts`
- 테스트 결과: 22/22 통과 (100%)
- 커버리지: 100%

### 8.3 소스 코드 위치
- DB 유틸리티: `src/lib/db.ts`
- 데이터 디렉토리: `data/`
- DB 파일: `data/database.db` (자동 생성)

---

## 9. 다음 단계

### 9.1 연결 작업
- **TSK-00-05**: Zustand 스토어 설정 (DB 유틸리티 사용)
- **TSK-01-02**: 에디터 콘텐츠 저장/로드 (content 필드 활용)

### 9.2 다음 워크플로우
- `/wf:verify TSK-00-04` - 통합테스트 시작 (선택사항)
- 다음 Task 진행

---

## 부록: 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0.0 | 2026-01-02 | devops-architect | 최초 작성 |

---

<!--
TSK-00-04: SQLite Database Initialization - Implementation Report
Version: 1.0.0
Category: infrastructure
Agent: devops-architect
-->
