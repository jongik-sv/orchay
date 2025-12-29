# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**orchay** (orchestration + okay) is a WezTerm-based Task scheduler that monitors `wbs.md` files and automatically distributes executable tasks to multiple Claude Code Worker panes.

## Development Commands

```bash
# Navigate to orchay directory first
cd orchay

# Setup (recommended: uv)
uv venv
uv pip install -e ".[dev]"

# Run scheduler from project root (where .orchay exists)
cd ..  # back to project root
uv run --project orchay python -m orchay [PROJECT] [OPTIONS]

# Run tests
cd orchay
pytest                           # all tests
pytest tests/test_scheduler.py   # specific module
pytest --cov=orchay              # with coverage

# Linting and type checking
ruff check src tests             # lint
ruff format src tests            # format
pyright src tests                # type check (strict mode)
```

### CLI Usage

```bash
# Scheduler modes
python -m orchay orchay --dry-run    # status only, no dispatch
python -m orchay orchay -m design    # design mode
python -m orchay orchay -m quick     # quick mode (default)
python -m orchay orchay -m develop   # full workflow
python -m orchay orchay -m force     # ignore dependencies

# Task execution state management (for workflow hooks)
orchay exec start <task_id> <step>   # register task
orchay exec stop <task_id>           # unregister task
orchay exec list                     # show active tasks
orchay exec clear                    # reset all
```

## Architecture

```
orchay/src/orchay/
├── main.py          # Orchestrator class, CLI entry, scheduling loop
├── scheduler.py     # ExecutionMode, filter_executable_tasks, dispatch_task
├── wbs_parser.py    # WbsParser, WbsWatcher, parse_wbs(), watch_wbs()
├── worker.py        # detect_worker_state(), DONE_PATTERN, state patterns
├── cli.py           # Subcommand CLI (run, exec)
├── models/
│   ├── task.py      # Task, TaskStatus, TaskPriority, TaskCategory
│   ├── worker.py    # Worker, WorkerState
│   └── config.py    # Config, ExecutionConfig, DispatchConfig
└── utils/
    ├── wezterm.py   # wezterm_list_panes, wezterm_get_text, wezterm_send_text
    └── active_tasks.py  # File-based state: orchay-active.json
```

### Core Flow

1. **Orchestrator** (`main.py:34`) initializes Workers from WezTerm panes
2. **WbsParser** (`wbs_parser.py:106`) parses `.orchay/projects/{project}/wbs.md`
3. **Scheduler** (`scheduler.py:88`) filters executable Tasks by mode and dependencies
4. **Worker detection** (`worker.py:89`) monitors pane output for state patterns
5. **Dispatch** sends `/wf:run {task-id}` to idle Worker panes

### Execution Modes

| Mode | Workflow Steps | Dependency Check |
|------|----------------|------------------|
| design | start | None |
| quick | start → approve → build → done | [dd]+ only |
| develop | start → review → apply → approve → build → audit → patch → test → done | [dd]+ only |
| force | start → approve → build → done | Ignored |

### Task States (WBS status codes)

`[ ]` TODO → `[bd]` Basic Design → `[dd]` Detail Design → `[an]` Analysis → `[ds]` Design → `[ap]` Approved → `[im]` Implement → `[fx]` Fix → `[vf]` Verify → `[xx]` Done

### Worker States

| State | Detection |
|-------|-----------|
| dead | pane not found |
| done | `ORCHAY_DONE:{task-id}:{action}:{status}` signal |
| paused | rate limit, capacity, context limit patterns |
| error | Error:, Failed:, Exception: patterns |
| blocked | y/n, ? at end, input prompts |
| idle | `>` or `❯` prompt at end of output |
| busy | default when active |

### File-Based State (`.orchay/logs/orchay-active.json`)

```json
{
  "activeTasks": {
    "TSK-01-01": {
      "worker": 1,
      "paneId": 2,
      "startedAt": "2025-12-28T10:00:00",
      "currentStep": "start"
    }
  }
}
```

## Code Patterns

### Async-First Design

All I/O operations use `asyncio`. Never use blocking calls:

```python
# Correct
await wezterm_send_text(pane_id, "/wf:run TSK-01-01\n")
await asyncio.sleep(2)

# Wrong - blocks event loop
subprocess.run(["wezterm", "cli", ...])
time.sleep(2)
```

### WezTerm Integration

```python
from orchay.utils.wezterm import wezterm_list_panes, wezterm_get_text, wezterm_send_text

panes = await wezterm_list_panes()
text = await wezterm_get_text(pane_id=1, lines=50)
await wezterm_send_text(pane_id=1, text="/wf:build TSK-01-01\n")
```

### WBS Parsing

```python
from orchay.wbs_parser import parse_wbs, watch_wbs

tasks = await parse_wbs(".orchay/projects/orchay/wbs.md")

async def on_change(tasks): ...
watcher = watch_wbs("wbs.md", on_change, debounce=0.5)
watcher.start()
await watcher.stop()
```

## Testing

- pytest-asyncio with `asyncio_mode = "auto"`
- Tests in `orchay/tests/`
- Key test files: `test_scheduler.py`, `test_wbs_parser.py`, `test_worker.py`, `test_wezterm.py`

## Key Constraints

- Python >= 3.10, WezTerm required in PATH
- Pyright strict mode enabled
- Ruff lint rules: E, F, W, I, UP, ANN, B, C4, SIM
- Line length: 100
- Google-style docstrings
- No global mutable state (use dependency injection)
- No print() (use Rich console)
- workflows.json for state colors/icons (no hardcoding)

## basic rule
- 대답은 한국어로 해.
- prd.md 문서에는 코드를 남기지말고 *-reference.md 문서에 남기고 prd문서에는 링크만 남겨