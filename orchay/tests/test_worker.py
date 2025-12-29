"""Worker 상태 감지 테스트."""

import time
from unittest.mock import patch

import pytest

import orchay.worker
from orchay.worker import detect_worker_state, parse_done_signal


@pytest.fixture(autouse=True)
def reset_startup_time() -> None:
    """테스트에서 idle 감지가 즉시 동작하도록 startup_time을 과거로 설정."""
    orchay.worker._startup_time = time.time() - 100  # 100초 전으로 설정


class TestParseDoneSignal:
    """parse_done_signal 테스트."""

    def test_parse_success(self) -> None:
        """UT-012: ORCHAY_DONE 파싱 성공."""
        text = "some output\nORCHAY_DONE:TSK-01-04:start:success\n> "

        result = parse_done_signal(text)

        assert result is not None
        assert result.task_id == "TSK-01-04"
        assert result.action == "start"
        assert result.status == "success"
        assert result.message is None

    def test_parse_with_error_message(self) -> None:
        """에러 메시지 포함 파싱."""
        text = "ORCHAY_DONE:TSK-01-04:build:error:TDD 5회 초과"

        result = parse_done_signal(text)

        assert result is not None
        assert result.task_id == "TSK-01-04"
        assert result.action == "build"
        assert result.status == "error"
        assert result.message == "TDD 5회 초과"

    def test_parse_no_match(self) -> None:
        """ORCHAY_DONE 패턴 없음."""
        text = "some random output\n> "

        result = parse_done_signal(text)

        assert result is None

    def test_parse_multiple_matches(self) -> None:
        """여러 ORCHAY_DONE 중 마지막 것 파싱."""
        text = (
            "ORCHAY_DONE:TSK-01-01:start:success\n"
            "작업 진행 중...\n"
            "ORCHAY_DONE:TSK-01-04:build:success\n"
        )

        result = parse_done_signal(text)

        assert result is not None
        assert result.task_id == "TSK-01-04"

    def test_parse_with_project_name(self) -> None:
        """프로젝트명 포함 ORCHAY_DONE 파싱."""
        text = "ORCHAY_DONE:orchay/TSK-01-01:done:success"

        result = parse_done_signal(text)

        assert result is not None
        assert result.task_id == "orchay/TSK-01-01"
        assert result.action == "done"
        assert result.status == "success"

    def test_fallback_pattern_without_project(self) -> None:
        """Fallback 패턴: 프로젝트명 없이 'Task TSK-XX 완료'."""
        sep = "═" * 35
        text = f"{sep}\nTask TSK-02-04 완료\n{sep}"

        result = parse_done_signal(text)

        assert result is not None
        assert result.task_id == "TSK-02-04"
        assert result.action == "done"
        assert result.status == "success"
        assert result.message == "fallback pattern"

    def test_fallback_pattern_with_project(self) -> None:
        """Fallback 패턴: 프로젝트명 포함 'Task project/TSK-XX 완료'."""
        sep = "═" * 35
        text = f"{sep}\nTask orchay/TSK-01-01 완료\n{sep}"

        result = parse_done_signal(text)

        assert result is not None
        assert result.task_id == "orchay/TSK-01-01"
        assert result.action == "done"
        assert result.status == "success"


