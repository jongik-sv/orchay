"""프로세스 관리 유틸리티 테스트 (Phase 4.2)."""

from __future__ import annotations

import subprocess
from unittest.mock import MagicMock, patch

import pytest

from orchay.utils.process import (
    ProcessInfo,
    _is_process_running_sync,
    _kill_process_sync,
    _list_processes_sync,
    _list_processes_unix,
    _list_processes_windows,
    is_process_running,
    kill_process,
    kill_process_nowait,
    kill_processes_by_name,
    list_processes,
)


class TestProcessInfo:
    """ProcessInfo 데이터클래스 테스트."""

    def test_create(self) -> None:
        """TC-PR-01: ProcessInfo를 생성합니다."""
        info = ProcessInfo(pid=1234, name="test.exe")

        assert info.pid == 1234
        assert info.name == "test.exe"


class TestListProcessesWindows:
    """Windows 프로세스 목록 조회 테스트."""

    def test_parses_csv_output(self) -> None:
        """TC-PR-02: CSV 출력을 파싱합니다."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = '"wezterm-gui.exe","1234","Console","1","50,000 K"\n'

        with patch("subprocess.run", return_value=mock_result):
            processes = _list_processes_windows("wezterm-gui")

        assert len(processes) == 1
        assert processes[0].pid == 1234
        assert processes[0].name == "wezterm-gui.exe"

    def test_handles_multiple_processes(self) -> None:
        """TC-PR-03: 여러 프로세스를 처리합니다."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = (
            '"wezterm-gui.exe","1234","Console","1","50,000 K"\n'
            '"wezterm-gui.exe","5678","Console","1","60,000 K"\n'
        )

        with patch("subprocess.run", return_value=mock_result):
            processes = _list_processes_windows("wezterm-gui")

        assert len(processes) == 2
        assert processes[0].pid == 1234
        assert processes[1].pid == 5678

    def test_adds_exe_extension(self) -> None:
        """TC-PR-04: .exe 확장자를 자동으로 추가합니다."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = ""

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            _list_processes_windows("wezterm-gui")

        # .exe가 추가되었는지 확인
        call_args = mock_run.call_args[0][0]
        assert "IMAGENAME eq wezterm-gui.exe" in call_args

    def test_handles_empty_output(self) -> None:
        """TC-PR-05: 빈 출력을 처리합니다."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = ""

        with patch("subprocess.run", return_value=mock_result):
            processes = _list_processes_windows("nonexistent")

        assert len(processes) == 0

    def test_handles_error(self) -> None:
        """TC-PR-06: 오류를 처리합니다."""
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stdout = ""

        with patch("subprocess.run", return_value=mock_result):
            processes = _list_processes_windows("test")

        assert len(processes) == 0


