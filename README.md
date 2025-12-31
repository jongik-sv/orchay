# orchay

> **orch**estration + ok**ay** - WezTerm 기반 AI Task 스케줄러

wbs.md를 모니터링하여 실행 가능한 Task를 추출하고, 여러 Claude Code Worker pane에 작업을 자동 분배합니다.

## 프로젝트 구조

```
orchay/
├── orchay/          # 스케줄러 코어 (Python)
├── orchay_web/      # 웹 대시보드 (Nuxt 3)
├── orchay-init/     # 프로젝트 초기화 CLI (npm)
├── .claude/         # Claude Code 설정 템플릿
└── .orchay/         # 프로젝트 설정 및 WBS 파일
```

| 모듈 | 설명 | 기술 스택 |
|------|------|----------|
| [orchay](./orchay/) | Task 스케줄러 코어 | Python, Textual, FastAPI |
| [orchay_web](./orchay_web/) | 웹 대시보드 | Nuxt 3, PrimeVue, Tailwind |
| [orchay-init](./orchay-init/) | 프로젝트 초기화 CLI | Node.js |

## 빠른 시작

### 0. 프로젝트 초기화 (새 프로젝트)

다른 프로젝트에 orchay 구조를 추가하려면:

```bash
cd your-project
npx orchay-init
```

생성되는 구조:
- `.claude/` - Claude Code 에이전트, 슬래시 명령어
- `.orchay/` - 워크플로우 설정, 템플릿, 프로젝트 폴더

### 1. 설치

#### 1.1 orchay (스케줄러 CLI)

##### Windows

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

##### Linux

```bash
curl -L https://github.com/jongik-sv/orchay/releases/latest/download/orchay-linux-x64.zip -o orchay.zip
unzip orchay.zip -d ~/.local/
ln -s ~/.local/orchay-linux-x64/orchay ~/.local/bin/orchay
```

##### macOS

```bash
curl -L https://github.com/jongik-sv/orchay/releases/latest/download/orchay-macos-x64.zip -o orchay.zip
unzip orchay.zip -d ~/.local/
ln -s ~/.local/orchay-macos-x64/orchay ~/.local/bin/orchay
```

##### pipx (개발용)

```bash
pipx install orchay
```

#### 1.2 orchay_web (웹 대시보드)

##### Windows

[Releases](https://github.com/jongik-sv/orchay/releases/latest)에서 `orchay_web-x.x.x-win-x64.exe` 다운로드 후 실행

##### Linux

```bash
# AppImage
curl -L https://github.com/jongik-sv/orchay/releases/latest/download/orchay_web-0.1.0-linux-x64.AppImage -o orchay_web.AppImage
chmod +x orchay_web.AppImage
./orchay_web.AppImage

# 또는 deb 패키지
curl -L https://github.com/jongik-sv/orchay/releases/latest/download/orchay_web-0.1.0-linux-x64.deb -o orchay_web.deb
sudo dpkg -i orchay_web.deb
```

##### macOS

```bash
# Intel
curl -L https://github.com/jongik-sv/orchay/releases/latest/download/orchay_web-0.1.0-mac-x64.dmg -o orchay_web.dmg
hdiutil attach orchay_web.dmg
cp -R /Volumes/orchay_web*/orchay_web.app /Applications/
hdiutil detach /Volumes/orchay_web*

# Apple Silicon
curl -L https://github.com/jongik-sv/orchay/releases/latest/download/orchay_web-0.1.0-mac-arm64.dmg -o orchay_web.dmg
hdiutil attach orchay_web.dmg
cp -R /Volumes/orchay_web*/orchay_web.app /Applications/
hdiutil detach /Volumes/orchay_web*
```

#### 1.3 orchay-init (프로젝트 초기화)

```bash
cd your-project
npx orchay-init
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
