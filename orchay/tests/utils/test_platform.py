"""플랫폼 유틸리티 테스트 (Phase 5.2)."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from orchay.utils.platform import (
    get_config_dir,
    get_console_encoding,
    get_data_dir,
    get_path_separator,
    get_platform_name,
    get_shell_command,
    is_linux,
    is_macos,
    is_windows,
    normalize_path,
)


class TestPlatformDetection:
    """플랫폼 감지 테스트."""

    def test_is_windows_on_win32(self) -> None:
        """TC-PL-01: Windows 플랫폼을 감지합니다."""
        with patch("orchay.utils.platform.sys.platform", "win32"):
            assert is_windows() is True
            assert is_macos() is False
            assert is_linux() is False

    def test_is_macos_on_darwin(self) -> None:
        """TC-PL-02: macOS 플랫폼을 감지합니다."""
        with patch("orchay.utils.platform.sys.platform", "darwin"):
            assert is_windows() is False
            assert is_macos() is True
            assert is_linux() is False

    def test_is_linux_on_linux(self) -> None:
        """TC-PL-03: Linux 플랫폼을 감지합니다."""
        with patch("orchay.utils.platform.sys.platform", "linux"):
            assert is_windows() is False
            assert is_macos() is False
            assert is_linux() is True

    def test_is_linux_on_linux2(self) -> None:
        """TC-PL-04: linux2 플랫폼을 감지합니다."""
        with patch("orchay.utils.platform.sys.platform", "linux2"):
            assert is_linux() is True


class TestGetPlatformName:
    """get_platform_name 테스트."""

    def test_returns_windows(self) -> None:
        """TC-PL-05: Windows 이름을 반환합니다."""
        with patch("orchay.utils.platform.sys.platform", "win32"):
            assert get_platform_name() == "windows"

    def test_returns_macos(self) -> None:
        """TC-PL-06: macOS 이름을 반환합니다."""
        with patch("orchay.utils.platform.sys.platform", "darwin"):
            assert get_platform_name() == "macos"

    def test_returns_linux(self) -> None:
        """TC-PL-07: Linux 이름을 반환합니다."""
        with patch("orchay.utils.platform.sys.platform", "linux"):
            assert get_platform_name() == "linux"

    def test_returns_unknown(self) -> None:
        """TC-PL-08: 알 수 없는 플랫폼에서 unknown을 반환합니다."""
        with patch("orchay.utils.platform.sys.platform", "freebsd12"):
            assert get_platform_name() == "unknown"


class TestGetConfigDir:
    """get_config_dir 테스트."""

    def test_windows_config_dir(self) -> None:
        """TC-PL-09: Windows 설정 디렉토리를 반환합니다."""
        with (
            patch("orchay.utils.platform.sys.platform", "win32"),
            patch("orchay.utils.platform.Path.home", return_value=Path("C:/Users/test")),
        ):
            path = get_config_dir()
            assert path == Path("C:/Users/test/AppData/Local/wezterm")

    def test_macos_config_dir(self) -> None:
        """TC-PL-10: macOS 설정 디렉토리를 반환합니다."""
        with (
            patch("orchay.utils.platform.sys.platform", "darwin"),
            patch("orchay.utils.platform.Path.home", return_value=Path("/Users/test")),
        ):
            path = get_config_dir()
            assert path == Path("/Users/test/Library/Application Support/wezterm")

    def test_linux_config_dir(self) -> None:
        """TC-PL-11: Linux 설정 디렉토리를 반환합니다."""
        with (
            patch("orchay.utils.platform.sys.platform", "linux"),
            patch("orchay.utils.platform.Path.home", return_value=Path("/home/test")),
        ):
            path = get_config_dir()
            assert path == Path("/home/test/.config/wezterm")


class TestGetDataDir:
    """get_data_dir 테스트."""

    def test_windows_data_dir(self) -> None:
        """TC-PL-12: Windows 데이터 디렉토리를 반환합니다."""
        with (
            patch("orchay.utils.platform.sys.platform", "win32"),
            patch("orchay.utils.platform.Path.home", return_value=Path("C:/Users/test")),
        ):
            path = get_data_dir()
            assert path == Path("C:/Users/test/AppData/Local/orchay")

    def test_macos_data_dir(self) -> None:
        """TC-PL-13: macOS 데이터 디렉토리를 반환합니다."""
        with (
            patch("orchay.utils.platform.sys.platform", "darwin"),
            patch("orchay.utils.platform.Path.home", return_value=Path("/Users/test")),
        ):
            path = get_data_dir()
            assert path == Path("/Users/test/Library/Application Support/orchay")

    def test_linux_data_dir(self) -> None:
        """TC-PL-14: Linux 데이터 디렉토리를 반환합니다."""
        with (
            patch("orchay.utils.platform.sys.platform", "linux"),
            patch("orchay.utils.platform.Path.home", return_value=Path("/home/test")),
        ):
            path = get_data_dir()
            assert path == Path("/home/test/.local/share/orchay")


class TestGetConsoleEncoding:
    """get_console_encoding 테스트."""

    def test_returns_utf8(self) -> None:
        """TC-PL-15: 항상 UTF-8을 반환합니다."""
        assert get_console_encoding() == "utf-8"


class TestGetShellCommand:
    """get_shell_command 테스트."""

    def test_windows_shell(self) -> None:
        """TC-PL-16: Windows 셸 명령을 반환합니다."""
        with patch("orchay.utils.platform.sys.platform", "win32"):
            cmd = get_shell_command()
            assert cmd == ["powershell.exe", "-NoLogo"]

    def test_unix_shell(self) -> None:
        """TC-PL-17: Unix 셸 명령을 반환합니다."""
        with patch("orchay.utils.platform.sys.platform", "linux"):
            cmd = get_shell_command()
            assert cmd == ["/bin/bash"]


class TestGetPathSeparator:
    """get_path_separator 테스트."""

    def test_windows_separator(self) -> None:
        """TC-PL-18: Windows 경로 구분자를 반환합니다."""
        with patch("orchay.utils.platform.sys.platform", "win32"):
            assert get_path_separator() == "\\"

    def test_unix_separator(self) -> None:
        """TC-PL-19: Unix 경로 구분자를 반환합니다."""
        with patch("orchay.utils.platform.sys.platform", "linux"):
            assert get_path_separator() == "/"


class TestNormalizePath:
    """normalize_path 테스트."""

    def test_normalizes_string(self) -> None:
        """TC-PL-20: 문자열 경로를 정규화합니다."""
        result = normalize_path("./test/../test/file.txt")
        assert isinstance(result, Path)
        assert result.is_absolute()

    def test_normalizes_path(self) -> None:
        """TC-PL-21: Path 객체를 정규화합니다."""
        result = normalize_path(Path("./test"))
        assert isinstance(result, Path)
        assert result.is_absolute()
