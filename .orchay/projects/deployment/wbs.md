# WBS - deployment (orchay 배포 시스템)

> version: 1.0
> depth: 3
> updated: 2025-12-29
> project-root: orchay
> strategy: 단계별 배포 파이프라인 구축

---

## WP-01: 엔트리포인트 변경

- status: planned
- priority: critical
- schedule: 2025-12-29 ~ 2025-12-29
- progress: 0%
- note: launcher.py를 기본 엔트리포인트로 설정

### TSK-01-01: launcher.py 패키지 이동

- category: infrastructure
- domain: infra
- status: detail-design [dd]
- priority: critical
- assignee: -
- schedule: 2025-12-29
- tags: refactor, entrypoint
- depends: -

#### PRD 요구사항

- prd-ref: PRD 3.1 엔트리포인트 변경
- requirements:
  - launcher.py를 orchay/src/orchay/로 이동
  - get_orchay_cmd() 함수의 경로 로직 수정
  - 패키지 내부에서 동작하도록 상대 경로 조정
- acceptance:
  - launcher.py가 src/orchay/ 내에 위치
  - import 오류 없이 모듈 로드 가능
  - Pyright strict 모드 통과

---

### TSK-01-02: pyproject.toml 엔트리포인트 변경

- category: infrastructure
- domain: infra
- status: detail_design [dd]
- priority: critical
- assignee: -
- schedule: 2025-12-29
- tags: config, packaging
- depends: TSK-01-01

#### PRD 요구사항

- prd-ref: PRD 9.2 pyproject.toml 변경
- requirements:
  - [project.scripts] 섹션의 orchay 엔트리포인트 변경
  - orchay.cli:cli_main → orchay.launcher:main
- acceptance:
  - `uv pip install -e .` 성공
  - `orchay` 명령 실행 시 launcher.main() 호출
  - `python -m orchay` 동일하게 동작

---

### TSK-01-03: **main**.py 수정

- category: development
- domain: backend
- status: detail-design [dd]
- priority: high
- assignee: -
- schedule: 2025-12-29
- tags: entrypoint
- depends: TSK-01-01

#### PRD 요구사항

- prd-ref: PRD 9.4 **main**.py 변경
- requirements:
  - launcher.main() 호출로 변경
  - cli.cli_main() 대신 launcher.main() import
- acceptance:
  - `python -m orchay` 실행 시 WezTerm 레이아웃 생성
  - 기존 기능 정상 동작

---

## WP-02: PyInstaller 로컬 빌드 환경

- status: planned
- priority: high
- schedule: 2025-12-29 ~ 2025-12-30
- progress: 0%
- note: PyInstaller spec 파일 및 로컬 빌드 검증

### TSK-02-01: PyInstaller spec 파일 생성

- category: infrastructure
- domain: devops
- status: detail-design [dd]
- priority: high
- assignee: -
- schedule: 2025-12-29
- tags: pyinstaller, build, spec
- depends: TSK-01-02

#### PRD 요구사항

- prd-ref: PRD 4.5 spec 파일 구성
- requirements:
  - orchay.spec 파일 생성
  - hidden imports 설정 (pydantic, textual, rich, watchdog)
  - data files 설정 (workflows.json 등)
  - 콘솔 모드 유지 설정
- acceptance:
  - spec 파일로 빌드 성공
  - 모든 런타임 의존성 포함 확인

---

### TSK-02-02: Hidden Imports 분석 및 설정

- category: development
- domain: backend
- status: detail-design [dd]
- priority: high
- assignee: -
- schedule: 2025-12-29
- tags: pyinstaller, imports
- depends: TSK-02-01

#### PRD 요구사항

- prd-ref: PRD 4.6 Hidden Imports
- requirements:
  - 동적 import 모듈 분석 (pydantic, textual, watchdog)
  - collect_submodules 활용
  - 런타임 ModuleNotFoundError 해결
- acceptance:
  - 빌드된 실행 파일에서 import 오류 없음
  - 모든 Pydantic 모델 정상 동작

---

### TSK-02-03: 데이터 파일 및 리소스 번들링

- category: infrastructure
- domain: devops
- status: [ ]
- priority: medium
- assignee: -
- schedule: 2025-12-29
- tags: pyinstaller, resources
- depends: TSK-02-01

#### PRD 요구사항

- prd-ref: PRD 4.7 데이터 파일
- requirements:
  - workflows.json 포함
  - src/orchay 하위 리소스 포함
  - datas 옵션 설정
- acceptance:
  - 실행 파일에서 설정 파일 로드 성공
  - 리소스 경로 정상 해석

---

### TSK-02-04: 로컬 빌드 테스트 (Linux)

- category: development
- domain: qa
- status: detail-design [dd]
- priority: high
- assignee: -
- schedule: 2025-12-29
- tags: pyinstaller, test, linux
- depends: TSK-02-01, TSK-02-02, TSK-02-03

#### PRD 요구사항

