# TSK-02-05 - 테스트 명세서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-05 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-28 |

---

## 1. 테스트 전략

### 1.1 테스트 범위

| 테스트 유형 | 범위 | 도구 | 목표 커버리지 |
|------------|------|------|-------------|
| 단위 테스트 | 개별 모듈 함수 | pytest | 80% |
| 통합 테스트 | 모듈 간 상호작용 | pytest-asyncio | 주요 플로우 |
| TUI 테스트 | Textual 위젯 | textual.testing | 핵심 위젯 |
| 스냅샷 테스트 | UI 레이아웃 | pytest-textual-snapshot | 주요 화면 |

### 1.2 테스트 환경

| 항목 | 요구사항 |
|------|---------|
| Python | >=3.10 |
| pytest | >=8.0 |
| pytest-asyncio | >=0.23 |
| pytest-textual-snapshot | >=1.0 |
| pytest-cov | >=4.0 |

---

## 2. 단위 테스트 케이스

### 2.1 WBS 파서 테스트 (test_wbs_parser.py)

#### TC-UNIT-01: parse_wbs 기본 파싱

| 항목 | 내용 |
|------|------|
| 목적 | wbs.md 파일을 파싱하여 Task 목록 반환 |
| 사전 조건 | 유효한 wbs.md 파일 |
| 테스트 단계 | 1. wbs.md 로드<br>2. parse_wbs() 호출 |
| 예상 결과 | Task 리스트 반환 |
| 우선순위 | 높음 |

```python
def test_parse_wbs_basic(temp_wbs_file):
    tasks = parse_wbs(temp_wbs_file)
    assert len(tasks) >= 2
    assert tasks[0].id == "TSK-01-01"
```

#### TC-UNIT-02: Task ID 추출

| 항목 | 내용 |
|------|------|
| 목적 | Task ID 패턴 정확히 추출 |
| 예상 결과 | TSK-XX-XX 또는 TSK-XX-XX-XX 형식 |

```python
@pytest.mark.parametrize("line,expected", [
    ("### TSK-01-01: 테스트", "TSK-01-01"),
    ("### TSK-01-01-01: 테스트", "TSK-01-01-01"),
])
def test_extract_task_id(line, expected):
    task_id = extract_task_id(line)
    assert task_id == expected
```

#### TC-UNIT-03: 상태 코드 파싱

| 항목 | 내용 |
|------|------|
| 목적 | 상태 코드 정확히 파싱 |
| 예상 결과 | [ ], [dd], [ap], [im], [xx] 등 |

```python
@pytest.mark.parametrize("status_line,expected", [
    ("- status: [ ]", "[ ]"),
    ("- status: detail-design [dd]", "[dd]"),
    ("- status: approved [ap]", "[ap]"),
    ("- status: implement [im]", "[im]"),
    ("- status: done [xx]", "[xx]"),
])
def test_parse_status(status_line, expected):
    status = parse_status(status_line)
    assert status == expected
```

#### TC-UNIT-04: category 추출

```python
@pytest.mark.parametrize("line,expected", [
    ("- category: development", "development"),
    ("- category: defect", "defect"),
    ("- category: infrastructure", "infrastructure"),
])
def test_parse_category(line, expected):
    category = parse_category(line)
    assert category == expected
```

#### TC-UNIT-05: priority 추출

```python
@pytest.mark.parametrize("line,expected", [
    ("- priority: critical", "critical"),
    ("- priority: high", "high"),
    ("- priority: medium", "medium"),
    ("- priority: low", "low"),
])
def test_parse_priority(line, expected):
    priority = parse_priority(line)
    assert priority == expected
```

#### TC-UNIT-06: depends 파싱

```python
def test_parse_depends():
    line = "- depends: TSK-01-01, TSK-01-02"
    depends = parse_depends(line)
    assert depends == ["TSK-01-01", "TSK-01-02"]
```

#### TC-UNIT-07: 빈 depends

```python
def test_parse_depends_empty():
    line = "- depends: -"
    depends = parse_depends(line)
    assert depends == []
```

#### TC-UNIT-08: 잘못된 형식 처리

```python
def test_parse_invalid_format():
    with pytest.raises(ParseError):
        parse_wbs("invalid content")
```

---

### 2.2 스케줄러 테스트 (test_scheduler.py)

#### TC-UNIT-16: filter_executable_tasks 기본

| 항목 | 내용 |
|------|------|
| 목적 | 실행 가능한 Task만 필터링 |
| 예상 결과 | 완료/blocked/실행중 제외 |

