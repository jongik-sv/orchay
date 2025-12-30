# TSK-04-02: 배포 테스트 - 통합설계

## 문서 정보

| 항목 | 내용 |
|------|------|
| Task ID | TSK-04-02 |
| 문서 유형 | 통합설계 (Basic + Detail) |
| 작성일 | 2025-12-30 |
| 상태 | Draft |
| PRD 참조 | - |

---

## 1. 개요

### 1.1 목적

GitHub Releases와 PyPI에 배포된 orchay 패키지가 각 플랫폼에서 정상적으로 동작하는지 검증합니다.

### 1.2 범위

| 포함 | 제외 |
|------|------|
| Windows 실행 파일 테스트 | 빌드 파이프라인 (TSK-03-01) |
| Linux 실행 파일 테스트 | PyPI 배포 (TSK-03-02) |
| macOS 실행 파일 테스트 | |
| pipx 설치 테스트 | |
| pip 설치 테스트 | |

---

## 2. 테스트 환경

### 2.1 플랫폼별 환경

| 플랫폼 | 환경 | 비고 |
|--------|------|------|
| Windows | Windows 10/11 (x64) | GitHub Actions runner 또는 로컬 |
| Linux | Ubuntu 22.04+ (x64) | 현재 개발 환경 |
| macOS | macOS 13+ (ARM/Intel) | GitHub Actions runner |

### 2.2 사전 요구사항

| 요구사항 | Windows | Linux | macOS |
|----------|---------|-------|-------|
| WezTerm | ✅ | ✅ | ✅ |
| Claude Code | ✅ | ✅ | ✅ |
| Python 3.10+ | pipx용 | pipx용 | pipx용 |

---

## 3. 테스트 시나리오

### 3.1 실행 파일 테스트 (GitHub Releases)

#### TC-01: Windows 실행 파일

```powershell
# 1. 다운로드
Invoke-WebRequest -Uri "https://github.com/{owner}/orchay/releases/latest/download/orchay-windows.exe" -OutFile orchay.exe

# 2. 실행 권한 확인 (Windows는 자동)

# 3. 도움말 테스트
.\orchay.exe --help

# 4. 버전 확인
.\orchay.exe --version

# 5. 기능 테스트 (WezTerm 필요)
.\orchay.exe
```

**예상 결과**:
- `--help`: 사용법 출력
- `--version`: 버전 정보 출력
- 실행 시: WezTerm 레이아웃 생성

#### TC-02: Linux 실행 파일

```bash
# 1. 다운로드
curl -LO https://github.com/{owner}/orchay/releases/latest/download/orchay-linux
chmod +x orchay-linux

# 2. 도움말 테스트
./orchay-linux --help

# 3. 버전 확인
./orchay-linux --version

# 4. 기능 테스트
./orchay-linux
```

**예상 결과**:
- 실행 권한 설정 후 정상 실행
- WezTerm 레이아웃 생성

#### TC-03: macOS 실행 파일

```bash
# 1. 다운로드
curl -LO https://github.com/{owner}/orchay/releases/latest/download/orchay-macos
chmod +x orchay-macos

# 2. Gatekeeper 우회 (서명되지 않은 경우)
xattr -d com.apple.quarantine orchay-macos

# 3. 도움말 테스트
./orchay-macos --help

# 4. 기능 테스트
./orchay-macos
```

**예상 결과**:
- Gatekeeper 경고 후 실행 가능
- WezTerm 레이아웃 생성

### 3.2 PyPI 설치 테스트

#### TC-04: pipx 설치

```bash
# 1. pipx 설치 (없는 경우)
pip install pipx
pipx ensurepath

# 2. orchay 설치
pipx install orchay

# 3. 도움말 테스트
orchay --help

# 4. 버전 확인
orchay --version

# 5. 기능 테스트
orchay

# 6. 정리
pipx uninstall orchay
```

**예상 결과**:
- 설치 성공
- PATH에 `orchay` 명령 등록
- 정상 실행

#### TC-05: pip 설치 (가상환경)

