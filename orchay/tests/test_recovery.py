"""자동 재개 모듈 테스트.

TSK-02-01: 자동 재개 메커니즘 테스트 명세 기반
"""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest

# 테스트 대상 모듈 (구현 후 임포트 가능)
# from orchay.recovery import (
#     extract_reset_time,
#     calculate_wait_seconds,
#     detect_paused_type,
#     handle_paused_worker,
#     PausedType,
# )


class TestExtractResetTime:
    """extract_reset_time() 함수 테스트."""

    @pytest.mark.asyncio
    async def test_format_resets_at(self) -> None:
        """'resets Oct 9 at 10:30am' 형식 파싱."""
        from orchay.recovery import extract_reset_time

        output = "Weekly limit reached · resets Oct 9 at 10:30am"
        result = await extract_reset_time(output)

        assert result is not None
        assert result.month == 10
        assert result.day == 9
        assert result.hour == 10
        assert result.minute == 30

    @pytest.mark.asyncio
    async def test_format_resets_pm(self) -> None:
        """PM 시간 파싱."""
        from orchay.recovery import extract_reset_time

        output = "Weekly limit reached · resets Oct 9 at 2:30pm"
        result = await extract_reset_time(output)

        assert result is not None
        assert result.hour == 14
        assert result.minute == 30

    @pytest.mark.asyncio
    async def test_format_resets_no_minute(self) -> None:
        """분 없는 형식 파싱 (resets Oct 6, 1pm)."""
        from orchay.recovery import extract_reset_time

        output = "resets Oct 6, 1pm"
        result = await extract_reset_time(output)

        assert result is not None
        assert result.month == 10
        assert result.day == 6
        assert result.hour == 13
        assert result.minute == 0

    @pytest.mark.asyncio
    async def test_format_reset_at(self) -> None:
        """'reset at' 형식 파싱."""
        from orchay.recovery import extract_reset_time

        output = "reset at Dec 15, 9:45am"
        result = await extract_reset_time(output)

        assert result is not None
        assert result.month == 12
        assert result.day == 15
        assert result.hour == 9
        assert result.minute == 45

    @pytest.mark.asyncio
    async def test_invalid_format(self) -> None:
        """파싱 불가능한 형식은 None 반환."""
        from orchay.recovery import extract_reset_time

        output = "some random text without reset time"
        result = await extract_reset_time(output)

        assert result is None

    @pytest.mark.asyncio
    async def test_year_rollover(self) -> None:
        """현재 시간보다 과거면 다음 연도 사용."""
        from orchay.recovery import extract_reset_time

        # 테스트 시 현재 시간 고정
        with patch("orchay.recovery.datetime") as mock_datetime:
            mock_datetime.now.return_value = datetime(2025, 12, 28, 15, 0)
            mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)

            output = "resets Jan 5 at 10:00am"
            result = await extract_reset_time(output)

            assert result is not None
            # 12월 28일 이후 Jan 5는 다음 연도
            assert result.year == 2026
            assert result.month == 1
            assert result.day == 5

    @pytest.mark.asyncio
    async def test_empty_output(self) -> None:
        """빈 출력 처리."""
        from orchay.recovery import extract_reset_time

        result = await extract_reset_time("")
        assert result is None


class TestCalculateWaitSeconds:
    """calculate_wait_seconds() 함수 테스트."""

    def test_future_time(self) -> None:
        """미래 시간까지 대기 초 계산."""
        from orchay.recovery import calculate_wait_seconds

        with patch("orchay.recovery.datetime") as mock_datetime:
            mock_datetime.now.return_value = datetime(2025, 12, 28, 10, 0, 0)

            reset_time = datetime(2025, 12, 28, 11, 0, 0)  # 1시간 후
            result = calculate_wait_seconds(reset_time)

            assert result == 3600

    def test_past_time_returns_zero(self) -> None:
        """과거 시간이면 0 반환."""
        from orchay.recovery import calculate_wait_seconds

        with patch("orchay.recovery.datetime") as mock_datetime:
            mock_datetime.now.return_value = datetime(2025, 12, 28, 12, 0, 0)

            reset_time = datetime(2025, 12, 28, 10, 0, 0)  # 과거
            result = calculate_wait_seconds(reset_time)

            assert result == 0


