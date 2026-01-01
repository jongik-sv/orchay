"""WezTermAdapter 테스트."""

from unittest.mock import AsyncMock, patch

import pytest

from orchay.infrastructure.wezterm.adapter import (
    ITerminalAdapter,
    PaneInfo,
    WezTermAdapter,
    WezTermNotFoundError,
)


class TestPaneInfo:
    """PaneInfo 데이터클래스 테스트."""

    def test_pane_info_creation(self) -> None:
        """PaneInfo 생성."""
        info = PaneInfo(
            pane_id=1,
            workspace="default",
            cwd="/home/user",
            title="claude",
        )
        assert info.pane_id == 1
        assert info.workspace == "default"
        assert info.cwd == "/home/user"
        assert info.title == "claude"


class TestITerminalAdapter:
    """ITerminalAdapter 프로토콜 테스트."""

    def test_protocol_methods(self) -> None:
        """프로토콜 메서드 확인."""
        assert hasattr(ITerminalAdapter, "list_panes")
        assert hasattr(ITerminalAdapter, "get_text")
        assert hasattr(ITerminalAdapter, "send_text")
        assert hasattr(ITerminalAdapter, "pane_exists")
        assert hasattr(ITerminalAdapter, "get_active_pane_id")


class TestWezTermAdapterListPanes:
    """list_panes 메서드 테스트."""

    @pytest.fixture
    def adapter(self) -> WezTermAdapter:
        """테스트용 어댑터."""
        return WezTermAdapter()

    async def test_list_panes_success(self, adapter: WezTermAdapter) -> None:
        """pane 목록 조회 성공."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (
                b'[{"pane_id": 0, "workspace": "default", "cwd": "/home", "title": "zsh"}, '
                b'{"pane_id": 1, "workspace": "default", "cwd": "/home", "title": "claude"}]',
                b"",
            )
            mock_process.returncode = 0
            mock_exec.return_value = mock_process

            panes = await adapter.list_panes()

        assert len(panes) == 2
        assert panes[0].pane_id == 0
        assert panes[0].title == "zsh"
        assert panes[1].pane_id == 1
        assert panes[1].title == "claude"

    async def test_list_panes_empty(self, adapter: WezTermAdapter) -> None:
        """빈 pane 목록."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (b"[]", b"")
            mock_process.returncode = 0
            mock_exec.return_value = mock_process

            panes = await adapter.list_panes()

        assert len(panes) == 0

    async def test_list_panes_command_error(self, adapter: WezTermAdapter) -> None:
        """명령 실행 실패."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (b"", b"Error")
            mock_process.returncode = 1
            mock_exec.return_value = mock_process

            panes = await adapter.list_panes()

        assert len(panes) == 0

    async def test_list_panes_invalid_json(self, adapter: WezTermAdapter) -> None:
        """잘못된 JSON 응답."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (b"invalid json", b"")
            mock_process.returncode = 0
            mock_exec.return_value = mock_process

            panes = await adapter.list_panes()

        assert len(panes) == 0

    async def test_list_panes_wezterm_not_found(
        self, adapter: WezTermAdapter
    ) -> None:
        """WezTerm CLI 없음."""
        with patch(
            "asyncio.create_subprocess_exec", side_effect=FileNotFoundError()
        ):
            with pytest.raises(WezTermNotFoundError):
                await adapter.list_panes()


