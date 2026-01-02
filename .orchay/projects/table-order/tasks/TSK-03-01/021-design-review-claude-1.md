# TSK-03-01 설계 리뷰 결과

## 리뷰 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-03-01 |
| 리뷰어 | claude-1 |
| 리뷰 일자 | 2026-01-02 |
| 대상 문서 | 010-design.md |
| 카테고리 | development (simple-dev) |

---

## 검증 요약

| 검증 영역 | 평가 | 비고 |
|----------|------|------|
| 문서 완전성 | PASS | 필수 섹션 모두 포함 |
| 요구사항 추적성 | PASS | PRD C-001, C-002, C-010, C-011, C-012 매핑 완료 |
| 아키텍처 | WARN | 1건 개선 권장 |
| 보안 | PASS | XSS 방어 고려됨 |
| 성능 | WARN | 1건 개선 권장 |
| 테스트 가능성 | INFO | data-testid 추가 권장 |

---

## 이슈 목록

### ISSUE-001: 카테고리 스크롤 위치 지정 방식 미명시

| 항목 | 내용 |
|------|------|
| 심각도 | Medium |
| 우선순위 | P3 |
| 검증 영역 | 아키텍처 |
| 위치 | 010-design.md 섹션 8.1 |

**현재 상태:**
- 카테고리 탭 클릭 시 "해당 섹션으로 스크롤"로 명시되어 있으나, 구현 방식이 불명확함
- 스크롤 대상을 어떻게 식별할지 정의되지 않음

**문제점:**
- 구현 시 카테고리별 섹션 ID 또는 ref 연결 방식이 필요함
- 스크롤 오프셋(sticky 헤더 높이 보정) 고려 필요

**권장 개선:**
```typescript
// 카테고리별 섹션 참조
const categoryRefs = useRef<Record<number, HTMLDivElement | null>>({});

// 스크롤 함수
const scrollToCategory = (categoryId: number) => {
  const element = categoryRefs.current[categoryId];
  if (element) {
    const headerOffset = 140; // MenuHeader(72px) + CategoryTabs(~68px)
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.scrollY - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
};
```

---

### ISSUE-002: 이미지 로딩 최적화 누락

| 항목 | 내용 |
|------|------|
| 심각도 | Low |
| 우선순위 | P4 |
| 검증 영역 | 성능 |
| 위치 | 010-design.md 섹션 6.2 MenuCard |

**현재 상태:**
- MenuCard에서 `<img>` 태그 직접 사용
- 이미지 로딩 최적화 미적용

**문제점:**
- 메뉴가 많을 경우 초기 로딩 성능 저하 가능
- Next.js Image 컴포넌트 미활용

**권장 개선:**
```tsx
// Next.js Image 컴포넌트 사용
import Image from 'next/image';

// MenuCard 내부
{menu.imageUrl ? (
  <Image
    src={menu.imageUrl}
    alt={menu.name}
    fill
    className="object-cover"
    sizes="(max-width: 768px) 50vw, 25vw"
  />
) : (
  // placeholder
)}
```

**대안:**
- MVP 단순화를 위해 `<img>` 유지 가능 (loading="lazy" 추가)
```tsx
<img src={menu.imageUrl} alt={menu.name} loading="lazy" className="w-full h-full object-cover" />
```

---

### ISSUE-003: 테스트 용이성을 위한 data-testid 추가 권장

| 항목 | 내용 |
|------|------|
| 심각도 | Info |
| 우선순위 | P5 |
| 검증 영역 | 테스트 가능성 |
| 위치 | 010-design.md 섹션 6 전체 |

**현재 상태:**
- 컴포넌트 정의에 data-testid 속성 없음

**권장 개선:**
향후 E2E 테스트를 위해 주요 요소에 data-testid 추가:

```tsx
// MenuHeader
<header data-testid="menu-header">
  <h1 data-testid="table-number">{tableNumber}</h1>
</header>

// CategoryTabs
<button data-testid={`category-tab-${category.id}`}>

// MenuCard
<div data-testid={`menu-card-${menu.id}`}>
```

---

### ISSUE-004: 에러 상태 재시도 로직 개선

| 항목 | 내용 |
|------|------|
| 심각도 | Low |
| 우선순위 | P4 |
| 검증 영역 | 사용자 경험 |
| 위치 | 010-design.md 섹션 9.2 |

**현재 상태:**
- 에러 발생 시 `window.location.reload()` 사용

**문제점:**
- 전체 페이지 새로고침으로 사용자 경험 저하
- 테이블 번호 파라미터가 URL에 있어 유지되긴 하나, 불필요한 리소스 재로딩

**권장 개선:**
```typescript
// 재시도 함수
const handleRetry = () => {
  setError(null);
  setIsLoading(true);
  fetchData();
};

// 에러 UI
<button onClick={handleRetry}>다시 시도</button>
```

---

## 이슈 분포

| 우선순위 | 개수 | 상세 |
|----------|------|------|
| P1 (Critical) | 0 | - |
| P2 (High) | 0 | - |
| P3 (Medium) | 1 | ISSUE-001 |
| P4 (Low) | 2 | ISSUE-002, ISSUE-004 |
| P5 (Info) | 1 | ISSUE-003 |
| **합계** | **4** | |

---

## 긍정적 평가

### 1. PRD 요구사항 완전 매핑
- C-001 (QR 스캔 접속), C-002 (테이블 번호 표시), C-010~C-012 (메뉴 관련) 모두 설계에 반영됨
- 섹션 11에서 명시적 체크리스트로 추적 가능

### 2. TRD 디자인 시스템 준수
- 글래스모피즘 스타일 정확하게 적용
- `backdrop-blur-[16px] bg-white/25 border-white/30` 패턴 일관 적용
- 그라데이션 배경 색상 TRD와 일치

### 3. 컴포넌트 분리 적절
- MenuHeader, CategoryTabs, MenuCard 단일 책임 원칙 준수
- Props 인터페이스 명확하게 정의

### 4. 에러 처리 고려
- 테이블 파라미터 누락, API 오류, 메뉴 없음 등 예외 케이스 정의
- 사용자 친화적 에러 메시지 설계

### 5. 반응형 설계
- 모바일/태블릿/데스크톱 레이아웃 변화 명시
- 2열 → 3열 → 4열 그리드 적절한 breakpoint

---

## 리뷰 결론

| 항목 | 결과 |
|------|------|
| 전체 평가 | **PASS** |
| 구현 진행 가능 여부 | 가능 |
| 필수 수정 사항 | 없음 |
| 권장 수정 사항 | ISSUE-001 (카테고리 스크롤 구현 방식 명시) |

### 다음 단계 권장사항

1. **구현 진행**: 현재 설계로 구현 진행 가능
2. **ISSUE-001 반영**: 구현 시 카테고리 스크롤 로직 명확히 구현
3. **ISSUE-002 선택적 적용**: MVP 특성상 `loading="lazy"` 정도만 추가 권장
4. **ISSUE-003, 004**: 다음 iteration에서 개선

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2026-01-02 | claude-1 | 최초 작성 |
