"""CLI 파싱 테스트."""

from __future__ import annotations

from pathlib import Path

import pytest


class TestParseArgsDefault:
    """TC-06: parse_args() 기본 실행 테스트."""

    def test_parse_args_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """기본 인자로 파싱."""
        import sys

        from orchay.main import parse_args

        monkeypatch.setattr(sys, "argv", ["orchay"])
        args = parse_args()

        assert args.project == "orchay"
        assert args.dry_run is False
        assert args.workers == 3
        assert args.mode == "quick"

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


class TestExecSubcommand:
    """exec 서브커맨드 테스트."""

    def test_exec_start_parsing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """exec start 파싱."""
        import sys

        from orchay.cli import create_parser

        monkeypatch.setattr(sys, "argv", ["orchay", "exec", "start", "TSK-01-01", "build"])
        parser = create_parser()
        args = parser.parse_args()

        assert args.command == "exec"
        assert args.exec_command == "start"
        assert args.task_id == "TSK-01-01"
        assert args.step == "build"

    def test_exec_stop_parsing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """exec stop 파싱."""
        import sys

        from orchay.cli import create_parser

        monkeypatch.setattr(sys, "argv", ["orchay", "exec", "stop", "TSK-01-01"])
        parser = create_parser()
        args = parser.parse_args()

        assert args.command == "exec"
        assert args.exec_command == "stop"
        assert args.task_id == "TSK-01-01"

    def test_exec_update_parsing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """exec update 파싱."""
        import sys

        from orchay.cli import create_parser

        monkeypatch.setattr(sys, "argv", ["orchay", "exec", "update", "TSK-01-01", "done"])
        parser = create_parser()
        args = parser.parse_args()

        assert args.command == "exec"
        assert args.exec_command == "update"
        assert args.task_id == "TSK-01-01"
        assert args.step == "done"

    def test_exec_list_parsing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """exec list 파싱."""
        import sys

        from orchay.cli import create_parser

        monkeypatch.setattr(sys, "argv", ["orchay", "exec", "list"])
        parser = create_parser()
        args = parser.parse_args()

        assert args.command == "exec"
        assert args.exec_command == "list"

    def test_exec_clear_parsing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """exec clear 파싱."""
        import sys

        from orchay.cli import create_parser

        monkeypatch.setattr(sys, "argv", ["orchay", "exec", "clear"])
        parser = create_parser()
        args = parser.parse_args()

        assert args.command == "exec"
        assert args.exec_command == "clear"


