"""CLI 파싱 테스트."""

from __future__ import annotations

from pathlib import Path

import pytest


class TestParseArgsDefault:
    """TC-06: parse_args() 기본 실행 테스트."""

    def test_parse_args_with_project(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """프로젝트명 지정."""
        import sys

        from orchay.main import parse_args

        monkeypatch.setattr(sys, "argv", ["orchay", "my-project"])
        args = parse_args()

        assert args.project == "my-project"


class TestParseArgsOptions:
    """TC-07: parse_args() 옵션 파싱 테스트."""

    def test_parse_args_with_workers(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Worker 수 옵션."""
        import sys

        from orchay.main import parse_args

        monkeypatch.setattr(sys, "argv", ["orchay", "-w", "2"])
        args = parse_args()

        assert args.workers == 2

    def test_parse_args_with_mode(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """모드 옵션."""
        import sys

        from orchay.main import parse_args

        monkeypatch.setattr(sys, "argv", ["orchay", "-m", "develop"])
        args = parse_args()

        assert args.mode == "develop"

    def test_parse_args_with_dry_run(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """dry-run 옵션."""
        import sys

        from orchay.main import parse_args

        monkeypatch.setattr(sys, "argv", ["orchay", "--dry-run"])
        args = parse_args()

        assert args.dry_run is True

    def test_parse_args_all_options(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """모든 옵션 조합."""
        import sys

        from orchay.main import parse_args

        monkeypatch.setattr(
            sys,
            "argv",
            ["orchay", "my-project", "-w", "2", "-m", "develop", "--dry-run", "-i", "10"],
        )
        args = parse_args()

        assert args.project == "my-project"
        assert args.workers == 2
        assert args.mode == "develop"
        assert args.dry_run is True
        assert args.interval == 10


class TestParseArgsHistorySubcommand:
    """TC-08: parse_args() history 서브커맨드 테스트."""

    def test_parse_args_history_list(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """history 목록 조회."""
        import sys

        from orchay.cli import create_parser

        monkeypatch.setattr(sys, "argv", ["orchay", "history"])
        parser = create_parser()
        args = parser.parse_args()

        assert args.command == "history"

    def test_parse_args_history_with_task_id(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """history 특정 Task 조회."""
        import sys

        from orchay.cli import create_parser

        monkeypatch.setattr(sys, "argv", ["orchay", "history", "TSK-01-01"])
        parser = create_parser()
        args = parser.parse_args()

        assert args.command == "history"
        assert args.task_id == "TSK-01-01"

    def test_parse_args_history_with_limit(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """history limit 옵션."""
        import sys

        from orchay.cli import create_parser

        monkeypatch.setattr(sys, "argv", ["orchay", "history", "--limit", "20"])
        parser = create_parser()
        args = parser.parse_args()

        assert args.command == "history"
        assert args.limit == 20

    def test_parse_args_history_clear(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """history clear 옵션."""
        import sys

        from orchay.cli import create_parser

        monkeypatch.setattr(sys, "argv", ["orchay", "history", "--clear"])
        parser = create_parser()
        args = parser.parse_args()

        assert args.command == "history"
        assert args.clear is True


class TestHandleHistory:
    """handle_history 함수 테스트."""

    def test_handle_history_list_empty(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """handle_history 빈 목록."""
        from argparse import Namespace

        from orchay.cli import handle_history

        # .orchay 설정
        orchay_dir = tmp_path / ".orchay"
        orchay_dir.mkdir()
        logs_dir = orchay_dir / "logs"
        logs_dir.mkdir()

        monkeypatch.chdir(tmp_path)

        args = Namespace(task_id=None, limit=10, clear=False)
        result = handle_history(args)

        assert result == 0

    def test_handle_history_list_with_data(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """handle_history 데이터 있음."""
        from argparse import Namespace

        from orchay.cli import handle_history
        from orchay.utils.history import HistoryEntry, HistoryManager

        # .orchay 설정
        orchay_dir = tmp_path / ".orchay"
        orchay_dir.mkdir()
        logs_dir = orchay_dir / "logs"
        logs_dir.mkdir()
        history_file = logs_dir / "orchay-history.jsonl"

        # 히스토리 데이터 추가
        manager = HistoryManager(str(history_file))
        manager.save(
            HistoryEntry(
                task_id="TSK-01-01",
                command="build",
                result="success",
                worker_id=1,
                timestamp="2025-12-28 12:00:00",
                output="Build completed",
            )
        )

        monkeypatch.chdir(tmp_path)

        args = Namespace(task_id=None, limit=10, clear=False)
        result = handle_history(args)

        assert result == 0

    def test_handle_history_get_task(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """handle_history 특정 Task 조회."""
        from argparse import Namespace

        from orchay.cli import handle_history
        from orchay.utils.history import HistoryEntry, HistoryManager

        # .orchay 설정
        orchay_dir = tmp_path / ".orchay"
        orchay_dir.mkdir()
        logs_dir = orchay_dir / "logs"
        logs_dir.mkdir()
        history_file = logs_dir / "orchay-history.jsonl"

        # 히스토리 데이터 추가
        manager = HistoryManager(str(history_file))
        manager.save(
            HistoryEntry(
                task_id="TSK-01-01",
                command="build",
                result="success",
                worker_id=1,
                timestamp="2025-12-28 12:00:00",
                output="Build output here",
            )
        )

        monkeypatch.chdir(tmp_path)

        args = Namespace(task_id="TSK-01-01", limit=10, clear=False)
        result = handle_history(args)

        assert result == 0

    def test_handle_history_get_task_not_found(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """handle_history Task 없음."""
        from argparse import Namespace

        from orchay.cli import handle_history

        # .orchay 설정
        orchay_dir = tmp_path / ".orchay"
        orchay_dir.mkdir()
        logs_dir = orchay_dir / "logs"
        logs_dir.mkdir()

        monkeypatch.chdir(tmp_path)

        args = Namespace(task_id="TSK-99-99", limit=10, clear=False)
        result = handle_history(args)

        assert result == 0

    def test_handle_history_clear(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """handle_history 삭제."""
        from argparse import Namespace

        from orchay.cli import handle_history
        from orchay.utils.history import HistoryEntry, HistoryManager

        # .orchay 설정
        orchay_dir = tmp_path / ".orchay"
        orchay_dir.mkdir()
        logs_dir = orchay_dir / "logs"
        logs_dir.mkdir()
        history_file = logs_dir / "orchay-history.jsonl"

        # 히스토리 데이터 추가
        manager = HistoryManager(str(history_file))
        manager.save(
            HistoryEntry(
                task_id="TSK-01-01",
                command="build",
                result="success",
                worker_id=1,
                timestamp="2025-12-28 12:00:00",
                output="Build completed",
            )
        )

        monkeypatch.chdir(tmp_path)

        args = Namespace(task_id=None, limit=10, clear=True)
        result = handle_history(args)

        assert result == 0


