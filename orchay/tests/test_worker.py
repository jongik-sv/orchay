"""Worker 상태 감지 테스트."""

import time
import zoneinfo
from datetime import datetime
from unittest.mock import patch

import pytest

import orchay.worker
from orchay.models.worker import PausedInfo, Worker, WorkerState
from orchay.worker import (
    detect_worker_state,
    get_fallback_resume_time,
    parse_done_signal,
    parse_resume_time,
)


class TestWorkerModel:
    """Worker 모델 테스트."""

    def test_is_available_when_idle(self) -> None:
        """IDLE 상태에서 할당 가능."""
        worker = Worker(id=1, pane_id=1, state=WorkerState.IDLE)
        assert worker.is_available() is True

    def test_is_available_when_busy(self) -> None:
        """BUSY 상태에서 할당 불가."""
        worker = Worker(id=1, pane_id=1, state=WorkerState.BUSY)
        assert worker.is_available() is False

    def test_is_available_when_manually_paused(self) -> None:
        """수동 일시정지 상태에서 할당 불가."""
        worker = Worker(id=1, pane_id=1, state=WorkerState.IDLE, is_manually_paused=True)
        assert worker.is_available() is False

    def test_pause(self) -> None:
        """Worker 수동 일시정지."""
        worker = Worker(id=1, pane_id=1)
        assert worker.is_manually_paused is False

        worker.pause()

        assert worker.is_manually_paused is True

    def test_resume(self) -> None:
        """Worker 수동 일시정지 해제."""
        worker = Worker(id=1, pane_id=1, is_manually_paused=True)
        assert worker.is_manually_paused is True

        worker.resume()

        assert worker.is_manually_paused is False

    def test_reset(self) -> None:
        """Worker 상태 초기화."""
        worker = Worker(
            id=1,
            pane_id=1,
            state=WorkerState.BUSY,
            current_task="TSK-01-01",
            current_step="build",
            retry_count=2,
        )

        worker.reset()

        assert worker.state == WorkerState.IDLE
        assert worker.current_task is None
        assert worker.current_step is None
        assert worker.retry_count == 0

    def test_reset_keeps_manually_paused(self) -> None:
        """reset()은 is_manually_paused를 유지."""
        worker = Worker(
            id=1,
            pane_id=1,
            state=WorkerState.BUSY,
            is_manually_paused=True,
        )

        worker.reset()

        assert worker.is_manually_paused is True


