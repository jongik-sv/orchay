# TSK-02-01 - 테스트 명세서

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-02-01 |
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-28 |
| 상태 | 작성중 |

---

## 1. 테스트 전략

### 1.1 테스트 범위

| 유형 | 대상 | 도구 |
|------|------|------|
| 단위 테스트 | extract_reset_time, detect_paused_type | pytest |
| 통합 테스트 | handle_paused_worker 전체 흐름 | pytest-asyncio |
| 모킹 | WezTerm CLI 호출 | unittest.mock |

### 1.2 테스트 환경

```
pytest>=8.0
pytest-asyncio>=0.23
unittest.mock (내장)
```

---

## 2. 단위 테스트

### T-01: Weekly Limit Reset 시간 파싱

**테스트 목적:** 다양한 형식의 weekly limit reset 시간을 정확히 파싱

```python
import pytest
from datetime import datetime
from orchay.recovery import extract_reset_time

class TestExtractResetTime:
    """extract_reset_time() 함수 테스트."""

    @pytest.mark.asyncio
    async def test_format_resets_at(self):
        """'resets Oct 9 at 10:30am' 형식 파싱."""
        output = "Weekly limit reached · resets Oct 9 at 10:30am"
        result = await extract_reset_time(output)

        assert result is not None
        assert result.month == 10
        assert result.day == 9
        assert result.hour == 10
        assert result.minute == 30

    @pytest.mark.asyncio
    async def test_format_resets_pm(self):
        """PM 시간 파싱."""
        output = "Weekly limit reached · resets Oct 9 at 2:30pm"
        result = await extract_reset_time(output)

        assert result is not None
        assert result.hour == 14
        assert result.minute == 30

    @pytest.mark.asyncio
    async def test_format_resets_no_minute(self):
        """분 없는 형식 파싱 (resets Oct 6, 1pm)."""
        output = "resets Oct 6, 1pm"
        result = await extract_reset_time(output)

        assert result is not None
        assert result.month == 10
        assert result.day == 6
        assert result.hour == 13
        assert result.minute == 0

    @pytest.mark.asyncio
    async def test_format_reset_at(self):
        """'reset at' 형식 파싱."""
        output = "reset at Dec 15, 9:45am"
        result = await extract_reset_time(output)

        assert result is not None
        assert result.month == 12
        assert result.day == 15
        assert result.hour == 9
        assert result.minute == 45

    @pytest.mark.asyncio
    async def test_invalid_format(self):
        """파싱 불가능한 형식은 None 반환."""
        output = "some random text without reset time"
        result = await extract_reset_time(output)

        assert result is None

    @pytest.mark.asyncio
    async def test_year_rollover(self):
        """현재 시간보다 과거면 다음 연도 사용."""
        # 현재가 2025-12-28이고 reset이 Jan 5 at 10am이면
        # 결과는 2026-01-05 10:00이어야 함
        output = "resets Jan 5 at 10:00am"
        result = await extract_reset_time(output)

        assert result is not None
        now = datetime.now()
        assert result > now
```

### T-02: Rate Limit 대기 시간

**테스트 목적:** Rate limit 패턴 감지 및 기본 60초 대기

```python
from orchay.recovery import detect_paused_type

class TestDetectPausedType:
    """detect_paused_type() 함수 테스트."""

    def test_rate_limit_pattern(self):
        """rate limit 패턴 감지."""
        output = "Rate limit exceeded. Please wait..."
        result = detect_paused_type(output)

        assert result == "rate_limit"

    def test_please_wait_pattern(self):
        """please wait 패턴 감지."""
        output = "Too many requests. Please wait a moment."
        result = detect_paused_type(output)

        assert result == "rate_limit"
```

### T-03: Context Limit 대기 시간

**테스트 목적:** Context limit 패턴 감지 및 5초 대기

```python
class TestContextLimit:
    """Context limit 관련 테스트."""

    def test_context_limit_pattern(self):
        """context limit 패턴 감지."""
        output = "Context limit reached. Conversation too long."
        result = detect_paused_type(output)

        assert result == "context_limit"

    def test_conversation_too_long(self):
        """conversation too long 패턴 감지."""
        output = "This conversation is too long. Please start a new one."
        result = detect_paused_type(output)

        assert result == "context_limit"
```

### T-04: 재시도 제한 처리

**테스트 목적:** 최대 재시도 초과 시 error 상태 전환

