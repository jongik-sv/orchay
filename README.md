# orchay

> **orch**estration + ok**ay** - WezTerm 기반 AI Task 스케줄러

wbs.md를 모니터링하여 실행 가능한 Task를 추출하고, 여러 Claude Code Worker pane에 작업을 자동 분배합니다.

## 프로젝트 구조

```
orchay/
├── orchay/          # 스케줄러 코어 (Python)
├── orchay_web/      # 웹 대시보드 (Nuxt 3)
└── .orchay/         # 프로젝트 설정 및 WBS 파일
```

| 모듈 | 설명 | 기술 스택 |
|------|------|----------|
| [orchay](./orchay/) | Task 스케줄러 코어 | Python, Textual, FastAPI |
| [orchay_web](./orchay_web/) | 웹 대시보드 | Nuxt 3, PrimeVue, Tailwind |

## 빠른 시작

### 1. 설치

#### Windows

1. [Releases](https://github.com/jongik-sv/orchay/releases/latest)에서 `orchay-windows-x64.zip` 다운로드
2. 압축 해제 후 원하는 위치에 복사 (예: `C:\bin\orchay\`)
3. 런처 스크립트 생성:

```powershell
# C:\bin\orchay.cmd 파일 생성
echo @"C:\bin\orchay\orchay.exe" %%* > C:\bin\orchay.cmd
```

4. `C:\bin`이 PATH에 없다면 추가:

```powershell
# 현재 사용자 PATH에 추가
[Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";C:\bin", "User")
```

#### Linux / macOS

```bash
# 다운로드 및 설치
curl -L https://github.com/jongik-sv/orchay/releases/latest/download/orchay-linux-x64.zip -o orchay.zip
unzip orchay.zip -d ~/.local/
ln -s ~/.local/orchay-linux-x64/orchay ~/.local/bin/orchay
```

#### pipx (개발용)

```bash
pipx install orchay
```

### 2. 사전 요구사항

| 도구 | 설치 |
|------|------|
| WezTerm | `winget install wez.wezterm` |
| Claude Code | `npm install -g @anthropic-ai/claude-code` |

### 3. 실행

```bash
cd {프로젝트 루트}  # .orchay 폴더가 있는 위치
orchay project_name
```

## 주요 기능

- **자동 Task 분배**: WBS 파싱 → 실행 가능 Task 필터링 → Worker 자동 할당
- **멀티 Worker**: 최대 6개 Claude Code 인스턴스 병렬 실행
- **실행 모드**: design, quick, develop, force
- **실시간 모니터링**: TUI 및 웹 대시보드
- **의존성 관리**: Task 간 의존성 자동 추적

## 문서

- [orchay 스케줄러 상세](./orchay/README.md)
- [orchay_web 대시보드](./orchay_web/README.md)

## 라이선스

MIT