```bash
# 1. 가상환경 생성
python -m venv test-venv
source test-venv/bin/activate  # Linux/macOS
# test-venv\Scripts\activate  # Windows

# 2. orchay 설치
pip install orchay

# 3. 도움말 테스트
orchay --help

# 4. 정리
deactivate
rm -rf test-venv
```

**예상 결과**:
- 의존성 자동 설치
- 가상환경 내에서 정상 실행

---

## 4. 테스트 체크리스트

### 4.1 실행 파일 테스트

| ID | 테스트 항목 | Windows | Linux | macOS |
|----|------------|---------|-------|-------|
| EX-01 | 다운로드 가능 | ⬜ | ⬜ | ⬜ |
| EX-02 | 실행 권한 설정 | N/A | ⬜ | ⬜ |
| EX-03 | --help 출력 | ⬜ | ⬜ | ⬜ |
| EX-04 | --version 출력 | ⬜ | ⬜ | ⬜ |
| EX-05 | WezTerm 레이아웃 생성 | ⬜ | ⬜ | ⬜ |
| EX-06 | 스케줄러 TUI 표시 | ⬜ | ⬜ | ⬜ |
| EX-07 | Worker pane 생성 | ⬜ | ⬜ | ⬜ |

### 4.2 PyPI 설치 테스트

| ID | 테스트 항목 | 결과 |
|----|------------|------|
| PY-01 | pipx install 성공 | ⬜ |
| PY-02 | pip install 성공 | ⬜ |
| PY-03 | orchay 명령 등록 | ⬜ |
| PY-04 | --help 출력 | ⬜ |
| PY-05 | 기능 정상 동작 | ⬜ |

---

## 5. 오류 시나리오

### 5.1 예상 오류 및 대응

| 오류 | 원인 | 대응 |
|------|------|------|
| `ModuleNotFoundError` | Hidden imports 누락 | TSK-02-02 확인 |
| `FileNotFoundError` | 리소스 번들링 누락 | TSK-02-03 확인 |
| `WezTerm not found` | PATH 미등록 | 사전 요구사항 안내 |
| `Permission denied` | 실행 권한 없음 | `chmod +x` 안내 |
| Gatekeeper 차단 | 미서명 바이너리 | `xattr` 명령 안내 |

### 5.2 디버깅 방법

```bash
# 상세 로그 출력
orchay --verbose

# Python 버전 확인
python --version

# 의존성 확인
pip show orchay
```

---

## 6. 수용 기준

| ID | 기준 | 검증 방법 |
|----|------|----------|
| AC-01 | Windows 실행 파일 정상 동작 | TC-01 통과 |
| AC-02 | Linux 실행 파일 정상 동작 | TC-02 통과 |
| AC-03 | macOS 실행 파일 정상 동작 | TC-03 통과 |
| AC-04 | pipx install 정상 동작 | TC-04 통과 |
| AC-05 | 모든 플랫폼에서 WezTerm 레이아웃 생성 | 수동 확인 |
| AC-06 | 스케줄러 정상 실행 | TUI 화면 표시 |

---

## 7. 의존성

| Task | 상태 | 관계 |
|------|------|------|
| TSK-03-01 | [dd] | GitHub Releases 배포 필요 |
| TSK-03-02 | [dd] | PyPI 배포 필요 |
| TSK-03-03 | [ ] | Trusted Publishing 설정 필요 |

---

## 8. 테스트 결과 기록 양식

```markdown
## 테스트 결과

### 환경
- 날짜: YYYY-MM-DD
- 버전: v0.1.0
- 테스터: -

### 실행 파일 테스트

| 플랫폼 | 버전 | 결과 | 비고 |
|--------|------|------|------|
| Windows 11 | x64 | ✅/❌ | |
| Ubuntu 22.04 | x64 | ✅/❌ | |
| macOS 14 | ARM | ✅/❌ | |

### PyPI 테스트

| 방법 | 결과 | 비고 |
|------|------|------|
| pipx install | ✅/❌ | |
| pip install | ✅/❌ | |

### 발견된 이슈
- [ ] 이슈 1
- [ ] 이슈 2
```

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-30 | 초기 통합설계 작성 |
