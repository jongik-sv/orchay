# TSK-01-03 - 테스트 명세서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-03 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-28 |

---

## 1. 테스트 개요

### 1.1 테스트 범위

| 모듈 | 함수 | 테스트 유형 |
|------|------|------------|
| scheduler.py | `filter_executable_tasks` | 단위 테스트 |
| scheduler.py | `get_workflow_steps` | 단위 테스트 |
| scheduler.py | `dispatch_task` | 단위 테스트 |
| scheduler.py | `check_dependencies_implemented` | 단위 테스트 |
| scheduler.py | 전체 흐름 | 통합 테스트 |

### 1.2 테스트 환경

| 항목 | 값 |
|------|-----|
| 테스트 프레임워크 | pytest |
| 비동기 테스트 | pytest-asyncio |
| 커버리지 목표 | 80% |

---

## 2. 단위 테스트 케이스

### 2.1 filter_executable_tasks 테스트

#### TC-01: 완료 Task 제외

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-01 |
| 테스트명 | test_filter_excludes_completed_tasks |
| 목적 | `[xx]` 상태 Task가 필터링에서 제외되는지 확인 |
| 사전 조건 | Task 목록에 `[xx]` 상태 Task 포함 |
| 입력 | `tasks=[Task(status="[xx]"), Task(status="[ ]")]`, `mode=QUICK` |
| 기대 결과 | `[xx]` Task 제외, `[ ]` Task만 반환 |
| 비즈니스 규칙 | BR-01 |

```python
@pytest.mark.asyncio
async def test_filter_excludes_completed_tasks():
    tasks = [
        Task(id="TSK-01-01", status="[xx]", priority=Priority.HIGH),
        Task(id="TSK-01-02", status="[ ]", priority=Priority.HIGH),
    ]
    result = await filter_executable_tasks(tasks, ExecutionMode.QUICK)
    assert len(result) == 1
    assert result[0].id == "TSK-01-02"
```

#### TC-02: blocked-by Task 제외

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-02 |
| 테스트명 | test_filter_excludes_blocked_tasks |
| 목적 | `blocked_by` 필드가 설정된 Task 제외 확인 |
| 사전 조건 | Task에 `blocked_by` 설정 |
| 입력 | `tasks=[Task(blocked_by=["TSK-01-01"])]` |
| 기대 결과 | 해당 Task 제외 |
| 비즈니스 규칙 | BR-02 |

```python
@pytest.mark.asyncio
async def test_filter_excludes_blocked_tasks():
    tasks = [
        Task(id="TSK-01-01", status="[ ]", priority=Priority.HIGH, blocked_by=["ISSUE-001"]),
        Task(id="TSK-01-02", status="[ ]", priority=Priority.HIGH),
    ]
    result = await filter_executable_tasks(tasks, ExecutionMode.QUICK)
    assert len(result) == 1
    assert result[0].id == "TSK-01-02"
```

#### TC-03: 실행 중 Task 제외

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-03 |
| 테스트명 | test_filter_excludes_running_tasks |
| 목적 | `running_tasks`에 포함된 Task 제외 확인 |
| 사전 조건 | `running_tasks` 집합에 Task ID 존재 |
| 입력 | `running_tasks={"TSK-01-01"}` |
| 기대 결과 | TSK-01-01 제외 |
| 비즈니스 규칙 | BR-03 |

```python
@pytest.mark.asyncio
async def test_filter_excludes_running_tasks():
    tasks = [
        Task(id="TSK-01-01", status="[ ]", priority=Priority.HIGH),
        Task(id="TSK-01-02", status="[ ]", priority=Priority.HIGH),
    ]
    result = await filter_executable_tasks(
        tasks, ExecutionMode.QUICK, running_tasks={"TSK-01-01"}
    )
    assert len(result) == 1
    assert result[0].id == "TSK-01-02"
```

