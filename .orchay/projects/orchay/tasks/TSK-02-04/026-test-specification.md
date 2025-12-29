# TSK-02-04 - 테스트 명세서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-04 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-28 |

---

## 1. 테스트 범위

### 1.1 테스트 대상

| 모듈 | 파일 | 테스트 유형 |
|------|------|-----------|
| Config 모델 | `models/config.py` | 단위 테스트 |
| 설정 로드 | `utils/config.py` | 단위 테스트 |
| 히스토리 관리 | `utils/history.py` | 단위 테스트 |
| CLI 파싱 | `main.py` | 단위 테스트 |
| 전체 흐름 | `main.py` | 통합 테스트 |

### 1.2 테스트 제외

- TUI 화면 렌더링 (별도 Task에서 처리)
- WezTerm CLI 연동 (mocking 처리)

---

## 2. 단위 테스트

### TC-01: Config 모델 기본값

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-01 |
| 테스트 대상 | `Config` 클래스 |
| 사전 조건 | 없음 |
| 입력 | `Config()` (인자 없이 생성) |
| 예상 결과 | workers=3, interval=5, execution.mode="quick" |
| 검증 방법 | assert 비교 |

```python
def test_config_default_values():
    config = Config()
    assert config.workers == 3
    assert config.interval == 5
    assert config.execution.mode == "quick"
    assert config.detection.readLines == 50
    assert config.history.maxEntries == 1000
```

### TC-02: Config Pydantic 검증

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-02 |
| 테스트 대상 | `Config` 스키마 검증 |
| 사전 조건 | 없음 |
| 입력 | 잘못된 값 (workers=-1, mode="invalid") |
| 예상 결과 | ValidationError 발생 |
| 검증 방법 | pytest.raises |

```python
def test_config_validation_error():
    with pytest.raises(ValidationError):
        Config(workers=-1)

    with pytest.raises(ValidationError):
        Config(workers=100)  # max 10 초과

    with pytest.raises(ValidationError):
        Config(execution={"mode": "invalid"})
```

### TC-03: load_config() 파일 존재

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-03 |
| 테스트 대상 | `load_config()` 함수 |
| 사전 조건 | 유효한 orchay.json 파일 존재 |
| 입력 | 함수 호출 |
| 예상 결과 | 파일 내용 반영된 Config 객체 |
| 검증 방법 | assert 비교 |

```python
def test_load_config_from_file(tmp_path, monkeypatch):
    # .orchay/settings/orchay.json 생성
    settings_dir = tmp_path / ".orchay" / "settings"
    settings_dir.mkdir(parents=True)
    config_file = settings_dir / "orchay.json"
    config_file.write_text('{"workers": 5, "interval": 10}')

    monkeypatch.chdir(tmp_path)

    config = load_config()
    assert config.workers == 5
    assert config.interval == 10
```

### TC-04: load_config() 파일 없음

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-04 |
| 테스트 대상 | `load_config()` 함수 |
| 사전 조건 | orchay.json 파일 없음, .orchay 폴더 존재 |
| 입력 | 함수 호출 |
| 예상 결과 | 기본값 Config 객체 반환 |
| 검증 방법 | assert 기본값 |

```python
def test_load_config_default_when_missing(tmp_path, monkeypatch):
    # .orchay 폴더만 생성 (설정 파일 없음)
    orchay_dir = tmp_path / ".orchay"
    orchay_dir.mkdir()

    monkeypatch.chdir(tmp_path)

    config = load_config()
    assert config.workers == 3  # 기본값
    assert config.interval == 5
```

### TC-05: load_config() JSON 파싱 오류

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-05 |
| 테스트 대상 | `load_config()` 함수 |
| 사전 조건 | 잘못된 JSON 형식 파일 |
| 입력 | 함수 호출 |
| 예상 결과 | RuntimeError 발생 |
| 검증 방법 | pytest.raises |

```python
def test_load_config_invalid_json(tmp_path, monkeypatch):
    settings_dir = tmp_path / ".orchay" / "settings"
    settings_dir.mkdir(parents=True)
    config_file = settings_dir / "orchay.json"
    config_file.write_text('{ invalid json }')

    monkeypatch.chdir(tmp_path)

    with pytest.raises(RuntimeError):
        load_config()
```

### TC-06: parse_args() 기본 실행

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-06 |
| 테스트 대상 | `parse_args()` 함수 |
| 사전 조건 | 없음 |
| 입력 | 빈 인자 리스트 |
| 예상 결과 | project="orchay", dry_run=False |
| 검증 방법 | assert 비교 |

```python
def test_parse_args_default(monkeypatch):
    monkeypatch.setattr("sys.argv", ["orchay"])
    args = parse_args()
    assert args.project == "orchay"
    assert args.dry_run is False
    assert args.workers is None
```

