# 테스트 명세서 (026-test-specification.md)

**Template Version:** 1.0.0 — **Last Updated:** 2026-01-02

> **목적**: 단위 테스트, E2E 테스트, 매뉴얼 테스트 시나리오 및 테스트 데이터 정의
>
> **참조**: 이 문서는 `010-design.md`와 `025-traceability-matrix.md`와 함께 사용됩니다.
>
> **활용 단계**: `/wf:build`, `/wf:test` 단계에서 테스트 코드 생성 기준으로 사용

---

## 0. 문서 메타데이터

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-01 |
| Task명 | 메인 레이아웃 (사이드바 + 에디터 영역) |
| 설계 문서 참조 | `010-design.md` |
| 추적성 매트릭스 참조 | `025-traceability-matrix.md` |
| 작성일 | 2026-01-02 |
| 작성자 | Claude |

---

## 1. 테스트 전략 개요

### 1.1 테스트 범위

| 테스트 유형 | 범위 | 목표 커버리지 |
|------------|------|--------------|
| 단위 테스트 | MainLayout 컴포넌트, Zustand 스토어 연동 | 80% 이상 |
| E2E 테스트 | 레이아웃 표시, 사이드바 토글 | 100% 시나리오 커버 |
| 매뉴얼 테스트 | UI/UX, 반응형 확인 (TSK-03-01 이후) | 전체 화면 |

### 1.2 테스트 환경

| 항목 | 내용 |
|------|------|
| 테스트 프레임워크 (단위) | Vitest + React Testing Library |
| 테스트 프레임워크 (E2E) | Playwright |
| 브라우저 | Chromium (기본) |
| 베이스 URL | `http://localhost:3000` |

---

## 2. 단위 테스트 시나리오

### 2.1 테스트 케이스 목록

| 테스트 ID | 대상 | 시나리오 | 예상 결과 | 요구사항 |
|-----------|------|----------|----------|----------|
| UT-001 | MainLayout | 기본 렌더링 | 2컬럼 레이아웃 표시 | FR-001 |
| UT-002 | MainLayout | 사이드바 토글 | 상태 변경에 따라 사이드바 표시/숨김 | FR-002 |
| UT-003 | MainLayout | 사이드바 너비 | 240px 너비 확인 | FR-003 |

### 2.2 테스트 케이스 상세

#### UT-001: MainLayout 기본 렌더링

| 항목 | 내용 |
|------|------|
| **파일** | `src/components/layout/__tests__/MainLayout.test.tsx` |
| **테스트 블록** | `describe('MainLayout') → it('should render sidebar and editor area')` |
| **Mock 의존성** | Zustand store (sidebarOpen: true) |
| **입력 데이터** | `<MainLayout><div>Editor Content</div></MainLayout>` |
| **검증 포인트** | 사이드바 영역과 에디터 영역이 모두 렌더링됨 |
| **커버리지 대상** | MainLayout 기본 렌더링 분기 |
| **관련 요구사항** | FR-001, BR-003 |

```typescript
// 테스트 코드 예시
import { render, screen } from '@testing-library/react';
import { MainLayout } from '../MainLayout';

describe('MainLayout', () => {
  it('should render sidebar and editor area', () => {
    render(
      <MainLayout sidebar={<div>Sidebar</div>}>
        <div>Editor Content</div>
      </MainLayout>
    );

    expect(screen.getByText('Sidebar')).toBeInTheDocument();
    expect(screen.getByText('Editor Content')).toBeInTheDocument();
  });
});
```

#### UT-002: 사이드바 토글 동작

| 항목 | 내용 |
|------|------|
| **파일** | `src/components/layout/__tests__/MainLayout.test.tsx` |
| **테스트 블록** | `describe('MainLayout') → it('should toggle sidebar visibility')` |
| **Mock 의존성** | Zustand store |
| **입력 데이터** | 토글 버튼 클릭 이벤트 |
| **검증 포인트** | 사이드바 표시/숨김 상태 변경 |
| **커버리지 대상** | toggleSidebar 함수 호출 분기 |
| **관련 요구사항** | FR-002, BR-002 |

```typescript
// 테스트 코드 예시
import { render, screen, fireEvent } from '@testing-library/react';
import { MainLayout } from '../MainLayout';
import { useAppStore } from '@/lib/store';

describe('MainLayout', () => {
  it('should toggle sidebar visibility', () => {
    // 초기 상태: 사이드바 열림
    const { rerender } = render(
      <MainLayout sidebar={<div data-testid="sidebar">Sidebar</div>}>
        <div>Content</div>
      </MainLayout>
    );

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();

    // 스토어 상태 변경 시뮬레이션
    useAppStore.setState({ sidebarOpen: false });
    rerender(
      <MainLayout sidebar={<div data-testid="sidebar">Sidebar</div>}>
        <div>Content</div>
      </MainLayout>
    );

    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.getByLabelText('사이드바 열기')).toBeInTheDocument();
  });
});
```

#### UT-003: 사이드바 너비 240px 확인