- prd-ref: PRD 4.1 로컬 빌드
- requirements:
  - Linux에서 PyInstaller 빌드 실행
  - dist/orchay 바이너리 생성 확인
  - WezTerm 레이아웃 생성 테스트
- acceptance:
  - ./dist/orchay 실행 성공
  - 스케줄러 정상 동작

---

### TSK-02-05: UPX 압축 설정 (선택)

- category: infrastructure
- domain: devops
- status: [ ]
- priority: low
- assignee: -
- schedule: 2025-12-30
- tags: pyinstaller, optimization
- depends: TSK-02-04

#### PRD 요구사항

- prd-ref: PRD 4.9 UPX 압축
- requirements:
  - UPX 설치 및 경로 설정
  - --upx-dir 옵션 적용
  - 압축 제외 파일 설정
- acceptance:
  - 실행 파일 크기 20-40% 감소
  - 실행 시간 영향 최소화

---

## WP-03: GitHub Actions 빌드 파이프라인

- status: planned
- priority: high
- schedule: 2025-12-30 ~ 2025-12-31
- progress: 0%
- note: 크로스 플랫폼 빌드 자동화

### TSK-03-01: PyInstaller 빌드 워크플로우

- category: infrastructure
- domain: devops
- status: detail-design [dd]
- priority: high
- assignee: -
- schedule: 2025-12-30
- tags: ci, pyinstaller, github-actions
- depends: TSK-02-04

#### PRD 요구사항

- prd-ref: PRD 5.1 실행 파일 빌드 및 릴리스
- requirements:
  - .github/workflows/release.yml 생성
  - matrix 전략으로 Windows/Linux/macOS 빌드
  - 태그 푸시 시 자동 빌드
  - GitHub Releases에 아티팩트 업로드
  - spec 파일 기반 빌드 (TSK-02-01에서 생성)
- acceptance:
  - v\* 태그 푸시 → 3개 플랫폼 빌드 성공
  - GitHub Releases에 orchay, orchay.exe, orchay (macOS) 업로드

---

### TSK-03-02: PyPI 배포 워크플로우

- category: infrastructure
- domain: devops
- status: [ ]
- priority: high
- assignee: -
- schedule: 2025-12-30
- tags: ci, pypi, github-actions
- depends: TSK-02-04

#### PRD 요구사항

- prd-ref: PRD 5.2 PyPI 배포
- requirements:
  - .github/workflows/pypi.yml 생성
  - Trusted Publishing 설정 (id-token: write)
  - 태그 푸시 시 자동 배포
- acceptance:
  - v\* 태그 푸시 → PyPI 배포 성공
  - `pipx install orchay` 동작

---

### TSK-03-03: PyPI Trusted Publishing 설정

- category: infrastructure
- domain: devops
- status: [ ]
- priority: high
- assignee: -
- schedule: 2025-12-30
- tags: pypi, security
- depends: TSK-03-02

#### PRD 요구사항

- prd-ref: PRD 5.3 PyPI Trusted Publishing 설정
- requirements:
  - PyPI 계정 생성
  - 프로젝트 생성 및 Trusted Publishing 구성
  - GitHub repository 연결
- acceptance:
  - PyPI에서 orchay 프로젝트 존재
  - Trusted Publishing 활성화 상태

---

## WP-04: 문서화 및 테스트

- status: planned
- priority: medium
- schedule: 2026-01-01 ~ 2026-01-02
- progress: 0%
- note: 설치 가이드 및 통합 테스트

### TSK-04-01: README 설치 가이드 작성

- category: documentation
- domain: docs
- status: [ ]
- priority: medium
- assignee: -
- schedule: 2026-01-01
- tags: docs, readme
- depends: TSK-03-01, TSK-03-02

#### PRD 요구사항

- prd-ref: PRD 10. README 설치 안내
- requirements:
  - 실행 파일 다운로드 방법 안내
  - pipx 설치 방법 안내
  - pip 설치 방법 안내
  - 사전 요구사항 (WezTerm, Claude Code) 명시
- acceptance:
  - README.md에 설치 섹션 추가
  - 모든 플랫폼별 안내 포함

---

### TSK-04-02: 배포 테스트

- category: development
- domain: qa
- status: [ ]
- priority: medium
- assignee: -
- schedule: 2026-01-02
- tags: test, integration
- depends: TSK-03-01, TSK-03-02

#### PRD 요구사항

- requirements:
  - Windows에서 orchay.exe 실행 테스트
  - Linux에서 orchay 실행 테스트
  - macOS에서 orchay 실행 테스트
  - pipx install orchay 테스트
- acceptance:
  - 모든 플랫폼에서 WezTerm 레이아웃 생성 성공
  - 스케줄러 정상 실행

---

## 완료 조건

| 조건                                  | 상태 |
| ------------------------------------- | ---- |
| `orchay` 명령으로 launcher 실행       | ⬜   |
| GitHub Releases에 3개 플랫폼 바이너리 | ⬜   |
| PyPI에 orchay 패키지 등록             | ⬜   |
| `pipx install orchay` 동작            | ⬜   |
| README 설치 가이드 완성               | ⬜   |
