> version: 1.0
> depth: 3
> updated: 2026-01-01
> start: 2025-12-29

---

## WP-01: 엔트리포인트 변경
- priority: critical
- schedule: 2025-12-29 ~ 2025-12-29
- progress: 80%

### TSK-01-01: launcher.py 패키지 이동
- category: infrastructure
- status: [vf]
- priority: critical
- tags: refactor, entrypoint
- requirements:
  - launcher.py를 orchay/src/orchay/로 이동
  - get_orchay_cmd() 함수의 경로 로직 수정
  - 패키지 내부에서 동작하도록 상대 경로 조정

### TSK-01-02: pyproject.toml 엔트리포인트 변경
- category: infrastructure
- status: [vf]
- priority: critical
- tags: config, packaging
- depends: TSK-01-01
- requirements:
  - [project.scripts] 섹션의 orchay 엔트리포인트 변경
  - orchay.cli:cli_main → orchay.launcher:main

### TSK-01-03: **main**.py 수정
- category: development
- status: [vf]
- priority: high
- tags: entrypoint
- depends: TSK-01-01
- requirements:
  - launcher.main() 호출로 변경
  - cli.cli_main() 대신 launcher.main() import

---

## WP-02: PyInstaller 로컬 빌드 환경
- priority: high
- schedule: 2025-12-29 ~ 2025-12-30
- progress: 64%

### TSK-02-01: PyInstaller spec 파일 생성
- category: infrastructure
- status: [vf]
- priority: high
- tags: pyinstaller, build, spec
- depends: TSK-01-02
- requirements:
  - orchay.spec 파일 생성
  - hidden imports 설정 (pydantic, textual, rich, watchdog)
  - data files 설정 (workflows.json 등)
  - 콘솔 모드 유지 설정

### TSK-02-02: Hidden Imports 분석 및 설정
- category: development
- status: [vf]
- priority: high
- tags: pyinstaller, imports
- depends: TSK-02-01
- requirements:
  - 동적 import 모듈 분석 (pydantic, textual, watchdog)
  - collect_submodules 활용
  - 런타임 ModuleNotFoundError 해결

### TSK-02-03: 데이터 파일 및 리소스 번들링
- category: infrastructure
- status: [vf]
- priority: medium
- tags: pyinstaller, resources
- depends: TSK-02-01
- requirements:
  - workflows.json 포함
  - src/orchay 하위 리소스 포함
  - datas 옵션 설정

### TSK-02-04: 로컬 빌드 테스트 (Linux)
- category: development
- status: [vf]
- priority: high
- tags: pyinstaller, test, linux
- depends: TSK-02-01,TSK-02-02,TSK-02-03
- requirements:
  - Linux에서 PyInstaller 빌드 실행
  - dist/orchay 바이너리 생성 확인
  - WezTerm 레이아웃 생성 테스트

### TSK-02-05: UPX 압축 설정 (선택)
- category: infrastructure
- status: [ap]
- priority: low
- tags: pyinstaller, optimization
- depends: TSK-02-04
- requirements:
  - UPX 설치 및 경로 설정
  - --upx-dir 옵션 적용
  - 압축 제외 파일 설정

---

## WP-03: GitHub Actions 빌드 파이프라인
- priority: high
- schedule: 2025-12-30 ~ 2025-12-31
- progress: 80%

### TSK-03-01: PyInstaller 빌드 워크플로우
- category: infrastructure
- status: [vf]
- priority: high
- tags: ci, pyinstaller, github-actions
- depends: TSK-02-04
- requirements:
  - .github/workflows/release.yml 생성
  - matrix 전략으로 Windows/Linux/macOS 빌드
  - 태그 푸시 시 자동 빌드
  - GitHub Releases에 아티팩트 업로드
  - spec 파일 기반 빌드 (TSK-02-01에서 생성)

### TSK-03-02: PyPI 배포 워크플로우
- category: infrastructure
- status: [vf]
- priority: high
- tags: ci, pypi, github-actions
- depends: TSK-02-04
- requirements:
  - .github/workflows/pypi.yml 생성
  - Trusted Publishing 설정 (id-token: write)
  - 태그 푸시 시 자동 배포

### TSK-03-03: PyPI Trusted Publishing 설정
- category: infrastructure
- status: [vf]
- priority: high
- tags: pypi, security
- depends: TSK-03-02
- requirements:
  - PyPI 계정 생성
  - 프로젝트 생성 및 Trusted Publishing 구성
  - GitHub repository 연결

---

## WP-04: 문서화 및 테스트
- priority: medium
- schedule: 2026-01-01 ~ 2026-01-02
- progress: 0%

### TSK-04-01: README 설치 가이드 작성
- category: infrastructure
- status: [ap]
- priority: medium
- tags: docs, readme
- depends: TSK-03-01,TSK-03-02
- requirements:
  - 실행 파일 다운로드 방법 안내
  - pipx 설치 방법 안내
  - pip 설치 방법 안내
  - 사전 요구사항 (WezTerm, Claude Code) 명시

### TSK-04-02: 배포 테스트
- category: development
- status: [ap]
- priority: medium
- tags: test, integration
- depends: TSK-03-01,TSK-03-02
- requirements:
  - Windows에서 orchay.exe 실행 테스트
  - Linux에서 orchay 실행 테스트
  - macOS에서 orchay 실행 테스트
  - pipx install orchay 테스트