class TestWezTermAdapterGetText:
    """get_text 메서드 테스트."""

    @pytest.fixture
    def adapter(self) -> WezTermAdapter:
        """테스트용 어댑터."""
        return WezTermAdapter()

    async def test_get_text_success(self, adapter: WezTermAdapter) -> None:
        """텍스트 조회 성공."""
        expected_text = "Hello, World!\nSecond line"

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (expected_text.encode(), b"")
            mock_process.returncode = 0
            mock_exec.return_value = mock_process

            text = await adapter.get_text(pane_id=1, lines=50)

        assert text == expected_text

    async def test_get_text_truncates_lines(self, adapter: WezTermAdapter) -> None:
        """라인 수 제한."""
        long_text = "\n".join([f"line {i}" for i in range(100)])

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (long_text.encode(), b"")
            mock_process.returncode = 0
            mock_exec.return_value = mock_process

            text = await adapter.get_text(pane_id=1, lines=10)

        assert len(text.split("\n")) == 10

    async def test_get_text_command_error(self, adapter: WezTermAdapter) -> None:
        """명령 실행 실패."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (b"", b"Error")
            mock_process.returncode = 1
            mock_exec.return_value = mock_process

            text = await adapter.get_text(pane_id=1)

        assert text == ""

    async def test_get_text_decodes_utf8(self, adapter: WezTermAdapter) -> None:
        """UTF-8 디코딩."""
        korean_text = "안녕하세요"

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (korean_text.encode("utf-8"), b"")
            mock_process.returncode = 0
            mock_exec.return_value = mock_process

            text = await adapter.get_text(pane_id=1)

        assert text == korean_text

    async def test_get_text_wezterm_not_found(self, adapter: WezTermAdapter) -> None:
        """WezTerm CLI 없음."""
        with patch(
            "asyncio.create_subprocess_exec", side_effect=FileNotFoundError()
        ):
            text = await adapter.get_text(pane_id=1)

        assert text == ""


class TestWezTermAdapterSendText:
    """send_text 메서드 테스트."""

    @pytest.fixture
    def adapter(self) -> WezTermAdapter:
        """테스트용 어댑터."""
        return WezTermAdapter()

    async def test_send_text_success(self, adapter: WezTermAdapter) -> None:
        """텍스트 전송 성공."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (b"", b"")
            mock_process.returncode = 0
            mock_exec.return_value = mock_process

            await adapter.send_text(pane_id=1, text="echo hello\n")

            # 명령 호출 확인
            mock_exec.assert_called_once()

    async def test_send_text_uses_no_paste(self, adapter: WezTermAdapter) -> None:
        """--no-paste 옵션 사용."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (b"", b"")
            mock_process.returncode = 0
            mock_exec.return_value = mock_process

            await adapter.send_text(pane_id=1, text="test")

            call_args = mock_exec.call_args[0]
            assert "--no-paste" in call_args

    async def test_send_text_command_error_raises(
        self, adapter: WezTermAdapter
    ) -> None:
        """명령 실패 시 예외 발생."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (b"", b"Error")
            mock_process.returncode = 1
            mock_exec.return_value = mock_process

            with pytest.raises(RuntimeError, match="WezTerm send-text 실패"):
                await adapter.send_text(pane_id=1, text="test")

    async def test_send_text_wezterm_not_found(
        self, adapter: WezTermAdapter
    ) -> None:
        """WezTerm CLI 없음."""
        with patch(
            "asyncio.create_subprocess_exec", side_effect=FileNotFoundError()
        ):
            with pytest.raises(WezTermNotFoundError):
                await adapter.send_text(pane_id=1, text="test")


class TestWezTermAdapterPaneExists:
    """pane_exists 메서드 테스트."""

    @pytest.fixture
    def adapter(self) -> WezTermAdapter:
        """테스트용 어댑터."""
        return WezTermAdapter()

    async def test_pane_exists_true(self, adapter: WezTermAdapter) -> None:
        """pane 존재."""
        with patch.object(adapter, "list_panes") as mock_list:
            mock_list.return_value = [
                PaneInfo(pane_id=0, workspace="default", cwd="/", title=""),
                PaneInfo(pane_id=1, workspace="default", cwd="/", title=""),
            ]

            exists = await adapter.pane_exists(1)

        assert exists is True

    async def test_pane_exists_false(self, adapter: WezTermAdapter) -> None:
        """pane 미존재."""
        with patch.object(adapter, "list_panes") as mock_list:
            mock_list.return_value = [
                PaneInfo(pane_id=0, workspace="default", cwd="/", title=""),
            ]

            exists = await adapter.pane_exists(1)

        assert exists is False

    async def test_pane_exists_empty_list(self, adapter: WezTermAdapter) -> None:
        """빈 pane 목록."""
        with patch.object(adapter, "list_panes") as mock_list:
            mock_list.return_value = []

            exists = await adapter.pane_exists(0)

        assert exists is False


