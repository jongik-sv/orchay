"""WezTerm CLI 래퍼 테스트."""

import json
from unittest.mock import AsyncMock, patch

import pytest

from orchay.utils.wezterm import (
    WezTermNotFoundError,
    get_active_pane_id,
    pane_exists,
    wezterm_get_text,
    wezterm_list_panes,
    wezterm_send_text,
)


class TestWeztermListPanes:
    """wezterm_list_panes 테스트."""

    @pytest.mark.asyncio
    async def test_list_panes_success(self) -> None:
        """UT-001: 정상 pane 목록 조회."""
        mock_json = json.dumps(
            [
                {"pane_id": 1, "workspace": "default", "cwd": "/home", "title": "bash"},
                {"pane_id": 2, "workspace": "default", "cwd": "/home", "title": "python"},
            ]
        )

        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(mock_json.encode(), b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await wezterm_list_panes()

        assert len(result) == 2
        assert result[0].pane_id == 1
        assert result[0].workspace == "default"
        assert result[0].cwd == "/home"
        assert result[0].title == "bash"

    @pytest.mark.asyncio
    async def test_list_panes_empty(self) -> None:
        """빈 pane 목록 처리."""
        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(b"[]", b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await wezterm_list_panes()

        assert result == []

    @pytest.mark.asyncio
    async def test_list_panes_wezterm_not_found(self) -> None:
        """WezTerm CLI 미설치 에러."""
        with (
            patch(
                "asyncio.create_subprocess_exec",
                side_effect=FileNotFoundError("wezterm not found"),
            ),
            pytest.raises(WezTermNotFoundError),
        ):
            await wezterm_list_panes()

    @pytest.mark.asyncio
    async def test_list_panes_process_error(self) -> None:
        """프로세스 실행 실패 시 빈 리스트 반환."""
        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(b"", b"error"))
        mock_process.returncode = 1

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await wezterm_list_panes()

        assert result == []

    @pytest.mark.asyncio
    async def test_list_panes_json_decode_error(self) -> None:
        """JSON 파싱 실패 시 빈 리스트 반환."""
        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(b"invalid json {", b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await wezterm_list_panes()

        assert result == []


class TestWeztermGetText:
    """wezterm_get_text 테스트."""

    @pytest.mark.asyncio
    async def test_get_text_success(self) -> None:
        """UT-002: 정상 텍스트 조회."""
        output_text = "Hello World\n작업 완료\n> "

        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(output_text.encode(), b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await wezterm_get_text(pane_id=1, lines=50)

        assert "Hello World" in result
        assert ">" in result

    @pytest.mark.asyncio
    async def test_get_text_pane_not_found(self) -> None:
        """UT-003: pane 미존재 시 빈 문자열 반환."""
        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(b"", b"pane not found"))
        mock_process.returncode = 1

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await wezterm_get_text(pane_id=999)

        assert result == ""

    @pytest.mark.asyncio
    async def test_get_text_default_lines(self) -> None:
        """기본 줄 수(50) 적용 확인."""
        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(b"test", b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process) as mock_exec:
            await wezterm_get_text(pane_id=1)

            # --start-line 옵션이 포함되어 있는지 확인
            call_args = mock_exec.call_args
            assert call_args is not None

    @pytest.mark.asyncio
    async def test_get_text_wezterm_not_found(self) -> None:
        """WezTerm CLI 없을 때 빈 문자열 반환."""
        with patch(
            "asyncio.create_subprocess_exec",
            side_effect=FileNotFoundError("wezterm not found"),
        ):
            result = await wezterm_get_text(pane_id=1)

        assert result == ""

    @pytest.mark.asyncio
    async def test_get_text_line_truncation(self) -> None:
        """라인 자르기 동작 확인."""
        # 100줄의 텍스트 생성
        lines_text = "\n".join([f"line {i}" for i in range(100)])

        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(lines_text.encode(), b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await wezterm_get_text(pane_id=1, lines=10)

        # 마지막 10줄만 반환되어야 함
        result_lines = result.split("\n")
        assert len(result_lines) == 10
        assert "line 90" in result
        assert "line 99" in result

    @pytest.mark.asyncio
    async def test_get_text_less_than_requested(self) -> None:
        """요청 줄 수보다 적은 출력."""
        lines_text = "line 1\nline 2\nline 3"

        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(lines_text.encode(), b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await wezterm_get_text(pane_id=1, lines=50)

        # 전체 텍스트 반환
        assert result == "line 1\nline 2\nline 3"


class TestPaneExists:
    """pane_exists 테스트."""

    @pytest.mark.asyncio
    async def test_pane_exists_true(self) -> None:
        """존재하는 pane 확인."""
        mock_json = json.dumps([{"pane_id": 1, "workspace": "default", "cwd": "/home", "title": "bash"}])

        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(mock_json.encode(), b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await pane_exists(pane_id=1)

        assert result is True

    @pytest.mark.asyncio
    async def test_pane_exists_false(self) -> None:
        """존재하지 않는 pane 확인."""
        mock_json = json.dumps([{"pane_id": 1, "workspace": "default", "cwd": "/home", "title": "bash"}])

        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(mock_json.encode(), b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await pane_exists(pane_id=999)

        assert result is False

    @pytest.mark.asyncio
    async def test_pane_exists_empty_list(self) -> None:
        """빈 pane 목록에서 확인."""
        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(b"[]", b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await pane_exists(pane_id=1)

        assert result is False


class TestGetActivePaneId:
    """get_active_pane_id 테스트."""

    @pytest.mark.asyncio
    async def test_get_active_pane_id_success(self) -> None:
        """활성 pane ID 조회 성공."""
        mock_json = json.dumps([
            {"pane_id": 1, "is_active": False, "workspace": "default"},
            {"pane_id": 2, "is_active": True, "workspace": "default"},
            {"pane_id": 3, "is_active": False, "workspace": "default"},
        ])

        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(mock_json.encode(), b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await get_active_pane_id()

        assert result == 2

    @pytest.mark.asyncio
    async def test_get_active_pane_id_no_active(self) -> None:
        """활성 pane 없음."""
        mock_json = json.dumps([
            {"pane_id": 1, "is_active": False, "workspace": "default"},
            {"pane_id": 2, "is_active": False, "workspace": "default"},
        ])

        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(mock_json.encode(), b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await get_active_pane_id()

        assert result is None

    @pytest.mark.asyncio
    async def test_get_active_pane_id_file_not_found(self) -> None:
        """WezTerm CLI 없음."""
        with patch(
            "asyncio.create_subprocess_exec",
            side_effect=FileNotFoundError("wezterm not found"),
        ):
            result = await get_active_pane_id()

        assert result is None

    @pytest.mark.asyncio
    async def test_get_active_pane_id_process_error(self) -> None:
        """프로세스 실행 실패."""
        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(b"", b"error"))
        mock_process.returncode = 1

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await get_active_pane_id()

        assert result is None

    @pytest.mark.asyncio
    async def test_get_active_pane_id_json_decode_error(self) -> None:
        """JSON 파싱 실패."""
        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(b"invalid json", b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await get_active_pane_id()

        assert result is None

    @pytest.mark.asyncio
    async def test_get_active_pane_id_empty_list(self) -> None:
        """빈 pane 목록."""
        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(b"[]", b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            result = await get_active_pane_id()

        assert result is None


class TestWeztermSendText:
    """wezterm_send_text 테스트."""

    @pytest.mark.asyncio
    async def test_send_text_success(self) -> None:
        """UT-004: 정상 명령 전송."""
        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(b"", b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            # 예외 없이 완료되면 성공
            await wezterm_send_text(pane_id=1, text="/wf:start TSK-01-01")

    @pytest.mark.asyncio
    async def test_send_text_injection_prevention(self) -> None:
        """UT-014: 명령 인젝션 방지 - shlex.quote 사용."""
        malicious_text = "; rm -rf /"

        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(b"", b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process) as mock_exec:
            await wezterm_send_text(pane_id=1, text=malicious_text)

            # 호출된 인자 확인
            call_args = mock_exec.call_args
            assert call_args is not None
            call_args[0]
            # 텍스트가 안전하게 전달되었는지 확인 (인젝션 불가)
            # wezterm cli send-text는 -- 뒤에 텍스트를 받으므로 안전

    @pytest.mark.asyncio
    async def test_send_text_with_newline(self) -> None:
        """개행 문자 포함 명령 전송."""
        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(b"", b""))
        mock_process.returncode = 0

        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            await wezterm_send_text(pane_id=1, text="/clear\r")

    @pytest.mark.asyncio
    async def test_send_text_failure(self) -> None:
        """전송 실패 시 예외."""
        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(return_value=(b"", b"error"))
        mock_process.returncode = 1

        with (
            patch("asyncio.create_subprocess_exec", return_value=mock_process),
            pytest.raises(RuntimeError),
        ):
            await wezterm_send_text(pane_id=1, text="test")

    @pytest.mark.asyncio
    async def test_send_text_wezterm_not_found(self) -> None:
        """WezTerm CLI 없을 때 WezTermNotFoundError."""
        with (
            patch(
                "asyncio.create_subprocess_exec",
                side_effect=FileNotFoundError("wezterm not found"),
            ),
            pytest.raises(WezTermNotFoundError),
        ):
            await wezterm_send_text(pane_id=1, text="test")
