# orchay_web

> orchay 프로젝트의 웹 대시보드 - Nuxt 3 기반 실시간 모니터링 UI

## 개요

orchay_web은 orchay 스케줄러의 상태를 웹 브라우저에서 모니터링할 수 있는 대시보드입니다.

### 주요 기능

- **WBS 트리 뷰**: 계층적 Task 구조 시각화 (WP → ACT → Task)
- **Task 상세 정보**: 선택한 Task의 상태, 의존성, 진행 상황 확인
- **Worker 모니터링**: 각 Worker의 현재 상태 및 작업 표시
- **플로우 차트**: @vue-flow 기반 Task 의존성 그래프
- **실시간 갱신**: 자동 상태 업데이트

## 기술 스택

| 분류 | 기술 |
|------|------|
| Framework | Nuxt 3 |
| UI Library | PrimeVue 4, Tailwind CSS |
| State | Pinia |
| Flow Chart | @vue-flow |
| Markdown | marked, mermaid |
| Testing | Vitest (Unit), Playwright (E2E) |

## 설치

```bash
cd orchay_web

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

## 개발

### 개발 서버

```bash
# 개발 서버 (http://localhost:3000)
npm run dev

# 타입 체크
npm run typecheck
```

### 테스트

```bash
# 유닛 테스트
npm run test

# 유닛 테스트 (watch 모드)
npm run test:watch

# 커버리지
npm run test:coverage

# E2E 테스트
npm run test:e2e

# E2E 테스트 (UI 모드)
npm run test:e2e:ui
```

### 빌드

```bash
# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

## 프로젝트 구조

```
orchay_web/
├── app/
│   ├── components/      # Vue 컴포넌트
│   ├── composables/     # Vue Composables
│   ├── layouts/         # 레이아웃
│   ├── pages/           # 페이지 (파일 기반 라우팅)
│   ├── plugins/         # Nuxt 플러그인
│   ├── stores/          # Pinia 스토어
│   ├── types/           # TypeScript 타입 정의
│   └── utils/           # 유틸리티 함수
├── server/
│   ├── api/             # API 라우트
│   └── utils/           # 서버 유틸리티
├── constants/           # 상수 정의
├── tests/               # 테스트 코드
├── nuxt.config.ts       # Nuxt 설정
├── tailwind.config.ts   # Tailwind 설정
└── vitest.config.ts     # Vitest 설정
```

## 환경 요구사항

- Node.js >= 20.0.0
- npm 또는 yarn

## 라이선스

MIT