class TestExecHandlers:
    """exec 핸들러 함수 테스트."""

    def test_exec_start_success(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """exec start 성공."""
        from argparse import Namespace

        from orchay.cli import exec_start

        # 임시 로그 디렉토리 설정
        logs_dir = tmp_path / ".orchay" / "logs"
        logs_dir.mkdir(parents=True)
        monkeypatch.chdir(tmp_path)

        args = Namespace(task_id="TSK-01-01", step="build", worker=1, pane=100)
        result = exec_start(args)

        assert result == 0

    def test_exec_stop_success(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """exec stop 성공."""
        from argparse import Namespace

        from orchay.cli import exec_start, exec_stop

        logs_dir = tmp_path / ".orchay" / "logs"
        logs_dir.mkdir(parents=True)
        monkeypatch.chdir(tmp_path)

        # 먼저 등록
        start_args = Namespace(task_id="TSK-01-01", step="build", worker=1, pane=100)
        exec_start(start_args)

        # 해제
        stop_args = Namespace(task_id="TSK-01-01")
        result = exec_stop(stop_args)

        assert result == 0

    def test_exec_update_success(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """exec update 성공."""
        from argparse import Namespace

        from orchay.cli import exec_start, exec_update

        logs_dir = tmp_path / ".orchay" / "logs"
        logs_dir.mkdir(parents=True)
        monkeypatch.chdir(tmp_path)

        # 먼저 등록
        start_args = Namespace(task_id="TSK-01-01", step="build", worker=1, pane=100)
        exec_start(start_args)

        # 업데이트
        update_args = Namespace(task_id="TSK-01-01", step="done")
        result = exec_update(update_args)

        assert result == 0

    def test_exec_list_empty(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """exec list 빈 목록."""
        from argparse import Namespace

        from orchay.cli import exec_list

        logs_dir = tmp_path / ".orchay" / "logs"
        logs_dir.mkdir(parents=True)
        monkeypatch.chdir(tmp_path)

        args = Namespace()
        result = exec_list(args)

        assert result == 0

    def test_exec_list_with_data(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """exec list 데이터 있음."""
        from argparse import Namespace

        from orchay.cli import exec_list, exec_start

        logs_dir = tmp_path / ".orchay" / "logs"
        logs_dir.mkdir(parents=True)
        monkeypatch.chdir(tmp_path)

        # 등록
        start_args = Namespace(task_id="TSK-01-01", step="build", worker=1, pane=100)
        exec_start(start_args)

        args = Namespace()
        result = exec_list(args)

        assert result == 0

    def test_exec_clear_success(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """exec clear 성공."""
        from argparse import Namespace

        from orchay.cli import exec_clear, exec_start

        logs_dir = tmp_path / ".orchay" / "logs"
        logs_dir.mkdir(parents=True)
        monkeypatch.chdir(tmp_path)

        # 먼저 등록
        start_args = Namespace(task_id="TSK-01-01", step="build", worker=1, pane=100)
        exec_start(start_args)

        args = Namespace()
        result = exec_clear(args)

        assert result == 0


class TestHandleExec:
    """handle_exec 함수 테스트."""

    def test_handle_exec_start(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """handle_exec start."""
        from argparse import Namespace

        from orchay.cli import handle_exec

        logs_dir = tmp_path / ".orchay" / "logs"
        logs_dir.mkdir(parents=True)
        monkeypatch.chdir(tmp_path)

        args = Namespace(
            exec_command="start",
            task_id="TSK-01-01",
            step="build",
            worker=1,
            pane=100,
        )
        result = handle_exec(args)

        assert result == 0

    def test_handle_exec_stop(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """handle_exec stop."""
        from argparse import Namespace

        from orchay.cli import handle_exec

        logs_dir = tmp_path / ".orchay" / "logs"
        logs_dir.mkdir(parents=True)
        monkeypatch.chdir(tmp_path)

        # 먼저 등록
        start_args = Namespace(
            exec_command="start",
            task_id="TSK-01-01",
            step="build",
            worker=1,
            pane=100,
        )
        handle_exec(start_args)

        stop_args = Namespace(exec_command="stop", task_id="TSK-01-01")
        result = handle_exec(stop_args)

        assert result == 0

    def test_handle_exec_update(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """handle_exec update."""
        from argparse import Namespace

        from orchay.cli import handle_exec

        logs_dir = tmp_path / ".orchay" / "logs"
        logs_dir.mkdir(parents=True)
        monkeypatch.chdir(tmp_path)

        # 먼저 등록
        start_args = Namespace(
            exec_command="start",
            task_id="TSK-01-01",
            step="build",
            worker=1,
            pane=100,
        )
        handle_exec(start_args)

        update_args = Namespace(exec_command="update", task_id="TSK-01-01", step="done")
        result = handle_exec(update_args)

        assert result == 0

    def test_handle_exec_list(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """handle_exec list."""
        from argparse import Namespace

        from orchay.cli import handle_exec

        logs_dir = tmp_path / ".orchay" / "logs"
        logs_dir.mkdir(parents=True)
        monkeypatch.chdir(tmp_path)

        args = Namespace(exec_command="list")
        result = handle_exec(args)

        assert result == 0

    def test_handle_exec_clear(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """handle_exec clear."""
        from argparse import Namespace

        from orchay.cli import handle_exec

        logs_dir = tmp_path / ".orchay" / "logs"
        logs_dir.mkdir(parents=True)
        monkeypatch.chdir(tmp_path)

        args = Namespace(exec_command="clear")
        result = handle_exec(args)

        assert result == 0

    def test_handle_exec_unknown(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """handle_exec 알 수 없는 명령."""
        from argparse import Namespace

        from orchay.cli import handle_exec

        logs_dir = tmp_path / ".orchay" / "logs"
        logs_dir.mkdir(parents=True)
        monkeypatch.chdir(tmp_path)

        args = Namespace(exec_command=None)
        result = handle_exec(args)

        assert result == 1


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