```python
import pytest
from unittest.mock import AsyncMock, patch
from orchay.recovery import handle_paused_worker
from orchay.models.worker import Worker
from orchay.models.config import RecoveryConfig

class TestRetryLimit:
    """재시도 제한 테스트."""

    @pytest.mark.asyncio
    async def test_max_retries_exceeded(self):
        """최대 재시도 초과 시 error 상태 전환."""
        worker = Worker(id=1, pane_id=100, state="paused", retry_count=2)
        config = RecoveryConfig(max_retries=3)

        with patch("orchay.recovery.wezterm_get_text", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = "rate limit"
            with patch("orchay.recovery.wezterm_send_text", new_callable=AsyncMock):
                with patch("orchay.recovery.detect_worker_state", new_callable=AsyncMock) as mock_state:
                    # 재개 실패 시뮬레이션
                    mock_state.return_value = ("paused", None)

                    result = await handle_paused_worker(worker, config)

                    assert result is False
                    assert worker.retry_count == 3
                    assert worker.state == "error"

    @pytest.mark.asyncio
    async def test_retry_within_limit(self):
        """재시도 제한 내 재시도."""
        worker = Worker(id=1, pane_id=100, state="paused", retry_count=0)
        config = RecoveryConfig(max_retries=3)

        with patch("orchay.recovery.wezterm_get_text", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = "rate limit"
            with patch("orchay.recovery.wezterm_send_text", new_callable=AsyncMock):
                with patch("orchay.recovery.detect_worker_state", new_callable=AsyncMock) as mock_state:
                    mock_state.return_value = ("paused", None)

                    result = await handle_paused_worker(worker, config)

                    assert result is False
                    assert worker.retry_count == 1
                    assert worker.state == "paused"  # 아직 error 아님
```

### T-05: 다양한 형식 Reset 시간 파싱

**테스트 목적:** 지원하는 모든 형식의 reset 시간 파싱 검증

```python
@pytest.mark.parametrize("input_text,expected_month,expected_day,expected_hour", [
    ("resets Jan 15 at 9:00am", 1, 15, 9),
    ("resets Feb 28 at 12:00pm", 2, 28, 12),
    ("resets Mar 1 at 3:30pm", 3, 1, 15),
    ("resets Dec 31 at 11:59pm", 12, 31, 23),
    ("reset at Apr 10, 8am", 4, 10, 8),
    ("resets May 5, 2pm", 5, 5, 14),
])
@pytest.mark.asyncio
async def test_various_formats(input_text, expected_month, expected_day, expected_hour):
    """다양한 형식 파싱 테스트."""
    result = await extract_reset_time(input_text)

    assert result is not None
    assert result.month == expected_month
    assert result.day == expected_day
    assert result.hour == expected_hour
```

### T-06: 재개 성공 시 retry_count 초기화

**테스트 목적:** 재개 성공 후 retry_count=0 확인

```python
class TestRetryReset:
    """재시도 카운트 초기화 테스트."""

    @pytest.mark.asyncio
    async def test_retry_count_reset_on_success(self):
        """재개 성공 시 retry_count 0으로 초기화."""
        worker = Worker(id=1, pane_id=100, state="paused", retry_count=2)
        config = RecoveryConfig()

        with patch("orchay.recovery.wezterm_get_text", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = "context limit"
            with patch("orchay.recovery.wezterm_send_text", new_callable=AsyncMock):
                with patch("orchay.recovery.detect_worker_state", new_callable=AsyncMock) as mock_state:
                    # 재개 성공 시뮬레이션
                    mock_state.return_value = ("busy", None)

                    result = await handle_paused_worker(worker, config)

                    assert result is True
                    assert worker.retry_count == 0
                    assert worker.state == "busy"
```

### T-07: 비동기 대기 동작

**테스트 목적:** asyncio.sleep 사용 확인

```python
import asyncio
from unittest.mock import patch

class TestAsyncSleep:
    """비동기 대기 테스트."""

    @pytest.mark.asyncio
    async def test_uses_asyncio_sleep(self):
        """asyncio.sleep 사용 확인."""
        worker = Worker(id=1, pane_id=100, state="paused", retry_count=0)
        config = RecoveryConfig(context_limit_wait=1)  # 1초로 설정

        with patch("orchay.recovery.wezterm_get_text", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = "context limit"
            with patch("orchay.recovery.wezterm_send_text", new_callable=AsyncMock):
                with patch("orchay.recovery.detect_worker_state", new_callable=AsyncMock) as mock_state:
                    mock_state.return_value = ("busy", None)
                    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                        await handle_paused_worker(worker, config)

                        # asyncio.sleep이 호출되었는지 확인
                        mock_sleep.assert_called()
```