#### TC-04: 우선순위 정렬

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-04 |
| 테스트명 | test_filter_sorts_by_priority |
| 목적 | critical > high > medium > low 순 정렬 확인 |
| 사전 조건 | 다양한 우선순위 Task 존재 |
| 입력 | `tasks=[low, critical, medium, high]` |
| 기대 결과 | `[critical, high, medium, low]` 순 반환 |
| 비즈니스 규칙 | BR-07 |

```python
@pytest.mark.asyncio
async def test_filter_sorts_by_priority():
    tasks = [
        Task(id="TSK-01-01", status="[ ]", priority=Priority.LOW),
        Task(id="TSK-01-02", status="[ ]", priority=Priority.CRITICAL),
        Task(id="TSK-01-03", status="[ ]", priority=Priority.MEDIUM),
        Task(id="TSK-01-04", status="[ ]", priority=Priority.HIGH),
    ]
    result = await filter_executable_tasks(tasks, ExecutionMode.QUICK)
    priorities = [t.priority for t in result]
    assert priorities == [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW]
```

#### TC-05: design 모드 필터링

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-05 |
| 테스트명 | test_design_mode_only_todo_tasks |
| 목적 | design 모드에서 `[ ]` 상태만 포함 확인 |
| 사전 조건 | 다양한 상태 Task 존재 |
| 입력 | `mode=DESIGN`, `tasks=[[ ], [dd], [im]]` |
| 기대 결과 | `[ ]` 상태만 반환 |
| 비즈니스 규칙 | BR-04 |

```python
@pytest.mark.asyncio
async def test_design_mode_only_todo_tasks():
    tasks = [
        Task(id="TSK-01-01", status="[ ]", priority=Priority.HIGH),
        Task(id="TSK-01-02", status="[dd]", priority=Priority.HIGH),
        Task(id="TSK-01-03", status="[im]", priority=Priority.HIGH),
    ]
    result = await filter_executable_tasks(tasks, ExecutionMode.DESIGN)
    assert len(result) == 1
    assert result[0].status == "[ ]"
```

#### TC-06: develop 모드 의존성 검사

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-06 |
| 테스트명 | test_develop_mode_checks_dependencies |
| 목적 | `[dd]` 이상 상태에서 depends 검사 확인 |
| 사전 조건 | TSK-01-02가 TSK-01-01에 의존, TSK-01-01은 `[dd]` 상태 |
| 입력 | `mode=DEVELOP` |
| 기대 결과 | TSK-01-02 제외 (의존성 미충족) |
| 비즈니스 규칙 | BR-05 |

```python
@pytest.mark.asyncio
async def test_develop_mode_checks_dependencies():
    tasks = [
        Task(id="TSK-01-01", status="[dd]", priority=Priority.HIGH),
        Task(id="TSK-01-02", status="[dd]", priority=Priority.HIGH, depends=["TSK-01-01"]),
    ]
    result = await filter_executable_tasks(tasks, ExecutionMode.DEVELOP)
    # TSK-01-02는 TSK-01-01이 [im] 이상이어야 포함됨
    assert len(result) == 1
    assert result[0].id == "TSK-01-01"
```

#### TC-07: force 모드 의존성 무시

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-07 |
| 테스트명 | test_force_mode_ignores_dependencies |
| 목적 | force 모드에서 모든 미완료 Task 포함 확인 |
| 사전 조건 | 의존성 설정된 Task 존재 |
| 입력 | `mode=FORCE` |
| 기대 결과 | 모든 미완료 Task 포함 |
| 비즈니스 규칙 | BR-06 |

```python
@pytest.mark.asyncio
async def test_force_mode_ignores_dependencies():
    tasks = [
        Task(id="TSK-01-01", status="[dd]", priority=Priority.HIGH),
        Task(id="TSK-01-02", status="[dd]", priority=Priority.HIGH, depends=["TSK-01-01"]),
    ]
    result = await filter_executable_tasks(tasks, ExecutionMode.FORCE)
    assert len(result) == 2
```

