"""WBS 파서 테스트."""

import asyncio
from pathlib import Path

import pytest

from orchay.models import TaskStatus
from orchay.wbs_parser import (
    WbsParser,
    parse_wbs,
    update_task_blocked_by,
    update_task_status,
    watch_wbs,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestParseWbs:
    """parse_wbs() 함수 테스트."""

    @pytest.mark.asyncio
    async def test_parse_wbs_valid(self) -> None:
        """TC-01: 정상 wbs.yaml 파싱."""
        tasks = await parse_wbs(FIXTURES_DIR / "valid_wbs.yaml")

        assert len(tasks) == 4
        assert tasks[0].id == "TSK-01-01"
        assert tasks[0].category.value == "infrastructure"
        assert tasks[0].status.value == "[xx]"
        assert tasks[0].priority.value == "critical"

    @pytest.mark.asyncio
    async def test_parse_wbs_file_not_found(self) -> None:
        """TC-02: 파일 없음 처리."""
        tasks = await parse_wbs(Path("nonexistent.yaml"))

        assert tasks == []

    @pytest.mark.asyncio
    async def test_parse_wbs_cache_on_error(self) -> None:
        """TC-03: 파싱 오류 시 캐시 반환."""
        parser = WbsParser(FIXTURES_DIR / "valid_wbs.yaml")

        # 첫 번째 파싱 성공
        tasks1 = await parser.parse()
        assert len(tasks1) > 0

        # 경로 변경 후 파싱 (손상된 파일)
        parser._path = FIXTURES_DIR / "corrupted_wbs.yaml"

        # 캐시 반환
        tasks2 = await parser.parse()
        assert tasks2 == tasks1


class TestTaskAttributes:
    """Task 속성 파싱 테스트."""

    @pytest.mark.asyncio
    async def test_task_all_attributes(self) -> None:
        """TC-06: 모든 속성 파싱."""
        tasks = await parse_wbs(FIXTURES_DIR / "full_attributes_wbs.yaml")
        task = tasks[0]

        assert task.id == "TSK-01-02"
        assert task.title == "WBS 파서 구현"
        assert task.category.value == "development"
        assert task.domain == "backend"
        assert task.status.value == "[ ]"
        assert task.priority.value == "critical"
        assert "parser" in task.tags
        assert "TSK-01-01" in task.depends


class TestStatusParsing:
    """상태 코드 파싱 테스트."""

    @pytest.mark.asyncio
    async def test_parse_all_status_codes(self, tmp_path: Path) -> None:
        """TC-07: 모든 상태 코드 인식."""
        status_codes = [
            ("[ ]", TaskStatus.TODO),
            ("[bd]", TaskStatus.BASIC_DESIGN),
            ("[dd]", TaskStatus.DETAIL_DESIGN),
            ("[an]", TaskStatus.ANALYSIS),
            ("[ds]", TaskStatus.DESIGN),
            ("[ap]", TaskStatus.APPROVED),
            ("[im]", TaskStatus.IMPLEMENT),
            ("[fx]", TaskStatus.FIX),
            ("[vf]", TaskStatus.VERIFY),
            ("[xx]", TaskStatus.DONE),
        ]

        for code, expected_status in status_codes:
            yaml_content = f"""project:
  id: test
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
        title: Test Task
        category: development
        status: "{code}"
"""
            wbs_file = tmp_path / f"wbs_{code.replace('[', '').replace(']', '')}.yaml"
            wbs_file.write_text(yaml_content)

            tasks = await parse_wbs(wbs_file)
            assert len(tasks) == 1
            assert tasks[0].status == expected_status, f"Failed for status code {code}"


class TestWatchWbs:
    """watch_wbs() 함수 테스트."""

    @pytest.mark.asyncio
    async def test_watch_wbs_callback(self, tmp_path: Path) -> None:
        """TC-04: 파일 변경 감지 및 콜백."""
        wbs_file = tmp_path / "wbs.yaml"
        wbs_file.write_text("""project:
  id: test
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
        title: Test
        category: development
        status: "[ ]"
""")

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
            wbs_file.write_text("""project:
  id: test
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
        title: Test
        category: development
        status: "[im]"
""")

            # 콜백 대기
            await asyncio.wait_for(callback_called.wait(), timeout=5.0)

            assert len(received_tasks) > 0
            assert received_tasks[-1].status.value == "[im]"
        finally:
            await watcher.stop()

    @pytest.mark.asyncio
    async def test_watch_wbs_debounce(self, tmp_path: Path) -> None:
        """TC-05: 디바운싱 동작."""
        wbs_file = tmp_path / "wbs.yaml"
        wbs_file.write_text("""project:
  id: test
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
        title: Test
        category: development
        status: "[ ]"
""")

        callback_count = 0

        async def on_change(tasks: list) -> None:
            nonlocal callback_count
            callback_count += 1

        watcher = watch_wbs(str(wbs_file), on_change, debounce=0.5)
        watcher.start()

        try:
            # 빠른 연속 수정 (5회)
            for i in range(5):
                wbs_content = f"""project:
  id: test
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
        title: Test {i}
        category: development
        status: "[ ]"
"""
                wbs_file.write_text(wbs_content)
                await asyncio.sleep(0.1)

            # 디바운스 대기
            await asyncio.sleep(1.0)

            # 1회만 호출되어야 함
            assert callback_count <= 2  # 최대 2회 (디바운싱 효과)
        finally:
            await watcher.stop()


class TestUpdateTaskStatus:
    """update_task_status() 함수 테스트."""

    @pytest.mark.asyncio
    async def test_update_status_success(self, tmp_path: Path) -> None:
        """TC-08: 상태 업데이트 성공."""
        wbs_file = tmp_path / "wbs.yaml"
        wbs_file.write_text("""project:
  id: test
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
        title: Test Task
        category: development
        status: "[ ]"
""")

        result = await update_task_status(wbs_file, "TSK-01-01", "[im]")

        assert result is True
        content = wbs_file.read_text()
        assert "[im]" in content

    @pytest.mark.asyncio
    async def test_update_status_file_not_found(self, tmp_path: Path) -> None:
        """TC-09: 파일 없음 처리."""
        wbs_file = tmp_path / "nonexistent.yaml"

        result = await update_task_status(wbs_file, "TSK-01-01", "[im]")

        assert result is False

    @pytest.mark.asyncio
    async def test_update_status_task_not_found(self, tmp_path: Path) -> None:
        """TC-10: Task ID 없음 처리."""
        wbs_file = tmp_path / "wbs.yaml"
        wbs_file.write_text("""project:
  id: test
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
        title: Test Task
        category: development
        status: "[ ]"
""")

        result = await update_task_status(wbs_file, "TSK-99-99", "[im]")

        assert result is False

    @pytest.mark.asyncio
    async def test_update_status_already_same(self, tmp_path: Path) -> None:
        """TC-11: 이미 동일한 상태일 경우 True 반환."""
        wbs_file = tmp_path / "wbs.yaml"
        wbs_file.write_text("""project:
  id: test
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
        title: Test Task
        category: development
        status: "[im]"
""")

        result = await update_task_status(wbs_file, "TSK-01-01", "[im]")

        assert result is True

    @pytest.mark.asyncio
    async def test_update_status_multiple_tasks(self, tmp_path: Path) -> None:
        """TC-12: 여러 Task 중 특정 Task만 업데이트."""
        wbs_file = tmp_path / "wbs.yaml"
        wbs_file.write_text("""project:
  id: test
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
        title: First Task
        category: development
        status: "[ ]"
      - id: TSK-01-02
        title: Second Task
        category: development
        status: "[ ]"
""")

        result = await update_task_status(wbs_file, "TSK-01-02", "[im]")

        assert result is True
        # YAML 재파싱으로 확인
        tasks = await parse_wbs(wbs_file)
        assert tasks[0].status.value == "[ ]"  # TSK-01-01은 변경 없음
        assert tasks[1].status.value == "[im]"  # TSK-01-02만 변경


class TestUpdateTaskBlockedBy:
    """update_task_blocked_by() 함수 테스트."""

    @pytest.mark.asyncio
    async def test_add_blocked_by(self, tmp_path: Path) -> None:
        """TC-13: blocked-by 추가."""
        wbs_file = tmp_path / "wbs.yaml"
        wbs_file.write_text("""project:
  id: test
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
        title: Test Task
        category: development
        status: "[ ]"
""")

        result = await update_task_blocked_by(wbs_file, "TSK-01-01", "skipped")

        assert result is True
        content = wbs_file.read_text()
        assert "skipped" in content

    @pytest.mark.asyncio
    async def test_remove_blocked_by(self, tmp_path: Path) -> None:
        """TC-14: blocked-by 제거."""
        wbs_file = tmp_path / "wbs.yaml"
        wbs_file.write_text("""project:
  id: test
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
        title: Test Task
        category: development
        status: "[ ]"
        blocked-by: skipped
""")

        result = await update_task_blocked_by(wbs_file, "TSK-01-01", None)

        assert result is True
        content = wbs_file.read_text()
        assert "blocked-by" not in content

    @pytest.mark.asyncio
    async def test_blocked_by_file_not_found(self, tmp_path: Path) -> None:
        """TC-15: 파일 없음 처리."""
        wbs_file = tmp_path / "nonexistent.yaml"

        result = await update_task_blocked_by(wbs_file, "TSK-01-01", "skipped")

        assert result is False

    @pytest.mark.asyncio
    async def test_blocked_by_task_not_found(self, tmp_path: Path) -> None:
        """TC-16: Task ID 없음 처리."""
        wbs_file = tmp_path / "wbs.yaml"
        wbs_file.write_text("""project:
  id: test
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
        title: Test Task
        category: development
        status: "[ ]"
""")

        result = await update_task_blocked_by(wbs_file, "TSK-99-99", "skipped")

        assert result is False


class TestExecutionInfo:
    """execution 필드 파싱 테스트."""

    @pytest.mark.asyncio
    async def test_parse_execution_field(self, tmp_path: Path) -> None:
        """TC-18: execution 필드 파싱."""
        wbs_file = tmp_path / "wbs.yaml"
        wbs_file.write_text("""project:
  id: test
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
        title: Test Task
        category: development
        status: "[im]"
        execution:
          command: build
          description: Building the project
          startedAt: "2025-01-02T10:00:00"
          worker: 1
""")

        tasks = await parse_wbs(wbs_file)
        assert len(tasks) == 1
        task = tasks[0]

        assert task.execution is not None
        assert task.execution.command == "build"
        assert task.execution.description == "Building the project"
        assert task.execution.startedAt == "2025-01-02T10:00:00"
        assert task.execution.worker == 1

    @pytest.mark.asyncio
    async def test_parse_without_execution(self, tmp_path: Path) -> None:
        """TC-19: execution 필드 없는 경우."""
        wbs_file = tmp_path / "wbs.yaml"
        wbs_file.write_text("""project:
  id: test
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
        title: Test Task
        category: development
        status: "[ ]"
""")

        tasks = await parse_wbs(wbs_file)
        assert len(tasks) == 1
        assert tasks[0].execution is None