---

## 3. 통합 테스트

### T-INT-01: Weekly Limit 전체 흐름

**테스트 목적:** Weekly limit 감지부터 재개까지 전체 흐름 검증

```python
class TestWeeklyLimitFlow:
    """Weekly limit 통합 테스트."""

    @pytest.mark.asyncio
    async def test_weekly_limit_full_flow(self):
        """Weekly limit 전체 흐름."""
        worker = Worker(id=1, pane_id=100, state="paused")
        config = RecoveryConfig(weekly_limit_default=1)  # 테스트용 1초

        weekly_output = "Weekly limit reached · resets Dec 28 at 23:59pm"

        with patch("orchay.recovery.wezterm_get_text", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = weekly_output
            with patch("orchay.recovery.wezterm_send_text", new_callable=AsyncMock) as mock_send:
                with patch("orchay.recovery.detect_worker_state", new_callable=AsyncMock) as mock_state:
                    mock_state.return_value = ("busy", None)
                    with patch("asyncio.sleep", new_callable=AsyncMock):
                        result = await handle_paused_worker(worker, config)

                        assert result is True
                        # "계속" 전송 확인
                        mock_send.assert_called_once()
                        call_args = mock_send.call_args
                        assert "계속" in call_args[0][1]
```

### T-INT-02: 스케줄러 루프 통합

**테스트 목적:** 메인 루프에서 paused 상태 처리 확인

```python
class TestSchedulerIntegration:
    """스케줄러 통합 테스트."""

    @pytest.mark.asyncio
    async def test_scheduler_handles_paused(self):
        """스케줄러가 paused 상태를 처리하는지 확인."""
        # 이 테스트는 scheduler.py 구현 후 작성
        pass
```

---

## 4. 에지 케이스

### T-EDGE-01: 빈 출력

```python
class TestEdgeCases:
    """에지 케이스 테스트."""

    @pytest.mark.asyncio
    async def test_empty_output(self):
        """빈 출력 처리."""
        result = detect_paused_type("")
        assert result == "unknown"

    @pytest.mark.asyncio
    async def test_none_output(self):
        """None 출력 처리."""
        result = await extract_reset_time("")
        assert result is None
```

### T-EDGE-02: 잘못된 날짜

```python
    @pytest.mark.asyncio
    async def test_invalid_month(self):
        """존재하지 않는 월 처리."""
        output = "resets Xyz 15 at 10:00am"
        result = await extract_reset_time(output)
        # 파싱 실패하거나 기본값 사용
        # 구현에 따라 None 또는 기본 월 사용
```

---

## 5. 테스트 파일 구조

```
orchay/tests/
├── test_recovery.py        # 자동 재개 단위 테스트
│   ├── TestExtractResetTime
│   ├── TestDetectPausedType
│   ├── TestRetryLimit
│   └── TestRetryReset
├── test_recovery_integration.py  # 통합 테스트
│   ├── TestWeeklyLimitFlow
│   └── TestSchedulerIntegration
└── conftest.py             # 공통 fixtures
    ├── worker_fixture
    └── config_fixture
```

---

## 6. conftest.py 예시

```python
import pytest
from orchay.models.worker import Worker
from orchay.models.config import RecoveryConfig

@pytest.fixture
def worker():
    """기본 Worker fixture."""
    return Worker(id=1, pane_id=100, state="paused", retry_count=0)

@pytest.fixture
def config():
    """기본 RecoveryConfig fixture."""
    return RecoveryConfig(
        resume_text="계속",
        default_wait_time=1,  # 테스트용 짧은 대기
        max_retries=3,
        weekly_limit_default=1,
        context_limit_wait=1,
    )
```

---

## 7. 실행 명령

```bash
# 단위 테스트만 실행
pytest tests/test_recovery.py -v

# 통합 테스트 포함
pytest tests/ -v

# 커버리지 포함
pytest tests/ --cov=orchay.recovery --cov-report=html
```

---

## 변경 이력

| 버전 | 일자 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-28 | 최초 작성 |