#### TC-08: 중복 분배 방지

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-08 |
| 테스트명 | test_no_duplicate_dispatch |
| 목적 | 동일 Task가 여러 번 분배되지 않음 확인 |
| 사전 조건 | Task가 이미 `running_tasks`에 있음 |
| 입력 | `running_tasks={"TSK-01-01"}` |
| 기대 결과 | TSK-01-01 제외 |
| 비즈니스 규칙 | BR-03 |

```python
@pytest.mark.asyncio
async def test_no_duplicate_dispatch():
    tasks = [
        Task(id="TSK-01-01", status="[ ]", priority=Priority.CRITICAL),
    ]
    # 첫 번째 호출
    result1 = await filter_executable_tasks(tasks, ExecutionMode.QUICK)
    assert len(result1) == 1

    # 분배 후 running_tasks에 추가
    result2 = await filter_executable_tasks(
        tasks, ExecutionMode.QUICK, running_tasks={"TSK-01-01"}
    )
    assert len(result2) == 0
```

### 2.2 get_workflow_steps 테스트

#### TC-09: design 모드 워크플로우

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-09 |
| 테스트명 | test_design_mode_workflow |
| 목적 | design 모드에서 `["start"]`만 반환 확인 |
| 입력 | `mode=DESIGN`, `task.status="[ ]"` |
| 기대 결과 | `["start"]` |

```python
def test_design_mode_workflow():
    task = Task(id="TSK-01-01", status="[ ]", priority=Priority.HIGH)
    steps = get_workflow_steps(task, ExecutionMode.DESIGN)
    assert steps == ["start"]
```

#### TC-10: quick 모드 워크플로우

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-10 |
| 테스트명 | test_quick_mode_workflow |
| 목적 | quick 모드에서 transitions만 반환 확인 |
| 입력 | `mode=QUICK` |
| 기대 결과 | `["start", "approve", "build", "done"]` |

```python
def test_quick_mode_workflow():
    task = Task(id="TSK-01-01", status="[ ]", priority=Priority.HIGH)
    steps = get_workflow_steps(task, ExecutionMode.QUICK)
    assert steps == ["start", "approve", "build", "done"]
```

#### TC-11: develop 모드 워크플로우

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-11 |
| 테스트명 | test_develop_mode_workflow |
| 목적 | develop 모드에서 full workflow 반환 확인 |
| 입력 | `mode=DEVELOP` |
| 기대 결과 | 9단계 워크플로우 |

```python
def test_develop_mode_workflow():
    task = Task(id="TSK-01-01", status="[ ]", priority=Priority.HIGH)
    steps = get_workflow_steps(task, ExecutionMode.DEVELOP)
    expected = ["start", "review", "apply", "approve", "build", "audit", "patch", "test", "done"]
    assert steps == expected
```

#### TC-12: force 모드 워크플로우

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-12 |
| 테스트명 | test_force_mode_workflow |
| 목적 | force 모드에서 quick과 동일한 워크플로우 확인 |
| 입력 | `mode=FORCE` |
| 기대 결과 | `["start", "approve", "build", "done"]` |

```python
def test_force_mode_workflow():
    task = Task(id="TSK-01-01", status="[ ]", priority=Priority.HIGH)
    steps = get_workflow_steps(task, ExecutionMode.FORCE)
    assert steps == ["start", "approve", "build", "done"]
```

### 2.3 dispatch_task 테스트

#### TC-13: Worker 상태 변경

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-13 |
| 테스트명 | test_dispatch_updates_worker_state |
| 목적 | dispatch 후 Worker가 busy 상태로 변경되는지 확인 |
| 사전 조건 | Worker가 idle 상태 |
| 기대 결과 | `worker.state == "busy"` |

```python
@pytest.mark.asyncio
async def test_dispatch_updates_worker_state():
    worker = Worker(id="W1", pane_id=1, state="idle")
    task = Task(id="TSK-01-01", status="[ ]", priority=Priority.HIGH)

    await dispatch_task(worker, task, ExecutionMode.QUICK)

    assert worker.state == "busy"
```