### TC-07: parse_args() 옵션 파싱

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-07 |
| 테스트 대상 | `parse_args()` 함수 |
| 사전 조건 | 없음 |
| 입력 | `-w 2 -m develop --dry-run` |
| 예상 결과 | workers=2, mode="develop", dry_run=True |
| 검증 방법 | assert 비교 |

```python
def test_parse_args_with_options(monkeypatch):
    monkeypatch.setattr("sys.argv", ["orchay", "-w", "2", "-m", "develop", "--dry-run"])
    args = parse_args()
    assert args.workers == 2
    assert args.mode == "develop"
    assert args.dry_run is True
```

### TC-08: parse_args() history 서브커맨드

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-08 |
| 테스트 대상 | `parse_args()` 함수 |
| 사전 조건 | 없음 |
| 입력 | `history TSK-01-01 --limit 20` |
| 예상 결과 | command="history", task_id="TSK-01-01", limit=20 |
| 검증 방법 | assert 비교 |

```python
def test_parse_args_history_subcommand(monkeypatch):
    monkeypatch.setattr("sys.argv", ["orchay", "history", "TSK-01-01", "--limit", "20"])
    args = parse_args()
    assert args.command == "history"
    assert args.task_id == "TSK-01-01"
    assert args.limit == 20
```

### TC-09: HistoryManager.save()

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-09 |
| 테스트 대상 | `HistoryManager.save()` |
| 사전 조건 | 빈 히스토리 파일 |
| 입력 | HistoryEntry 객체 |
| 예상 결과 | JSON Lines 형식으로 저장됨 |
| 검증 방법 | 파일 내용 확인 |

```python
def test_history_manager_save(tmp_path):
    storage_path = tmp_path / "history.jsonl"
    manager = HistoryManager(str(storage_path))

    entry = HistoryEntry(
        task_id="TSK-01-01",
        command="build",
        result="success",
        worker_id=1,
        timestamp="2025-12-28 12:00:00",
        output="Build completed"
    )
    manager.save(entry)

    content = storage_path.read_text()
    assert "TSK-01-01" in content
    assert "build" in content
```

### TC-10: HistoryManager.list()

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-10 |
| 테스트 대상 | `HistoryManager.list()` |
| 사전 조건 | 여러 항목이 저장된 히스토리 파일 |
| 입력 | limit=5 |
| 예상 결과 | 최근 5개 항목 반환 (최신순) |
| 검증 방법 | 리스트 길이, 순서 확인 |

```python
def test_history_manager_list(tmp_path):
    storage_path = tmp_path / "history.jsonl"
    manager = HistoryManager(str(storage_path))

    # 10개 항목 저장
    for i in range(10):
        entry = HistoryEntry(
            task_id=f"TSK-01-{i:02d}",
            command="build",
            result="success",
            worker_id=1,
            timestamp=f"2025-12-28 12:{i:02d}:00",
            output=""
        )
        manager.save(entry)

    result = manager.list(limit=5)
    assert len(result) == 5
    assert result[0]["task_id"] == "TSK-01-09"  # 최신
```

### TC-11: HistoryManager.get()

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-11 |
| 테스트 대상 | `HistoryManager.get()` |
| 사전 조건 | 특정 Task ID가 저장된 히스토리 |
| 입력 | task_id="TSK-01-05" |
| 예상 결과 | 해당 Task 항목 반환 |
| 검증 방법 | dict 내용 확인 |

```python
def test_history_manager_get(tmp_path):
    storage_path = tmp_path / "history.jsonl"
    manager = HistoryManager(str(storage_path))

    entry = HistoryEntry(
        task_id="TSK-01-05",
        command="verify",
        result="success",
        worker_id=2,
        timestamp="2025-12-28 15:00:00",
        output="Test passed"
    )
    manager.save(entry)

    result = manager.get("TSK-01-05")
    assert result is not None
    assert result["task_id"] == "TSK-01-05"
    assert result["output"] == "Test passed"

    # 존재하지 않는 ID
    assert manager.get("TSK-99-99") is None
```

### TC-12: HistoryManager.clear()

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-12 |
| 테스트 대상 | `HistoryManager.clear()` |
| 사전 조건 | 히스토리 파일 존재 |
| 입력 | 함수 호출 |
| 예상 결과 | 파일 삭제됨 |
| 검증 방법 | 파일 존재 여부 확인 |

```python
def test_history_manager_clear(tmp_path):
    storage_path = tmp_path / "history.jsonl"
    storage_path.write_text('{"task_id": "test"}')

    manager = HistoryManager(str(storage_path))
    manager.clear()

    assert not storage_path.exists()
```

### TC-13: 히스토리 로테이션

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-13 |
| 테스트 대상 | `HistoryManager.save()` |
| 사전 조건 | maxEntries=5 |
| 입력 | 10개 항목 저장 |
| 예상 결과 | 최근 5개만 유지 |
| 검증 방법 | 파일 라인 수 확인 |

