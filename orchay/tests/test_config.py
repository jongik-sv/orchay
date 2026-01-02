"""Config 모델 및 설정 로드 테스트."""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from orchay.models.config import Config, ExecutionConfig, WorkerCommandConfig


class TestConfigDefaultValues:
    """TC-01: Config 모델 기본값 테스트."""

    def test_config_default_values(self) -> None:
        """기본값이 올바르게 설정되는지 확인."""
        config = Config()
        assert config.workers == 0  # 0 = 자동 (무제한)
        assert config.interval == 5
        assert config.execution.mode == "quick"
        assert config.detection.read_lines == 50
        assert config.history.max_entries == 1000

    def test_config_nested_defaults(self) -> None:
        """중첩 설정의 기본값 확인."""
        config = Config()
        assert config.detection.done_pattern is not None
        assert len(config.detection.prompt_patterns) > 0
        assert config.worker_command.startup == "claude --dangerously-skip-permissions"
        assert config.dispatch.clear_before_dispatch is True
        assert config.history.enabled is True


class TestConfigValidation:
    """TC-02: Config Pydantic 검증 테스트."""

    def test_workers_validation_zero_allowed(self) -> None:
        """workers=0은 자동(무제한)을 의미하므로 허용."""
        config = Config(workers=0)
        assert config.workers == 0

    def test_workers_validation_large_allowed(self) -> None:
        """workers 큰 값도 허용 (제한 없음)."""
        config = Config(workers=100)
        assert config.workers == 100

    def test_workers_validation_negative(self) -> None:
        """workers 음수 검증."""
        with pytest.raises(ValidationError):
            Config(workers=-1)

    def test_interval_validation_min(self) -> None:
        """interval 최소값 검증."""
        with pytest.raises(ValidationError):
            Config(interval=0)

    def test_interval_validation_max(self) -> None:
        """interval 최대값 검증."""
        with pytest.raises(ValidationError):
            Config(interval=61)

    def test_execution_mode_validation(self) -> None:
        """실행 모드 검증."""
        with pytest.raises(ValidationError):
            Config(execution=ExecutionConfig(mode="invalid"))

    def test_valid_config(self) -> None:
        """유효한 설정값 테스트."""
        config = Config(workers=5, interval=10)
        assert config.workers == 5
        assert config.interval == 10


