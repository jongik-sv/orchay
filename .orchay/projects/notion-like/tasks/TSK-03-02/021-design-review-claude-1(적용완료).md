# TSK-03-02 설계 리뷰 결과

## 리뷰 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-03-02 |
| 리뷰어 | claude-1 |
| 리뷰 일자 | 2026-01-03 |
| 대상 문서 | 010-design.md |

---

## 1. 문서 검증 결과

| 문서 | 상태 | 비고 |
|------|------|------|
| 010-design.md | ✅ 존재 | 통합 설계 문서 |
| 025-traceability-matrix.md | ⚠️ 미존재 | simple-dev 카테고리로 선택적 |
| 026-test-specification.md | ⚠️ 미존재 | simple-dev 카테고리로 선택적 |

---

## 2. 검증 영역별 평가

| 검증 영역 | 평가 | 비고 |
|----------|------|------|
| 문서 완전성 | PASS | 필수 섹션 모두 포함 |
| 요구사항 추적성 | PASS | WBS 요구사항 명확히 참조 |
| 아키텍처 | WARN | 1건 개선 권장 (CSS 변수 일관성) |
| 보안 | PASS | 보안 관련 사항 없음 (CSS only) |
| 테스트 가능성 | PASS | 시각적 테스트 가능 |

---

## 3. 현황 분석

### 3.1 CSS 변수 정의 상태

**globals.css:**
- ✅ 다크모드 CSS 변수가 `@media (prefers-color-scheme: dark)` 내에 올바르게 정의됨
- ✅ 라이트/다크 팔레트 완비: bg-primary, bg-secondary, bg-tertiary, text-primary, text-secondary, text-tertiary, border-light, border-medium

**문제점:**
- ❌ 대부분의 컴포넌트가 하드코딩된 색상값 사용

### 3.2 컴포넌트별 하드코딩 현황

| 컴포넌트 | 하드코딩 색상 | 수정 필요 |
|----------|-------------|----------|
| layout.tsx | `bg-white text-gray-900` | CSS 변수 또는 dark: 클래스 |
| MainLayout.tsx | `bg-[#F7F6F3]`, `bg-[#EFEFEF]`, `text-[#787774]` | CSS 변수로 교체 |
| Sidebar.tsx | `bg-[#F7F6F3]`, `text-[#37352F]`, `bg-[#EFEFEF]`, `border-[#E9E9E7]`, `text-[#787774]`, `text-[#B4B4B3]` | CSS 변수로 교체 |
| PageHeader.tsx | `bg-white`, `bg-gray-200`, `bg-gray-300`, `hover:bg-gray-400`, `border-gray-200`, `hover:border-gray-300`, `focus:border-gray-400` | CSS 변수로 교체 |

### 3.3 Tailwind 설정 현황

```typescript
// 현재 tailwind.config.ts - darkMode 설정 없음
const config: Config = {
  content: [...],
  theme: { extend: { colors: { notion: {...} } } },
  plugins: [],
};
```

---

## 4. 리뷰 이슈 목록

### Issue #1: Tailwind darkMode 설정 누락

| 항목 | 내용 |
|------|------|
| Severity | High |
| Priority | P1 |
| 영역 | 설정 |
| 파일 | `tailwind.config.ts` |

**현재 상태:**
- darkMode 설정이 없어 dark: 클래스 사용 불가

**권장 수정:**
```typescript
export default {
  darkMode: 'media', // 시스템 설정 자동 감지
  // ...
}
```

---

### Issue #2: layout.tsx 하드코딩된 배경/텍스트 색상

| 항목 | 내용 |
|------|------|
| Severity | High |
| Priority | P1 |
| 영역 | 아키텍처 |
| 파일 | `src/app/layout.tsx` |

**현재 상태:**
```tsx
<body className="bg-white text-gray-900">
```

**권장 수정:**
```tsx
<body className="bg-[var(--notion-bg-primary)] text-[var(--notion-text-primary)]">
// 또는 Tailwind dark: variant 사용
<body className="bg-white dark:bg-[#191919] text-gray-900 dark:text-[#E6E6E4]">
```

---

### Issue #3: MainLayout.tsx 색상 하드코딩

| 항목 | 내용 |
|------|------|
| Severity | Medium |
| Priority | P2 |
| 영역 | 아키텍처 |
| 파일 | `src/components/layout/MainLayout.tsx` |

