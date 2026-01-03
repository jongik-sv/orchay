# TSK-02-07 - 검색 기능 (Cmd+K) 구현 보고서

## 구현 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-07 |
| 구현 일자 | 2026-01-03 |
| 상태 | 구현 완료 |

---

## 1. 구현 개요

### 1.1 목표
Cmd+K(Mac) / Ctrl+K(Windows) 단축키로 검색 모달을 열어 페이지를 빠르게 찾고 이동하는 기능 구현

### 1.2 구현 범위
- 검색 모달 컴포넌트 (SearchModal.tsx) 신규 생성
- 전역 Cmd+K 단축키 이벤트 리스너
- 사이드바 Search 버튼 연동
- 페이지 제목 기반 실시간 필터링
- 키보드 네비게이션 (화살표, Enter, Esc)

---

## 2. 변경 파일 목록

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| src/components/ui/SearchModal.tsx | 신규 생성 | 검색 모달 컴포넌트 |
| src/components/layout/ClientSidebar.tsx | 수정 | 검색 모달 연동 및 Cmd+K 이벤트 |
| tests/e2e/search.spec.ts | 신규 생성 | E2E 테스트 |
| playwright.config.ts | 수정 | 테스트 포트 변경 (3001) |

---

## 3. 주요 구현 내용

### 3.1 SearchModal.tsx

```typescript
// 핵심 Props
interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 핵심 상태
const [query, setQuery] = useState('');
const [selectedIndex, setSelectedIndex] = useState(0);

// 검색 필터링 로직
const filteredPages = useMemo(() => {
  if (!query.trim()) return pageCache;
  const lowerQuery = query.toLowerCase();
  return pageCache.filter((page) =>
    page.title.toLowerCase().includes(lowerQuery)
  );
}, [query, pageCache]);
```

**기능:**
- pageCache에서 클라이언트 측 검색 (BR-01)
- 대소문자 무시, 부분 일치
- 화살표 키로 선택 이동
- Enter로 페이지 이동
- Esc로 모달 닫기
- 오버레이 클릭으로 모달 닫기

### 3.2 ClientSidebar.tsx 수정

```typescript
// 검색 모달 상태 추가
const [searchOpen, setSearchOpen] = useState(false);

// 전역 Cmd+K 이벤트 리스너
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);

// Search 버튼 onClick 연동
const handleSearchClick = useCallback(() => setSearchOpen(true), []);
```

---

## 4. UI 스펙

| 요소 | 스타일 |
|------|--------|
| 모달 배경 | bg-black/50, z-50 |
| 모달 컨테이너 | w-[500px], max-h-[400px], bg-white, rounded-lg, shadow-xl |
| 검색 입력창 | px-4 py-3, text-[16px], border-b |
| 결과 항목 | px-4 py-2, hover:bg-[#F7F6F3] |
| 선택된 항목 | bg-[#E8F0FE] |

---

## 5. 접근성

| 기능 | 구현 |
|------|------|
| 키보드 단축키 | Cmd+K / Ctrl+K |
| 모달 열기 | 검색창 자동 포커스 |
| 선택 이동 | 화살표 위/아래 |
| 선택 확정 | Enter |
| 모달 닫기 | Esc |

---

## 6. 다크모드 지원

```css
/* 다크모드 스타일 */
.dark:bg-[#2F2F2F]           /* 모달 배경 */
.dark:border-[#3F3F3F]       /* 구분선 */
.dark:text-[#E6E6E4]         /* 텍스트 */
.dark:placeholder-[#6B6B6B]  /* 플레이스홀더 */
.dark:bg-[#2D4A77]           /* 선택된 항목 */
.dark:hover:bg-[#3A3A3A]     /* 호버 */
```

---

## 7. 테스트 결과

| 항목 | 결과 |
|------|------|
| E2E 테스트 | 6/6 통과 (100%) |
| 테스트 환경 | Playwright + Chromium |

---

## 8. 설계서 대비 구현 매핑

| 설계서 항목 | 구현 상태 | 비고 |
|------------|----------|------|
| UC-01: 검색 모달 열기 | ✅ 완료 | Cmd+K, Search 버튼 |
| UC-02: 페이지 검색 | ✅ 완료 | 실시간 필터링 |
| UC-03: 검색 결과 이동 | ✅ 완료 | 클릭/Enter |
| 키보드 네비게이션 | ✅ 완료 | ↑↓, Enter, Esc |
| 반응형 디자인 | 🔶 부분 | 기본 구현 |

---

## 9. 제약 사항 및 향후 과제

### 제약 사항
- 페이지 제목만 검색 (콘텐츠 검색 미지원)
- 클라이언트 측 검색만 지원 (서버 검색 미지원)

### 향후 과제 (MVP 제외)
- 검색어 하이라이트
- 최근 검색 기록 저장
- 페이지 콘텐츠(블록) 검색
- 검색 결과 정렬 옵션

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2026-01-03 | Claude | 최초 작성 |
