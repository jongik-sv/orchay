# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec file for orchay.

TSK-02-01: PyInstaller spec 파일 생성
- hidden imports: pydantic, textual, rich, watchdog
- data files: workflows.json 등
- 콘솔 모드 유지

Usage:
    cd orchay
    pyinstaller orchay.spec
    # 또는
    pyinstaller orchay.spec --clean
"""

from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# Hidden imports - 동적 import 모듈들
hiddenimports = [
    # Pydantic (동적 모델 로딩)
    *collect_submodules('pydantic'),
    *collect_submodules('pydantic_core'),

    # Textual (TUI 프레임워크)
    *collect_submodules('textual'),

    # Rich (콘솔 출력)
    *collect_submodules('rich'),

    # Watchdog (파일 감시)
    *collect_submodules('watchdog'),

    # YAML 파서
    'yaml',

    # orchay 내부 모듈
    'orchay',
    'orchay.launcher',
    'orchay.main',
    'orchay.cli',
    'orchay.scheduler',
    'orchay.wbs_parser',
    'orchay.worker',
    'orchay.command',
    'orchay.recovery',
    'orchay.models',
    'orchay.models.task',
    'orchay.models.worker',
    'orchay.models.config',
    'orchay.utils',
    'orchay.utils.wezterm',
    'orchay.utils.active_tasks',
    'orchay.utils.config',
    'orchay.utils.history',
    'orchay.ui',
    'orchay.ui.app',
    'orchay.ui.widgets',
]

# Data files - 패키지에 포함되어야 하는 리소스
datas = [
    # Textual CSS 및 데이터 파일
    *collect_data_files('textual'),
    *collect_data_files('rich'),
]

# Analysis 설정
a = Analysis(
    ['src/orchay/launcher.py'],
    pathex=['src'],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # 개발 의존성 제외
        'pytest',
        'pytest_asyncio',
        'ruff',
        'pyright',
        # 불필요한 모듈 제외
        'tkinter',
        'matplotlib',
        'numpy',
        'scipy',
        'pandas',
    ],
    noarchive=False,
    optimize=0,
)

# PYZ 압축
pyz = PYZ(a.pure)

# EXE 생성
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='orchay',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,  # UPX 압축 활성화 (TSK-02-05에서 상세 설정)
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # 콘솔 모드 유지 (TUI 앱)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
