---
name: user-manual-creator
description: |
  Task 사용자 매뉴얼(080-user-manual.md) 생성 스킬. Playwright MCP로 스크린샷 캡쳐,
  템플릿 기반 문서 작성을 자동화합니다.

  트리거: "사용자 매뉴얼 생성", "080-user-manual 작성", "스크린샷 캡쳐해서 매뉴얼",
  "Task 사용자 가이드 작성", "user-manual-creator 실행"
---

# User Manual Creator

Task의 사용자 매뉴얼(080-user-manual.md)을 생성하는 스킬.

## 필수 조건

- 애플리케이션 실행 중 (localhost:3000)
- Playwright MCP 활성화
- Task 폴더 존재 (.orchay/projects/{project}/tasks/{TSK-ID}/)

## 워크플로우

### Phase 1: 준비

1. Task ID 및 기능 정보 확인
2. 기본설계(010-basic-design.md) 읽기
3. 시나리오 목록 작성 (3~6개)

### Phase 2: 스크린샷 캡쳐

**파일명 규칙**:
```
{TSK-ID}-{시나리오}-{step}-{내용}.png

예: TSK-04-01-01-01-initial-view.png
```

**캡쳐 순서**:
1. `playwright/browser_navigate` → URL 이동
2. `playwright/browser_snapshot` → 요소 확인
3. `playwright/browser_click` → 화면 조작
4. `playwright/browser_take_screenshot` → 캡쳐

**이미지 복사**:
```bash
mkdir -p .orchay/projects/{project}/tasks/{TSK-ID}/manual-images
cp .playwright-mcp/{파일명}.png .orchay/projects/{project}/tasks/{TSK-ID}/manual-images/
```

### Phase 3: 문서 작성

템플릿 기반으로 080-user-manual.md 작성. See [assets/080-user-manual-template.md](assets/080-user-manual-template.md)

**시나리오 형식**:
```markdown
### 시나리오 N: [목표 동사형]

**목표**: [사용자가 달성하고자 하는 목표]

#### 단계별 안내

**Step 1.** [동작 설명]

![설명](./manual-images/{TSK-ID}-01-01-xxx.png)
```

### Phase 4: 검증

- 이미지 링크 유효성 확인
- 섹션 완전성 (1~8)
- 시나리오 3개 이상

## 에러 처리

캡쳐 불가 시 즉시 종료:

| 상황 | 메시지 |
|------|--------|
| 서버 미실행 | `[ERROR] localhost:3000 연결 실패` |
| Playwright 실패 | `[ERROR] Playwright MCP 연결 실패` |
| Task 폴더 없음 | `[ERROR] Task 폴더 없음: {경로}` |

## 파일 구조

```
tasks/{TSK-ID}/
├── 080-user-manual.md
└── manual-images/
    ├── {TSK-ID}-01-01-xxx.png
    └── ...
```

## 상세 절차

전체 워크플로우는 [references/workflow.md](references/workflow.md) 참조.
