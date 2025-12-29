"""HistoryManager 테스트."""

from __future__ import annotations

from pathlib import Path


class TestHistoryManagerSave:
    """TC-09: HistoryManager.save() 테스트."""

    def test_history_manager_save(self, tmp_path: Path) -> None:
        """히스토리 항목 저장."""
        from orchay.utils.history import HistoryEntry, HistoryManager

        storage_path = tmp_path / "history.jsonl"
        manager = HistoryManager(str(storage_path))

        entry = HistoryEntry(
            task_id="TSK-01-01",
            command="build",
            result="success",
            worker_id=1,
            timestamp="2025-12-28 12:00:00",
            output="Build completed",
        )
        manager.save(entry)

        content = storage_path.read_text(encoding="utf-8")
        assert "TSK-01-01" in content
        assert "build" in content
        assert "success" in content

    def test_history_manager_save_multiple(self, tmp_path: Path) -> None:
        """여러 항목 저장."""
        from orchay.utils.history import HistoryEntry, HistoryManager

        storage_path = tmp_path / "history.jsonl"
        manager = HistoryManager(str(storage_path))

        for i in range(3):
            entry = HistoryEntry(
                task_id=f"TSK-01-{i:02d}",
                command="build",
                result="success",
                worker_id=1,
                timestamp=f"2025-12-28 12:0{i}:00",
                output="",
            )
            manager.save(entry)

        lines = storage_path.read_text(encoding="utf-8").strip().split("\n")
        assert len(lines) == 3


class TestHistoryManagerList:
    """TC-10: HistoryManager.list() 테스트."""

    def test_history_manager_list(self, tmp_path: Path) -> None:
        """히스토리 목록 조회."""
        from orchay.utils.history import HistoryEntry, HistoryManager

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
                output="",
            )
            manager.save(entry)

        result = manager.list(limit=5)
        assert len(result) == 5
        # 최신순 (역순)
        assert result[0]["task_id"] == "TSK-01-09"
        assert result[4]["task_id"] == "TSK-01-05"

    def test_history_manager_list_empty(self, tmp_path: Path) -> None:
        """빈 히스토리 조회."""
        from orchay.utils.history import HistoryManager

        storage_path = tmp_path / "history.jsonl"
        manager = HistoryManager(str(storage_path))

        result = manager.list()
        assert result == []

    def test_history_manager_list_default_limit(self, tmp_path: Path) -> None:
        """기본 limit 테스트."""
        from orchay.utils.history import HistoryEntry, HistoryManager

        storage_path = tmp_path / "history.jsonl"
        manager = HistoryManager(str(storage_path))

        for i in range(15):
            entry = HistoryEntry(
                task_id=f"TSK-{i:02d}",
                command="build",
                result="success",
                worker_id=1,
                timestamp="2025-12-28 12:00:00",
                output="",
            )
            manager.save(entry)

        result = manager.list()  # 기본 limit=10
        assert len(result) == 10


class TestHistoryManagerGet:
    """TC-11: HistoryManager.get() 테스트."""

    def test_history_manager_get(self, tmp_path: Path) -> None:
        """특정 Task 조회."""
        from orchay.utils.history import HistoryEntry, HistoryManager

        storage_path = tmp_path / "history.jsonl"
        manager = HistoryManager(str(storage_path))

        entry = HistoryEntry(
            task_id="TSK-01-05",
            command="verify",
            result="success",
            worker_id=2,
            timestamp="2025-12-28 15:00:00",
            output="Test passed",
        )
        manager.save(entry)

        result = manager.get("TSK-01-05")
        assert result is not None
        assert result["task_id"] == "TSK-01-05"
        assert result["output"] == "Test passed"

    def test_history_manager_get_not_found(self, tmp_path: Path) -> None:
        """존재하지 않는 Task 조회."""
        from orchay.utils.history import HistoryEntry, HistoryManager

        storage_path = tmp_path / "history.jsonl"
        manager = HistoryManager(str(storage_path))

        entry = HistoryEntry(
            task_id="TSK-01-01",
            command="build",
            result="success",
            worker_id=1,
            timestamp="2025-12-28 12:00:00",
            output="",
        )
        manager.save(entry)

        result = manager.get("TSK-99-99")
        assert result is None

    def test_history_manager_get_latest(self, tmp_path: Path) -> None:
        """같은 Task ID의 최신 항목 조회."""
        from orchay.utils.history import HistoryEntry, HistoryManager

        storage_path = tmp_path / "history.jsonl"
        manager = HistoryManager(str(storage_path))

        # 같은 Task ID로 두 번 저장
        for i in range(2):
            entry = HistoryEntry(
                task_id="TSK-01-01",
                command="build",
                result="success" if i == 1 else "error",
                worker_id=1,
                timestamp=f"2025-12-28 12:0{i}:00",
                output=f"Output {i}",
            )
            manager.save(entry)

        result = manager.get("TSK-01-01")
        assert result is not None
        assert result["result"] == "success"  # 최신 항목
        assert result["output"] == "Output 1"


class TestHistoryManagerClear:
    """TC-12: HistoryManager.clear() 테스트."""

    def test_history_manager_clear(self, tmp_path: Path) -> None:
        """히스토리 삭제."""
        from orchay.utils.history import HistoryManager

        storage_path = tmp_path / "history.jsonl"
        storage_path.write_text('{"task_id": "test"}\n', encoding="utf-8")

        manager = HistoryManager(str(storage_path))
        manager.clear()

        assert not storage_path.exists()

    def test_history_manager_clear_nonexistent(self, tmp_path: Path) -> None:
        """존재하지 않는 파일 삭제 시도."""
        from orchay.utils.history import HistoryManager

        storage_path = tmp_path / "nonexistent.jsonl"
        manager = HistoryManager(str(storage_path))

        # 예외 없이 동작해야 함
        manager.clear()
        assert not storage_path.exists()


class TestHistoryRotation:
    """TC-13: 히스토리 로테이션 테스트."""

    def test_history_rotation(self, tmp_path: Path) -> None:
        """maxEntries 초과 시 오래된 항목 삭제."""
        from orchay.utils.history import HistoryEntry, HistoryManager

        storage_path = tmp_path / "history.jsonl"
        manager = HistoryManager(str(storage_path), max_entries=5)

        # 10개 저장
        for i in range(10):
            entry = HistoryEntry(
                task_id=f"TSK-{i:02d}",
                command="build",
                result="success",
                worker_id=1,
                timestamp="2025-12-28 12:00:00",
                output="",
            )
            manager.save(entry)

        entries = manager.list(limit=100)
        assert len(entries) == 5
        # 최신 5개만 남음
        assert entries[0]["task_id"] == "TSK-09"
        assert entries[4]["task_id"] == "TSK-05"

    def test_history_rotation_exact(self, tmp_path: Path) -> None:
        """maxEntries와 정확히 같을 때."""
        from orchay.utils.history import HistoryEntry, HistoryManager

        storage_path = tmp_path / "history.jsonl"
        manager = HistoryManager(str(storage_path), max_entries=5)

        for i in range(5):
            entry = HistoryEntry(
                task_id=f"TSK-{i:02d}",
                command="build",
                result="success",
                worker_id=1,
                timestamp="2025-12-28 12:00:00",
                output="",
            )
            manager.save(entry)

        entries = manager.list(limit=100)
        assert len(entries) == 5