```python
def test_history_rotation(tmp_path):
    storage_path = tmp_path / "history.jsonl"
    manager = HistoryManager(str(storage_path), max_entries=5)

    for i in range(10):
        entry = HistoryEntry(
            task_id=f"TSK-{i:02d}",
            command="build",
            result="success",
            worker_id=1,
            timestamp="2025-12-28 12:00:00",
            output=""
        )
        manager.save(entry)

    entries = manager.list(limit=100)
    assert len(entries) == 5
    assert entries[0]["task_id"] == "TSK-09"  # 최신 5개만 남음
```

---

## 3. 통합 테스트

### TC-14: CLI 옵션 오버라이드 동작

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-14 |
| 테스트 대상 | 전체 설정 로드 및 오버라이드 |
| 사전 조건 | 설정 파일에 workers=3 |
| 입력 | CLI에서 -w 2 전달 |
| 예상 결과 | 최종 workers=2 |
| 검증 방법 | 설정값 확인 |

```python
def test_cli_override_config(tmp_path, monkeypatch):
    # 설정 파일 생성
    settings_dir = tmp_path / ".orchay" / "settings"
    settings_dir.mkdir(parents=True)
    (settings_dir / "orchay.json").write_text('{"workers": 3}')

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("sys.argv", ["orchay", "-w", "2", "--dry-run"])

    # main 함수 로직 테스트 (실제 TUI 시작 전 중단)
    config = load_config()
    args = parse_args()

    if args.workers:
        config.workers = args.workers

    assert config.workers == 2
```

### TC-15: --dry-run 전체 흐름

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-15 |
| 테스트 대상 | dry-run 모드 실행 |
| 사전 조건 | 유효한 wbs.md 파일 |
| 입력 | `orchay --dry-run` |
| 예상 결과 | 큐 표시 후 종료, 분배 없음 |
| 검증 방법 | 종료 코드 0, 출력 확인 |

```python
def test_dry_run_mode(tmp_path, monkeypatch, capsys):
    # 환경 설정
    orchay_dir = tmp_path / ".orchay"
    orchay_dir.mkdir()

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("sys.argv", ["orchay", "--dry-run"])

    # dry-run은 TUI 없이 출력만 확인
    # 실제 구현에서는 run_scheduler 호출 전 종료
    # 여기서는 handle_dry_run 함수 직접 테스트

    from orchay.main import handle_dry_run
    from rich.console import Console

    config = Config()
    console = Console()
    result = handle_dry_run(config, console)

    assert result == 0
    captured = capsys.readouterr()
    assert "Dry Run" in captured.out or "dry run" in captured.out.lower()
```

### TC-16: history 명령 전체 흐름

| 항목 | 내용 |
|------|------|
| 테스트 ID | TC-16 |
| 테스트 대상 | history 명령 실행 |
| 사전 조건 | 저장된 히스토리 |
| 입력 | `orchay history` |
| 예상 결과 | 테이블 형식 목록 출력 |
| 검증 방법 | 출력 내용 확인 |

```python
def test_history_command_flow(tmp_path, monkeypatch, capsys):
    # 히스토리 파일 생성
    logs_dir = tmp_path / ".orchay" / "logs"
    logs_dir.mkdir(parents=True)
    history_file = logs_dir / "orchay-history.jsonl"
    history_file.write_text(
        '{"task_id": "TSK-01-01", "command": "build", "result": "success", '
        '"worker_id": 1, "timestamp": "2025-12-28 12:00:00", "output": ""}\n'
    )

    # 설정 파일도 생성
    settings_dir = tmp_path / ".orchay" / "settings"
    settings_dir.mkdir(parents=True)
    (settings_dir / "orchay.json").write_text(
        '{"history": {"storagePath": ".orchay/logs/orchay-history.jsonl"}}'
    )

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("sys.argv", ["orchay", "history"])

    from orchay.main import handle_history, parse_args

    args = parse_args()
    from rich.console import Console
    console = Console()
    result = handle_history(args, console)

    assert result == 0
```

---

## 4. 테스트 환경

### 4.1 필수 의존성

```toml
[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
]
```

### 4.2 테스트 실행

```bash
# 전체 테스트
uv run pytest tests/test_config.py tests/test_history.py tests/test_cli.py -v

# 특정 테스트
uv run pytest tests/test_config.py::test_config_default_values -v

# 커버리지
uv run pytest --cov=orchay --cov-report=term-missing
```

---

## 5. 테스트 파일 구조

```
tests/
├── __init__.py
├── conftest.py              # 공통 fixtures
├── test_config.py           # TC-01 ~ TC-05
├── test_cli.py              # TC-06 ~ TC-08
├── test_history.py          # TC-09 ~ TC-13
└── test_integration.py      # TC-14 ~ TC-16
```

---

## 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-12-28 | Claude | 최초 작성 |