class TestListProcessesUnix:
    """Unix 프로세스 목록 조회 테스트."""

    def test_parses_pgrep_output(self) -> None:
        """TC-PR-07: pgrep 출력을 파싱합니다."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "1234\n5678\n"

        with patch("subprocess.run", return_value=mock_result):
            processes = _list_processes_unix("wezterm-gui")

        assert len(processes) == 2
        assert processes[0].pid == 1234
        assert processes[1].pid == 5678

    def test_handles_no_match(self) -> None:
        """TC-PR-08: 일치하는 프로세스가 없을 때 처리합니다."""
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stdout = ""

        with patch("subprocess.run", return_value=mock_result):
            processes = _list_processes_unix("nonexistent")

        assert len(processes) == 0


class TestListProcesses:
    """list_processes 통합 테스트."""

    async def test_calls_windows_on_windows(self) -> None:
        """TC-PR-09: Windows에서 Windows 함수를 호출합니다."""
        with (
            patch("orchay.utils.process.is_windows", return_value=True),
            patch(
                "orchay.utils.process._list_processes_windows",
                return_value=[ProcessInfo(1234, "test.exe")],
            ) as mock_win,
        ):
            processes = await list_processes("test")

            mock_win.assert_called_once_with("test")
            assert len(processes) == 1

    async def test_calls_unix_on_linux(self) -> None:
        """TC-PR-10: Linux에서 Unix 함수를 호출합니다."""
        with (
            patch("orchay.utils.process.is_windows", return_value=False),
            patch(
                "orchay.utils.process._list_processes_unix",
                return_value=[ProcessInfo(1234, "test")],
            ) as mock_unix,
        ):
            processes = await list_processes("test")

            mock_unix.assert_called_once_with("test")
            assert len(processes) == 1


class TestKillProcess:
    """kill_process 테스트."""

    def test_kills_on_windows(self) -> None:
        """TC-PR-11: Windows에서 taskkill을 사용합니다."""
        mock_result = MagicMock()
        mock_result.returncode = 0

        with (
            patch("orchay.utils.process.is_windows", return_value=True),
            patch("subprocess.run", return_value=mock_result) as mock_run,
        ):
            result = _kill_process_sync(1234)

            assert result is True
            call_args = mock_run.call_args[0][0]
            assert "taskkill" in call_args
            assert "/F" in call_args
            assert "/PID" in call_args
            assert "1234" in call_args

    def test_kills_on_unix(self) -> None:
        """TC-PR-12: Unix에서 kill -9를 사용합니다."""
        mock_result = MagicMock()
        mock_result.returncode = 0

        with (
            patch("orchay.utils.process.is_windows", return_value=False),
            patch("subprocess.run", return_value=mock_result) as mock_run,
        ):
            result = _kill_process_sync(1234)

            assert result is True
            call_args = mock_run.call_args[0][0]
            assert call_args == ["kill", "-9", "1234"]

    def test_returns_false_on_failure(self) -> None:
        """TC-PR-13: 실패 시 False를 반환합니다."""
        mock_result = MagicMock()
        mock_result.returncode = 1

        with (
            patch("orchay.utils.process.is_windows", return_value=True),
            patch("subprocess.run", return_value=mock_result),
        ):
            result = _kill_process_sync(9999)

            assert result is False

    async def test_async_kill(self) -> None:
        """TC-PR-14: 비동기 kill을 수행합니다."""
        with patch(
            "orchay.utils.process._kill_process_sync",
            return_value=True,
        ) as mock_kill:
            result = await kill_process(1234)

            mock_kill.assert_called_once_with(1234)
            assert result is True


class TestKillProcessesByName:
    """kill_processes_by_name 테스트."""

    async def test_kills_all_matching(self) -> None:
        """TC-PR-15: 모든 일치하는 프로세스를 종료합니다."""
        processes = [
            ProcessInfo(1234, "test"),
            ProcessInfo(5678, "test"),
        ]

        with (
            patch(
                "orchay.utils.process.list_processes",
                return_value=processes,
            ),
            patch(
                "orchay.utils.process.kill_process",
                return_value=True,
            ) as mock_kill,
        ):
            count = await kill_processes_by_name("test")

            assert count == 2
            assert mock_kill.call_count == 2

    async def test_returns_zero_when_none_found(self) -> None:
        """TC-PR-16: 프로세스가 없으면 0을 반환합니다."""
        with patch("orchay.utils.process.list_processes", return_value=[]):
            count = await kill_processes_by_name("nonexistent")

            assert count == 0


class TestKillProcessNowait:
    """kill_process_nowait 테스트."""

    def test_uses_popen_on_windows(self) -> None:
        """TC-PR-17: Windows에서 Popen을 사용합니다."""
        with (
            patch("orchay.utils.process.is_windows", return_value=True),
            patch("subprocess.Popen") as mock_popen,
        ):
            kill_process_nowait(1234)

            mock_popen.assert_called_once()
            call_args = mock_popen.call_args[0][0]
            assert "taskkill" in call_args

    def test_uses_popen_on_unix(self) -> None:
        """TC-PR-18: Unix에서 Popen을 사용합니다."""
        with (
            patch("orchay.utils.process.is_windows", return_value=False),
            patch("subprocess.Popen") as mock_popen,
        ):
            kill_process_nowait(1234)

            mock_popen.assert_called_once()
            call_args = mock_popen.call_args[0][0]
            assert call_args == ["kill", "-9", "1234"]


class TestIsProcessRunning:
    """is_process_running 테스트."""

    def test_running_on_windows(self) -> None:
        """TC-PR-19: Windows에서 실행 중인 프로세스를 감지합니다."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = '"wezterm-gui.exe","1234","Console","1","50 K"'

        with (
            patch("orchay.utils.process.is_windows", return_value=True),
            patch("subprocess.run", return_value=mock_result),
        ):
            result = _is_process_running_sync(1234)

            assert result is True

    def test_not_running_on_windows(self) -> None:
        """TC-PR-20: Windows에서 종료된 프로세스를 감지합니다."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "정보: 지정한 조건에 맞는 작업이 없습니다."

        with (
            patch("orchay.utils.process.is_windows", return_value=True),
            patch("subprocess.run", return_value=mock_result),
        ):
            result = _is_process_running_sync(9999)

            assert result is False

    def test_running_on_unix(self) -> None:
        """TC-PR-21: Unix에서 실행 중인 프로세스를 감지합니다."""
        mock_result = MagicMock()
        mock_result.returncode = 0

        with (
            patch("orchay.utils.process.is_windows", return_value=False),
            patch("subprocess.run", return_value=mock_result),
        ):
            result = _is_process_running_sync(1234)

            assert result is True

    def test_not_running_on_unix(self) -> None:
        """TC-PR-22: Unix에서 종료된 프로세스를 감지합니다."""
        mock_result = MagicMock()
        mock_result.returncode = 1

        with (
            patch("orchay.utils.process.is_windows", return_value=False),
            patch("subprocess.run", return_value=mock_result),
        ):
            result = _is_process_running_sync(9999)

            assert result is False

    async def test_async_check(self) -> None:
        """TC-PR-23: 비동기 확인을 수행합니다."""
        with patch(
            "orchay.utils.process._is_process_running_sync",
            return_value=True,
        ):
            result = await is_process_running(1234)

            assert result is True
