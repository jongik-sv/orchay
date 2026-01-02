# TSK-02-02 설계 리뷰 결과

## 리뷰 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-02 |
| 리뷰어 | claude-1 |
| 리뷰 일자 | 2026-01-02 |
| 설계 문서 | 010-design.md |

---

## 검증 결과 요약

| 검증 영역 | 평가 | 비고 |
|----------|------|------|
| 문서 완전성 | ✅ PASS | 필수 섹션 모두 포함 |
| 요구사항 추적성 | ✅ PASS | WBS/TRD 요구사항 매핑 완료 |
| 아키텍처 | ⚠️ WARN | 컴포넌트 분리 관련 1건 |
| 보안 | ✅ PASS | MVP 단계, 외부 입력 없음 |
| 테스트 가능성 | ⚠️ WARN | data-testid 미정의 |
| 접근성 | ⚠️ WARN | ARIA 속성 미정의 |

---

## 발견된 이슈

### 이슈 #1: TRD와 컴포넌트 분리 불일치

| 항목 | 내용 |
|------|------|
| 심각도 | Medium |
| 우선순위 | P3 |
| 영역 | 아키텍처 |
| 위치 | 010-design.md 섹션 5.3, 11 |

**설명:**
TRD 4. 프로젝트 구조에서 `SidebarItem.tsx`를 별도 파일로 정의하고 있으나, 설계 문서에서는 Sidebar.tsx 내부에 모든 하위 컴포넌트를 정의하는 것으로 명시함.

**TRD 명세:**
```
src/components/layout/
├── Sidebar.tsx
├── SidebarItem.tsx  ← 별도 파일
└── ...
```

**설계 문서:**
```
Sidebar.tsx
├── WorkspaceHeader (내부 정의)
├── SidebarItem (내부 정의)  ← 불일치
└── ...
```

**권장 조치:**
- MVP에서는 현재 설계대로 단일 파일 유지 가능
- 향후 확장 시 TRD 구조로 분리 검토
- 또는 설계 문서에 "향후 분리 예정" 주석 추가

---

### 이슈 #2: 콜백 핸들러 Props 미정의

| 항목 | 내용 |
|------|------|
| 심각도 | Low |
| 우선순위 | P4 |
| 영역 | 데이터 흐름 |
| 위치 | 010-design.md 섹션 5.3 |

**설명:**
퀵 액션(검색, 설정)과 새 페이지 버튼의 클릭 이벤트 처리를 위한 props 인터페이스가 정의되지 않음. MVP에서 콘솔 로그만 언급되어 있으나, 향후 기능 연동을 위한 확장 포인트 필요.

**권장 조치:**
```typescript
interface SidebarProps {
  onSearch?: () => void;
  onSettings?: () => void;
  onNewPage?: () => void;
}
```

---

### 이슈 #3: data-testid 미정의

| 항목 | 내용 |
|------|------|
| 심각도 | Low |
| 우선순위 | P3 |
| 영역 | 테스트 가능성 |
| 위치 | 010-design.md 섹션 5 |

**설명:**
컴포넌트에 테스트 식별자(data-testid)가 정의되지 않아 E2E 테스트 또는 컴포넌트 테스트 작성 시 어려움 예상.

**권장 조치:**
주요 요소에 data-testid 추가:
- `data-testid="sidebar"`
- `data-testid="workspace-header"`
- `data-testid="search-button"`
- `data-testid="settings-button"`
- `data-testid="new-page-button"`
- `data-testid="page-tree-area"`

---

### 이슈 #4: 접근성(ARIA) 속성 미정의

| 항목 | 내용 |
|------|------|
| 심각도 | Low |
| 우선순위 | P4 |
| 영역 | 접근성 |
| 위치 | 010-design.md 섹션 5.4 |

**설명:**
버튼, 네비게이션 요소에 ARIA 속성이 정의되지 않아 스크린 리더 사용자의 접근성이 제한될 수 있음.

**권장 조치:**
- `<nav aria-label="Sidebar navigation">`
- 버튼에 `aria-label` 추가
- 페이지 트리 영역에 `role="tree"` 고려 (TSK-02-03에서)

---

## 이슈 분포

| 우선순위 | 건수 |
|----------|------|
| P1 (Critical) | 0 |
| P2 (High) | 0 |
| P3 (Medium) | 2 |
| P4 (Low) | 2 |
| P5 (Info) | 0 |
| **총계** | **4** |

---

## 권장 사항

1. **즉시 반영 권장 (P3)**
   - 이슈 #3: data-testid 추가 - 구현 시 테스트 용이성 확보

2. **구현 시 고려 (P4)**
   - 이슈 #1: TRD와의 불일치는 MVP 특성상 허용 가능
   - 이슈 #2: 콜백 props는 실제 기능 연동 시 추가
   - 이슈 #4: 접근성은 MVP 이후 개선 가능

---

## 결론

TSK-02-02 설계 문서는 전반적으로 잘 작성되었으며, MVP 구현에 충분한 수준입니다.

- **Critical/High 이슈 없음**: 즉시 구현 진행 가능
- **Minor 개선 사항**: data-testid 추가 권장
- **향후 고려 사항**: 컴포넌트 분리, 접근성 개선

**다음 단계:** `/wf:apply` (선택적) 또는 `/wf:build`

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2026-01-02 | Claude | 최초 작성 |
