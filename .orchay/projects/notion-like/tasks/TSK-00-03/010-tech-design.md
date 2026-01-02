# TSK-00-03: 프로젝트 구조 및 기본 레이아웃 생성 - 기술 설계

## 개요

Next.js 15 App Router를 기반으로 한 프로젝트 디렉토리 구조 생성 및 Notion 스타일 기본 레이아웃(globals.css) 설정

**TRD 참조**: TRD 4. 프로젝트 구조

---

## 목표

1. Next.js App Router 기반 표준 디렉토리 구조 구축
2. Notion 컬러 시스템 및 기본 스타일 정의
3. 빌드 에러 없는 깨끗한 프로젝트 초기 상태 확보

---

## 현재 상태

- ✅ Next.js 15 프로젝트 생성 완료 (TSK-00-01)
- ✅ 핵심 의존성 설치 완료 (TSK-00-02)
- ⏳ 프로젝트 구조 생성 필요

---

## 목표 상태

```
src/
├── app/
│   ├── layout.tsx (루트 레이아웃)
│   ├── page.tsx (홈 페이지)
│   └── [pageId]/
│       └── page.tsx (동적 페이지)
├── components/
│   ├── layout/
│   │   ├── MainLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── PageTree.tsx
│   ├── editor/
│   │   ├── Editor.tsx
│   │   └── PageHeader.tsx
│   └── ui/
│       ├── IconPicker.tsx
│       ├── Toast.tsx
│       └── SearchModal.tsx
├── lib/
│   ├── db.ts (SQLite 연동)
│   ├── store.ts (Zustand)
│   ├── utils.ts
│   └── api.ts
└── styles/
    └── globals.css (Notion 스타일)
```

---

## 구현 계획

### Phase 1: 디렉토리 구조 생성

**경로 생성:**
```bash
# src 디렉토리 구조
src/
├── app/
│   └── [pageId]/
├── components/
│   ├── layout/
│   ├── editor/
│   └── ui/
├── lib/
└── styles/
```

**파일 생성:**
1. `src/app/layout.tsx` - 루트 레이아웃 (기본 구조)
2. `src/app/page.tsx` - 홈 페이지 (리다이렉트)
3. `src/app/[pageId]/page.tsx` - 동적 페이지 (스켈레톤)
4. `src/lib/db.ts` - DB 유틸리티 (스켈레톤)
5. `src/lib/store.ts` - Zustand 스토어 (스켈레톤)

---

### Phase 2: 기본 레이아웃 (layout.tsx)

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orchay Notes - 올인원 워크스페이스",
  description: "Notion 같은 블록 기반 워크스페이스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
```

**특징:**
- 한국어 메타데이터
- 글로벌 스타일 import
- 기본 배경색 및 텍스트 색상

---

### Phase 3: 홈 페이지 (page.tsx)

```tsx
// src/app/page.tsx
export default function Home() {
  return (
    <main className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          Orchay Notes에 오신 것을 환영합니다
        </h1>
        <p className="text-gray-600 mb-8">
          블록 기반 올인원 워크스페이스
        </p>
        {/* 첫 페이지 자동 로드 또는 페이지 선택 UI */}
      </div>
    </main>
  );
}
```

---

### Phase 4: 동적 페이지 라우트

```tsx
// src/app/[pageId]/page.tsx
import { ReactNode } from "react";

interface PageProps {
  params: {
    pageId: string;
  };
}

export default async function Page({ params }: PageProps) {
  const { pageId } = params;

  // 페이지 데이터 로드 (Phase 1: DB 스켈레톤)
  // const page = await getPageData(pageId);

  return (
    <main className="flex h-screen">
      {/* 사이드바 + 에디터 레이아웃 (나중에 구현) */}
      <div className="text-center flex-1">
        <p>페이지 {pageId} 로드 중...</p>
      </div>
    </main>
  );
}
```

---

### Phase 5: globals.css - Notion 스타일

**Notion 컬러 시스템:**
```css
:root {
  /* Primary Colors */
  --notion-bg-primary: #ffffff;
  --notion-bg-secondary: #f7f6f3;
  --notion-bg-tertiary: #efefef;

  /* Text Colors */
  --notion-text-primary: #37352f;
  --notion-text-secondary: #626060;
  --notion-text-tertiary: #9a9a97;

  /* Border Colors */
  --notion-border-light: #e9e9e7;
  --notion-border-medium: #d3d3ce;

  /* Accent Colors (Notion 팔레트)*/
  --notion-red: #f81b13;
  --notion-orange: #fa8500;
  --notion-yellow: #ebdb34;
  --notion-green: #0b8861;
  --notion-blue: #0b6e99;
  --notion-purple: #6940ef;
  --notion-pink: #d946ef;
  --notion-gray: #626060;
}

body {
  background-color: var(--notion-bg-primary);
  color: var(--notion-text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  line-height: 1.5;
}

/* 레이아웃 */
.sidebar {
  width: 240px;
  background-color: var(--notion-bg-secondary);
  border-right: 1px solid var(--notion-border-light);
}

.editor-area {
  flex: 1;
  overflow: auto;
  padding: 0 96px;
}

/* 타이포그래피 */
h1, h2, h3, h4, h5, h6 {
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

h1 {
  font-size: 1.875rem;
}

h2 {
  font-size: 1.5rem;
}

h3 {
  font-size: 1.25rem;
}

/* BlockNote 기본 스타일 (나중에 오버라이드) */
.bn-block {
  margin: 1px 0;
}

.bn-side-menu {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.bn-block:hover .bn-side-menu {
  opacity: 1;
}
```

---

## 파일 생성 체크리스트

- [ ] `src/app/layout.tsx` 생성
- [ ] `src/app/page.tsx` 생성
- [ ] `src/app/[pageId]/page.tsx` 생성
- [ ] `src/lib/db.ts` 스켈레톤 생성
- [ ] `src/lib/store.ts` 스켈레톤 생성
- [ ] `src/styles/globals.css` Notion 스타일 생성
- [ ] 빌드 테스트 (`npm run build`)
- [ ] 타입 에러 확인 (`tsc --noEmit`)

---

## 기술 스펙

| 항목 | 스펙 |
|------|------|
| **프레임워크** | Next.js 15 App Router |
| **스타일** | Tailwind CSS 3 + CSS Variables |
| **타입** | TypeScript 5 |
| **번들러** | next build |

---

## 수용 기준

✅ 디렉토리 구조 TRD 명세와 일치
✅ 빌드 에러 없음
✅ 타입 에러 없음
✅ `npm run dev` 정상 실행
✅ localhost:3000 접속 확인

---

## 이슈 및 고려사항

1. **다이나믹 라우트**: `[pageId]` 경로는 나중에 실제 DB 쿼리로 구현
2. **Zustand 스토어**: 현재 스켈레톤, TSK-00-05에서 완전 구현
3. **BlockNote 스타일**: 추가 CSS 오버라이드는 TSK-01-03에서 수행
4. **반응형**: 기본 구조만 설정, 모바일 대응은 TSK-03-01에서

---

## 참고

- **다음 Task**: TSK-00-04 (SQLite 데이터베이스 초기화)
- **의존**: TSK-00-02 완료 필수
