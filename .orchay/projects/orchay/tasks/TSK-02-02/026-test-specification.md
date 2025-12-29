# TSK-02-02 - 테스트 명세서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-02 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-28 |

---

## 1. 테스트 전략

### 1.1 테스트 범위

| 테스트 유형 | 범위 | 도구 |
|------------|------|------|
| 단위 테스트 | 개별 위젯 렌더링, 데이터 바인딩 | pytest, textual.testing |
| UI 테스트 | 레이아웃, 색상, 스타일 | pytest-textual-snapshot |
| 통합 테스트 | 위젯 간 상호작용, 실시간 갱신 | pytest-asyncio |
| E2E 테스트 | 전체 TUI 플로우 | textual.testing |

### 1.2 테스트 환경

| 항목 | 요구사항 |
|------|---------|
| Python | >=3.10 |
| Textual | ^1.0 |
| 터미널 | 트루컬러 지원 (256색 폴백) |
| 화면 크기 | 최소 80x24 |

---

## 2. 단위 테스트 케이스

### TC-01: 헤더 위젯

#### TC-01-01: 헤더 기본 렌더링

| 항목 | 내용 |
|------|------|
| 목적 | Header 위젯이 올바르게 렌더링되는지 확인 |
| 사전 조건 | App 인스턴스 생성 |
| 테스트 단계 | 1. App 시작<br>2. Header 위젯 확인 |
| 예상 결과 | "orchay - Task Scheduler" 텍스트 표시 |
| 우선순위 | 높음 |

```python
async def test_header_renders():
    async with OrchayApp().run_test() as pilot:
        header = pilot.app.query_one(Header)
        assert "orchay" in header.title
```

#### TC-01-02: 헤더 모드 표시

| 항목 | 내용 |
|------|------|
| 목적 | 헤더에 현재 실행 모드가 표시되는지 확인 |
| 사전 조건 | mode="quick" 설정 |
| 테스트 단계 | 1. App 시작<br>2. 모드 표시 확인 |
| 예상 결과 | "[MODE: quick]" 텍스트 및 녹색 표시 |
| 우선순위 | 높음 |

```python
async def test_header_shows_mode():
    async with OrchayApp(mode="quick").run_test() as pilot:
        header = pilot.app.query_one("#mode-indicator")
        assert "quick" in header.render()
        assert header.styles.color == Color.parse("#22c55e")
```

---

### TC-02: 스케줄 큐 테이블

#### TC-02-01: DataTable 기본 렌더링

| 항목 | 내용 |
|------|------|
| 목적 | DataTable이 올바른 컬럼으로 렌더링되는지 확인 |
| 사전 조건 | Task 목록 제공 |
| 테스트 단계 | 1. App 시작<br>2. DataTable 컬럼 확인 |
| 예상 결과 | #, Task ID, Status, Category, Priority, Title 컬럼 존재 |
| 우선순위 | 높음 |

```python
async def test_queue_table_columns():
    async with OrchayApp().run_test() as pilot:
        table = pilot.app.query_one(DataTable)
        columns = [col.label for col in table.columns.values()]
        assert "#" in columns
        assert "Task ID" in columns
        assert "Status" in columns
```

#### TC-02-02: Task 데이터 표시

| 항목 | 내용 |
|------|------|
| 목적 | Task 데이터가 올바르게 테이블에 표시되는지 확인 |
| 사전 조건 | 테스트 Task 3개 제공 |
| 테스트 단계 | 1. App 시작<br>2. 행 데이터 확인 |
| 예상 결과 | 3개 행, 올바른 Task ID 표시 |
| 우선순위 | 높음 |

```python
async def test_queue_table_data():
    tasks = [
        Task(id="TSK-01-01", status="[ ]", category="development", priority="high"),
        Task(id="TSK-01-02", status="[dd]", category="development", priority="medium"),
        Task(id="TSK-02-01", status="[ ]", category="defect", priority="low"),
    ]
    async with OrchayApp(tasks=tasks).run_test() as pilot:
        table = pilot.app.query_one(DataTable)
        assert table.row_count == 3
        assert "TSK-01-01" in str(table.get_cell_at((0, 1)))
```