class TestDetectWorkerState:
    """detect_worker_state 테스트."""

    @pytest.mark.asyncio
    async def test_detect_idle(self) -> None:
        """UT-005: idle 상태 감지."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            mock_get_text.return_value = "작업 완료\n> "  # 파일에 작업 없음

            state, done_info = await detect_worker_state(pane_id=1)

            assert state == "idle"
            assert done_info is None

    @pytest.mark.asyncio
    async def test_detect_busy(self) -> None:
        """UT-006: busy 상태 감지."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            # 파일에 없지만 busy 패턴 감지
            mock_get_text.return_value = "[wf:build] 구현 중...\n진행률: 50%"

            state, done_info = await detect_worker_state(pane_id=1)

            assert state == "busy"
            assert done_info is None

    @pytest.mark.asyncio
    async def test_detect_done(self) -> None:
        """UT-007: done 상태 감지 (active pane에서)."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            # active 상태에서만 done 반환
            mock_get_text.return_value = "ORCHAY_DONE:TSK-01-04:build:success\n> "

            state, done_info = await detect_worker_state(pane_id=1)

            assert state == "done"
            assert done_info is not None
            assert done_info.task_id == "TSK-01-04"
            assert done_info.action == "build"
            assert done_info.status == "success"

    @pytest.mark.asyncio
    async def test_detect_paused_rate_limit(self) -> None:
        """UT-008: paused 상태 감지 (rate limit)."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            mock_get_text.return_value = "rate limit exceeded, please wait..."

            state, done_info = await detect_worker_state(pane_id=1)

            assert state == "paused"
            assert done_info is None

    @pytest.mark.asyncio
    async def test_detect_paused_weekly_limit(self) -> None:
        """paused 상태 감지 (weekly limit)."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            mock_get_text.return_value = "weekly limit reached, resets at Oct 9 10:30am"

            state, done_info = await detect_worker_state(pane_id=1)

            assert state == "paused"

    @pytest.mark.asyncio
    async def test_detect_paused_context_limit(self) -> None:
        """paused 상태 감지 (context limit)."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            mock_get_text.return_value = "context limit exceeded, conversation too long"

            state, done_info = await detect_worker_state(pane_id=1)

            assert state == "paused"

    @pytest.mark.asyncio
    async def test_detect_error(self) -> None:
        """UT-009: error 상태 감지."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            mock_get_text.return_value = "Error: Task failed\n❌ 실패"

            state, done_info = await detect_worker_state(pane_id=1)

            assert state == "error"
            assert done_info is None

    @pytest.mark.asyncio
    async def test_detect_error_failed(self) -> None:
        """error 상태 감지 (Failed 패턴)."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            mock_get_text.return_value = "Failed: Build error"

            state, done_info = await detect_worker_state(pane_id=1)

            assert state == "error"

    @pytest.mark.asyncio
    async def test_detect_blocked(self) -> None:
        """UT-010: blocked 상태 감지."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            mock_get_text.return_value = "계속하시겠습니까? (y/n)"

            state, done_info = await detect_worker_state(pane_id=1)

            assert state == "blocked"
            assert done_info is None

    @pytest.mark.asyncio
    async def test_detect_blocked_question(self) -> None:
        """blocked 상태 감지 (질문 패턴)."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            mock_get_text.return_value = "어떤 옵션을 선택하시겠습니까?"

            state, done_info = await detect_worker_state(pane_id=1)

            assert state == "blocked"

    @pytest.mark.asyncio
    async def test_detect_dead(self) -> None:
        """UT-011: dead 상태 감지 (pane 미존재)."""
        with patch("orchay.worker.wezterm_get_text") as mock_get_text:
            # pane 미존재 시 빈 문자열 반환 + 내부에서 pane_exists 확인
            mock_get_text.return_value = ""

        with patch("orchay.worker.pane_exists") as mock_exists:
            mock_exists.return_value = False

            state, done_info = await detect_worker_state(pane_id=999)

            assert state == "dead"
            assert done_info is None

    @pytest.mark.asyncio
    async def test_priority_done_over_idle(self) -> None:
        """UT-013: 우선순위 테스트 - done이 idle보다 우선 (active pane에서)."""
        with (
            patch("orchay.worker.pane_exists", return_value=True),
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            # done 패턴과 idle 패턴(>) 동시 존재
            mock_get_text.return_value = "ORCHAY_DONE:TSK-01-04:build:success\n> "

            state, done_info = await detect_worker_state(pane_id=1)

            # active pane에서 done이 idle보다 우선
            assert state == "done"

    @pytest.mark.asyncio
    async def test_priority_paused_over_idle(self) -> None:
        """우선순위 테스트 - paused가 idle보다 우선."""
        with (
            patch("orchay.worker.pane_exists", return_value=True),
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_get_text.return_value = "rate limit exceeded, please wait\n> "

            state, _done_info = await detect_worker_state(pane_id=1)

            assert state == "paused"

    @pytest.mark.asyncio
    async def test_50_lines_limit(self) -> None:
        """UT-015: 최근 50줄만 검색."""
        with (
            patch("orchay.worker.pane_exists", return_value=True),
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_get_text.return_value = "test output"

            await detect_worker_state(pane_id=1)

            # wezterm_get_text가 lines=50으로 호출되었는지 확인
            mock_get_text.assert_called_once_with(1, lines=50)