class TestDetectPausedType:
    """detect_paused_type() 함수 테스트."""

    def test_weekly_limit_pattern(self) -> None:
        """weekly limit 패턴 감지."""
        from orchay.recovery import detect_paused_type

        output = "Weekly limit reached · resets Oct 9 at 10:30am"
        result = detect_paused_type(output)

        assert result == "weekly_limit"

    def test_rate_limit_pattern(self) -> None:
        """rate limit 패턴 감지."""
        from orchay.recovery import detect_paused_type

        output = "Rate limit exceeded. Please wait..."
        result = detect_paused_type(output)

        assert result == "rate_limit"

    def test_please_wait_pattern(self) -> None:
        """please wait 패턴 감지."""
        from orchay.recovery import detect_paused_type

        output = "Too many requests. Please wait a moment."
        result = detect_paused_type(output)

        assert result == "rate_limit"

    def test_context_limit_pattern(self) -> None:
        """context limit 패턴 감지."""
        from orchay.recovery import detect_paused_type

        output = "Context limit reached. Conversation too long."
        result = detect_paused_type(output)

        assert result == "context_limit"

    def test_conversation_too_long(self) -> None:
        """conversation too long 패턴 감지."""
        from orchay.recovery import detect_paused_type

        output = "This conversation is too long. Please start a new one."
        result = detect_paused_type(output)

        assert result == "context_limit"

    def test_unknown_pattern(self) -> None:
        """알 수 없는 패턴은 unknown 반환."""
        from orchay.recovery import detect_paused_type

        output = "some random text"
        result = detect_paused_type(output)

        assert result == "unknown"

    def test_empty_output(self) -> None:
        """빈 출력은 unknown 반환."""
        from orchay.recovery import detect_paused_type

        result = detect_paused_type("")
        assert result == "unknown"