class TestLoadConfigFromFile:
    """TC-03: load_config() 파일 존재 테스트."""

    def test_load_config_from_file(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """유효한 설정 파일에서 로드."""
        from orchay.utils.config import load_config

        # .orchay/settings/orchay.json 생성
        settings_dir = tmp_path / ".orchay" / "settings"
        settings_dir.mkdir(parents=True)
        config_file = settings_dir / "orchay.json"
        config_file.write_text('{"workers": 5, "interval": 10}', encoding="utf-8")

        monkeypatch.chdir(tmp_path)

        config = load_config()
        assert config.workers == 5
        assert config.interval == 10

    def test_load_config_with_nested_values(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """중첩 설정값 로드 테스트."""
        from orchay.utils.config import load_config

        settings_dir = tmp_path / ".orchay" / "settings"
        settings_dir.mkdir(parents=True)
        config_file = settings_dir / "orchay.json"
        config_data = {
            "workers": 4,
            "execution": {"mode": "develop"},
            "history": {"max_entries": 500},
        }
        config_file.write_text(json.dumps(config_data), encoding="utf-8")

        monkeypatch.chdir(tmp_path)

        config = load_config()
        assert config.workers == 4
        assert config.execution.mode == "develop"
        assert config.history.max_entries == 500


class TestLoadConfigMissing:
    """TC-04: load_config() 파일 없음 테스트."""

    def test_load_config_default_when_missing(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """설정 파일 없을 때 기본값 사용."""
        from orchay.utils.config import load_config

        # .orchay 폴더만 생성 (설정 파일 없음)
        orchay_dir = tmp_path / ".orchay"
        orchay_dir.mkdir()

        monkeypatch.chdir(tmp_path)

        config = load_config()
        assert config.workers == 0  # 기본값 (0=자동)
        assert config.interval == 5  # 기본값

    def test_load_config_no_orchay_folder(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """.orchay 폴더 없을 때 기본값 사용."""
        from orchay.utils.config import load_config

        monkeypatch.chdir(tmp_path)

        # .orchay 폴더가 없어도 기본값 반환
        config = load_config()
        assert config.workers == 0  # 기본값 (0=자동)
        assert config.interval == 5


class TestLoadConfigYaml:
    """TC-05: load_config() YAML 파일 로드 테스트."""

    def test_load_config_from_yaml(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """유효한 YAML 설정 파일에서 로드."""
        from orchay.utils.config import load_config

        settings_dir = tmp_path / ".orchay" / "settings"
        settings_dir.mkdir(parents=True)
        config_file = settings_dir / "orchay.yaml"
        config_file.write_text("workers: 3\ninterval: 8", encoding="utf-8")

        monkeypatch.chdir(tmp_path)

        config = load_config()
        assert config.workers == 3
        assert config.interval == 8

    def test_load_config_yaml_priority_over_json(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """YAML이 JSON보다 우선."""
        from orchay.utils.config import load_config

        settings_dir = tmp_path / ".orchay" / "settings"
        settings_dir.mkdir(parents=True)
        # YAML 파일
        yaml_file = settings_dir / "orchay.yaml"
        yaml_file.write_text("workers: 3", encoding="utf-8")
        # JSON 파일
        json_file = settings_dir / "orchay.json"
        json_file.write_text('{"workers": 5}', encoding="utf-8")

        monkeypatch.chdir(tmp_path)

        config = load_config()
        assert config.workers == 3  # YAML 값 사용

    def test_load_config_empty_yaml(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """빈 YAML 파일은 기본값 사용."""
        from orchay.utils.config import load_config

        settings_dir = tmp_path / ".orchay" / "settings"
        settings_dir.mkdir(parents=True)
        config_file = settings_dir / "orchay.yaml"
        config_file.write_text("", encoding="utf-8")

        monkeypatch.chdir(tmp_path)

        config = load_config()
        assert config.workers == 0  # 기본값

    def test_load_config_invalid_yaml(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """잘못된 YAML 형식."""
        from orchay.utils.config import ConfigLoadError, load_config

        settings_dir = tmp_path / ".orchay" / "settings"
        settings_dir.mkdir(parents=True)
        config_file = settings_dir / "orchay.yaml"
        config_file.write_text("workers: [invalid yaml", encoding="utf-8")

        monkeypatch.chdir(tmp_path)

        with pytest.raises(ConfigLoadError):
            load_config()

    def test_load_config_yaml_invalid_schema(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """YAML 스키마 검증 실패."""
        from orchay.utils.config import ConfigLoadError, load_config

        settings_dir = tmp_path / ".orchay" / "settings"
        settings_dir.mkdir(parents=True)
        config_file = settings_dir / "orchay.yaml"
        config_file.write_text("workers: -5", encoding="utf-8")

        monkeypatch.chdir(tmp_path)

        with pytest.raises(ConfigLoadError):
            load_config()


class TestLoadConfigInvalidJson:
    """TC-06: load_config() JSON 파싱 오류 테스트."""

    def test_load_config_invalid_json(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """잘못된 JSON 형식 파일."""
        from orchay.utils.config import ConfigLoadError, load_config

        settings_dir = tmp_path / ".orchay" / "settings"
        settings_dir.mkdir(parents=True)
        config_file = settings_dir / "orchay.json"
        config_file.write_text("{ invalid json }", encoding="utf-8")

        monkeypatch.chdir(tmp_path)

        with pytest.raises(ConfigLoadError):
            load_config()

    def test_load_config_invalid_schema(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """스키마 검증 실패."""
        from orchay.utils.config import ConfigLoadError, load_config

        settings_dir = tmp_path / ".orchay" / "settings"
        settings_dir.mkdir(parents=True)
        config_file = settings_dir / "orchay.json"
        config_file.write_text('{"workers": -1}', encoding="utf-8")

        monkeypatch.chdir(tmp_path)

        with pytest.raises(ConfigLoadError):
            load_config()


class TestWorkerCommandPaneStartup:
    """TC-07: WorkerCommandConfig pane_startup 테스트."""

    def test_default_pane_startup_empty(self) -> None:
        """pane_startup 기본값은 빈 dict."""
        config = WorkerCommandConfig()
        assert config.pane_startup == {}

    def test_get_startup_for_default(self) -> None:
        """기본 startup 사용."""
        config = WorkerCommandConfig(startup="claude --model haiku")
        assert config.get_startup_for_worker(1) == "claude --model haiku"
        assert config.get_startup_for_worker(6) == "claude --model haiku"

    def test_get_startup_for_override(self) -> None:
        """pane_startup 오버라이드."""
        config = WorkerCommandConfig(
            startup="claude --model haiku",
            pane_startup={1: "claude --model opus", 3: "claude --model sonnet"},
        )
        assert config.get_startup_for_worker(1) == "claude --model opus"
        assert config.get_startup_for_worker(2) == "claude --model haiku"  # 기본값
        assert config.get_startup_for_worker(3) == "claude --model sonnet"
        assert config.get_startup_for_worker(4) == "claude --model haiku"  # 기본값

    def test_get_startup_invalid_worker_id(self) -> None:
        """잘못된 worker_id 검증."""
        config = WorkerCommandConfig()
        with pytest.raises(ValueError, match="worker_id는 1-6 사이여야 함"):
            config.get_startup_for_worker(0)
        with pytest.raises(ValueError, match="worker_id는 1-6 사이여야 함"):
            config.get_startup_for_worker(7)

    def test_pane_startup_validation(self) -> None:
        """pane_startup 유효성 검증."""
        from pydantic import ValidationError

        # 유효한 범위
        WorkerCommandConfig(pane_startup={1: "cmd", 6: "cmd"})

        # 잘못된 범위
        with pytest.raises(ValidationError):
            WorkerCommandConfig(pane_startup={0: "cmd"})
        with pytest.raises(ValidationError):
            WorkerCommandConfig(pane_startup={7: "cmd"})

    def test_load_config_with_pane_startup(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """YAML에서 pane_startup 로드."""
        from orchay.utils.config import load_config

        settings_dir = tmp_path / ".orchay" / "settings"
        settings_dir.mkdir(parents=True)
        yaml_file = settings_dir / "orchay.yaml"
        yaml_file.write_text(
            """
worker_command:
  startup: "claude --model haiku"
  pane_startup:
    1: "claude --model opus"
    3: "claude --model sonnet"
""",
            encoding="utf-8",
        )

        monkeypatch.chdir(tmp_path)
        config = load_config()

        assert config.worker_command.startup == "claude --model haiku"
        assert config.worker_command.pane_startup == {
            1: "claude --model opus",
            3: "claude --model sonnet",
        }
