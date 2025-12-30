# -*- mode: python ; coding: utf-8 -*-
# orchay PyInstaller spec file
# TSK-02-01: spec 파일 생성
# TSK-02-02: Hidden Imports 설정
# TSK-02-03: 데이터 파일 및 리소스 번들링

from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# Hidden imports - 동적 로딩 모듈 (TSK-02-02)
hiddenimports = [
    # pydantic v2 관련
    *collect_submodules('pydantic'),
    *collect_submodules('pydantic_core'),
    'annotated_types',

    # 타입 확장 (런타임 필수)
    'typing_extensions',

    # Textual 내부 모듈
    *collect_submodules('textual'),

    # Rich 콘솔
    *collect_submodules('rich'),

    # Watchdog 백엔드
    'watchdog.observers.polling',

    # YAML 파서
    'yaml.loader',
    'yaml.dumper',

    # asyncio 관련
    'asyncio',
    'asyncio.base_events',
    'asyncio.events',

    # logging
    'logging.handlers',

    # collections (Python 표준 라이브러리)
    'collections',
    'collections.abc',

    # orchay 패키지
    *collect_submodules('orchay'),
]

# Data files - 패키지 리소스 (TSK-02-03)
datas = [
    # Textual CSS 및 데이터 파일
    *collect_data_files('textual'),
    *collect_data_files('rich'),

    # orchay 패키지 리소스
    ('src/orchay/ui/styles.tcss', 'orchay/ui'),
]

a = Analysis(
    ['src/orchay/__main__.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

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
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
