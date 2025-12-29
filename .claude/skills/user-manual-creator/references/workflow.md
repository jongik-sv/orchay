# 매뉴얼 생성 워크플로우 상세

## Phase 1: 준비

**입력물**:
- Task ID
- 010-basic-design.md
- 011-ui-design.md (있는 경우)

**작업**:
1. `.orchay/templates/080-manual.md` 템플릿 확인
2. 기능 범위 파악
3. 시나리오 목록 초안 (3~6개)

---

## Phase 2: 스크린샷 계획

**파일명 규칙**:
```
{TSK-ID}-{시나리오번호}-{step번호}-{내용}.png

예시:
├── TSK-04-01-01-01-initial-view.png
├── TSK-04-01-01-02-click-result.png
├── TSK-04-01-02-01-search-input.png
└── ...
```

**체크리스트 작성**:
| 시나리오 | Step | 파일명 | 캡쳐 내용 |
|---------|------|--------|----------|
| 1 | 1 | TSK-XX-XX-01-01-xxx.png | [설명] |
| 1 | 2 | TSK-XX-XX-01-02-xxx.png | [설명] |

---

## Phase 3: 스크린샷 캡쳐

### Playwright MCP 명령어

```
1. 페이지 이동
   playwright/browser_navigate → http://localhost:3000/{path}

2. 스냅샷 확인 (요소 ref 확인용)
   playwright/browser_snapshot

3. 요소 클릭
   playwright/browser_click → ref="{element-ref}"

4. 스크린샷 캡쳐
   playwright/browser_take_screenshot → {파일명}.png
```

### 이미지 복사

```bash
# 폴더 생성
mkdir -p .orchay/projects/{project}/tasks/{TSK-ID}/manual-images

# 이미지 복사
cp .playwright-mcp/{파일명}.png .orchay/projects/{project}/tasks/{TSK-ID}/manual-images/
```

### Playwright 제약사항

- 저장 경로: `.playwright-mcp/` 폴더만 가능
- 해결책: 캡쳐 후 `manual-images/`로 복사

---

## Phase 4: 문서 작성

### 메타데이터

```markdown
| 항목 | 내용 |
|------|------|
| Task ID | TSK-XX-XX |
| Task명 | [기능명] |
| 작성일 | YYYY-MM-DD |
| 버전 | 1.0.0 |
```

### 개요 섹션

1. 한 문장 설명
2. ASCII 다이어그램 (화면 구성)
3. 주요 기능 요약 테이블

### 시나리오 형식

```markdown
### 시나리오 N: [목표 동사형]

**목표**: [사용자가 달성하고자 하는 목표]

#### 단계별 안내

**Step 1.** [동작 설명]

![설명](./manual-images/{TSK-ID}-01-01-xxx.png)

**Step 2.** [동작 설명]

| 항목 | 설명 |
|------|------|

> **Tip**: [유용한 정보]
```

### 필수 섹션

1. 개요
2. 시나리오별 사용 가이드 (3개 이상)
3. 키보드 단축키
4. 상태별 화면
5. FAQ / 트러블슈팅 (3개 이상)
6. 접근성
7. 관련 문서
8. 변경 이력

---

## Phase 5: 검증

### 이미지 링크 검증

```bash
grep -o './manual-images/[^)]*' 080-user-manual.md
```

### 체크리스트

- [ ] 모든 이미지 링크 유효
- [ ] 섹션 1~8 존재
- [ ] 시나리오 3개 이상
- [ ] Step 형식 일관성
- [ ] FAQ 3개 이상

---

## 에러 처리

| 상황 | 에러 메시지 | 조치 |
|------|------------|------|
| 서버 미실행 | `[ERROR] localhost:3000 연결 실패` | 서버 실행 후 재시도 |
| Playwright 실패 | `[ERROR] Playwright MCP 연결 실패` | MCP 상태 확인 |
| 페이지 로드 실패 | `[ERROR] 페이지 로드 실패: {URL}` | URL 확인 |
| Task 폴더 없음 | `[ERROR] Task 폴더 없음` | Task 폴더 생성 |

**처리 규칙**: 에러 발생 시 즉시 종료, 에러 메시지 출력
