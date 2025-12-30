# TSK-04-01: README 설치 가이드 작성

> **category**: infrastructure
> **상태**: 상세설계 [dd]
> **PRD 참조**: PRD 10. README 설치 안내

---

## 1. 개요

### 1.1 목적

orchay 프로젝트의 README.md에 다양한 설치 방법을 안내하여 사용자가 자신의 환경에 맞는 최적의 설치 방법을 선택할 수 있도록 함.

### 1.2 범위

| 항목 | 포함 |
|------|------|
| 실행 파일 다운로드 안내 | ✅ |
| pipx 설치 방법 | ✅ |
| pip 설치 방법 | ✅ |
| 사전 요구사항 명시 | ✅ |
| 플랫폼별 안내 | ✅ |

### 1.3 의존성

| 선행 Task | 설명 |
|-----------|------|
| TSK-03-01 | PyInstaller 빌드 워크플로우 (GitHub Releases) |
| TSK-03-02 | PyPI 배포 워크플로우 (pipx/pip 설치) |

---

## 2. 현재 상태

### 2.1 기존 README.md 분석

현재 `orchay/README.md` 파일의 설치 관련 내용 확인 필요:
- 설치 섹션 존재 여부
- 기존 안내 내용

### 2.2 문제점

- 일반 사용자가 orchay를 설치하기 위한 명확한 가이드 부재
- Python 환경, venv, uv 등 개발자 도구 이해 필요

---

## 3. 목표 상태

### 3.1 설치 섹션 구조

```markdown
## 설치

### 사전 요구사항
- WezTerm, Claude Code 설치 안내

### 방법 1: 실행 파일 다운로드 (권장)
- 일반 사용자 대상
- GitHub Releases 링크

### 방법 2: pipx (Python 환경)
- Python 개발자 대상
- pipx 설치 및 orchay 설치 명령

### 방법 3: pip (개발용)
- 기여자/개발자 대상
- editable 설치 방법
```

### 3.2 대상 사용자별 권장 방법

| 대상 | 권장 방법 | 이유 |
|------|----------|------|
| Python 없는 일반 사용자 | 실행 파일 다운로드 | venv/Python 설치 불필요 |
| Python 개발자 | pipx install | 자동 격리, 쉬운 업그레이드 |
| 기여자/개발자 | pip install -e | 소스 수정 및 테스트 용이 |

---

## 4. 구현 계획

### 4.1 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `orchay/README.md` | 설치 섹션 추가/업데이트 |

### 4.2 README 설치 섹션 내용

```markdown
## Installation

### Prerequisites

Before installing orchay, ensure you have the following:

- **[WezTerm](https://wezfurlong.org/wezterm/)** - Terminal emulator (must be in PATH)
- **[Claude Code](https://claude.ai/code)** - Claude AI CLI tool

### Option 1: Download Executable (Recommended)

Download the latest release for your platform from [GitHub Releases](https://github.com/xxx/orchay/releases):

| Platform | File |
|----------|------|
| Windows | `orchay.exe` |
| Linux | `orchay` |
| macOS | `orchay` |

```bash
# Linux/macOS: Make executable
chmod +x orchay

# Run
./orchay --help
```

### Option 2: pipx (Python Users)

```bash
# Install pipx if not installed
pip install pipx
pipx ensurepath

# Install orchay
pipx install orchay

# Run
orchay --help
```

### Option 3: pip (Development)

```bash
# Standard installation
pip install orchay

# Development installation (editable)
git clone https://github.com/xxx/orchay.git
pip install -e ./orchay[dev]
```
```

### 4.3 구현 절차

1. 기존 README.md 내용 확인
2. 설치 섹션 위치 결정 (일반적으로 상단)
3. 설치 내용 작성 및 삽입
4. GitHub repository URL 확인 및 적용

---

## 5. 수용 기준

| 기준 | 검증 방법 |
|------|----------|
| README.md에 설치 섹션 추가 | 파일 내 섹션 존재 확인 |
| 모든 플랫폼별 안내 포함 | Windows, Linux, macOS 언급 |
| 3가지 설치 방법 안내 | 실행파일, pipx, pip |
| 사전 요구사항 명시 | WezTerm, Claude Code 언급 |

---

## 6. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-30 | 초기 설계 문서 작성 |