class TestWezTermAdapterGetActivePaneId:
    """get_active_pane_id 메서드 테스트."""

    @pytest.fixture
    def adapter(self) -> WezTermAdapter:
        """테스트용 어댑터."""
        return WezTermAdapter()

    async def test_get_active_pane_id_found(self, adapter: WezTermAdapter) -> None:
        """활성 pane ID 조회."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (
                b'[{"pane_id": 0, "is_active": false}, '
                b'{"pane_id": 1, "is_active": true}, '
                b'{"pane_id": 2, "is_active": false}]',
                b"",
            )
            mock_process.returncode = 0
            mock_exec.return_value = mock_process

            active_id = await adapter.get_active_pane_id()

        assert active_id == 1

    async def test_get_active_pane_id_not_found(
        self, adapter: WezTermAdapter
    ) -> None:
        """활성 pane 없음."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (
                b'[{"pane_id": 0, "is_active": false}, {"pane_id": 1, "is_active": false}]',
                b"",
            )
            mock_process.returncode = 0
            mock_exec.return_value = mock_process

            active_id = await adapter.get_active_pane_id()

        assert active_id is None

    async def test_get_active_pane_id_empty(self, adapter: WezTermAdapter) -> None:
        """pane 목록 비어있음."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (b"[]", b"")
            mock_process.returncode = 0
            mock_exec.return_value = mock_process

            active_id = await adapter.get_active_pane_id()

        assert active_id is None

    async def test_get_active_pane_id_command_error(
        self, adapter: WezTermAdapter
    ) -> None:
        """명령 실패."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = AsyncMock()
            mock_process.communicate.return_value = (b"", b"Error")
            mock_process.returncode = 1
            mock_exec.return_value = mock_process

            active_id = await adapter.get_active_pane_id()

        assert active_id is None

    async def test_get_active_pane_id_wezterm_not_found(
        self, adapter: WezTermAdapter
    ) -> None:
        """WezTerm CLI 없음."""
        with patch(
            "asyncio.create_subprocess_exec", side_effect=FileNotFoundError()
        ):
            active_id = await adapter.get_active_pane_id()

        assert active_id is None


class TestWezTermAdapterIntegration:
    """통합 테스트 (모킹 최소화)."""

    async def test_adapter_implements_protocol(self) -> None:
        """WezTermAdapter가 ITerminalAdapter 프로토콜 구현."""
        adapter = WezTermAdapter()

        # 프로토콜의 모든 메서드 존재 확인
        assert hasattr(adapter, "list_panes")
        assert hasattr(adapter, "get_text")
        assert hasattr(adapter, "send_text")
        assert hasattr(adapter, "pane_exists")
        assert hasattr(adapter, "get_active_pane_id")

        # callable 확인
        assert callable(adapter.list_panes)
        assert callable(adapter.get_text)
        assert callable(adapter.send_text)
        assert callable(adapter.pane_exists)
        assert callable(adapter.get_active_pane_id)


class TestWezTermNotFoundError:
    """WezTermNotFoundError 예외 테스트."""

    def test_exception_message(self) -> None:
        """예외 메시지."""
        error = WezTermNotFoundError("Test message")
        assert str(error) == "Test message"

    def test_exception_inherits_exception(self) -> None:
        """Exception 상속."""
        assert issubclass(WezTermNotFoundError, Exception)