#### TC-14: current_task 설정

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-14 |
| 테스트명 | test_dispatch_sets_current_task |
| 목적 | dispatch 후 Worker의 current_task 설정 확인 |
| 기대 결과 | `worker.current_task == task.id` |

```python
@pytest.mark.asyncio
async def test_dispatch_sets_current_task():
    worker = Worker(id="W1", pane_id=1, state="idle")
    task = Task(id="TSK-01-01", status="[ ]", priority=Priority.HIGH)

    await dispatch_task(worker, task, ExecutionMode.QUICK)

    assert worker.current_task == "TSK-01-01"
```

#### TC-15: dispatch_time 기록

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-15 |
| 테스트명 | test_dispatch_records_time |
| 목적 | dispatch 후 dispatch_time 설정 확인 |
| 기대 결과 | `worker.dispatch_time is not None` |

```python
@pytest.mark.asyncio
async def test_dispatch_records_time():
    worker = Worker(id="W1", pane_id=1, state="idle")
    task = Task(id="TSK-01-01", status="[ ]", priority=Priority.HIGH)

    await dispatch_task(worker, task, ExecutionMode.QUICK)

    assert worker.dispatch_time is not None
```

### 2.4 check_dependencies_implemented 테스트

#### TC-16: 의존성 없는 Task

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-16 |
| 테스트명 | test_no_dependencies_returns_true |
| 목적 | depends가 없는 Task는 True 반환 확인 |
| 입력 | `task.depends = None` |
| 기대 결과 | `True` |

```python
def test_no_dependencies_returns_true():
    task = Task(id="TSK-01-01", status="[dd]", priority=Priority.HIGH)
    all_tasks = {"TSK-01-01": task}

    result = check_dependencies_implemented(task, all_tasks)
    assert result is True
```

#### TC-17: 의존성 충족

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-17 |
| 테스트명 | test_dependencies_implemented |
| 목적 | 선행 Task가 `[im]` 이상일 때 True 반환 확인 |
| 사전 조건 | 선행 Task 상태 `[im]` |
| 기대 결과 | `True` |

```python
def test_dependencies_implemented():
    task1 = Task(id="TSK-01-01", status="[im]", priority=Priority.HIGH)
    task2 = Task(id="TSK-01-02", status="[dd]", priority=Priority.HIGH, depends=["TSK-01-01"])
    all_tasks = {"TSK-01-01": task1, "TSK-01-02": task2}

    result = check_dependencies_implemented(task2, all_tasks)
    assert result is True
```

#### TC-18: 의존성 미충족

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-18 |
| 테스트명 | test_dependencies_not_implemented |
| 목적 | 선행 Task가 `[dd]` 상태일 때 False 반환 확인 |
| 사전 조건 | 선행 Task 상태 `[dd]` |
| 기대 결과 | `False` |

```python
def test_dependencies_not_implemented():
    task1 = Task(id="TSK-01-01", status="[dd]", priority=Priority.HIGH)
    task2 = Task(id="TSK-01-02", status="[dd]", priority=Priority.HIGH, depends=["TSK-01-01"])
    all_tasks = {"TSK-01-01": task1, "TSK-01-02": task2}

    result = check_dependencies_implemented(task2, all_tasks)
    assert result is False
```

---

## 3. 통합 테스트 케이스

### TC-INT-01: 정상적인 Task 분배 흐름

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-INT-01 |
| 테스트명 | test_integration_normal_dispatch_flow |
| 목적 | 필터링 → 워크플로우 결정 → 분배 전체 흐름 확인 |

