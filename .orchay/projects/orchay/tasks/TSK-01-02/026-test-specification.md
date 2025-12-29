# TSK-01-02 - 테스트 명세서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-01-02 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-28 |

---

## 1. 단위 테스트

### TC-01: 정상 wbs.md 파싱

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-01 |
| 테스트 대상 | `parse_wbs()` |
| 사전 조건 | 유효한 wbs.md 파일 존재 |
| 테스트 데이터 | fixtures/valid_wbs.md |
| 기대 결과 | Task 리스트 반환, 모든 속성 정확히 파싱 |

```python
async def test_parse_wbs_valid():
    tasks = await parse_wbs("fixtures/valid_wbs.md")

    assert len(tasks) == 9  # orchay wbs.md 기준
    assert tasks[0].id == "TSK-01-01"
    assert tasks[0].category == "infrastructure"
    assert tasks[0].status_code == "[ ]"
    assert tasks[0].priority == "critical"
```

---

### TC-02: 파일 없음 처리

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-02 |
| 테스트 대상 | `parse_wbs()` |
| 사전 조건 | 파일 경로가 존재하지 않음 |
| 테스트 데이터 | "nonexistent.md" |
| 기대 결과 | 빈 리스트 반환, 경고 로그 |

```python
async def test_parse_wbs_file_not_found():
    tasks = await parse_wbs("nonexistent.md")

    assert tasks == []
```

---

### TC-03: 파싱 오류 시 캐시 반환

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-03 |
| 테스트 대상 | `parse_wbs()` |
| 사전 조건 | 첫 번째 파싱 성공 후 파일 손상 |
| 테스트 데이터 | fixtures/valid_wbs.md → fixtures/corrupted_wbs.md |
| 기대 결과 | 이전 캐시된 결과 반환 |

```python
async def test_parse_wbs_cache_on_error():
    parser = WbsParser("fixtures/valid_wbs.md")

    # 첫 번째 파싱 성공
    tasks1 = await parser.parse()
    assert len(tasks1) > 0

    # 파일 손상 시뮬레이션
    parser._path = "fixtures/corrupted_wbs.md"

    # 캐시 반환
    tasks2 = await parser.parse()
    assert tasks2 == tasks1
```

---

### TC-06: 모든 속성 파싱

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-06 |
| 테스트 대상 | `Task` 모델 |
| 사전 조건 | 모든 속성이 포함된 Task 블록 |
| 기대 결과 | 모든 필드 정확히 매핑 |

```python
async def test_task_all_attributes():
    tasks = await parse_wbs("fixtures/full_attributes_wbs.md")
    task = tasks[0]

    assert task.id == "TSK-01-02"
    assert task.title == "WBS 파서 구현"
    assert task.category == "development"
    assert task.domain == "backend"
    assert task.status_code == "[ ]"
    assert task.priority == "critical"
    assert task.assignee == "-"
    assert "parser" in task.tags
    assert "TSK-01-01" in task.depends
```

---

### TC-07: 모든 상태 기호 인식

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-07 |
| 테스트 대상 | `extract_status_code()` |
| 사전 조건 | - |
| 기대 결과 | 모든 상태 기호 정확히 추출 |

```python
@pytest.mark.parametrize("input_line,expected", [
    ("- status: [ ]", "[ ]"),
    ("- status: todo [ ]", "[ ]"),
    ("- status: detail-design [dd]", "[dd]"),
    ("- status: implement [im]", "[im]"),
    ("- status: done [xx]", "[xx]"),
    ("- status: analysis [an]", "[an]"),
    ("- status: fix [fx]", "[fx]"),
    ("- status: verify [vf]", "[vf]"),
    ("- status: approve [ap]", "[ap]"),
    ("- status: design [ds]", "[ds]"),
    ("- status: basic-design [bd]", "[bd]"),
])
def test_extract_status_code(input_line: str, expected: str):
    assert extract_status_code(input_line) == expected
```

---

## 2. 통합 테스트

### TC-04: 파일 변경 감지 및 콜백

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-04 |
| 테스트 대상 | `watch_wbs()` |
| 사전 조건 | wbs.md 파일 존재 |
| 기대 결과 | 파일 수정 시 콜백 호출 |

```python
async def test_watch_wbs_callback(tmp_path):
    wbs_file = tmp_path / "wbs.md"
    wbs_file.write_text("### TSK-01-01: Test\n- status: [ ]")

    callback_called = asyncio.Event()
    received_tasks = []

    async def on_change(tasks: list[Task]):
        received_tasks.extend(tasks)
        callback_called.set()

    watcher = watch_wbs(str(wbs_file), on_change)
    watcher.start()

    try:
        # 파일 수정
        await asyncio.sleep(0.1)
        wbs_file.write_text("### TSK-01-01: Test\n- status: [im]")

        # 콜백 대기
        await asyncio.wait_for(callback_called.wait(), timeout=3.0)

        assert len(received_tasks) > 0
        assert received_tasks[-1].status_code == "[im]"
    finally:
        watcher.stop()
```

---

### TC-05: 디바운싱 동작

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-05 |
| 테스트 대상 | `watch_wbs()` 디바운싱 |
| 사전 조건 | wbs.md 파일 존재 |
| 기대 결과 | 연속 수정 시 마지막 1회만 콜백 |

```python
async def test_watch_wbs_debounce(tmp_path):
    wbs_file = tmp_path / "wbs.md"
    wbs_file.write_text("### TSK-01-01: Test\n- status: [ ]")

    callback_count = 0

    async def on_change(tasks: list[Task]):
        nonlocal callback_count
        callback_count += 1

    watcher = watch_wbs(str(wbs_file), on_change, debounce=0.5)
    watcher.start()

    try:
        # 빠른 연속 수정 (5회)
        for i in range(5):
            wbs_file.write_text(f"### TSK-01-01: Test {i}\n- status: [ ]")
            await asyncio.sleep(0.1)

        # 디바운스 대기
        await asyncio.sleep(1.0)

        # 1회만 호출되어야 함
        assert callback_count == 1
    finally:
        watcher.stop()
```

---

## 3. 테스트 픽스처

### fixtures/valid_wbs.md

```markdown
# WBS - Test Project

## WP-01: Work Package 1

### TSK-01-01: Task 1
- category: infrastructure
- status: [ ]
- priority: critical

### TSK-01-02: Task 2
- category: development
- status: [ ]
- priority: critical
- depends: TSK-01-01
```

### fixtures/corrupted_wbs.md

```markdown
# Invalid WBS
### TSK-01-01
- status: [invalid
- category:
```

---

## 4. 테스트 커버리지 목표

| 모듈 | 목표 커버리지 |
|------|-------------|
| wbs_parser.py | 90% |
| models/task.py | 95% |

---

## 5. 테스트 실행 명령

```bash
cd orchay
uv run pytest tests/test_wbs_parser.py -v --cov=orchay.wbs_parser
```
