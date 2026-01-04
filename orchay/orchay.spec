# -*- mode: python ; coding: utf-8 -*-
# orchay PyInstaller spec file
# TSK-02-01: spec 파일 생성
# TSK-02-02: Hidden Imports 설정
# TSK-02-03: 데이터 파일 및 리소스 번들링
# TSK-02-05: UPX 압축 설정

from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# UPX 압축 제외 대상 (TSK-02-05)
# 아래 파일들은 UPX 압축 시 손상될 수 있어 제외
upx_exclude = [
    # Python 바이트코드/동적 라이브러리
    'python*.dll',
    'python*.so*',
    '_ssl*.so*',
    '_ssl*.pyd',

    # Pydantic Core (Rust 컴파일 바이너리)
    'pydantic_core*.so*',
    'pydantic_core*.pyd',

    # 암호화 관련 라이브러리
    'libcrypto*.so*',
    'libssl*.so*',
    'libffi*.so*',

    # Windows CRT 런타임
    'vcruntime*.dll',
    'api-ms-*.dll',
    'ucrtbase.dll',

    # macOS 시스템 라이브러리
    'libSystem*.dylib',
]

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

    # WezTerm 설정 파일 (Windows) - 패키지 data 폴더에서 로드
    ('src/orchay/data/wezterm-orchay-windows.lua', 'orchay/data'),
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

# One-folder 모드 (폴더 배포)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='orchay',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=upx_exclude,
    name='orchay',
)