@pytest.fixture(autouse=True)
def reset_startup_time() -> None:
    """테스트에서 기본적으로 시작 후 3초 이후 상태로 설정."""
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
    async def test_detect_idle_at_startup(self) -> None:
        """UT-005: idle 상태 감지 (시작 시 3초 이내에만 프롬프트로 감지)."""
        # 시작 시(3초 이내)에만 프롬프트로 idle 감지
        orchay.worker._startup_time = time.time()  # 방금 시작한 상태
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            mock_get_text.return_value = "작업 완료\n> "  # 프롬프트로 idle 감지

            state, done_info = await detect_worker_state(pane_id=1)

            assert state == "idle"
            assert done_info is None

    @pytest.mark.asyncio
    async def test_detect_busy_with_prompt_when_task_active(self) -> None:
        """Task 실행 중에는 프롬프트만으로 idle 감지하지 않음."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            mock_get_text.return_value = "작업 완료\n> "  # 프롬프트만 있음

            # has_active_task=True: Task 실행 중
            state, done_info = await detect_worker_state(pane_id=1, has_active_task=True)

            # Task 실행 중에는 프롬프트만으로 idle 판정 안 함, busy 반환
            assert state == "busy"
            assert done_info is None

    @pytest.mark.asyncio
    async def test_detect_idle_with_prompt_when_no_task(self) -> None:
        """Task 없을 때는 프롬프트로 idle 감지 허용."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            mock_get_text.return_value = "작업 완료\n> "  # 프롬프트만 있음

            # has_active_task=False: Task 없음 (기본값)
            state, done_info = await detect_worker_state(pane_id=1, has_active_task=False)

            # Task 없으면 프롬프트로 idle 감지
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

            state, paused_info = await detect_worker_state(pane_id=1)

            assert state == "paused"
            # fallback: 30분 뒤 (시간 파싱 실패)
            assert isinstance(paused_info, PausedInfo)
            assert paused_info.reason == "rate limit"

    @pytest.mark.asyncio
    async def test_detect_paused_weekly_limit(self) -> None:
        """paused 상태 감지 (weekly limit)."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            # 11pm은 대부분의 시간대에서 미래이므로 안정적인 테스트 가능
            mock_get_text.return_value = "weekly limit reached, resets at 11pm"

            state, paused_info = await detect_worker_state(pane_id=1)

            assert state == "paused"
            assert isinstance(paused_info, PausedInfo)
            # 시간 파싱 성공: 11pm + 10분 = 11:10pm
            # (현재 시간이 11:10pm 이전이면 오늘 11:10pm, 이후면 1분 뒤)
            assert paused_info.resume_at is not None
            assert paused_info.reason == "rate limit"

    @pytest.mark.asyncio
    async def test_detect_paused_context_limit(self) -> None:
        """paused 상태 감지 (context limit)."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            mock_get_text.return_value = "context limit exceeded, conversation too long"

            state, paused_info = await detect_worker_state(pane_id=1)

            assert state == "paused"
            # fallback: 30분 뒤
            assert isinstance(paused_info, PausedInfo)

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

            state, paused_info = await detect_worker_state(pane_id=1)

            assert state == "paused"
            assert isinstance(paused_info, PausedInfo)

    @pytest.mark.asyncio
    async def test_output_lines_limit(self) -> None:
        """UT-015: 100줄 한 번 읽어서 DONE + 기본 상태 모두 처리 (성능 최적화)."""
        with (
            patch("orchay.worker.pane_exists", return_value=True),
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_get_text.return_value = "test output"

            await detect_worker_state(pane_id=1)

            # 성능 최적화: wezterm_get_text가 한 번만 호출됨 (100줄)
            assert mock_get_text.call_count == 1
            mock_get_text.assert_called_once_with(1, lines=100)


class TestParseResumeTime:
    """시간 파싱 테스트 (토큰 limit 재개 시간)."""

    def test_parse_6pm_when_before(self) -> None:
        """6pm 파싱: 현재 시간이 6:10pm 전이면 오늘 6:10pm."""
        detected_at = datetime(2025, 1, 2, 14, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        result = parse_resume_time("resets 6pm", detected_at)

        assert result.hour == 18
        assert result.minute == 10  # 6pm + 10분
        assert result.day == 2  # 오늘

    def test_parse_6pm_when_after(self) -> None:
        """6pm 파싱: 현재 시간이 6:10pm 후면 1분 뒤 즉시 재시도."""
        detected_at = datetime(2025, 1, 2, 19, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        result = parse_resume_time("resets 6pm", detected_at)

        # 이미 지났으면 1분 뒤 즉시 재시도 (다음날 대기 X)
        assert result.hour == 19
        assert result.minute == 1  # 19:00 + 1분
        assert result.day == 2  # 오늘

    def test_parse_5_59pm(self) -> None:
        """5:59pm 파싱: 6:10pm으로 동일."""
        detected_at = datetime(2025, 1, 2, 14, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        result = parse_resume_time("resets 5:59pm", detected_at)

        # 분 무시하고 6pm + 10분 = 6:10pm
        assert result.hour == 18
        assert result.minute == 10

    def test_parse_9am(self) -> None:
        """9am 파싱: 현재 8am이면 9:10am, 현재 2pm이면 1분 뒤."""
        # 9:10am 전이면 오늘 9:10am
        detected_at_before = datetime(2025, 1, 2, 8, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        result_before = parse_resume_time("resets 9am", detected_at_before)
        assert result_before.hour == 9
        assert result_before.minute == 10

        # 9:10am 후면 1분 뒤 즉시 재시도
        detected_at_after = datetime(2025, 1, 2, 14, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        result_after = parse_resume_time("resets 9am", detected_at_after)
        assert result_after.hour == 14
        assert result_after.minute == 1  # 14:00 + 1분

    def test_parse_9_30pm(self) -> None:
        """9:30pm 파싱: 10:10pm (올림)."""
        detected_at = datetime(2025, 1, 2, 14, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        result = parse_resume_time("rate limit resets at 9:30pm", detected_at)

        # 분 있으면 한 시간 올림: 9:30pm → 10pm + 10분 = 10:10pm
        assert result.hour == 22
        assert result.minute == 10

    def test_parse_12pm(self) -> None:
        """12pm 파싱 (정오): 12:10pm 전이면 오늘, 후면 1분 뒤."""
        # 12:10pm 전이면 오늘 12:10pm
        detected_at_before = datetime(2025, 1, 2, 10, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        result_before = parse_resume_time("resets 12pm", detected_at_before)
        assert result_before.hour == 12
        assert result_before.minute == 10

        # 12:10pm 후면 1분 뒤 즉시 재시도
        detected_at_after = datetime(2025, 1, 2, 14, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        result_after = parse_resume_time("resets 12pm", detected_at_after)
        assert result_after.hour == 14
        assert result_after.minute == 1

    def test_parse_12am(self) -> None:
        """12am 파싱 (자정): 12:10am 전이면 오늘, 후면 1분 뒤."""
        # 12:10am 전이면 오늘 12:10am
        detected_at_before = datetime(2025, 1, 2, 0, 5, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        result_before = parse_resume_time("resets 12am", detected_at_before)
        assert result_before.hour == 0
        assert result_before.minute == 10

        # 12:10am 후면 1분 뒤 즉시 재시도
        detected_at_after = datetime(2025, 1, 2, 14, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        result_after = parse_resume_time("resets 12am", detected_at_after)
        assert result_after.hour == 14
        assert result_after.minute == 1

    def test_parse_with_timezone(self) -> None:
        """타임존 정보 포함 파싱."""
        detected_at = datetime(2025, 1, 2, 14, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        result = parse_resume_time(
            "resets 6pm (Asia/Seoul) /extra-usage to finish", detected_at
        )

        assert result.hour == 18
        assert result.minute == 10
        assert result.tzinfo.key == "Asia/Seoul"

    def test_parse_no_match_raises_value_error(self) -> None:
        """시간 패턴 없으면 ValueError 발생."""
        detected_at = datetime(2025, 1, 2, 14, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))

        with pytest.raises(ValueError, match="Cannot parse resume time"):
            parse_resume_time("no time here", detected_at)

    def test_fallback_resume_time(self) -> None:
        """Fallback: 30분 뒤."""
        detected_at = datetime(2025, 1, 2, 14, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        result = get_fallback_resume_time(detected_at)

        expected = datetime(2025, 1, 2, 14, 30, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        assert result == expected


class TestDetectPausedWithTime:
    """토큰 limit 시간 파싱 통합 테스트."""

    @pytest.mark.asyncio
    async def test_detect_paused_with_resume_time(self) -> None:
        """토큰 limit 감지 후 시간 파싱."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            mock_get_text.return_value = (
                "⎿ You've hit your limit · resets 6pm (Asia/Seoul)\n"
                "/extra-usage to finish what you're working on."
            )

            state, info = await detect_worker_state(pane_id=1)

            assert state == "paused"
            assert isinstance(info, PausedInfo)
            assert info.reason == "rate limit"
            assert info.resume_at.hour == 18  # 6pm
            assert info.resume_at.tzinfo.key == "Asia/Seoul"

    @pytest.mark.asyncio
    async def test_detect_paused_fallback_when_no_time(self) -> None:
        """시간 없으면 fallback 30분 뒤 사용."""
        with (
            patch("orchay.worker.pane_exists") as mock_pane_exists,
            patch("orchay.worker.wezterm_get_text") as mock_get_text,
        ):
            mock_pane_exists.return_value = True
            mock_get_text.return_value = "rate limit exceeded, please wait"

            state, info = await detect_worker_state(pane_id=1)

            assert state == "paused"
            assert isinstance(info, PausedInfo)
            assert info.reason == "rate limit"
            # fallback: 30분 뒤
            assert info.message == "fallback: 30 minutes"
