# TSK-01-01 코드 리뷰

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-01 |
| Task 제목 | SQLite 데이터베이스 설정 및 스키마 생성 |
| 리뷰어 | Claude |
| 리뷰 일자 | 2026-01-02 |
| 리뷰 버전 | 2 |
| 비고 | TSK-01-02 구현 반영 후 리뷰 |

---

## 리뷰 대상 파일

| 파일 | LOC | 설명 |
|------|-----|------|
| `mvp/src/lib/db.ts` | 251 | SQLite 연결 및 초기화 모듈 |
| `mvp/tests/db.test.ts` | 391 | TDD 테스트 |

---

## 분석 요약

| 영역 | Critical | Major | Minor | Info |
|------|----------|-------|-------|------|
| 품질 | 0 | 0 | 2 | 1 |
| 보안 | 0 | 0 | 1 | 0 |
| 성능 | 0 | 0 | 0 | 1 |
| 설계 | 0 | 0 | 0 | 2 |

---

## 이전 리뷰 대비 개선 사항

| 이전 지적 (v1) | 상태 | 비고 |
|----------------|------|------|
| [Major] 기본 export 즉시 실행 | ✅ 해결 | `getDb as default`로 지연 초기화 적용 |
| [Minor] 타입 단언 반복 | ⚠️ 일부 해결 | 새 함수에선 타입 정의 사용 |
| [Minor] 에러 처리 미흡 | 미해결 | 동일 |

---

## 상세 리뷰

### 1. 품질

#### [Minor] 타입 단언 여전히 사용 (P3)

**파일**: `mvp/src/lib/db.ts:124, 151-154`

**문제**:
```typescript
const tableCount = (db.prepare('SELECT COUNT(*) as count FROM tables').get() as { count: number }).count;
```

`getCategories()`와 `getMenus()`에서는 인터페이스(`Category`, `Menu`)를 정의하여 타입 안전성이 향상되었으나, 기존 코드의 타입 단언은 그대로입니다.

**권장**:
```typescript
interface CountResult {
  count: number;
}
// 기존 코드에도 동일 패턴 적용
```

---

#### [Minor] 에러 처리 미흡 (P3)

**파일**: `mvp/src/lib/db.ts:156`

**문제**:
```typescript
} catch {
  return false;
}
```

에러를 무시하여 디버깅 어려움. (이전 리뷰와 동일)

**권장**:
```typescript
} catch (error) {
  console.error('[DB] 초기화 상태 확인 실패:', error);
  return false;
}
```

---

#### [Info] 인터페이스 정의 개선

**파일**: `mvp/src/lib/db.ts:186-203`

`Category`와 `Menu` 인터페이스가 명확하게 정의되어 있어 타입 안전성이 향상되었습니다. camelCase 변환도 SQL alias로 깔끔하게 처리됨.

---

### 2. 보안

#### [Minor] SQL 문자열 템플릿 사용 (P3)

**파일**: `mvp/src/lib/db.ts:225`

**현재**:
```typescript
const whereClause = includeSoldOut ? '' : 'WHERE m.is_sold_out = 0';
const stmt = db.prepare(`
  SELECT ...
  ${whereClause}
  ...
`);
```

`whereClause`가 고정된 문자열이므로 현재는 안전하지만, 동적 쿼리 패턴은 주의가 필요합니다. 향후 확장 시 매개변수화된 쿼리로 변경 권장.

---

### 3. 성능

#### [Info] JOIN 쿼리 최적화

**파일**: `mvp/src/lib/db.ts:226-239`

`getMenus()` 함수에서 `categories` 테이블과 JOIN하여 `categoryName`을 가져옵니다. MVP 규모에서는 문제없으나, 대규모 데이터에서는 인덱스 추가 고려.

```sql
-- 권장 인덱스 (대규모 데이터 시)
CREATE INDEX idx_menus_category ON menus(category_id);
```

---

### 4. 설계

#### [Info] 지연 초기화 적용 완료

**파일**: `mvp/src/lib/db.ts:248-250`

```typescript
// 기본 export - getDb 함수 자체를 export하여 지연 초기화 지원
// 모듈 로드 시점에 DB 연결 생성 방지 (사용 시점에 초기화)
export { getDb as default };
```

이전 리뷰의 Major 지적사항이 해결되었습니다.

---

#### [Info] Boolean 변환 처리

**파일**: `mvp/src/lib/db.ts:240-245`

```typescript
const rows = stmt.all() as Array<Omit<Menu, 'isSoldOut'> & { isSoldOut: number }>;
return rows.map(row => ({
  ...row,
  isSoldOut: row.isSoldOut === 1,
}));
```

SQLite의 INTEGER(0/1)를 JavaScript boolean으로 변환하는 패턴이 명확합니다.

---

## 테스트 코드 리뷰

| 항목 | 상태 | 비고 |
|------|------|------|
| 테스트 커버리지 | ✅ | 30개 테스트, 94% 커버리지 |
| 격리성 | ✅ | 환경 변수로 테스트 DB 분리 |
| 정리 | ✅ | afterAll에서 테스트 DB 삭제 |

### [Info] TSK-01-02 함수 테스트 누락

`getCategories()`와 `getMenus()` 함수는 TSK-01-02 범위이므로 해당 Task에서 테스트될 것으로 예상됩니다.

---

## 보안 검토

| 항목 | 상태 | 비고 |
|------|------|------|
| SQL Injection | ✅ | Prepared statement 사용 |
| Path Traversal | ✅ | 환경 변수 경로만 사용 |
| 민감 데이터 | ✅ | 해당 없음 |

---

## 결론

### 긍정적 사항

1. **지연 초기화 적용**: 이전 Major 지적사항 해결
2. **타입 안전성 향상**: `Category`, `Menu` 인터페이스 정의
3. **camelCase 변환**: SQL alias로 깔끔한 필드명 변환
4. **Boolean 변환 처리**: SQLite INTEGER → JS boolean 명확히 처리

### 개선 필요 사항

| 우선순위 | 항목 | 조치 |
|----------|------|------|
| P3 | 타입 단언 반복 | 헬퍼 인터페이스 추출 |
| P3 | 에러 처리 | 로깅 추가 |
| P3 | SQL 템플릿 | 매개변수화 고려 (향후) |

### 리뷰 판정

**✅ 승인**

이전 Major 지적사항이 해결되었고, 남은 Minor 이슈는 코드 품질 개선 사항으로 즉시 수정 필수 아님.

---

## 다음 단계

- `/wf:verify` - 통합테스트 진행

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1 | 2026-01-02 | Claude | 최초 작성 |
| 2 | 2026-01-02 | Claude | TSK-01-02 반영 후 재리뷰 |