| 항목 | 내용 |
|------|------|
| **파일** | `src/components/layout/__tests__/MainLayout.test.tsx` |
| **테스트 블록** | `describe('MainLayout') → it('should have sidebar width of 240px')` |
| **Mock 의존성** | Zustand store (sidebarOpen: true) |
| **입력 데이터** | 기본 렌더링 |
| **검증 포인트** | aside 요소의 width 클래스 확인 |
| **커버리지 대상** | CSS 클래스 적용 |
| **관련 요구사항** | FR-003, BR-001 |

```typescript
// 테스트 코드 예시
describe('MainLayout', () => {
  it('should have sidebar width of 240px', () => {
    render(
      <MainLayout sidebar={<div>Sidebar</div>}>
        <div>Content</div>
      </MainLayout>
    );

    const aside = screen.getByRole('complementary');
    expect(aside).toHaveClass('w-[240px]');
  });
});
```

---

## 3. E2E 테스트 시나리오

### 3.1 테스트 케이스 목록

| 테스트 ID | 시나리오 | 사전조건 | 실행 단계 | 예상 결과 | 요구사항 |
|-----------|----------|----------|----------|----------|----------|
| E2E-001 | 레이아웃 표시 | 앱 접속 | 1. 페이지 로드 | 2컬럼 레이아웃 표시 | FR-001, FR-003 |
| E2E-002 | 사이드바 토글 | 앱 접속 | 1. 토글 클릭 2. 다시 토글 | 사이드바 숨김/표시 | FR-002 |

### 3.2 테스트 케이스 상세

#### E2E-001: 레이아웃 표시

| 항목 | 내용 |
|------|------|
| **파일** | `tests/e2e/layout.spec.ts` |
| **테스트명** | `test('메인 레이아웃이 2컬럼으로 표시된다')` |
| **사전조건** | - |
| **data-testid 셀렉터** | |
| - 레이아웃 컨테이너 | `[data-testid="main-layout"]` |
| - 사이드바 영역 | `[data-testid="sidebar"]` |
| - 에디터 영역 | `[data-testid="editor-area"]` |
| **실행 단계** | |
| 1 | `await page.goto('/')` |
| 2 | `await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()` |
| 3 | `await expect(page.locator('[data-testid="editor-area"]')).toBeVisible()` |
| **검증 포인트** | 사이드바와 에디터 영역이 모두 표시됨 |
| **스크린샷** | `e2e-001-layout.png` |
| **관련 요구사항** | FR-001, FR-003, BR-001, BR-003 |

```typescript
// E2E 테스트 코드 예시
import { test, expect } from '@playwright/test';

test.describe('MainLayout', () => {
  test('메인 레이아웃이 2컬럼으로 표시된다', async ({ page }) => {
    await page.goto('/');

    const sidebar = page.locator('[data-testid="sidebar"]');
    const editorArea = page.locator('[data-testid="editor-area"]');

    await expect(sidebar).toBeVisible();
    await expect(editorArea).toBeVisible();

    // 사이드바 너비 확인
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox?.width).toBe(240);

    await page.screenshot({ path: 'e2e-001-layout.png' });
  });
});
```

#### E2E-002: 사이드바 토글

| 항목 | 내용 |
|------|------|
| **파일** | `tests/e2e/layout.spec.ts` |
| **테스트명** | `test('사이드바를 토글할 수 있다')` |
| **사전조건** | 페이지 로드 완료 |
| **data-testid 셀렉터** | |
| - 토글 버튼 (사이드바 내) | `[data-testid="sidebar-toggle"]` |
| - 토글 버튼 (접힘 시) | `[data-testid="sidebar-open-btn"]` |
| **실행 단계** | |
| 1 | `await page.goto('/')` |
| 2 | `await page.click('[data-testid="sidebar-toggle"]')` |
| 3 | `await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()` |
| 4 | `await page.click('[data-testid="sidebar-open-btn"]')` |
| 5 | `await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()` |
| **검증 포인트** | 토글 클릭 시 사이드바 상태 변경 |
| **스크린샷** | `e2e-002-toggle-closed.png`, `e2e-002-toggle-open.png` |
| **관련 요구사항** | FR-002, BR-002 |

```typescript
// E2E 테스트 코드 예시
test('사이드바를 토글할 수 있다', async ({ page }) => {
  await page.goto('/');

  const sidebar = page.locator('[data-testid="sidebar"]');

  // 초기 상태: 사이드바 표시
  await expect(sidebar).toBeVisible();

  // 토글 클릭 (사이드바 내 버튼)
  await page.click('[data-testid="sidebar-toggle"]');
  await expect(sidebar).not.toBeVisible();
  await page.screenshot({ path: 'e2e-002-toggle-closed.png' });

  // 다시 열기 버튼 클릭
  await page.click('[data-testid="sidebar-open-btn"]');
  await expect(sidebar).toBeVisible();
  await page.screenshot({ path: 'e2e-002-toggle-open.png' });
});
```

---

## 4. UI 테스트케이스 (매뉴얼)

### 4.1 테스트 케이스 목록

