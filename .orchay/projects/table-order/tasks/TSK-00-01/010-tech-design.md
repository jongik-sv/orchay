# TSK-00-01 - Next.js 프로젝트 초기화 및 의존성 설치 설계 문서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-00-01 |
| 문서 버전 | 1.0 |
| 작성일 | 2026-01-02 |
| 상태 | 작성중 |
| 카테고리 | infrastructure |

---

## 1. 개요

### 1.1 목적

테이블 오더 MVP 프로젝트의 기반이 되는 Next.js 프로젝트를 초기화하고 필수 의존성을 설치한다.

### 1.2 현재 상태

- 프로젝트 폴더가 존재하지 않음
- 개발 환경 미구성

### 1.3 목표 상태

- Next.js 15.x + App Router 프로젝트 생성 완료
- TypeScript 5.x 설정 완료
- TailwindCSS 3.4 설정 완료
- 필수 런타임 의존성 설치 완료 (better-sqlite3, socket.io, lucide-react)
- 개발 서버 정상 실행 확인

### 1.4 참조 문서

| 문서 | 경로 | 관련 섹션 |
|------|------|----------|
| TRD | `.orchay/projects/table-order/trd.md` | 섹션 7 (의존성 목록) |

---

## 2. 구현 계획

### 2.1 프로젝트 생성

```bash
# 프로젝트 루트에서 실행
npx create-next-app@latest mvp --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

**옵션 설명:**
- `--typescript`: TypeScript 활성화
- `--tailwind`: TailwindCSS 설정 포함
- `--eslint`: ESLint 설정 포함
- `--app`: App Router 사용
- `--src-dir`: src 디렉토리 사용
- `--no-import-alias`: import alias 미사용 (단순화)

### 2.2 의존성 설치

#### 런타임 의존성

```bash
cd mvp
npm install better-sqlite3 socket.io socket.io-client lucide-react
```

| 패키지 | 버전 | 용도 |
|--------|------|------|
| better-sqlite3 | ^11.x | SQLite 데이터베이스 연결 |
| socket.io | ^4.8.x | 서버사이드 WebSocket |
| socket.io-client | ^4.8.x | 클라이언트사이드 WebSocket |
| lucide-react | ^0.460.x | 아이콘 라이브러리 |

#### 개발 의존성

```bash
npm install -D @types/better-sqlite3
```

| 패키지 | 버전 | 용도 |
|--------|------|------|
| @types/better-sqlite3 | ^7.x | better-sqlite3 타입 정의 |

### 2.3 설정 파일

#### tailwind.config.ts

TRD에 명시된 글래스모피즘 색상 시스템 확장:

```typescript
import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#8B5CF6',
          600: '#7C3AED',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

#### tsconfig.json

기본 생성된 설정 사용 (수정 불필요)

---

## 3. 검증 기준

### 3.1 수용 기준

| 기준 | 검증 방법 |
|------|----------|
| npm run dev 실행 시 정상 동작 | 개발 서버 실행 후 http://localhost:3000 접속 |
| TypeScript 컴파일 에러 없음 | `npx tsc --noEmit` 실행 |
| TailwindCSS 유틸리티 클래스 동작 확인 | 페이지에 TailwindCSS 클래스 적용 후 스타일 확인 |

### 3.2 설치 확인

```bash
# 의존성 설치 확인
npm list better-sqlite3 socket.io socket.io-client lucide-react

# TypeScript 타입 확인
npm list @types/better-sqlite3
```

---

## 4. 예상 결과물

### 4.1 폴더 구조

```
mvp/
├── src/
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx
│       └── globals.css
├── public/
├── package.json
├── package-lock.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.ts
└── eslint.config.mjs
```

### 4.2 package.json (의존성)

```json
{
  "dependencies": {
    "next": "^15.x",
    "react": "^19.x",
    "react-dom": "^19.x",
    "better-sqlite3": "^11.x",
    "socket.io": "^4.8.x",
    "socket.io-client": "^4.8.x",
    "lucide-react": "^0.460.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^22.x",
    "@types/react": "^19.x",
    "@types/react-dom": "^19.x",
    "@types/better-sqlite3": "^7.x",
    "tailwindcss": "^3.4.x",
    "postcss": "^8.x",
    "autoprefixer": "^10.x",
    "eslint": "^9.x",
    "eslint-config-next": "^15.x"
  }
}
```

---

## 5. 제약 사항

| 제약 | 설명 | 대응 방안 |
|------|------|----------|
| Node.js 버전 | Next.js 15는 Node.js 18.18+ 필요 | 버전 확인 후 진행 |
| better-sqlite3 빌드 | native 모듈로 빌드 필요 | node-gyp 설치 확인 |

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2026-01-02 | Claude | 최초 작성 |
