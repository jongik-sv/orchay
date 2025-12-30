"""설정 로드 유틸리티."""

from __future__ import annotations

import json
from pathlib import Path

import yaml

from orchay.models.config import Config


class ConfigLoadError(Exception):
    """설정 로드 오류."""


def find_orchay_root() -> Path | None:
    """프로젝트 루트에서 .orchay 폴더를 찾는다.

    현재 디렉토리부터 상위로 탐색합니다.

    Returns:
        .orchay 폴더 경로 또는 None
    """
    current = Path.cwd().resolve()
    while current != current.parent:
        orchay_path = current / ".orchay"
        if orchay_path.is_dir():
            return orchay_path
        current = current.parent
    return None


def load_config() -> Config:
    """설정 파일을 로드하여 Config 객체를 반환한다.

    설정 파일 경로 (우선순위):
    1. .orchay/settings/orchay.yaml (YAML, 주석 지원)
    2. .orchay/settings/orchay.json (JSON, fallback)

    Returns:
        Config 객체 (파일 없으면 기본값)

    Raises:
        ConfigLoadError: 파싱 오류 또는 스키마 검증 실패
    """
    orchay_root = find_orchay_root()

    if orchay_root is None:
        # .orchay 폴더가 없으면 기본값 반환
        return Config()

    settings_dir = orchay_root / "settings"

    # 1. YAML 파일 우선 시도
    yaml_path = settings_dir / "orchay.yaml"
    if yaml_path.exists():
        try:
            with open(yaml_path, encoding="utf-8") as f:
                data = yaml.safe_load(f)
            if data is None:
                data = {}
            return Config.model_validate(data)
        except yaml.YAMLError as e:
            raise ConfigLoadError(f"YAML 파싱 오류: {e}") from e
        except OSError as e:
            raise ConfigLoadError(f"파일 읽기 오류: {e}") from e
        except Exception as e:
            raise ConfigLoadError(f"설정 검증 오류: {e}") from e

    # 2. JSON 파일 fallback
    json_path = settings_dir / "orchay.json"
    if json_path.exists():
        try:
            with open(json_path, encoding="utf-8") as f:
                data = json.load(f)
            return Config.model_validate(data)
        except json.JSONDecodeError as e:
            raise ConfigLoadError(f"JSON 파싱 오류: {e}") from e
        except OSError as e:
            raise ConfigLoadError(f"파일 읽기 오류: {e}") from e
        except Exception as e:
            raise ConfigLoadError(f"설정 검증 오류: {e}") from e

    # 설정 파일이 없으면 기본값 반환
    return Config()
