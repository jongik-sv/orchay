"""WBS 파서 테스트."""

import asyncio
from pathlib import Path

import pytest

from orchay.wbs_parser import WbsParser, extract_status_code, parse_wbs, watch_wbs

FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestParseWbs:
    """parse_wbs() 함수 테스트."""

    @pytest.mark.asyncio
    async def test_parse_wbs_valid(self) -> None:
        """TC-01: 정상 wbs.md 파싱."""
        tasks = await parse_wbs(FIXTURES_DIR / "valid_wbs.md")

        assert len(tasks) == 4
        assert tasks[0].id == "TSK-01-01"
        assert tasks[0].category.value == "infrastructure"
        assert tasks[0].status.value == "[xx]"
        assert tasks[0].priority.value == "critical"

    @pytest.mark.asyncio
    async def test_parse_wbs_file_not_found(self) -> None:
        """TC-02: 파일 없음 처리."""
        tasks = await parse_wbs(Path("nonexistent.md"))

        assert tasks == []

    @pytest.mark.asyncio
    async def test_parse_wbs_cache_on_error(self) -> None:
        """TC-03: 파싱 오류 시 캐시 반환."""
        parser = WbsParser(FIXTURES_DIR / "valid_wbs.md")

        # 첫 번째 파싱 성공
        tasks1 = await parser.parse()
        assert len(tasks1) > 0

        # 경로 변경 후 파싱 (손상된 파일)
        parser._path = FIXTURES_DIR / "corrupted_wbs.md"

        # 캐시 반환
        tasks2 = await parser.parse()
        assert tasks2 == tasks1


class TestTaskAttributes:
    """Task 속성 파싱 테스트."""

    @pytest.mark.asyncio
    async def test_task_all_attributes(self) -> None:
        """TC-06: 모든 속성 파싱."""
        tasks = await parse_wbs(FIXTURES_DIR / "full_attributes_wbs.md")
        task = tasks[0]

        assert task.id == "TSK-01-02"
        assert task.title == "WBS 파서 구현"
        assert task.category.value == "development"
        assert task.domain == "backend"
        assert task.status.value == "[ ]"
        assert task.priority.value == "critical"
        assert "parser" in task.tags
        assert "TSK-01-01" in task.depends


class TestExtractStatusCode:
    """상태 코드 추출 테스트."""

    @pytest.mark.parametrize(
        "input_line,expected",
        [
            ("- status: [ ]", "[ ]"),
            ("- status: todo [ ]", "[ ]"),
            ("- status: detail-design [dd]", "[dd]"),
            ("- status: implement [im]", "[im]"),
            ("- status: done [xx]", "[xx]"),
            ("- status: analysis [an]", "[an]"),
            ("- status: fix [fx]", "[fx]"),
            ("- status: verify [vf]", "[vf]"),
            ("- status: approve [ap]", "[ap]"),
            ("- status: design [ds]", "[ds]"),
            ("- status: basic-design [bd]", "[bd]"),
        ],
    )
    def test_extract_status_code(self, input_line: str, expected: str) -> None:
        """TC-07: 모든 상태 기호 인식."""
        assert extract_status_code(input_line) == expected


class TestWatchWbs:
    """watch_wbs() 함수 테스트."""

    @pytest.mark.asyncio
    async def test_watch_wbs_callback(self, tmp_path: Path) -> None:
        """TC-04: 파일 변경 감지 및 콜백."""
        wbs_file = tmp_path / "wbs.md"
        wbs_file.write_text(
            "## WP-01: Test\n### TSK-01-01: Test\n- category: development\n- status: [ ]"
        )

        callback_called = asyncio.Event()
        received_tasks: list = []

        async def on_change(tasks: list) -> None:
            received_tasks.extend(tasks)
            callback_called.set()

        watcher = watch_wbs(str(wbs_file), on_change)
        watcher.start()

        try:
            # 파일 수정
            await asyncio.sleep(0.2)
            wbs_file.write_text(
                "## WP-01: Test\n### TSK-01-01: Test\n- category: development\n- status: [im]"
            )

            # 콜백 대기
            await asyncio.wait_for(callback_called.wait(), timeout=5.0)

            assert len(received_tasks) > 0
            assert received_tasks[-1].status.value == "[im]"
        finally:
            await watcher.stop()

    @pytest.mark.asyncio
    async def test_watch_wbs_debounce(self, tmp_path: Path) -> None:
        """TC-05: 디바운싱 동작."""
        wbs_file = tmp_path / "wbs.md"
        wbs_file.write_text(
            "## WP-01: Test\n### TSK-01-01: Test\n- category: development\n- status: [ ]"
        )

        callback_count = 0

        async def on_change(tasks: list) -> None:
            nonlocal callback_count
            callback_count += 1

        watcher = watch_wbs(str(wbs_file), on_change, debounce=0.5)
        watcher.start()

        try:
            # 빠른 연속 수정 (5회)
            for i in range(5):
                wbs_content = (
                    f"## WP-01: Test\n### TSK-01-01: Test {i}\n"
                    "- category: development\n- status: [ ]"
                )
                wbs_file.write_text(wbs_content)
                await asyncio.sleep(0.1)

            # 디바운스 대기
            await asyncio.sleep(1.0)

            # 1회만 호출되어야 함
            assert callback_count <= 2  # 최대 2회 (디바운싱 효과)
        finally:
            await watcher.stop()
