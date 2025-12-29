# TSK-01-03 - 스케줄러 코어 사용자 매뉴얼

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-03 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-28 |
| 대상 사용자 | 개발자, orchay 스케줄러 통합자 |

---

## 1. 개요

### 1.1 기능 소개

스케줄러 코어(`scheduler.py`)는 orchay Task 스케줄러의 핵심 모듈로, 다음 기능을 제공합니다:

- **Task 필터링**: 실행 가능한 Task를 자동으로 필터링
- **우선순위 정렬**: critical > high > medium > low 순으로 정렬
- **모드별 워크플로우**: 4가지 실행 모드에 따른 워크플로우 단계 결정
- **Task 분배**: idle 상태 Worker에 Task 할당

### 1.2 대상 사용자

| 사용자 유형 | 사용 목적 |
|------------|----------|
| orchay 통합자 | 스케줄러 코어 함수를 호출하여 Task 분배 구현 |
| 개발자 | 모드 전환, 큐 상태 확인 |

---

## 2. 시작하기

### 2.1 사전 요구사항

- Python 3.10 이상
- uv 패키지 매니저
- orchay 패키지 설치 완료

### 2.2 설치

```bash
cd orchay
uv pip install -e .
```

### 2.3 모듈 임포트

```python
from orchay.scheduler import (
    filter_executable_tasks,
    get_workflow_steps,
    dispatch_task,
    check_dependencies_implemented,
    ExecutionMode,
    WORKFLOW_STEPS,
    PRIORITY_ORDER,
)
from orchay.models.task import Task, TaskPriority, TaskStatus
from orchay.models.worker import Worker
```

---

## 3. 사용 방법

### 3.1 실행 가능 Task 필터링

```python
import asyncio
from orchay.scheduler import filter_executable_tasks, ExecutionMode
from orchay.models.task import Task, TaskPriority, TaskStatus

async def main():
    tasks = [
        Task(
            id="TSK-01-01",
            category="development",
            domain="backend",
            status=TaskStatus.TODO,
            priority=TaskPriority.CRITICAL,
        ),
        Task(
            id="TSK-01-02",
            category="development",
            domain="backend",
            status=TaskStatus.TODO,
            priority=TaskPriority.HIGH,
            depends=["TSK-01-01"],
        ),
    ]

    # QUICK 모드로 필터링
    queue = await filter_executable_tasks(tasks, ExecutionMode.QUICK)

    for task in queue:
        print(f"{task.id} - {task.priority}")

asyncio.run(main())
```

**출력:**
```
TSK-01-01 - critical
TSK-01-02 - high
```

### 3.2 모드별 워크플로우 단계 조회

```python
from orchay.scheduler import get_workflow_steps, ExecutionMode
from orchay.models.task import Task, TaskPriority, TaskStatus

task = Task(
    id="TSK-01-01",
    category="development",
    domain="backend",
    status=TaskStatus.TODO,
    priority=TaskPriority.HIGH,
)

# 각 모드별 워크플로우
for mode in ExecutionMode:
    steps = get_workflow_steps(task, mode)
    print(f"{mode.value}: {steps}")
```

**출력:**
```
design: ['start']
quick: ['start', 'approve', 'build', 'done']
develop: ['start', 'review', 'apply', 'approve', 'build', 'audit', 'patch', 'test', 'done']
force: ['start', 'approve', 'build', 'done']
```

### 3.3 Task 분배

```python
import asyncio
from orchay.scheduler import dispatch_task, ExecutionMode
from orchay.models.task import Task, TaskPriority, TaskStatus
from orchay.models.worker import Worker

async def main():
    worker = Worker(id="W1", pane_id=1, state="idle")
    task = Task(
        id="TSK-01-01",
        category="development",
        domain="backend",
        status=TaskStatus.TODO,
        priority=TaskPriority.CRITICAL,
    )

    print(f"분배 전: {worker.state}, {worker.current_task}")

    await dispatch_task(worker, task, ExecutionMode.QUICK)

    print(f"분배 후: {worker.state}, {worker.current_task}")

asyncio.run(main())
```