**현재 상태:**
```tsx
<aside className="... bg-[#F7F6F3] ... border-r border-[#E9E9E7] ...">
<button className="... hover:bg-[#EFEFEF] ...">
  <Menu className="... text-[#787774]" />
```

**권장 수정:**
- `bg-[#F7F6F3]` → `bg-[var(--notion-bg-secondary)]`
- `border-[#E9E9E7]` → `border-[var(--notion-border-light)]`
- `hover:bg-[#EFEFEF]` → `hover:bg-[var(--notion-bg-tertiary)]`
- `text-[#787774]` → `text-[var(--notion-text-tertiary)]`

---

### Issue #4: Sidebar.tsx 대량 하드코딩

| 항목 | 내용 |
|------|------|
| Severity | High |
| Priority | P1 |
| 영역 | 아키텍처 |
| 파일 | `src/components/layout/Sidebar.tsx` |

**하드코딩 목록 (12개):**
| 현재값 | CSS 변수 |
|--------|----------|
| `bg-[#F7F6F3]` | `--notion-bg-secondary` |
| `text-[#37352F]` | `--notion-text-primary` |
| `bg-[#EFEFEF]` (hover) | `--notion-bg-tertiary` |
| `border-[#E9E9E7]` | `--notion-border-light` |
| `text-[#787774]` | `--notion-text-tertiary` |
| `text-[#B4B4B3]` | 새 변수 필요 또는 `--notion-text-tertiary` 사용 |

**권장:** 모든 하드코딩 색상을 CSS 변수로 교체

---

### Issue #5: PageHeader.tsx 색상 하드코딩

| 항목 | 내용 |
|------|------|
| Severity | Medium |
| Priority | P2 |
| 영역 | 아키텍처 |
| 파일 | `src/components/editor/PageHeader.tsx` |

**하드코딩 목록:**
| 현재값 | CSS 변수 |
|--------|----------|
| `bg-white` | `--notion-bg-primary` |
| `border-gray-200` | `--notion-border-light` |
| `bg-gray-200` (cover fallback) | `--notion-bg-tertiary` |
| `bg-gray-300` (button) | 추가 정의 필요 |
| `hover:bg-gray-400` (button) | 추가 정의 필요 |

---

### Issue #6: BlockNote 다크모드 CSS 미완성

| 항목 | 내용 |
|------|------|
| Severity | Medium |
| Priority | P2 |
| 영역 | 스타일 |
| 파일 | `src/app/globals.css` |

**현재 상태:**
- `.bn-popover`, `.bn-menu-item:hover`, `.bn-code-block`에 하드코딩된 라이트 모드 색상만 존재
- `@media (prefers-color-scheme: dark)` 내에 BlockNote 오버라이드 없음

**권장 추가:**
```css
@media (prefers-color-scheme: dark) {
  .bn-popover {
    background-color: var(--notion-bg-secondary);
    border-color: var(--notion-border-light);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .bn-menu-item:hover {
    background-color: var(--notion-bg-tertiary);
  }

  .bn-code-block {
    background-color: var(--notion-bg-secondary);
  }
}
```

---

### Issue #7: 색상 전환 트랜지션 미적용 (설계 문서 반영 필요)

| 항목 | 내용 |
|------|------|
| Severity | Low |
| Priority | P3 |
| 영역 | 인터랙션 |
| 파일 | `src/app/globals.css` |

**설계 문서 명세 (6.1절):**
- `transition-property: background-color, color, border-color`
- `transition-duration: 150ms`
- `transition-timing-function: ease`

**권장 추가:**
```css
* {
  transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
}
```

---

### Issue #8: 버튼 색상 CSS 변수 부재

| 항목 | 내용 |
|------|------|
| Severity | Low |
| Priority | P4 |
| 영역 | 설계 |
| 파일 | 설계 문서 / globals.css |

**문제:**
- PageHeader의 "Change" 버튼(`bg-gray-300`, `hover:bg-gray-400`)에 대응하는 CSS 변수가 설계 문서에 없음

**권장:**
- 버튼용 CSS 변수 추가 정의:
```css
:root {
  --notion-button-bg: #d1d5db;        /* gray-300 */
  --notion-button-hover: #9ca3af;     /* gray-400 */
}
@media (prefers-color-scheme: dark) {
  :root {
    --notion-button-bg: #4d4d4a;
    --notion-button-hover: #5d5d5a;
  }
}
```

