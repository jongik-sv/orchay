"""Config 모델 및 설정 로드 테스트."""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from orchay.models.config import Config, ExecutionConfig


class TestConfigDefaultValues:
    """TC-01: Config 모델 기본값 테스트."""

    def test_config_default_values(self) -> None:
        """기본값이 올바르게 설정되는지 확인."""
        config = Config()
        assert config.workers == 3
        assert config.interval == 5
        assert config.execution.mode == "quick"
        assert config.detection.read_lines == 50
        assert config.history.max_entries == 1000

    def test_config_nested_defaults(self) -> None:
        """중첩 설정의 기본값 확인."""
        config = Config()
        assert config.detection.done_pattern is not None
        assert len(config.detection.prompt_patterns) > 0
        assert config.recovery.resume_text == "계속"
        assert config.dispatch.clear_before_dispatch is True
        assert config.history.enabled is True


class TestConfigValidation:
    """TC-02: Config Pydantic 검증 테스트."""

    def test_workers_validation_min(self) -> None:
        """workers 최소값 검증."""
        with pytest.raises(ValidationError):
            Config(workers=0)

    def test_workers_validation_max(self) -> None:
        """workers 최대값 검증."""
        with pytest.raises(ValidationError):
            Config(workers=11)

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
        assert config.workers == 3  # 기본값
        assert config.interval == 5  # 기본값

    def test_load_config_no_orchay_folder(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """.orchay 폴더 없을 때 기본값 사용."""
        from orchay.utils.config import load_config

        monkeypatch.chdir(tmp_path)

        # .orchay 폴더가 없어도 기본값 반환
        config = load_config()
        assert config.workers == 3
        assert config.interval == 5


class TestLoadConfigInvalidJson:
    """TC-05: load_config() JSON 파싱 오류 테스트."""

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