#### TC-02-03: 우선순위 정렬

| 항목 | 내용 |
|------|------|
| 목적 | Task가 우선순위순으로 정렬되는지 확인 |
| 사전 조건 | 다양한 우선순위의 Task 제공 |
| 테스트 단계 | 1. App 시작<br>2. 정렬 순서 확인 |
| 예상 결과 | critical > high > medium > low 순서 |
| 우선순위 | 중간 |

---

### TC-03: Worker 상태 패널

#### TC-03-01: Worker 목록 표시

| 항목 | 내용 |
|------|------|
| 목적 | Worker 패널에 모든 Worker가 표시되는지 확인 |
| 사전 조건 | 3개 Worker 설정 |
| 테스트 단계 | 1. App 시작<br>2. Worker 패널 확인 |
| 예상 결과 | Worker 1, 2, 3 표시 |
| 우선순위 | 높음 |

```python
async def test_worker_panel_shows_all_workers():
    async with OrchayApp(workers=3).run_test() as pilot:
        panel = pilot.app.query_one("#workers-panel")
        content = panel.render()
        assert "Worker 1" in content
        assert "Worker 2" in content
        assert "Worker 3" in content
```

#### TC-03-02: Worker 상태별 색상

| 항목 | 내용 |
|------|------|
| 목적 | Worker 상태에 따라 올바른 색상이 적용되는지 확인 |
| 사전 조건 | 각 상태의 Worker 설정 |
| 테스트 단계 | 1. Worker 상태 설정<br>2. 색상 확인 |
| 예상 결과 | idle=녹색, busy=청색, paused=황색, error=적색 |
| 우선순위 | 높음 |

```python
@pytest.mark.parametrize("state,expected_color", [
    ("idle", "#22c55e"),
    ("busy", "#3b82f6"),
    ("paused", "#f59e0b"),
    ("error", "#ef4444"),
])
async def test_worker_state_colors(state, expected_color):
    workers = [Worker(id=1, state=state)]
    async with OrchayApp(workers=workers).run_test() as pilot:
        indicator = pilot.app.query_one(f"#worker-1-indicator")
        assert indicator.styles.background == Color.parse(expected_color)
```

#### TC-03-03: 현재 Task 표시

| 항목 | 내용 |
|------|------|
| 목적 | busy 상태 Worker의 현재 Task가 표시되는지 확인 |
| 사전 조건 | Worker가 Task 실행 중 |
| 테스트 단계 | 1. Worker에 Task 할당<br>2. Task 정보 표시 확인 |
| 예상 결과 | "TSK-01-01 (build)" 형식으로 표시 |
| 우선순위 | 높음 |

---

### TC-04: 진행률 표시

#### TC-04-01: ProgressBar 렌더링

| 항목 | 내용 |
|------|------|
| 목적 | ProgressBar가 올바르게 렌더링되는지 확인 |
| 사전 조건 | 완료/전체 Task 수 설정 |
| 테스트 단계 | 1. App 시작<br>2. ProgressBar 확인 |
| 예상 결과 | 진행률 바 표시 |
| 우선순위 | 중간 |

```python
async def test_progress_bar_renders():
    async with OrchayApp(completed=4, total=9).run_test() as pilot:
        progress = pilot.app.query_one(ProgressBar)
        assert progress is not None
```

#### TC-04-02: 진행률 계산

| 항목 | 내용 |
|------|------|
| 목적 | 진행률이 올바르게 계산되는지 확인 |
| 사전 조건 | 완료 4개, 전체 9개 |
| 테스트 단계 | 1. 진행률 계산<br>2. 백분율 확인 |
| 예상 결과 | 44% (4/9) 표시 |
| 우선순위 | 중간 |

```python
async def test_progress_calculation():
    async with OrchayApp(completed=4, total=9).run_test() as pilot:
        progress = pilot.app.query_one(ProgressBar)
        assert abs(progress.percentage - 44.4) < 1
```

---

### TC-05: 상태바 (Footer)

#### TC-05-01: F-key 바인딩 표시

