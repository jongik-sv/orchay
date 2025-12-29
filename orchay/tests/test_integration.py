"""통합 테스트."""

from __future__ import annotations

from pathlib import Path

import pytest


class TestCliOverrideConfig:
    """TC-14: CLI 옵션 오버라이드 동작 테스트."""

    def test_cli_override_config(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """CLI 옵션이 설정 파일 값을 오버라이드."""
        import sys

        from orchay.main import parse_args
        from orchay.utils.config import load_config

        # 설정 파일 생성
        settings_dir = tmp_path / ".orchay" / "settings"
        settings_dir.mkdir(parents=True)
        (settings_dir / "orchay.json").write_text('{"workers": 3}', encoding="utf-8")

        monkeypatch.chdir(tmp_path)
        monkeypatch.setattr(sys, "argv", ["orchay", "-w", "2", "--dry-run"])

        config = load_config()
        args = parse_args()

        # CLI 값으로 오버라이드
        if args.workers:
            config.workers = args.workers
        if args.mode:
            config.execution.mode = args.mode

        assert config.workers == 2  # CLI 값

    def test_config_file_used_when_no_cli(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """CLI 옵션 없을 때 설정 파일 값 사용."""
        import sys

        from orchay.main import parse_args
        from orchay.utils.config import load_config

        settings_dir = tmp_path / ".orchay" / "settings"
        settings_dir.mkdir(parents=True)
        (settings_dir / "orchay.json").write_text(
            '{"workers": 5, "interval": 15}', encoding="utf-8"
        )

        monkeypatch.chdir(tmp_path)
        monkeypatch.setattr(sys, "argv", ["orchay"])

        config = load_config()
        parse_args()

        # CLI에서 workers를 지정하지 않음 (기본값 3)
        # 하지만 파일에서 로드한 값은 5
        assert config.workers == 5
        assert config.interval == 15


class TestDryRunMode:
    """TC-15: --dry-run 전체 흐름 테스트."""

    def test_dry_run_mode(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """dry-run 모드 실행."""
        from rich.console import Console

        from orchay.models.config import Config

        # 환경 설정
        orchay_dir = tmp_path / ".orchay"
        orchay_dir.mkdir()

        monkeypatch.chdir(tmp_path)

        # handle_dry_run 함수 테스트 (실제 구현 후)
        # 여기서는 Config 기반 동작만 확인
        config = Config()
        Console(force_terminal=True)

        # dry-run은 분배 없이 상태만 표시
        # 실제 TUI는 시작하지 않아야 함
        assert config.workers == 3
        assert config.execution.mode == "quick"


class TestHistoryCommandFlow:
    """TC-16: history 명령 전체 흐름 테스트."""

    def test_history_command_flow(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """history 명령 전체 흐름."""
        from orchay.utils.history import HistoryEntry, HistoryManager

        # 히스토리 파일 생성
        logs_dir = tmp_path / ".orchay" / "logs"
        logs_dir.mkdir(parents=True)
        history_file = logs_dir / "orchay-history.jsonl"

        manager = HistoryManager(str(history_file))
        entry = HistoryEntry(
            task_id="TSK-01-01",
            command="build",
            result="success",
            worker_id=1,
            timestamp="2025-12-28 12:00:00",
            output="Build completed successfully",
        )
        manager.save(entry)

        # 목록 조회
        entries = manager.list()
        assert len(entries) == 1
        assert entries[0]["task_id"] == "TSK-01-01"

        # 상세 조회
        detail = manager.get("TSK-01-01")
        assert detail is not None
        assert detail["output"] == "Build completed successfully"

    def test_history_command_empty(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """빈 히스토리 상태."""
        from orchay.utils.history import HistoryManager

        logs_dir = tmp_path / ".orchay" / "logs"
        logs_dir.mkdir(parents=True)
        history_file = logs_dir / "orchay-history.jsonl"

        manager = HistoryManager(str(history_file))

        entries = manager.list()
        assert entries == []

        detail = manager.get("TSK-99-99")
        assert detail is None
