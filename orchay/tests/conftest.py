"""pytest 설정 및 fixtures."""

import pytest

from orchay.models import Config, Task, TaskCategory, TaskPriority, TaskStatus


@pytest.fixture
def sample_task() -> Task:
    """샘플 Task fixture."""
    return Task(
        id="TSK-01-01",
        title="테스트 Task",
        category=TaskCategory.DEVELOPMENT,
        domain="backend",
        status=TaskStatus.TODO,
        priority=TaskPriority.HIGH,
    )


@pytest.fixture
def sample_config() -> Config:
    """샘플 Config fixture."""
    return Config()
