# 코드 리뷰 보고서

## 0. 문서 메타데이터

* **문서명**: `031-code-review-claude-1.md`
* **Task ID**: TSK-01-02
* **Task 명**: 카테고리/메뉴 조회 API 구현
* **리뷰 일자**: 2026-01-02
* **리뷰어**: Claude (claude-opus-4-5-20251101)
* **리뷰 대상**: 030-implementation.md에 명시된 구현 파일

---

## 1. 리뷰 요약

### 1.1 분석 대상 파일

| 파일 | 라인 수 | 역할 |
|------|---------|------|
| `src/app/api/categories/route.ts` | 21 | 카테고리 API 엔드포인트 |
| `src/app/api/menus/route.ts` | 24 | 메뉴 API 엔드포인트 |
| `src/lib/db.ts` | 251 | DB 연결 및 조회 함수 |
| `tests/api.test.ts` | 168 | API 테스트 |

### 1.2 전체 점수

| 영역 | 점수 | 비고 |
|------|------|------|
| 코드 품질 | 8/10 | 구조 양호, 일부 개선 여지 |
| 보안 | 9/10 | SQL Injection 안전, FK 비활성화 주의 |
| 성능 | 8/10 | 적절한 쿼리 구조 |
| 설계 | 8/10 | 관심사 분리 잘됨 |

### 1.3 지적사항 요약

| 심각도 | 건수 |
|--------|------|
| Critical | 0 |
| Major | 1 |
| Minor | 3 |
| Info | 2 |

---

## 2. 상세 분석

### 2.1 품질 분석

#### [Minor] P3 - db.ts SQL 쿼리 문자열 템플릿 사용

**파일**: `src/lib/db.ts:225-238`

**현상**:
```typescript
const whereClause = includeSoldOut ? '' : 'WHERE m.is_sold_out = 0';
const stmt = db.prepare(`
  SELECT ... ${whereClause} ...
`);
```

**분석**: 동적 SQL 구성에 문자열 보간을 사용하고 있습니다. 현재 `includeSoldOut`은 boolean이므로 SQL Injection 위험은 없지만, 유지보수성과 일관성 측면에서 개선 여지가 있습니다.

**권장 수정**:
```typescript
export function getMenus(includeSoldOut: boolean = false): Menu[] {
  const db = getDb();
  const sql = includeSoldOut
    ? `SELECT ... FROM menus m JOIN categories c ON m.category_id = c.id ORDER BY c.sort_order, m.id`
    : `SELECT ... FROM menus m JOIN categories c ON m.category_id = c.id WHERE m.is_sold_out = 0 ORDER BY c.sort_order, m.id`;
  const stmt = db.prepare(sql);
  // ...
}
```

---

#### [Minor] P3 - 타입 캐스팅 개선

**파일**: `src/lib/db.ts:124, 151-154`

**현상**:
```typescript
const tableCount = (db.prepare('SELECT COUNT(*)...').get() as { count: number }).count;
```

**분석**: `as` 타입 캐스팅이 여러 곳에서 반복됩니다.

**권장 수정**: 헬퍼 타입 또는 제네릭 함수를 활용하면 코드 중복을 줄일 수 있습니다.

---

### 2.2 보안 분석

#### [Major] P2 - Foreign Key 비활성화

**파일**: `src/lib/db.ts:137-138`

**현상**:
```typescript
// MVP에서는 FK 제약 비활성화 (설계 문서 에러 처리 참조)
dbInstance.pragma('foreign_keys = OFF');
```

**분석**: FK 비활성화는 데이터 무결성 위험을 초래합니다. 주석에 설계 문서를 참조하도록 되어 있으나, MVP 이후 반드시 활성화해야 합니다.

**권장 조치**:
1. MVP 완료 후 `foreign_keys = ON` 전환 계획 수립
2. 데이터 무결성 관련 문서화 추가

---

### 2.3 성능 분석

#### [Info] - JOIN 쿼리 최적화 가능

**파일**: `src/lib/db.ts:226-239`

**현상**: 현재 메뉴 조회 시 매번 categories 테이블과 JOIN합니다.

**분석**: MVP 규모에서는 문제없으나, 메뉴 수 증가 시 categoryName을 별도 캐싱하거나 인덱스 추가를 고려할 수 있습니다.

---

### 2.4 설계 분석

#### [Minor] P3 - API Route 에러 로깅 형식

**파일**: `src/app/api/categories/route.ts:15`, `src/app/api/menus/route.ts:18`

**현상**:
```typescript
console.error('Failed to fetch categories:', error);
```

**분석**: 에러 로깅은 적절하나, 프로덕션 환경에서는 구조화된 로깅(structured logging)을 권장합니다.

**권장 조치**: 향후 로깅 라이브러리 도입 고려 (pino, winston 등)

---

#### [Info] - 테스트 파일 구조

**파일**: `tests/api.test.ts`

**분석**: 테스트 구조가 잘 되어있습니다. describe 블록으로 기능별 분리, beforeAll/afterAll로 테스트 DB 관리가 적절합니다.

---

## 3. 보안 체크리스트

| 항목 | 상태 | 비고 |
|------|------|------|
| SQL Injection | ✅ 안전 | Prepared Statement 사용 |
| XSS | ✅ 해당없음 | API 전용 (프론트 미구현) |
| 인증/권한 | ⚠️ 해당없음 | 공개 API (설계 의도) |
| 입력 검증 | ✅ 양호 | boolean 파라미터만 사용 |
| 에러 노출 | ✅ 양호 | 상세 에러 클라이언트 미노출 |

---

## 4. 권장사항 요약

### 4.1 즉시 수정 필요 (P1)
- 없음

### 4.2 통합테스트 전 권장 (P2)
| 번호 | 내용 | 파일 |
|------|------|------|
| 1 | FK 비활성화 관련 문서화 보강 | db.ts |

### 4.3 향후 개선 (P3)
| 번호 | 내용 | 파일 |
|------|------|------|
| 1 | SQL 문자열 보간 대신 명시적 쿼리 분리 | db.ts |
| 2 | 타입 캐스팅 헬퍼 도입 | db.ts |
| 3 | 구조화된 로깅 도입 | route.ts |

---

## 5. 결론

TSK-01-02 구현은 전체적으로 **양호**합니다. Critical 이슈 없이, 설계 문서의 요구사항을 충실히 이행했습니다.

- **강점**: 관심사 분리, 타입 정의, 테스트 커버리지
- **개선점**: FK 비활성화 문서화, 향후 로깅 체계 수립

**다음 단계 권장**: `/wf:verify TSK-01-02` (통합테스트 진행)

---

## 6. 리뷰 이력

| 버전 | 날짜 | 리뷰어 | 비고 |
|------|------|--------|------|
| 1.0 | 2026-01-02 | Claude | 최초 리뷰 |