```python
def test_filter_executable_tasks(sample_tasks):
    executable = filter_executable_tasks(sample_tasks, mode="quick")
    assert all(t.status != "[xx]" for t in executable)
    assert all(not t.blocked_by for t in executable)
```

#### TC-UNIT-17: design 모드 필터링

```python
def test_filter_design_mode(sample_tasks):
    executable = filter_executable_tasks(sample_tasks, mode="design")
    assert all(t.status == "[ ]" for t in executable)
```

#### TC-UNIT-18: develop 모드 의존성 확인

```python
def test_filter_develop_mode_dependencies(sample_tasks):
    # TSK-01-02가 TSK-01-01에 의존하고 TSK-01-01이 완료되지 않았으면 제외
    executable = filter_executable_tasks(sample_tasks, mode="develop")
    # 설계 단계([ ])는 의존성 무시
    # 구현 단계([dd] 이상)는 의존성 확인
```

#### TC-UNIT-19: force 모드 의존성 무시

```python
def test_filter_force_mode(sample_tasks):
    executable = filter_executable_tasks(sample_tasks, mode="force")
    # 의존성 무시하고 모든 미완료 Task 포함
    assert len(executable) >= 2
```

#### TC-UNIT-20: 우선순위 정렬

```python
def test_sort_by_priority(sample_tasks):
    sorted_tasks = sort_by_priority(sample_tasks)
    priorities = [t.priority for t in sorted_tasks]
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    assert priorities == sorted(priorities, key=lambda p: priority_order[p])
```

#### TC-UNIT-21: get_workflow_steps design

```python
def test_get_workflow_steps_design():
    task = Task(id="TSK-01-01", status="[ ]", category="development")
    steps = get_workflow_steps(task, mode="design")
    assert steps == ["start"]
```

#### TC-UNIT-22: get_workflow_steps quick

```python
def test_get_workflow_steps_quick():
    task = Task(id="TSK-01-01", status="[ ]", category="development")
    steps = get_workflow_steps(task, mode="quick")
    assert steps == ["start", "approve", "build", "done"]
```

---

### 2.3 Worker 테스트 (test_worker.py)

#### TC-UNIT-28: Worker 상태 초기화

```python
def test_worker_init():
    worker = Worker(id=1, pane_id=1)
    assert worker.state == "idle"
    assert worker.current_task is None
```

#### TC-UNIT-29: Worker 상태 변경

```python
def test_worker_state_change():
    worker = Worker(id=1, pane_id=1)
    worker.state = "busy"
    worker.current_task = "TSK-01-01"
    assert worker.state == "busy"
    assert worker.current_task == "TSK-01-01"
```

---

### 2.4 WezTerm 래퍼 테스트 (test_wezterm.py)

#### TC-UNIT-38: detect_worker_state - idle

```python
async def test_detect_worker_state_idle(mocker):
    mocker.patch("orchay.utils.wezterm.wezterm_get_text", return_value="> ")
    state, info = await detect_worker_state(1)
    assert state == "idle"
```

#### TC-UNIT-39: detect_worker_state - done

```python
async def test_detect_worker_state_done(mocker):
    output = "ORCHAY_DONE:TSK-01-01:build:success"
    mocker.patch("orchay.utils.wezterm.wezterm_get_text", return_value=output)
    state, info = await detect_worker_state(1)
    assert state == "done"
    assert info["task_id"] == "TSK-01-01"
    assert info["action"] == "build"
    assert info["status"] == "success"
```

#### TC-UNIT-40: detect_worker_state - paused

```python
async def test_detect_worker_state_paused(mocker):
    output = "rate limit reached, please wait"
    mocker.patch("orchay.utils.wezterm.wezterm_get_text", return_value=output)
    state, info = await detect_worker_state(1)
    assert state == "paused"
```

#### TC-UNIT-41: detect_worker_state - error

```python
async def test_detect_worker_state_error(mocker):
    output = "Error: Something went wrong"
    mocker.patch("orchay.utils.wezterm.wezterm_get_text", return_value=output)
    state, info = await detect_worker_state(1)
    assert state == "error"
```

---

### 2.5 Config 테스트 (test_config.py)

#### TC-UNIT-46: Config 기본값

```python
def test_config_defaults():
    config = Config()
    assert config.workers == 3
    assert config.interval == 5
    assert config.mode == "quick"
```

#### TC-UNIT-47: Config 로드

```python
def test_load_config(tmp_path):
    config_path = tmp_path / "orchay.json"
    config_path.write_text('{"workers": 5, "interval": 10}')
    config = load_config(config_path)
    assert config.workers == 5
    assert config.interval == 10
```

#### TC-UNIT-48: Config 유효성 검사