**출력:**
```
분배 전: idle, None
분배 후: busy, TSK-01-01
```

### 3.4 의존성 검사

```python
from orchay.scheduler import check_dependencies_implemented
from orchay.models.task import Task, TaskPriority, TaskStatus

tasks = {
    "TSK-01-01": Task(
        id="TSK-01-01",
        category="development",
        domain="backend",
        status=TaskStatus.IMPLEMENT,  # [im] 상태
        priority=TaskPriority.HIGH,
    ),
    "TSK-01-02": Task(
        id="TSK-01-02",
        category="development",
        domain="backend",
        status=TaskStatus.DETAIL_DESIGN,  # [dd] 상태
        priority=TaskPriority.HIGH,
        depends=["TSK-01-01"],
    ),
}

# TSK-01-01이 [im] 이상이므로 의존성 충족
result = check_dependencies_implemented(tasks["TSK-01-02"], tasks)
print(f"의존성 충족: {result}")  # True
```

---

## 4. 실행 모드 설명

### 4.1 모드별 특징

| 모드 | 설명 | 의존성 검사 | 워크플로우 |
|------|------|------------|------------|
| `design` | 설계만 진행 | 무시 | start만 |
| `quick` | 빠른 개발 | `[dd]` 이상에서 검사 | 4단계 |
| `develop` | 전체 워크플로우 | `[dd]` 이상에서 검사 | 9단계 |
| `force` | 강제 실행 | 무시 | 4단계 |

### 4.2 모드 전환 시나리오

**시나리오 1: 긴급 Task 처리**
```python
# 의존성 때문에 큐에 없는 Task를 강제로 분배
queue = await filter_executable_tasks(tasks, ExecutionMode.FORCE)
```

**시나리오 2: 설계 단계만 진행**
```python
# Todo 상태 Task만 설계 진행
queue = await filter_executable_tasks(tasks, ExecutionMode.DESIGN)
```

---

## 5. FAQ

### Q1: 왜 Task가 큐에 표시되지 않나요?

**원인 확인:**
1. Task 상태가 `[xx]` (완료)인가요?
2. `blocked_by` 필드가 설정되어 있나요?
3. 다른 Worker에서 이미 실행 중인가요?
4. develop/quick 모드에서 의존성 Task가 `[im]` 미만인가요?

**해결:**
```python
# force 모드로 전환하여 의존성 무시
queue = await filter_executable_tasks(tasks, ExecutionMode.FORCE)
```

### Q2: 우선순위 정렬 순서는?

```
critical (0) > high (1) > medium (2) > low (3)
```

동일 우선순위 내에서는 입력 순서가 유지됩니다.

### Q3: 비동기 함수를 동기로 호출하려면?

```python
import asyncio

# 동기 환경에서 호출
result = asyncio.run(filter_executable_tasks(tasks, mode))
```

---

## 6. 문제 해결

### 에러: Task 상태 변환 실패

**증상:** `ValidationError: Invalid status value`

**원인:** 잘못된 상태 문자열 사용

**해결:**
```python
from orchay.models.task import TaskStatus

# 올바른 사용
task = Task(status=TaskStatus.TODO)  # "[ ]"
task = Task(status=TaskStatus.IMPLEMENT)  # "[im]"
```

### 에러: 순환 의존성

**증상:** Task가 서로를 의존하여 필터링에서 모두 제외

**해결:** wbs.md에서 의존성 구조 확인 후 순환 참조 제거

---

## 7. 참고 자료

| 문서 | 경로 |
|------|------|
| 설계 문서 | `010-design.md` |
| API 명세 | `010-design.md` 섹션 12 |
| 테스트 명세 | `026-test-specification.md` |
| 추적성 매트릭스 | `025-traceability-matrix.md` |

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-12-28 | Claude | 최초 작성 |
