#!/usr/bin/env python3
"""
orchay-init: Initialize .orchay directory structure

Usage:
    python init.py [options]
    python init.py --project <project-name> [options]

Options:
    --path <path>       Base path for .orchay (default: current directory)
    --project <name>    Create a new project with given name
    --force             Overwrite existing files
    --dry-run           Preview changes without creating files
"""

import argparse
import json
import os
import shutil
import sys
from datetime import datetime, timedelta
from pathlib import Path


def get_script_dir():
    """Get the directory containing this script."""
    return Path(__file__).parent.resolve()


def get_assets_dir():
    """Get the assets directory relative to script."""
    return get_script_dir().parent / "assets"


def create_directory(path: Path, dry_run: bool = False):
    """Create directory if it doesn't exist."""
    if dry_run:
        print(f"[DRY-RUN] Would create directory: {path}")
        return

    path.mkdir(parents=True, exist_ok=True)
    print(f"✅ Created directory: {path}")


def copy_file(src: Path, dst: Path, force: bool = False, dry_run: bool = False):
    """Copy file from source to destination."""
    if dst.exists() and not force:
        print(f"⚠️  Skipped (exists): {dst}")
        return False

    if dry_run:
        print(f"[DRY-RUN] Would copy: {src} -> {dst}")
        return True

    shutil.copy2(src, dst)
    print(f"✅ Created: {dst}")
    return True


def copy_template_with_vars(src: Path, dst: Path, variables: dict, force: bool = False, dry_run: bool = False):
    """Copy template file and replace variables."""
    if dst.exists() and not force:
        print(f"⚠️  Skipped (exists): {dst}")
        return False

    content = src.read_text(encoding="utf-8")
    for key, value in variables.items():
        content = content.replace(f"{{{{{key}}}}}", str(value))

    if dry_run:
        print(f"[DRY-RUN] Would create from template: {dst}")
        return True

    dst.write_text(content, encoding="utf-8")
    print(f"✅ Created from template: {dst}")
    return True


def init_base_structure(base_path: Path, force: bool = False, dry_run: bool = False):
    """Initialize base .orchay directory structure."""
    orchay_path = base_path / ".orchay"
    assets_dir = get_assets_dir()

    # Create base directories
    create_directory(orchay_path / "settings", dry_run)
    create_directory(orchay_path / "templates", dry_run)
    create_directory(orchay_path / "projects", dry_run)

    # Copy settings files
    settings_src = assets_dir / "settings"
    settings_dst = orchay_path / "settings"

    for settings_file in settings_src.glob("*.json"):
        copy_file(settings_file, settings_dst / settings_file.name, force, dry_run)

    # Copy template files
    templates_src = assets_dir / "templates"
    templates_dst = orchay_path / "templates"

    # Only copy document templates (not project.json, team.json, wbs.md)
    exclude_files = {"project.json", "team.json", "wbs.md"}
    for template_file in templates_src.iterdir():
        if template_file.name not in exclude_files:
            copy_file(template_file, templates_dst / template_file.name, force, dry_run)

    print(f"\n🎉 Base structure initialized at: {orchay_path}")


def init_project(base_path: Path, project_name: str, force: bool = False, dry_run: bool = False):
    """Initialize a new project within .orchay/projects/."""
    orchay_path = base_path / ".orchay"
    projects_dir = orchay_path / "projects"
    project_path = projects_dir / project_name
    assets_dir = get_assets_dir()
    templates_src = assets_dir / "templates"

    # Ensure base structure exists
    if not (orchay_path / "settings").exists():
        print("⚠️  Base structure not found. Initializing...")
        init_base_structure(base_path, force, dry_run)

    # Create project directory
    create_directory(project_path, dry_run)
    create_directory(project_path / "tasks", dry_run)

    # Prepare template variables
    today = datetime.now()
    end_date = today + timedelta(days=90)

    variables = {
        "PROJECT_ID": project_name,
        "PROJECT_NAME": project_name.replace("-", " ").title(),
        "PROJECT_DESCRIPTION": f"Project: {project_name}",
        "CREATED_AT": today.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "START_DATE": today.strftime("%Y-%m-%d"),
        "END_DATE": end_date.strftime("%Y-%m-%d"),
    }

    # Copy project files with variable substitution
    copy_template_with_vars(
        templates_src / "project.json",
        project_path / "project.json",
        variables, force, dry_run
    )

    copy_template_with_vars(
        templates_src / "team.json",
        project_path / "team.json",
        variables, force, dry_run
    )

    copy_template_with_vars(
        templates_src / "wbs.md",
        project_path / "wbs.md",
        variables, force, dry_run
    )

    # Update projects.json
    if not dry_run:
        projects_file = orchay_path / "settings" / "projects.json"
        if projects_file.exists():
            projects = json.loads(projects_file.read_text(encoding="utf-8"))

            # Check if project already exists
            existing_ids = [p["id"] for p in projects.get("projects", [])]
            if project_name not in existing_ids:
                projects["projects"].append({
                    "id": project_name,
                    "name": variables["PROJECT_NAME"],
                    "path": project_name,
                    "status": "active",
                    "wbsDepth": 4,
                    "createdAt": today.strftime("%Y-%m-%d")
                })

                if projects["defaultProject"] is None:
                    projects["defaultProject"] = project_name

                projects_file.write_text(
                    json.dumps(projects, indent=2, ensure_ascii=False),
                    encoding="utf-8"
                )
                print(f"✅ Updated: {projects_file}")

    print(f"\n🎉 Project '{project_name}' initialized at: {project_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Initialize orchay directory structure",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        "--path",
        type=str,
        default=".",
        help="Base path for .orchay directory (default: current directory)"
    )

    parser.add_argument(
        "--project",
        type=str,
        help="Create a new project with the given name"
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing files"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without creating files"
    )

    args = parser.parse_args()

    base_path = Path(args.path).resolve()

    if not base_path.exists():
        print(f"❌ Error: Path does not exist: {base_path}")
        sys.exit(1)

    print(f"📁 Base path: {base_path}")
    print(f"📦 Assets: {get_assets_dir()}")
    print()

    if args.project:
        init_project(base_path, args.project, args.force, args.dry_run)
    else:
        init_base_structure(base_path, args.force, args.dry_run)


if __name__ == "__main__":
    main()
