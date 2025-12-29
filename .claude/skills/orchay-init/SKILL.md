---
name: orchay-init
description: Initialize orchay project management directory structure. Use when creating .orchay folder with settings, templates, and project folders. Triggers on "init orchay", "create orchay structure", "setup project management", "initialize .orchay", or "new orchay project".
---

# orchay-init

Initialize the `.orchay/` directory structure for AI-powered project management.

## Quick Start

```bash
# Initialize base structure
python scripts/init.py --path /path/to/project

# Create a new project
python scripts/init.py --path /path/to/project --project my-project
```

## Directory Structure Created

```
.orchay/
├── settings/              # Global settings
│   ├── projects.json      # Project list
│   ├── columns.json       # Kanban columns
│   ├── categories.json    # Task categories
│   ├── workflows.json     # Workflow rules
│   └── actions.json       # In-state actions
│
├── templates/             # Document templates
│   ├── 010-basic-design.md
│   ├── 020-detail-design.md
│   ├── 021-design-review.md
│   ├── 025-traceability-matrix.md
│   ├── 026-test-specification.md
│   ├── 030-implementation.md
│   └── (test templates)
│
└── projects/              # Projects folder
    └── [project-id]/      # Project folder
        ├── project.json   # Project metadata
        ├── team.json      # Team members
        ├── wbs.md         # WBS (single source of truth)
        └── tasks/         # Task documents
            └── TSK-XX-XX/
```

## Bundled Resources

### Scripts

- `scripts/init.py` - Initialize directory structure

### Assets

- `assets/settings/*.json` - Default setting templates
- `assets/templates/*.md` - Document templates

## Usage Patterns

### 1. Initialize Base Structure Only

```bash
python scripts/init.py --path /your/project
```

Creates `settings/` and `templates/` folders with default files.

### 2. Create New Project

```bash
python scripts/init.py --path /your/project --project my-app
```

Creates project folder with `project.json`, `team.json`, `wbs.md`.

### 3. Preview Changes (Dry Run)

```bash
python scripts/init.py --path /your/project --dry-run
```

### 4. Force Overwrite

```bash
python scripts/init.py --path /your/project --force
```

## WBS File Format

The `wbs.md` file uses markdown headers to define structure:

```markdown
## WP-01: Work Package Name
- status: in_progress
- priority: high

### ACT-01-01: Activity Name
- status: todo

#### TSK-01-01-01: Task Name
- category: development
- status: todo [ ]
- priority: high
- assignee: member_id
```

### 3-Level vs 4-Level Structure

- **4-level**: `WP → ACT → TSK` (large projects)
- **3-level**: `WP → TSK` (small projects, skip ACT)

## Task Status Codes

| Code | Status | Column |
|------|--------|--------|
| `[ ]` | Todo | Todo |
| `[bd]` | Basic Design | Design |
| `[dd]` | Detail Design | Detail |
| `[im]` | Implement | Implement |
| `[vf]` | Verify | Verify |
| `[xx]` | Done | Done |

## After Initialization

1. Edit `wbs.md` to define your WBS structure
2. Use workflow commands (`/wf:start`, `/wf:draft`, etc.) to progress tasks
3. Task documents are created in `tasks/TSK-XX-XX/` folders