| TC-ID | 테스트 항목 | 사전조건 | 테스트 단계 | 예상 결과 | 우선순위 | 요구사항 |
|-------|-----------|---------|-----------|----------|---------|----------|
| TC-001 | 레이아웃 표시 | 앱 접속 | 1. 페이지 확인 | 2컬럼 표시 | High | FR-001 |
| TC-002 | 사이드바 토글 | 레이아웃 표시 | 1. 토글 클릭 | 사이드바 숨김/표시 | High | FR-002 |
| TC-003 | 호버 효과 | 레이아웃 표시 | 1. 토글 버튼 호버 | 배경색 변경 | Low | - |

### 4.2 매뉴얼 테스트 상세

#### TC-001: 레이아웃 표시

**테스트 목적**: 사용자가 앱에 접속했을 때 2컬럼 레이아웃이 올바르게 표시되는지 확인

**테스트 단계**:
1. 브라우저에서 앱 URL 접속
2. 페이지 로드 완료 대기
3. 레이아웃 확인

**예상 결과**:
- 좌측에 사이드바 영역 표시 (240px 너비)
- 우측에 에디터 영역 표시 (나머지 공간)
- 두 영역 사이에 구분선 표시

**검증 기준**:
- [ ] 사이드바 영역이 좌측에 표시됨
- [ ] 에디터 영역이 우측에 표시됨
- [ ] 사이드바 배경색이 #F7F6F3임
- [ ] 구분선이 #E9E9E7 색상으로 표시됨

#### TC-002: 사이드바 토글

**테스트 목적**: 토글 버튼을 통해 사이드바를 접고 펼 수 있는지 확인

**테스트 단계**:
1. 앱 접속 (사이드바 열린 상태)
2. 사이드바 내 토글 버튼 클릭
3. 사이드바 접힘 확인
4. 좌측 상단 토글 버튼 클릭
5. 사이드바 펼침 확인

**예상 결과**:
- 토글 클릭 시 사이드바가 접히고 에디터가 전체 너비 사용
- 다시 토글 클릭 시 사이드바가 펼쳐짐

**검증 기준**:
- [ ] 사이드바 접힘 시 완전히 숨겨짐
- [ ] 접힘 상태에서 토글 버튼(메뉴 아이콘)이 좌측 상단에 표시됨
- [ ] 펼침 시 원래 레이아웃 복원

---

## 5. 테스트 데이터 (Fixture)

### 5.1 단위 테스트용 Mock 데이터

| 데이터 ID | 용도 | 값 |
|-----------|------|-----|
| MOCK-STORE-OPEN | 사이드바 열림 상태 | `{ sidebarOpen: true }` |
| MOCK-STORE-CLOSED | 사이드바 접힘 상태 | `{ sidebarOpen: false }` |
| MOCK-SIDEBAR-CONTENT | 사이드바 테스트 콘텐츠 | `<div data-testid="sidebar-content">Sidebar</div>` |
| MOCK-EDITOR-CONTENT | 에디터 테스트 콘텐츠 | `<div data-testid="editor-content">Editor</div>` |

### 5.2 E2E 테스트용 시드 데이터

| 시드 ID | 용도 | 생성 방법 | 포함 데이터 |
|---------|------|----------|------------|
| SEED-E2E-LAYOUT | 레이아웃 테스트 환경 | 기본 앱 상태 | 빈 에디터 상태 |

---

## 6. data-testid 목록

> 프론트엔드 컴포넌트에 적용할 `data-testid` 속성 정의

### 6.1 MainLayout 컴포넌트

| data-testid | 요소 | 용도 |
|-------------|------|------|
| `main-layout` | 루트 div | 레이아웃 컨테이너 확인 |
| `sidebar` | aside 요소 | 사이드바 존재 확인 |
| `sidebar-toggle` | 사이드바 내 토글 버튼 | 사이드바 접기 (향후 구현) |
| `sidebar-open-btn` | 접힘 시 토글 버튼 | 사이드바 열기 |
| `editor-area` | main 요소 | 에디터 영역 확인 |

---

## 7. 테스트 커버리지 목표

### 7.1 단위 테스트 커버리지

| 대상 | 목표 | 최소 |
|------|------|------|
| Lines | 80% | 70% |
| Branches | 75% | 65% |
| Functions | 85% | 75% |
| Statements | 80% | 70% |

### 7.2 E2E 테스트 커버리지

| 구분 | 목표 |
|------|------|
| 주요 사용자 시나리오 | 100% |
| 기능 요구사항 (FR) | 100% 커버 |
| 비즈니스 규칙 (BR) | 100% 커버 |
| 에러 케이스 | N/A (이 Task에서는 에러 케이스 없음) |

---

## 관련 문서

- 설계 문서: `010-design.md`
- 추적성 매트릭스: `025-traceability-matrix.md`
- PRD: `.orchay/projects/notion-like/prd.md`
- TRD: `.orchay/projects/notion-like/trd.md`

---

<!--
TSK-02-01 테스트 명세서
Version: 1.0
Created: 2026-01-02
-->
