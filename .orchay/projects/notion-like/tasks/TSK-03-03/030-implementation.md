# TSK-03-03 구현 보고서

## 구현 개요

| 항목 | 값 |
|------|-----|
| Task ID | TSK-03-03 |
| Task 제목 | 에러 처리 및 로딩 상태 |
| Category | development |
| Domain | frontend |
| 구현 일시 | 2026-01-03 |
| 상태 | 완료 |

## 요구사항

| 요구사항 | 구현 상태 |
|---------|----------|
| API 에러 시 토스트 알림 | 완료 |
| 페이지 로딩 스켈레톤 | 완료 |
| 에디터 저장 중 표시 | 완료 |

## 수용 기준 충족 여부

| 수용 기준 | 충족 |
|----------|-----|
| 네트워크 에러 시 사용자 알림 | Yes |
| 로딩 중 스켈레톤 표시 | Yes |

## 구현 내용

### 1. Toast 알림 시스템

#### 1.1 Zustand Store 확장 (`src/lib/store.ts`)

```typescript
// Toast 타입 정의
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

// Store에 Toast 상태 추가
toasts: Toast[];
addToast: (type: ToastType, message: string) => void;
removeToast: (id: string) => void;
```

#### 1.2 Toast 컴포넌트 (`src/components/ui/Toast.tsx`)

- **ToastItem**: 개별 토스트 아이템 렌더링
- **ToastContainer**: 전역 토스트 컨테이너 (우하단 고정)
- 타입별 스타일: success(녹색), error(빨강), warning(주황), info(파랑)
- 자동 닫힘: 3초 후 자동 제거
- 수동 닫힘: X 버튼 클릭

#### 1.3 layout.tsx 수정

```tsx
import { ToastContainer } from "@/components/ui/Toast";

<body>
  {children}
  <ToastContainer />
</body>
```

### 2. 페이지 로딩 스켈레톤

#### 2.1 PageSkeleton 컴포넌트 (`src/components/ui/PageSkeleton.tsx`)

```tsx
export function PageSkeleton() {
  return (
    <div data-testid="page-skeleton">
      <div className="w-full h-[200px] skeleton" />      {/* 커버 */}
      <div className="w-[78px] h-[78px] skeleton" />     {/* 아이콘 */}
      <div className="h-[40px] w-[60%] skeleton" />      {/* 제목 */}
      <div className="space-y-3">                         {/* 본문 */}
        <div className="h-[20px] w-[90%] skeleton" />
        <div className="h-[20px] w-[75%] skeleton" />
        <div className="h-[20px] w-[85%] skeleton" />
        <div className="h-[20px] w-[60%] skeleton" />
      </div>
    </div>
  );
}
```

#### 2.2 CSS 애니메이션 (`src/app/globals.css`)

```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

.skeleton {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  background-color: var(--notion-bg-tertiary);
}
```

### 3. 에디터 저장 중 표시

#### 3.1 [pageId]/page.tsx 수정

- 로딩 시 PageSkeleton 사용
- API 에러 시 `addToast` 호출
- 저장 상태 UI 개선:
  - saving: `<Loader2>` 스피너 + "저장 중..."
  - saved: `<Check>` 체크 + "저장됨"
  - error: `<AlertCircle>` 경고 + 에러 메시지

```tsx
<div data-testid="save-status" data-save-state={saveState.status}>
  {saveState.status === "saving" && (
    <>
      <Loader2 className="animate-spin" />
      <span>저장 중...</span>
    </>
  )}
  {/* ... */}
</div>
```

## 파일 변경 목록

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/lib/store.ts` | 수정 | Toast 상태 및 액션 추가 |
| `src/components/ui/Toast.tsx` | 신규 | Toast 컴포넌트 생성 |
| `src/components/ui/PageSkeleton.tsx` | 신규 | 스켈레톤 컴포넌트 생성 |
| `src/app/globals.css` | 수정 | 스켈레톤/슬라이드 애니메이션 추가 |
| `src/app/layout.tsx` | 수정 | ToastContainer 추가 |
| `src/app/[pageId]/page.tsx` | 수정 | 스켈레톤, 토스트, 저장 상태 UI 적용 |
| `tests/e2e/error-loading-state.spec.ts` | 신규 | E2E 테스트 추가 |

## 테스트 ID 목록

| 컴포넌트 | data-testid | 용도 |
|---------|-------------|------|
| Toast | `toast` | 개별 토스트 알림 |
| Toast | `toast-close-btn` | 토스트 닫기 버튼 |
| Toast | `toast-container` | 토스트 컨테이너 |
| PageSkeleton | `page-skeleton` | 페이지 스켈레톤 |
| SaveStatus | `save-status` | 저장 상태 표시 |

## 테스트 결과

| 테스트 유형 | 총 테스트 | 통과 | 실패 | 통과율 |
|------------|----------|------|------|--------|
| E2E (Chromium) | 13 | 13 | 0 | 100% |

## 다크모드 지원

모든 컴포넌트에서 CSS 변수 사용으로 다크모드 자동 지원:
- `--notion-bg-primary`, `--notion-bg-secondary`, `--notion-bg-tertiary`
- `--notion-text-primary`, `--notion-text-secondary`, `--notion-text-tertiary`

## 참조 문서

- [070-e2e-test-results.md](./070-e2e-test-results.md) - E2E 테스트 결과서
- `test-results/20260103-225531/e2e/` - Playwright HTML 리포트