```python
def test_config_validation():
    with pytest.raises(ValidationError):
        Config(workers=0)  # 최소 1
    with pytest.raises(ValidationError):
        Config(interval=-1)  # 양수
```

---

## 3. 통합 테스트 케이스

### 3.1 Task 분배 플로우 (test_integration.py)

#### TC-INT-01: wbs 파싱 → 큐 생성 → 분배

```python
async def test_wbs_to_dispatch_flow(temp_wbs_file, sample_workers):
    # 1. WBS 파싱
    tasks = parse_wbs(temp_wbs_file)

    # 2. 큐 생성
    queue = filter_executable_tasks(tasks, mode="quick")
    queue = sort_by_priority(queue)

    # 3. 분배 (mock)
    idle_workers = [w for w in sample_workers if w.state == "idle"]
    assert len(idle_workers) > 0

    # 분배 결과 확인
    assert queue[0] is not None
```

#### TC-INT-02: 상태 변경 → 큐 갱신

```python
async def test_status_change_triggers_queue_update():
    # wbs.md 변경 감지 → 큐 자동 갱신
    pass
```

#### TC-INT-03: Worker 완료 → 다음 Task 분배

```python
async def test_worker_completion_triggers_next_dispatch():
    # ORCHAY_DONE 감지 → 다음 Task 분배
    pass
```

---

## 4. TUI 테스트 케이스

### 4.1 App 테스트 (test_ui/test_app.py)

#### TC-UI-01: App 시작

```python
async def test_app_starts():
    async with OrchayApp().run_test() as pilot:
        assert pilot.app.is_running
```

#### TC-UI-02: 헤더 렌더링

```python
async def test_header_renders():
    async with OrchayApp().run_test() as pilot:
        header = pilot.app.query_one(Header)
        assert "orchay" in str(header.title)
```

#### TC-UI-03: DataTable 존재

```python
async def test_datatable_exists():
    async with OrchayApp().run_test() as pilot:
        table = pilot.app.query_one(DataTable)
        assert table is not None
```

#### TC-UI-04: Footer 키바인딩

```python
async def test_footer_keybindings():
    async with OrchayApp().run_test() as pilot:
        footer = pilot.app.query_one(Footer)
        content = str(footer.render())
        assert "F1" in content
        assert "F10" in content
```

#### TC-UI-05: F10 종료

```python
async def test_f10_exits():
    async with OrchayApp().run_test() as pilot:
        await pilot.press("f10")
        assert not pilot.app.is_running
```

---

## 5. 스냅샷 테스트

### TC-SNAP-01: 메인 화면 스냅샷

```python
async def test_main_screen_snapshot(snap_compare):
    assert snap_compare("src/orchay/ui/app.py", terminal_size=(120, 40))
```

### TC-SNAP-02: 에러 상태 스냅샷

```python
async def test_error_state_snapshot(snap_compare):
    # Worker 에러 상태 화면
    pass
```

---

## 6. 문서화 테스트

### TC-DOC-01: README 검증 (수동)

| 항목 | 확인 사항 |
|------|----------|
| 설치 가이드 | uv pip install -e . 동작 확인 |
| 사용법 | python -m orchay 실행 확인 |
| 설정 | orchay.json 설명 확인 |
| 명령어 | Function Key 바인딩 표 확인 |

---

## 7. 테스트 실행 명령

```bash
# 전체 테스트
pytest tests/

# 단위 테스트만
pytest tests/test_*.py -v

# 통합 테스트
pytest tests/test_integration.py -v

# TUI 테스트
pytest tests/test_ui/ -v

# 스냅샷 테스트 (갱신)
pytest tests/test_ui/test_snapshots.py --snapshot-update

# 커버리지
pytest tests/ --cov=src/orchay --cov-report=html --cov-fail-under=80
```

---

## 8. 테스트 매트릭스

| 테스트 ID | 모듈 | 유형 | 우선순위 | 자동화 |
|----------|------|------|---------|--------|
| TC-UNIT-01~08 | wbs_parser | 단위 | 높음 | O |
| TC-UNIT-16~22 | scheduler | 단위 | 높음 | O |
| TC-UNIT-28~29 | worker | 단위 | 높음 | O |
| TC-UNIT-38~41 | wezterm | 단위 | 높음 | O |
| TC-UNIT-46~48 | config | 단위 | 중간 | O |
| TC-INT-01~03 | 통합 | 통합 | 높음 | O |
| TC-UI-01~05 | TUI | UI | 중간 | O |
| TC-SNAP-01~02 | 스냅샷 | UI | 낮음 | O |
| TC-DOC-01 | README | 문서 | 중간 | X |

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-12-28 | Claude | 최초 작성 |