| 항목 | 내용 |
|------|------|
| 목적 | Footer에 F-key 바인딩이 표시되는지 확인 |
| 사전 조건 | App 시작 |
| 테스트 단계 | 1. Footer 확인 |
| 예상 결과 | F1:Help, F2:Status, ... F10:Exit 표시 |
| 우선순위 | 중간 |

```python
async def test_footer_shows_keybindings():
    async with OrchayApp().run_test() as pilot:
        footer = pilot.app.query_one(Footer)
        content = footer.render()
        assert "F1" in content and "Help" in content
        assert "F10" in content and "Exit" in content
```

---

### TC-06: 모드별 색상 표시

#### TC-06-01: 모드 색상 적용

| 항목 | 내용 |
|------|------|
| 목적 | 각 모드에 올바른 색상이 적용되는지 확인 |
| 사전 조건 | 각 모드 설정 |
| 테스트 단계 | 1. 모드별 App 시작<br>2. 색상 확인 |
| 예상 결과 | design=청색, quick=녹색, develop=보라, force=황색 |
| 우선순위 | 중간 |

```python
@pytest.mark.parametrize("mode,expected_color", [
    ("design", "#3b82f6"),
    ("quick", "#22c55e"),
    ("develop", "#8b5cf6"),
    ("force", "#f59e0b"),
])
async def test_mode_colors(mode, expected_color):
    async with OrchayApp(mode=mode).run_test() as pilot:
        indicator = pilot.app.query_one("#mode-indicator")
        assert indicator.styles.color == Color.parse(expected_color)
```

#### TC-06-02: 모드 전환 시 색상 변경

| 항목 | 내용 |
|------|------|
| 목적 | 모드 전환 시 색상이 변경되는지 확인 |
| 사전 조건 | design 모드로 시작 |
| 테스트 단계 | 1. F7 키 입력<br>2. 색상 변경 확인 |
| 예상 결과 | 다음 모드 색상으로 변경 |
| 우선순위 | 중간 |

---

### TC-07: 실시간 갱신

#### TC-07-01: Worker 상태 갱신

| 항목 | 내용 |
|------|------|
| 목적 | Worker 상태가 interval 간격으로 갱신되는지 확인 |
| 사전 조건 | interval=1초 설정 |
| 테스트 단계 | 1. Worker 상태 변경<br>2. 1초 후 UI 확인 |
| 예상 결과 | 변경된 상태가 UI에 반영 |
| 우선순위 | 높음 |

```python
async def test_worker_state_refresh():
    async with OrchayApp(interval=1).run_test() as pilot:
        # Initial state
        workers = pilot.app.workers
        workers[0].state = "idle"

        # Change state externally
        workers[0].state = "busy"

        # Wait for refresh
        await pilot.pause(1.5)

        indicator = pilot.app.query_one("#worker-1-indicator")
        assert "busy" in indicator.render()
```

#### TC-07-02: 큐 데이터 갱신

| 항목 | 내용 |
|------|------|
| 목적 | wbs.md 변경 시 큐가 갱신되는지 확인 |
| 사전 조건 | wbs.md 모니터링 활성화 |
| 테스트 단계 | 1. wbs.md 변경 이벤트 발생<br>2. 테이블 갱신 확인 |
| 예상 결과 | 변경된 Task 목록이 테이블에 반영 |
| 우선순위 | 높음 |

---

## 3. UI 스냅샷 테스트

### TC-UI-01: 메인 화면 스냅샷

| 항목 | 내용 |
|------|------|
| 목적 | 메인 화면 레이아웃이 일관되게 렌더링되는지 확인 |
| 도구 | pytest-textual-snapshot |
| 스냅샷 파일 | `tests/snapshots/main_screen.svg` |

```python
async def test_main_screen_snapshot(snap_compare):
    assert snap_compare("src/orchay/ui/app.py", terminal_size=(120, 40))
```

### TC-UI-02: 에러 상태 스냅샷

| 항목 | 내용 |
|------|------|
| 목적 | 에러 상태 화면이 일관되게 렌더링되는지 확인 |
| 도구 | pytest-textual-snapshot |
| 스냅샷 파일 | `tests/snapshots/error_state.svg` |

