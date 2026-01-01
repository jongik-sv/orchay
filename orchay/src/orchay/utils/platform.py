"""플랫폼 유틸리티 (Phase 4).

Windows, Linux, macOS에서 동일하게 동작하도록 플랫폼별 차이를 추상화합니다.
"""

from __future__ import annotations

import sys
from pathlib import Path


def is_windows() -> bool:
    """Windows 플랫폼인지 확인합니다.

    Returns:
        True: Windows
        False: 다른 플랫폼
    """
    return sys.platform == "win32"


def is_macos() -> bool:
    """macOS 플랫폼인지 확인합니다.

    Returns:
        True: macOS
        False: 다른 플랫폼
    """
    return sys.platform == "darwin"


def is_linux() -> bool:
    """Linux 플랫폼인지 확인합니다.

    Returns:
        True: Linux
        False: 다른 플랫폼
    """
    return sys.platform.startswith("linux")


def get_platform_name() -> str:
    """현재 플랫폼 이름을 반환합니다.

    Returns:
        "windows", "macos", "linux", 또는 "unknown"
    """
    if is_windows():
        return "windows"
    if is_macos():
        return "macos"
    if is_linux():
        return "linux"
    return "unknown"


def get_config_dir() -> Path:
    """WezTerm 설정 디렉토리 경로를 반환합니다.

    플랫폼별 표준 경로:
    - Windows: ~/AppData/Local/wezterm
    - macOS: ~/Library/Application Support/wezterm
    - Linux: ~/.config/wezterm

    Returns:
        설정 디렉토리 경로
    """
    home = Path.home()

    if is_windows():
        return home / "AppData" / "Local" / "wezterm"
    if is_macos():
        return home / "Library" / "Application Support" / "wezterm"
    # Linux 및 기타
    return home / ".config" / "wezterm"


def get_data_dir() -> Path:
    """애플리케이션 데이터 디렉토리 경로를 반환합니다.

    플랫폼별 표준 경로:
    - Windows: ~/AppData/Local/orchay
    - macOS: ~/Library/Application Support/orchay
    - Linux: ~/.local/share/orchay

    Returns:
        데이터 디렉토리 경로
    """
    home = Path.home()

    if is_windows():
        return home / "AppData" / "Local" / "orchay"
    if is_macos():
        return home / "Library" / "Application Support" / "orchay"
    # Linux 및 기타
    return home / ".local" / "share" / "orchay"


def get_console_encoding() -> str:
    """콘솔 출력 인코딩을 반환합니다.

    모든 플랫폼에서 UTF-8을 사용합니다.

    Returns:
        인코딩 문자열
    """
    return "utf-8"


def get_shell_command() -> list[str]:
    """기본 셸 명령어를 반환합니다.

    플랫폼별 기본 셸:
    - Windows: powershell.exe
    - macOS/Linux: /bin/bash

    Returns:
        셸 실행 명령어 리스트
    """
    if is_windows():
        return ["powershell.exe", "-NoLogo"]
    return ["/bin/bash"]


def get_path_separator() -> str:
    """경로 구분자를 반환합니다.

    Returns:
        Windows: "\\", 기타: "/"
    """
    if is_windows():
        return "\\"
    return "/"


def normalize_path(path: str | Path) -> Path:
    """경로를 플랫폼에 맞게 정규화합니다.

    Args:
        path: 정규화할 경로

    Returns:
        정규화된 Path 객체
    """
    return Path(path).resolve()