---

## 5. 이슈 분포 요약

| 심각도 | 개수 | 설명 |
|--------|------|------|
| Critical | 0 | - |
| High | 3 | #1, #2, #4 |
| Medium | 3 | #3, #5, #6 |
| Low | 2 | #7, #8 |
| Info | 0 | - |

| 우선순위 | 개수 | 설명 |
|----------|------|------|
| P1 | 3 | 구현 전 필수 수정 |
| P2 | 3 | 구현 초기 수정 |
| P3 | 1 | 구현 중 수정 |
| P4 | 1 | 구현 후 검토 |

---

## 6. 종합 평가

### 6.1 강점

1. **CSS 변수 기반 구조**: globals.css에 다크모드 CSS 변수가 올바르게 정의되어 있어 확장 용이
2. **명확한 색상 팔레트**: 라이트/다크 팔레트가 체계적으로 정의됨
3. **설계 문서 완성도**: 구현 순서, 컴포넌트별 매핑, 인터랙션 설계가 명확함

### 6.2 개선 필요 사항

1. **하드코딩 색상 제거**: 컴포넌트별로 하드코딩된 색상을 CSS 변수로 통일해야 함
2. **Tailwind 설정**: `darkMode: 'media'` 설정 필수
3. **BlockNote 스타일**: 다크모드 전용 스타일 추가 필요

### 6.3 권장 구현 순서 (설계 문서 10.2절과 동일)

1. Tailwind 설정 (`darkMode: 'media'`)
2. globals.css BlockNote 다크모드 스타일 추가
3. layout.tsx 수정
4. MainLayout.tsx 수정
5. Sidebar.tsx 수정
6. PageHeader.tsx 수정
7. 기타 UI 컴포넌트 확인 및 수정

---

## 7. 결론

| 항목 | 결과 |
|------|------|
| 설계 문서 품질 | **양호** - 필수 섹션 완비, 구현 가이드 명확 |
| 구현 준비 상태 | **조건부 승인** - P1 이슈 인지 후 구현 진행 가능 |
| 권장 사항 | 구현 시 P1/P2 이슈를 우선 해결하며 진행 |

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2026-01-03 | claude-1 | 최초 리뷰 |

---

## 8. 적용 결과

### 8.1 적용 일자
- **적용일**: 2026-01-03
- **적용자**: Claude

### 8.2 이슈별 처리 결과

| Issue | 우선순위 | 내용 | 처리 | 근거 |
|-------|----------|------|------|------|
| #1 | P1 | Tailwind darkMode 설정 누락 | ✅ 적용 | 설계 문서 10.3절에 이미 명시됨 |
| #2 | P1 | layout.tsx 하드코딩 색상 | ✅ 적용 | 10.1.1절에 상세 매핑 가이드 추가 |
| #3 | P2 | MainLayout.tsx 색상 하드코딩 | ✅ 적용 | 10.1.1절에 상세 매핑 가이드 추가 |
| #4 | P1 | Sidebar.tsx 대량 하드코딩 | ✅ 적용 | 10.1.1절에 상세 매핑 가이드 추가 |
| #5 | P2 | PageHeader.tsx 색상 하드코딩 | ✅ 적용 | 10.1.1절에 상세 매핑 가이드 추가 |
| #6 | P2 | BlockNote 다크모드 CSS 미완성 | ✅ 적용 | 10.5절에 확장 스타일 추가 |
| #7 | P3 | 색상 전환 트랜지션 미적용 | ✅ 적용 | 10.6절 신규 추가 |
| #8 | P4 | 버튼 색상 CSS 변수 부재 | 📝 조정 적용 | 10.7절 신규 추가 |

### 8.3 처리 요약

| 항목 | 결과 |
|------|------|
| 총 이슈 | 8건 |
| ✅ 적용 | 7건 |
| 📝 조정 적용 | 1건 |
| ⏸️ 보류 | 0건 |
| P1 처리율 | 100% (3/3) |
| P2 처리율 | 100% (3/3) |

### 8.4 수정된 문서

- `010-design.md` (v1.0 → v1.1)
  - 10.1.1절: 컴포넌트별 상세 수정 가이드 추가
  - 10.5절: BlockNote 다크모드 CSS 확장
  - 10.6절: 색상 전환 트랜지션 구현 가이드 신규
  - 10.7절: 버튼 색상 CSS 변수 추가 신규