class TestHandlePausedWorker:
    """handle_paused_worker() 함수 테스트."""

    @pytest.mark.asyncio
    async def test_max_retries_exceeded(self) -> None:
        """최대 재시도 초과 시 error 상태 전환."""
        from orchay.models.config import RecoveryConfig
        from orchay.models.worker import Worker, WorkerState
        from orchay.recovery import handle_paused_worker

        worker = Worker(id=1, pane_id=100, state=WorkerState.PAUSED, retry_count=2)
        config = RecoveryConfig(max_retries=3)

        with (
            patch("orchay.recovery.wezterm_get_text", new_callable=AsyncMock) as mock_get,
            patch("orchay.recovery.wezterm_send_text", new_callable=AsyncMock),
            patch("orchay.recovery.detect_worker_state", new_callable=AsyncMock) as mock_state,
            patch("asyncio.sleep", new_callable=AsyncMock),
        ):
            mock_get.return_value = "rate limit"
            # 재개 실패 시뮬레이션
            mock_state.return_value = ("paused", None)
            result = await handle_paused_worker(worker, config)

            assert result is False
            assert worker.retry_count == 3
            assert worker.state == WorkerState.ERROR

    @pytest.mark.asyncio
    async def test_retry_within_limit(self) -> None:
        """재시도 제한 내 재시도."""
        from orchay.models.config import RecoveryConfig
        from orchay.models.worker import Worker, WorkerState
        from orchay.recovery import handle_paused_worker

        worker = Worker(id=1, pane_id=100, state=WorkerState.PAUSED, retry_count=0)
        config = RecoveryConfig(max_retries=3)

        with (
            patch("orchay.recovery.wezterm_get_text", new_callable=AsyncMock) as mock_get,
            patch("orchay.recovery.wezterm_send_text", new_callable=AsyncMock),
            patch("orchay.recovery.detect_worker_state", new_callable=AsyncMock) as mock_state,
            patch("asyncio.sleep", new_callable=AsyncMock),
        ):
            mock_get.return_value = "rate limit"
            mock_state.return_value = ("paused", None)
            result = await handle_paused_worker(worker, config)

            assert result is False
            assert worker.retry_count == 1
            assert worker.state == WorkerState.PAUSED

    @pytest.mark.asyncio
    async def test_retry_count_reset_on_success(self) -> None:
        """재개 성공 시 retry_count 0으로 초기화."""
        from orchay.models.config import RecoveryConfig
        from orchay.models.worker import Worker, WorkerState
        from orchay.recovery import handle_paused_worker

        worker = Worker(id=1, pane_id=100, state=WorkerState.PAUSED, retry_count=2)
        config = RecoveryConfig()

        with (
            patch("orchay.recovery.wezterm_get_text", new_callable=AsyncMock) as mock_get,
            patch("orchay.recovery.wezterm_send_text", new_callable=AsyncMock),
            patch("orchay.recovery.detect_worker_state", new_callable=AsyncMock) as mock_state,
            patch("asyncio.sleep", new_callable=AsyncMock),
        ):
            mock_get.return_value = "context limit"
            # 재개 성공 시뮬레이션
            mock_state.return_value = ("busy", None)
            result = await handle_paused_worker(worker, config)

            assert result is True
            assert worker.retry_count == 0
            assert worker.state == WorkerState.BUSY

    @pytest.mark.asyncio
    async def test_uses_asyncio_sleep(self) -> None:
        """asyncio.sleep 사용 확인."""
        from orchay.models.config import RecoveryConfig
        from orchay.models.worker import Worker, WorkerState
        from orchay.recovery import handle_paused_worker

        worker = Worker(id=1, pane_id=100, state=WorkerState.PAUSED, retry_count=0)
        config = RecoveryConfig(context_limit_wait=1)

        with (
            patch("orchay.recovery.wezterm_get_text", new_callable=AsyncMock) as mock_get,
            patch("orchay.recovery.wezterm_send_text", new_callable=AsyncMock),
            patch("orchay.recovery.detect_worker_state", new_callable=AsyncMock) as mock_state,
            patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep,
        ):
            mock_get.return_value = "context limit"
            mock_state.return_value = ("busy", None)
            await handle_paused_worker(worker, config)

            # asyncio.sleep이 호출되었는지 확인
            mock_sleep.assert_called()

    @pytest.mark.asyncio
    async def test_sends_resume_text(self) -> None:
        """'계속' 텍스트 전송 확인."""
        from orchay.models.config import RecoveryConfig
        from orchay.models.worker import Worker, WorkerState
        from orchay.recovery import handle_paused_worker

        worker = Worker(id=1, pane_id=100, state=WorkerState.PAUSED, retry_count=0)
        config = RecoveryConfig(resume_text="계속")

        with patch("orchay.recovery.wezterm_get_text", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = "context limit"
            with (
                patch("orchay.recovery.wezterm_send_text", new_callable=AsyncMock) as mock_send,
                patch("orchay.recovery.detect_worker_state", new_callable=AsyncMock) as mock_state,
            ):
                mock_state.return_value = ("busy", None)
                with patch("asyncio.sleep", new_callable=AsyncMock):
                    await handle_paused_worker(worker, config)

                    mock_send.assert_called()
                    # 전송된 텍스트에 "계속" 포함 확인
                    call_args = mock_send.call_args
                    assert "계속" in call_args[0][1]


class TestWeeklyLimitIntegration:
    """Weekly limit 통합 테스트."""

    @pytest.mark.asyncio
    async def test_weekly_limit_full_flow(self) -> None:
        """Weekly limit 전체 흐름."""
        from orchay.models.config import RecoveryConfig
        from orchay.models.worker import Worker, WorkerState
        from orchay.recovery import handle_paused_worker

        worker = Worker(id=1, pane_id=100, state=WorkerState.PAUSED)
        config = RecoveryConfig()

        weekly_output = "Weekly limit reached · resets Dec 28 at 23:59pm"

        with patch("orchay.recovery.wezterm_get_text", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = weekly_output
            with (
                patch("orchay.recovery.wezterm_send_text", new_callable=AsyncMock) as mock_send,
                patch("orchay.recovery.detect_worker_state", new_callable=AsyncMock) as mock_state,
            ):
                mock_state.return_value = ("busy", None)
                with patch("asyncio.sleep", new_callable=AsyncMock):
                    result = await handle_paused_worker(worker, config)

                    assert result is True
                    mock_send.assert_called_once()
                    call_args = mock_send.call_args
                    assert "계속" in call_args[0][1]


@pytest.mark.parametrize(
    "input_text,expected_month,expected_day,expected_hour",
    [
        ("resets Jan 15 at 9:00am", 1, 15, 9),
        ("resets Feb 28 at 12:00pm", 2, 28, 12),
        ("resets Mar 1 at 3:30pm", 3, 1, 15),
        ("resets Dec 31 at 11:59pm", 12, 31, 23),
        ("reset at Apr 10, 8am", 4, 10, 8),
        ("resets May 5, 2pm", 5, 5, 14),
    ],
)
@pytest.mark.asyncio
async def test_various_reset_formats(
    input_text: str, expected_month: int, expected_day: int, expected_hour: int
) -> None:
    """다양한 형식 파싱 테스트."""
    from orchay.recovery import extract_reset_time

    result = await extract_reset_time(input_text)

    assert result is not None
    assert result.month == expected_month
    assert result.day == expected_day
    assert result.hour == expected_hour