```python
@pytest.mark.asyncio
async def test_integration_normal_dispatch_flow():
    # Setup
    tasks = [
        Task(id="TSK-01-01", status="[ ]", priority=Priority.CRITICAL),
        Task(id="TSK-01-02", status="[ ]", priority=Priority.HIGH),
    ]
    worker = Worker(id="W1", pane_id=1, state="idle")

    # Filter
    queue = await filter_executable_tasks(tasks, ExecutionMode.QUICK)
    assert len(queue) == 2
    assert queue[0].priority == Priority.CRITICAL

    # Get workflow
    steps = get_workflow_steps(queue[0], ExecutionMode.QUICK)
    assert steps == ["start", "approve", "build", "done"]

    # Dispatch
    await dispatch_task(worker, queue[0], ExecutionMode.QUICK)
    assert worker.state == "busy"
    assert worker.current_task == "TSK-01-01"
```

### TC-INT-02: 의존성으로 인한 필터링

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-INT-02 |
| 테스트명 | test_integration_dependency_filtering |
| 목적 | 의존성 미충족 Task가 큐에서 제외되는 전체 흐름 확인 |

```python
@pytest.mark.asyncio
async def test_integration_dependency_filtering():
    tasks = [
        Task(id="TSK-01-01", status="[dd]", priority=Priority.HIGH),
        Task(id="TSK-01-02", status="[dd]", priority=Priority.HIGH, depends=["TSK-01-01"]),
    ]

    # develop 모드: TSK-01-01이 [im] 미만이므로 TSK-01-02 제외
    queue = await filter_executable_tasks(tasks, ExecutionMode.DEVELOP)
    assert len(queue) == 1
    assert queue[0].id == "TSK-01-01"
```

### TC-INT-03: force 모드 전환

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-INT-03 |
| 테스트명 | test_integration_force_mode_switch |
| 목적 | force 모드 전환 시 의존성 무시 확인 |

```python
@pytest.mark.asyncio
async def test_integration_force_mode_switch():
    tasks = [
        Task(id="TSK-01-01", status="[dd]", priority=Priority.HIGH),
        Task(id="TSK-01-02", status="[dd]", priority=Priority.CRITICAL, depends=["TSK-01-01"]),
    ]

    # develop 모드: TSK-01-02 제외
    queue_develop = await filter_executable_tasks(tasks, ExecutionMode.DEVELOP)
    assert len(queue_develop) == 1

    # force 모드로 전환: 모든 Task 포함
    queue_force = await filter_executable_tasks(tasks, ExecutionMode.FORCE)
    assert len(queue_force) == 2
    assert queue_force[0].id == "TSK-01-02"  # critical 우선
```

---

## 4. 테스트 픽스처

```python
# tests/conftest.py

import pytest
from orchay.models.task import Task, Priority
from orchay.models.worker import Worker

@pytest.fixture
def sample_tasks():
    """테스트용 Task 목록"""
    return [
        Task(id="TSK-01-01", status="[ ]", priority=Priority.CRITICAL, category="development"),
        Task(id="TSK-01-02", status="[ ]", priority=Priority.HIGH, category="development", depends=["TSK-01-01"]),
        Task(id="TSK-01-03", status="[dd]", priority=Priority.MEDIUM, category="development"),
        Task(id="TSK-01-04", status="[im]", priority=Priority.LOW, category="development"),
        Task(id="TSK-01-05", status="[xx]", priority=Priority.HIGH, category="development"),
    ]

@pytest.fixture
def sample_workers():
    """테스트용 Worker 목록"""
    return [
        Worker(id="W1", pane_id=1, state="idle"),
        Worker(id="W2", pane_id=2, state="busy", current_task="TSK-99-99"),
        Worker(id="W3", pane_id=3, state="idle"),
    ]
```

---

## 5. 커버리지 목표

| 모듈 | 목표 커버리지 | 측정 방법 |
|------|-------------|----------|
| scheduler.py | 90% | pytest-cov |
| models/task.py | 80% | pytest-cov |
| models/worker.py | 80% | pytest-cov |

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-12-28 | Claude | 최초 작성 |