---

## 4. 통합 테스트 케이스

### TC-INT-01: 스케줄러 ↔ UI 연동

| 항목 | 내용 |
|------|------|
| 목적 | 스케줄러 이벤트가 UI에 반영되는지 확인 |
| 사전 조건 | 스케줄러 코어와 UI 통합 |
| 테스트 단계 | 1. Task 분배 이벤트 발생<br>2. Worker 패널 갱신 확인<br>3. 큐 테이블 갱신 확인 |
| 예상 결과 | 모든 UI 요소가 동기화됨 |
| 우선순위 | 높음 |

### TC-INT-02: Config ↔ UI 연동

| 항목 | 내용 |
|------|------|
| 목적 | 설정 값이 UI에 올바르게 반영되는지 확인 |
| 사전 조건 | orchay.json 설정 파일 존재 |
| 테스트 단계 | 1. 설정 로드<br>2. Worker 수, 모드 등 확인 |
| 예상 결과 | 설정 값이 UI에 반영됨 |
| 우선순위 | 중간 |

---

## 5. E2E 테스트 케이스

### TC-E2E-01: 전체 플로우

| 항목 | 내용 |
|------|------|
| 목적 | App 시작부터 종료까지 전체 플로우 확인 |
| 테스트 단계 | 1. App 시작<br>2. 화면 렌더링 확인<br>3. 상태 갱신 확인<br>4. F10 종료<br>5. 정상 종료 확인 |
| 예상 결과 | 오류 없이 모든 단계 완료 |
| 우선순위 | 높음 |

```python
async def test_full_flow():
    async with OrchayApp().run_test() as pilot:
        # Check initial render
        assert pilot.app.query_one(Header)
        assert pilot.app.query_one(DataTable)
        assert pilot.app.query_one(Footer)

        # Wait for status update
        await pilot.pause(2)

        # Exit
        await pilot.press("f10")

        # Verify clean exit
        assert not pilot.app.is_running
```

---

## 6. 테스트 매트릭스

| 테스트 ID | 요구사항 | 유형 | 우선순위 | 자동화 |
|----------|---------|------|---------|--------|
| TC-01-01 | REQ-01 | 단위 | 높음 | O |
| TC-01-02 | REQ-01, REQ-06 | 단위 | 높음 | O |
| TC-02-01 | REQ-02 | 단위 | 높음 | O |
| TC-02-02 | REQ-02 | 단위 | 높음 | O |
| TC-02-03 | REQ-02 | 단위 | 중간 | O |
| TC-03-01 | REQ-03 | 단위 | 높음 | O |
| TC-03-02 | REQ-03 | 단위 | 높음 | O |
| TC-03-03 | REQ-03 | 단위 | 높음 | O |
| TC-04-01 | REQ-04 | 단위 | 중간 | O |
| TC-04-02 | REQ-04 | 단위 | 중간 | O |
| TC-05-01 | REQ-05 | UI | 중간 | O |
| TC-06-01 | REQ-06 | UI | 중간 | O |
| TC-06-02 | REQ-06 | UI | 중간 | O |
| TC-07-01 | REQ-07 | 통합 | 높음 | O |
| TC-07-02 | REQ-07 | 통합 | 높음 | O |
| TC-UI-01 | 전체 | 스냅샷 | 중간 | O |
| TC-UI-02 | 에러 처리 | 스냅샷 | 낮음 | O |
| TC-INT-01 | REQ-07 | 통합 | 높음 | O |
| TC-INT-02 | 설정 | 통합 | 중간 | O |
| TC-E2E-01 | 전체 | E2E | 높음 | O |

---

## 7. 테스트 실행 명령

```bash
# 전체 테스트
pytest tests/test_ui/

# 단위 테스트만
pytest tests/test_ui/test_widgets.py

# 스냅샷 테스트 (갱신)
pytest tests/test_ui/test_snapshots.py --snapshot-update

# 커버리지 포함
pytest tests/test_ui/ --cov=src/orchay/ui --cov-report=html
```

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-12-28 | Claude | 최초 작성 |
