# TSK-00-02 - 핵심 의존성 설치 및 설정

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-00-02 |
| 문서 버전 | 1.0 |
| 작성일 | 2026-01-02 |
| 상태 | 작성중 |
| 카테고리 | infrastructure |

---

## 1. 개요

### 1.1 목적

TSK-00-01에서 생성된 Next.js 프로젝트에 Orchay Notes 애플리케이션 구현에 필요한 핵심 의존성을 설치하고 설정한다.

### 1.2 범위

**포함:**
- BlockNote 에디터 패키지 설치 (@blocknote/core, @blocknote/react, @blocknote/mantine)
- better-sqlite3 설치
- Zustand 상태 관리 라이브러리 설치
- Lucide React 아이콘 라이브러리 설치

**제외:**
- 실제 컴포넌트 구현 (WP-01, WP-02에서 처리)
- 데이터베이스 스키마 생성 (TSK-00-04에서 처리)
- 스토어 구현 (TSK-00-05에서 처리)

### 1.3 참조 문서

| 문서 | 경로 | 관련 섹션 |
|------|------|----------|
| TRD | `.orchay/projects/notion-like/trd.md` | 9. 의존성 목록 |
| TRD | `.orchay/projects/notion-like/trd.md` | 1. 기술 스택 결정 |

---

## 2. 현재 상태

### 2.1 전제 조건

TSK-00-01 완료 후 상태:
- Next.js 15 프로젝트 생성 완료
- TypeScript 설정 완료
- Tailwind CSS 설정 완료
- ESLint/Prettier 설정 완료

### 2.2 의존성 현황

현재 설치된 패키지 (TSK-00-01 완료 후):
```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

---

## 3. 목표 상태

### 3.1 설치할 의존성

TRD 9. 의존성 목록에 따른 패키지:

| 패키지 | 버전 | 용도 |
|--------|------|------|
| @blocknote/core | ^0.18.0 | BlockNote 에디터 코어 |
| @blocknote/react | ^0.18.0 | React용 BlockNote 컴포넌트 |
| @blocknote/mantine | ^0.18.0 | Mantine 테마 스타일링 |
| @mantine/core | ^7.0.0 | BlockNote Mantine 의존성 |
| better-sqlite3 | ^11.0.0 | SQLite 데이터베이스 드라이버 |
| zustand | ^5.0.0 | 경량 상태 관리 |
| lucide-react | ^0.460.0 | 아이콘 라이브러리 |

### 3.2 설치할 개발 의존성

| 패키지 | 용도 |
|--------|------|
| @types/better-sqlite3 | better-sqlite3 타입 정의 |

---

## 4. 구현 계획

### 4.1 단계 1: BlockNote 에디터 설치

```bash
npm install @blocknote/core @blocknote/react @blocknote/mantine @mantine/core
```

**검증:**
- 패키지 설치 성공 확인
- 타입 에러 없음 확인

### 4.2 단계 2: better-sqlite3 설치

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

**주의사항:**
- better-sqlite3는 네이티브 모듈로 빌드가 필요함
- Node.js 버전에 맞는 바이너리 자동 설치 확인

**검증:**
- 패키지 설치 성공 확인
- 네이티브 빌드 에러 없음 확인

### 4.3 단계 3: Zustand 설치

```bash
npm install zustand
```

**검증:**
- 패키지 설치 성공 확인

### 4.4 단계 4: Lucide React 설치

```bash
npm install lucide-react
```

**검증:**
- 패키지 설치 성공 확인

---

## 5. 설정 검증

### 5.1 패키지 설치 확인

설치 완료 후 `package.json` 의존성 확인:

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@blocknote/core": "^0.18.0",
    "@blocknote/react": "^0.18.0",
    "@blocknote/mantine": "^0.18.0",
    "@mantine/core": "^7.0.0",
    "better-sqlite3": "^11.0.0",
    "zustand": "^5.0.0",
    "lucide-react": "^0.460.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.0.0"
  }
}
```

### 5.2 빌드 검증

```bash
npm run build
```

**성공 기준:**
- 타입 에러 없음
- 빌드 완료

### 5.3 개발 서버 검증

```bash
npm run dev
```

**성공 기준:**
- 개발 서버 정상 실행
- localhost:3000 접속 가능

---

## 6. 수용 기준

| 번호 | 기준 | 검증 방법 |
|------|------|----------|
| AC-01 | 모든 패키지 설치 성공 | `npm ls` 명령으로 확인 |
| AC-02 | 타입 에러 없음 | `npm run build` 성공 |
| AC-03 | 개발 서버 정상 실행 | `npm run dev` 후 접속 확인 |

---

## 7. 주의사항

### 7.1 better-sqlite3 네이티브 모듈

- better-sqlite3는 C++ 네이티브 모듈 빌드가 필요
- Windows에서는 Visual Studio Build Tools 필요 가능
- macOS에서는 Xcode Command Line Tools 필요 가능

### 7.2 BlockNote Mantine 의존성

- @blocknote/mantine은 @mantine/core를 피어 의존성으로 요구
- 반드시 함께 설치해야 함
- TRD에 명시된 @mantine/core ^7.0.0 버전은 @blocknote/mantine ^0.18.0과 호환됨

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2026-01-02 | Claude | 최초 작성 |
| 1.1 | 2026-01-02 | Claude | 리뷰 반영: @mantine/core 호환성 명시 |
