# orchay-init

다른 프로젝트에 orchay 구조를 초기화하는 CLI 도구입니다.

## 사용법

### npx로 바로 실행 (권장)

```bash
# 현재 폴더에 초기화
npx orchay-init

# 특정 폴더에 초기화
npx orchay-init ./my-project

# 도움말
npx orchay-init --help
```

### 전역 설치

```bash
npm install -g orchay-init

# 실행
orchay-init
orchay-init ./my-project
```

### 프로젝트 로컬 설치

```bash
npm install --save-dev orchay-init

# package.json scripts에 추가
# "scripts": { "init": "orchay-init" }
npm run init
```

## 생성되는 구조

```
your-project/
├── .claude/
│   ├── agents/           # Claude Code 에이전트 설정
│   │   ├── backend-architect.md
│   │   ├── frontend-architect.md
│   │   ├── quality-engineer.md
│   │   └── ...
│   ├── commands/         # 커스텀 슬래시 명령어
│   │   ├── plan/
│   │   │   ├── tech-stack.md
│   │   │   ├── ui_theme.md
│   │   │   └── wbs.md
│   │   └── wf/
│   │       ├── start.md
│   │       ├── design.md
│   │       ├── build.md
│   │       └── ...
│   └── includes/         # 공통 포함 파일
│       ├── wf-common-lite.md
│       └── ...
└── .orchay/
    ├── projects/         # 프로젝트별 작업 폴더 (빈 폴더로 생성)
    ├── script/           # 자동화 스크립트
    │   ├── next-task.ts
    │   └── transition.ts
    ├── settings/         # 설정 파일
    │   ├── columns.json
    │   ├── workflows.json
    │   └── orchay.yaml
    └── templates/        # 문서 템플릿
        ├── 010-basic-design.md
        ├── 020-detail-design.md
        ├── 030-implementation.md
        └── ...
```

## 폴더 설명

### `.claude/`

Claude Code에서 사용하는 설정 파일들:

| 폴더 | 설명 |
|------|------|
| `agents/` | 특화된 AI 에이전트 프롬프트 (backend, frontend, quality 등) |
| `commands/` | `/plan:*`, `/wf:*` 슬래시 명령어 정의 |
| `includes/` | 명령어에서 재사용하는 공통 프롬프트 |

### `.orchay/`

orchay 워크플로우 시스템 설정:

| 폴더 | 설명 |
|------|------|
| `projects/` | 프로젝트별 WBS, 태스크, 문서 저장 폴더 |
| `script/` | 태스크 전환, 다음 태스크 찾기 등 자동화 스크립트 |
| `settings/` | 워크플로우, 컬럼, 프로젝트 설정 |
| `templates/` | 설계 문서, 구현 문서, 테스트 결과 템플릿 |

## 기존 파일 처리

- **덮어쓰기**: 이미 존재하는 파일은 새 파일로 교체됩니다.
- 기존 설정을 유지하려면 먼저 백업하세요:

```bash
# 백업 후 초기화
cp -r .claude .claude.backup
cp -r .orchay .orchay.backup
npx orchay-init
```

---

## 개발자 가이드

### 프로젝트 구조

```
orchay-init/
├── package.json          # npm 설정, prepublishOnly로 자동 빌드
├── bin/
│   └── cli.js            # CLI 진입점
├── scripts/
│   └── build.js          # 상위 폴더에서 templates/로 복사
├── templates/            # 빌드 시 생성 (.gitignore에 포함)
├── .gitignore
└── README.md
```

### 로컬 개발

```bash
cd orchay-init

# 빌드 (상위 폴더의 .claude, .orchay를 templates/로 복사)
npm run build

# 테스트
node bin/cli.js ./test-output

# 테스트 폴더 확인
ls -la ./test-output/.claude
ls -la ./test-output/.orchay

# 정리
rm -rf ./test-output
```

### 템플릿 수정

템플릿 파일들은 상위 폴더에 있습니다:

```
orchay/
├── .claude/              # ← 여기를 수정
├── .orchay/              # ← 여기를 수정
└── orchay-init/
```

수정 후 `npm run build`로 templates/에 반영됩니다.

---

## npm 배포

### 1. npm 로그인

```bash
npm login
# Username, Password, Email 입력
```

### 2. 버전 업데이트

```bash
cd orchay-init

# 패치 버전 (1.0.0 → 1.0.1)
npm version patch

# 마이너 버전 (1.0.0 → 1.1.0)
npm version minor

# 메이저 버전 (1.0.0 → 2.0.0)
npm version major
```

### 3. 배포

```bash
# 2FA 설정된 경우 (Access Token 사용)
npm publish --token=YOUR_ACCESS_TOKEN

# OTP 사용
npm publish --otp=123456

# 2FA 없는 경우
npm publish

# login 
npm login
npm publish
```

### Access Token 발급 방법

1. https://www.npmjs.com 로그인
2. 오른쪽 위 프로필 → **Access Tokens**
3. **Generate New Token** → **Classic Token** → **Automation**
4. 토큰 복사하여 사용

### 배포 확인

```bash
# 배포된 버전 확인
npm view orchay-init version

# 다른 폴더에서 테스트
cd /tmp
npx orchay-init@latest ./test
```

---

## 요구사항

- Node.js >= 16.7.0

## 라이선스

MIT
