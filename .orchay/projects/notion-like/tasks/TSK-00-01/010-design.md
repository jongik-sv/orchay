# TSK-00-01 - Next.js 프로젝트 생성 및 기본 설정

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

### 1.1 배경 및 문제 정의

**현재 상황:**
- Orchay Notes 프로젝트를 위한 기반 코드베이스가 존재하지 않음
- Notion과 유사한 블록 기반 올인원 워크스페이스 애플리케이션 개발 필요

**해결하려는 문제:**
- 개발을 시작할 수 있는 기본 프로젝트 구조 부재
- 팀(또는 개인) 개발 환경의 일관성 필요

### 1.2 목적 및 기대 효과

**목적:**
- Next.js 15 App Router 기반의 프로젝트 생성
- TypeScript, Tailwind CSS 등 핵심 도구 설정
- 개발 표준화를 위한 ESLint/Prettier 설정

**기대 효과:**
- 즉시 개발을 시작할 수 있는 환경 구축
- 코드 품질 유지를 위한 린팅 규칙 적용
- 일관된 코드 스타일 유지

### 1.3 범위

**포함:**
- Next.js 15 App Router 프로젝트 생성
- TypeScript 5.x 설정
- Tailwind CSS 3.x 설정
- ESLint/Prettier 설정

**제외:**
- BlockNote, Zustand 등 추가 의존성 설치 (TSK-00-02에서 처리)
- 디렉토리 구조 세부 설정 (TSK-00-03에서 처리)
- 데이터베이스 초기화 (TSK-00-04에서 처리)

### 1.4 참조 문서

| 문서 | 경로 | 관련 섹션 |
|------|------|----------|
| TRD | `.orchay/projects/notion-like/trd.md` | 1. 기술 스택 결정, 4. 프로젝트 구조, 9. 의존성 목록 |

---

## 2. 기술 스택

### 2.1 핵심 기술

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 15.x | 풀스택 프레임워크 (App Router) |
| React | 19.x | UI 라이브러리 |
| TypeScript | 5.x | 타입 안정성 |
| Tailwind CSS | 3.x | 유틸리티 퍼스트 스타일링 |
| Node.js | 22.x LTS | 런타임 환경 |

### 2.2 개발 도구

| 도구 | 용도 |
|------|------|
| ESLint | 코드 린팅 |
| Prettier | 코드 포매팅 |
| npm | 패키지 매니저 |

---

## 3. 구현 계획

### 3.1 프로젝트 생성

```bash
# notion-like 디렉토리에서 Next.js 프로젝트 생성
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
```

**생성 옵션 설명:**
- `--typescript`: TypeScript 사용
- `--tailwind`: Tailwind CSS 사용
- `--eslint`: ESLint 설정 포함
- `--app`: App Router 사용
- `--src-dir`: src 디렉토리 사용
- `--import-alias "@/*"`: 경로 별칭 설정
- `--no-turbopack`: 안정성을 위해 Turbopack 미사용

### 3.2 생성될 디렉토리 구조

```
notion-like/
├── src/
│   └── app/
│       ├── layout.tsx      # 루트 레이아웃
│       ├── page.tsx        # 메인 페이지
│       ├── globals.css     # 전역 스타일
│       └── favicon.ico
├── public/                  # 정적 파일
├── .eslintrc.json          # ESLint 설정
├── next.config.ts          # Next.js 설정
├── tailwind.config.ts      # Tailwind 설정
├── tsconfig.json           # TypeScript 설정
├── postcss.config.mjs      # PostCSS 설정
├── package.json            # 프로젝트 의존성
└── README.md
```

### 3.3 TypeScript 설정

**tsconfig.json 주요 설정:**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 3.4 Tailwind CSS 설정

**tailwind.config.ts:**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Notion 스타일 컬러는 TSK-00-03에서 추가
    },
  },
  plugins: [],
};

export default config;
```

### 3.5 ESLint/Prettier 설정

**ESLint 추가 규칙 (.eslintrc.json):**

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

**Prettier 설정 (.prettierrc):**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

---

## 4. 검증 계획

### 4.1 수용 기준

| 기준 | 검증 방법 |
|------|----------|
| npm run dev 정상 실행 | 개발 서버 시작 후 에러 없음 확인 |
| localhost:3000 접속 확인 | 브라우저에서 기본 페이지 렌더링 확인 |
| TypeScript 타입 체크 | `npx tsc --noEmit` 에러 없음 |
| ESLint 통과 | `npm run lint` 에러 없음 |
| Tailwind CSS 적용 | 기본 페이지에 Tailwind 클래스 동작 확인 |

### 4.2 검증 명령어

```bash
# 1. 의존성 설치
npm install

# 2. 개발 서버 실행
npm run dev

# 3. 타입 체크
npx tsc --noEmit

# 4. 린트 체크
npm run lint

# 5. 빌드 테스트
npm run build
```

---

## 5. 체크리스트

### 5.1 설계 완료 확인

- [x] 기술 스택 정의 완료
- [x] 생성 명령어 및 옵션 결정
- [x] 디렉토리 구조 정의
- [x] 설정 파일 내용 정의
- [x] 검증 기준 정의

### 5.2 구현 준비

- [x] 의존성 확인 완료 (Node.js 22.x LTS 필요)
- [x] 제약 사항 검토 완료

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2026-01-02 | Claude | 최초 작성 |
