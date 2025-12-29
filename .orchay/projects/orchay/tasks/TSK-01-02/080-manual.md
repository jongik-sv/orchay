# TSK-01-02 - WBS 파서 사용자 매뉴얼

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-02 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-28 |

---

## 1. 개요

### 1.1 기능 소개

WBS 파서는 wbs.md 마크다운 파일을 파싱하여 Task 객체 리스트로 변환하고, 파일 변경을 실시간으로 감지하여 콜백을 실행하는 모듈입니다.

### 1.2 주요 기능

| 기능 | 설명 |
|------|------|
| `parse_wbs()` | wbs.md 파일을 비동기로 파싱하여 Task 리스트 반환 |
| `watch_wbs()` | 파일 변경 감지 및 콜백 실행 (디바운싱 지원) |
| `extract_status_code()` | 상태 라인에서 상태 코드 추출 |

### 1.3 대상 사용자

- **스케줄러 코어**: Task 큐 구성을 위한 파싱 결과 소비
- **개발자**: 디버깅 및 테스트 목적

---

## 2. 시작하기

### 2.1 사전 요구사항

- Python >= 3.10
- watchdog >= 4.0
- pydantic >= 2.0

### 2.2 설치

```bash
cd orchay
uv pip install -e .
```

### 2.3 임포트

```python
from orchay.wbs_parser import parse_wbs, watch_wbs, extract_status_code
from orchay.models import Task
```

---

## 3. 사용 방법

### 3.1 wbs.md 파싱

```python
import asyncio
from pathlib import Path
from orchay.wbs_parser import parse_wbs

async def main():
    # wbs.md 파일 파싱
    tasks = await parse_wbs(".orchay/projects/orchay/wbs.md")

    for task in tasks:
        print(f"{task.id}: {task.title} [{task.status.value}]")

asyncio.run(main())
```

**출력 예시:**
```
TSK-01-01: 프로젝트 초기화 및 핵심 모델 [[xx]]
TSK-01-02: WBS 파서 구현 [[im]]
TSK-01-03: 스케줄러 코어 구현 [[dd]]
```

### 3.2 파일 변경 감지

```python
import asyncio
from orchay.wbs_parser import watch_wbs
from orchay.models import Task

async def on_change(tasks: list[Task]) -> None:
    print(f"Tasks updated: {len(tasks)}")
    for task in tasks:
        if task.status.value == "[im]":
            print(f"  - {task.id}: {task.title} (구현 중)")

async def main():
    # 파일 감시 시작
    watcher = watch_wbs(
        ".orchay/projects/orchay/wbs.md",
        on_change,
        debounce=0.5  # 0.5초 디바운싱
    )
    watcher.start()

    try:
        # 감시 유지 (다른 작업 수행)
        await asyncio.sleep(60)
    finally:
        await watcher.stop()

asyncio.run(main())
```

### 3.3 상태 코드 추출

```python
from orchay.wbs_parser import extract_status_code

# 상태 라인에서 코드 추출
code1 = extract_status_code("- status: implement [im]")
print(code1)  # [im]

code2 = extract_status_code("- status: [ ]")
print(code2)  # [ ]

code3 = extract_status_code("- status: done [xx]")
print(code3)  # [xx]
```

### 3.4 WbsParser 클래스 직접 사용

캐싱 기능이 필요한 경우 WbsParser 클래스를 직접 사용할 수 있습니다.

```python
from orchay.wbs_parser import WbsParser

async def main():
    parser = WbsParser(".orchay/projects/orchay/wbs.md")

    # 첫 번째 파싱
    tasks1 = await parser.parse()
    print(f"첫 번째 파싱: {len(tasks1)} tasks")

    # 두 번째 파싱 (파일 손상 시 캐시 반환)
    tasks2 = await parser.parse()
    print(f"두 번째 파싱: {len(tasks2)} tasks")

asyncio.run(main())
```

---

## 4. Task 속성

파싱된 Task 객체의 주요 속성:

| 속성 | 타입 | 설명 |
|------|------|------|
| `id` | str | Task ID (예: TSK-01-02) |
| `title` | str | Task 제목 |
| `category` | TaskCategory | 카테고리 (development, defect, infrastructure, simple-dev) |
| `domain` | str | 도메인 (backend, frontend, infra 등) |
| `status` | TaskStatus | 상태 (TODO, IMPLEMENT, DONE 등) |
| `priority` | TaskPriority | 우선순위 (critical, high, medium, low) |
| `assignee` | str | 담당자 |
| `schedule` | str | 일정 |
| `tags` | list[str] | 태그 목록 |
| `depends` | list[str] | 의존 Task ID 목록 |
| `blocked_by` | str \| None | 블로킹 사유 |

---

## 5. FAQ

### Q1: 파일이 존재하지 않으면 어떻게 되나요?

빈 리스트(`[]`)가 반환되고 경고 로그가 기록됩니다.

### Q2: 파싱 오류가 발생하면 어떻게 되나요?

이전에 성공한 파싱 결과가 캐시되어 있으면 캐시를 반환합니다. 캐시가 없으면 빈 리스트를 반환합니다.

### Q3: 디바운싱이란 무엇인가요?

파일이 짧은 시간 내에 여러 번 수정될 때, 마지막 수정 후 일정 시간(기본 0.5초)이 지나야 콜백이 호출됩니다. 이를 통해 중복 호출을 방지합니다.

### Q4: 지원하는 상태 코드는 무엇인가요?

| 코드 | 의미 |
|------|------|
| `[ ]` | Todo |
| `[bd]` | 기본설계 |
| `[dd]` | 상세설계 |
| `[an]` | 분석 |
| `[ds]` | 설계 |
| `[ap]` | 승인 |
| `[im]` | 구현 |
| `[fx]` | 수정 |
| `[vf]` | 검증 |
| `[xx]` | 완료 |

---

## 6. 문제 해결

### 파싱 결과가 비어있음

1. wbs.md 파일 경로 확인
2. Task 헤더 형식 확인: `### TSK-XX-XX: 제목`
3. 필수 속성 확인: `- category: development`

### 파일 변경 감지가 안됨

1. watchdog 설치 확인: `uv pip install watchdog`
2. 파일 경로가 존재하는지 확인
3. 권한 문제 확인 (Windows: 관리자 권한)

### 타입 오류 발생

Pyright strict 모드에서 타입 오류가 발생하면:
```python
from orchay.models import Task
tasks: list[Task] = await parse_wbs("wbs.md")
```

---

## 7. 참고 자료

| 문서 | 경로 |
|------|------|
| 설계 문서 | `010-design.md` |
| 추적성 매트릭스 | `025-traceability-matrix.md` |
| 테스트 명세 | `026-test-specification.md` |
| 구현 보고서 | `030-implementation.md` |

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-12-28 | Claude | 최초 작성 |
