# WezTerm CLI 사용 가이드

WezTerm은 tmux처럼 CLI를 통해 프로그래밍 방식으로 터미널을 제어할 수 있습니다.

## 목차

1. [기본 개념](#1-기본-개념)
2. [창 목록 조회](#2-창-목록-조회-list)
3. [텍스트 전송](#3-텍스트-전송-send-text)
4. [출력 캡쳐](#4-출력-캡쳐-get-text)
5. [새 프로세스 실행](#5-새-프로세스-실행-spawn)
6. [창 분할](#6-창-분할-split-pane)
7. [실용 예제](#7-실용-예제)
8. [Claude Code 훅 연동](#8-claude-code-훅-연동)

---

## 1. 기본 개념

### 명령어 구조

```bash
wezterm cli <명령어> [옵션]
```

### Pane 타겟팅 우선순위

1. `--pane-id` 옵션으로 직접 지정
2. `$WEZTERM_PANE` 환경변수
3. 가장 최근 세션의 focused pane

### 주요 명령어 목록

| 명령어 | 기능 |
|--------|------|
| `list` | 창/탭 목록 표시 |
| `send-text` | 텍스트 전송 (입력) |
| `get-text` | 텍스트 추출 (출력 캡쳐) |
| `spawn` | 새 프로세스 실행 |
| `split-pane` | 창 분할 |
| `activate-pane` | 특정 창 활성화 |
| `kill-pane` | 창 종료 |
| `zoom-pane` | 창 확대/축소 |

---

## 2. 창 목록 조회: `list`

현재 열려있는 모든 윈도우, 탭, 패인 정보를 확인합니다.

### 기본 사용법

```bash
# 테이블 형식 (기본)
wezterm cli list

# JSON 형식
wezterm cli list --format json
```

### 출력 예시

```
WINID  TABID  PANEID  WORKSPACE  SIZE     TITLE    CWD
0      0      0       default    120x30   bash     /home/user
0      0      1       default    120x30   vim      /home/user/project
```

### 테스트

```bash
# 1. 현재 pane 목록 확인
wezterm cli list

# 2. JSON으로 파싱 가능한 형식
wezterm cli list --format json | jq .
```

---

## 3. 텍스트 전송: `send-text`

특정 pane에 텍스트를 붙여넣기처럼 전송합니다.

### 옵션

| 옵션 | 설명 |
|------|------|
| `--pane-id <ID>` | 대상 pane 지정 |
| `--no-paste` | bracketed paste 비활성화 (직접 입력처럼) |
| `[TEXT]` | 전송할 텍스트 (생략시 stdin) |

### 테스트

```bash
# 1. 현재 pane에 텍스트 전송
wezterm cli send-text "echo hello"

# 2. 특정 pane에 전송 (pane-id는 list로 확인)
wezterm cli send-text --pane-id 0 "ls -la"

# 3. stdin으로 전송
echo "pwd" | wezterm cli send-text

# 4. 붙여넣기 모드 비활성화
wezterm cli send-text --no-paste "echo test"

# 5. 여러 줄 명령 전송
wezterm cli send-text "echo line1
echo line2
echo line3"

# 6. 엔터키 포함 (실제 실행)
wezterm cli send-text $'echo hello\n'
```

### Windows PowerShell에서

```powershell
# PowerShell에서 줄바꿈 포함
wezterm cli send-text "echo hello`n"

# 파이프 사용
"dir" | wezterm cli send-text
```

### Windows CMD에서 (권장)

Windows CMD에서는 `echo` 파이프 방식이 가장 확실하게 엔터키를 전송합니다.

```cmd
:: 명령어 + 엔터키 전송 (실제 실행됨)
echo echo hello| wezterm cli send-text --pane-id 0

:: 특정 pane에 명령 전송
echo cd C:\project| wezterm cli send-text --pane-id 0
echo npm run dev| wezterm cli send-text --pane-id 1

:: 여러 명령 순차 전송
echo git status| wezterm cli send-text --pane-id 0
echo git add .| wezterm cli send-text --pane-id 0
echo git commit -m "update"| wezterm cli send-text --pane-id 0
```

**주의:** `echo`와 `|` 사이에 공백이 없어야 합니다. 공백이 있으면 공백도 함께 전송됩니다.

```cmd
:: 올바른 방법 (공백 없음)
echo dir| wezterm cli send-text

:: 잘못된 방법 (뒤에 공백 포함됨)
echo dir | wezterm cli send-text
```

### 배치 스크립트 예시

```cmd
@echo off
:: dev-setup.cmd - 개발 환경 자동 설정

:: pane 목록 확인
wezterm cli list

:: pane 0에 서버 시작
echo npm run dev| wezterm cli send-text --pane-id 0

:: pane 1에 테스트 감시
echo npm run test:watch| wezterm cli send-text --pane-id 1

:: pane 2에 로그 모니터링
echo tail -f logs/app.log| wezterm cli send-text --pane-id 2
```

---

## 4. 출력 캡쳐: `get-text`

pane의 텍스트 내용을 추출합니다.

### 옵션

| 옵션 | 설명 |
|------|------|
| `--pane-id <ID>` | 대상 pane 지정 |
| `--start-line <N>` | 시작 줄 (0=화면 첫줄, 음수=스크롤백) |
| `--end-line <N>` | 종료 줄 |
| `--escapes` | ANSI 색상/스타일 코드 포함 |

### 테스트

```bash
# 1. 현재 화면 캡쳐
wezterm cli get-text

# 2. 파일로 저장
wezterm cli get-text > output.txt

# 3. 색상/스타일 포함
wezterm cli get-text --escapes > colored.txt

# 4. 스크롤백 100줄 포함
wezterm cli get-text --start-line -100 --end-line 0

# 5. 특정 pane에서 캡쳐
wezterm cli get-text --pane-id 1

# 6. 최근 20줄만 캡쳐
wezterm cli get-text --start-line -20

# 7. 화면 상단 10줄만
wezterm cli get-text --start-line 0 --end-line 10
```

---

## 5. 새 프로세스 실행: `spawn`

새 탭이나 윈도우에서 프로세스를 실행하고 pane-id를 반환합니다.

### 옵션

| 옵션 | 설명 |
|------|------|
| `--cwd <DIR>` | 작업 디렉토리 지정 |
| `--new-window` | 새 윈도우에서 실행 |
| `--workspace <NAME>` | 워크스페이스 이름 |
| `--window-id <ID>` | 특정 윈도우에 탭 생성 |

### 테스트

```bash
# 1. 기본 쉘 실행 (새 탭)
wezterm cli spawn

# 2. 특정 프로그램 실행
wezterm cli spawn -- powershell
wezterm cli spawn -- cmd /k "echo Hello"

# 3. 작업 디렉토리 지정
wezterm cli spawn --cwd C:\project -- cmd

# 4. 새 윈도우에서 실행
wezterm cli spawn --new-window -- powershell

# 5. pane-id 저장해서 활용
$PANE_ID=$(wezterm cli spawn -- bash)
echo "Created pane: $PANE_ID"
```

---

## 6. 창 분할: `split-pane`

현재 pane을 분할하고 새 pane-id를 반환합니다.

### 방향 옵션

| 옵션 | 설명 |
|------|------|
| `--bottom` | 아래쪽 분할 (기본값) |
| `--top` | 위쪽 분할 |
| `--left` | 왼쪽 분할 |
| `--right` | 오른쪽 분할 |
| `--horizontal` | `--right`와 동일 |

### 크기 옵션

| 옵션 | 설명 |
|------|------|
| `--percent <N>` | 백분율로 크기 지정 |
| `--cells <N>` | 셀 개수로 크기 지정 |

### 테스트

```bash
# 1. 아래쪽 분할 (기본)
wezterm cli split-pane

# 2. 오른쪽 분할
wezterm cli split-pane --right

# 3. 왼쪽 30% 크기로 분할
wezterm cli split-pane --left --percent 30

# 4. 아래쪽 10줄 크기로 분할
wezterm cli split-pane --bottom --cells 10

# 5. 프로그램과 함께 분할
wezterm cli split-pane --right -- powershell

# 6. 특정 디렉토리에서 분할
wezterm cli split-pane --right --cwd C:\project -- cmd
```

---

## 7. 실용 예제

### 예제 1: 명령 실행 후 결과 캡쳐

```bash
#!/bin/bash
# test-capture.sh

# 새 pane 생성
PANE_ID=$(wezterm cli split-pane --right -- bash)
echo "Created pane: $PANE_ID"

# 명령 전송
wezterm cli send-text --pane-id $PANE_ID $'echo "Hello World"\n'

# 잠시 대기
sleep 1

# 결과 캡쳐
wezterm cli get-text --pane-id $PANE_ID > result.txt
cat result.txt
```

### 예제 2: 모니터링 패널 생성

```bash
#!/bin/bash
# monitoring-setup.sh

# 오른쪽에 로그 모니터링 pane
LOG_PANE=$(wezterm cli split-pane --right --percent 40)
wezterm cli send-text --pane-id $LOG_PANE $'tail -f /var/log/app.log\n'

# 아래쪽에 시스템 모니터링 pane
SYS_PANE=$(wezterm cli split-pane --bottom --percent 30)
wezterm cli send-text --pane-id $SYS_PANE $'htop\n'

echo "Log pane: $LOG_PANE"
echo "System pane: $SYS_PANE"
```

### 예제 3: 개발 환경 자동 설정

```bash
#!/bin/bash
# dev-setup.sh

PROJECT_DIR="C:\project\myapp"

# 메인 편집기
wezterm cli send-text $'code .\n'

# 오른쪽: 서버 실행
SERVER_PANE=$(wezterm cli split-pane --right --percent 40 --cwd $PROJECT_DIR)
wezterm cli send-text --pane-id $SERVER_PANE $'npm run dev\n'

# 아래쪽: 테스트 워처
TEST_PANE=$(wezterm cli split-pane --bottom --percent 30 --cwd $PROJECT_DIR)
wezterm cli send-text --pane-id $TEST_PANE $'npm run test:watch\n'
```

### 예제 4: 특정 pane 출력 검색

```bash
#!/bin/bash
# search-output.sh

# 현재 pane 출력에서 에러 검색
wezterm cli get-text --start-line -100 | grep -i "error"

# 특정 pane에서 검색
wezterm cli get-text --pane-id 1 | grep -i "warning"
```

---

## 8. Claude Code 훅 연동

### 작업 완료 알림 (Windows CMD 방식)

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cmd /c \"echo echo [완료] Claude 작업이 끝났습니다| wezterm cli send-text --pane-id 1\""
          }
        ]
      }
    ]
  }
}
```

### 실행 전 컨텍스트 저장

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "wezterm cli get-text --start-line -50 > C:\\temp\\context.txt"
          }
        ]
      }
    ]
  }
}
```

### 결과를 다른 pane에 출력 (Windows CMD 방식)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "cmd /c \"echo echo --- Bash 실행 완료 ---| wezterm cli send-text --pane-id 1\""
          }
        ]
      }
    ]
  }
}
```

### 복합 훅 예시: 작업 완료 시 알림 + 사운드

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cmd /c \"echo echo ===TASK_COMPLETE===| wezterm cli send-text --pane-id 1\""
          }
        ]
      }
    ]
  }
}
```

### Windows에서 훅 명령어 패턴

```
cmd /c "echo <전송할 명령>| wezterm cli send-text --pane-id <ID>"
```

**주의사항:**
- `cmd /c`로 CMD 쉘에서 실행
- `echo`와 `|` 사이에 공백 없음
- 전체 명령을 큰따옴표로 감싸기

---

## 빠른 테스트 체크리스트

아래 명령어들을 순서대로 실행하여 WezTerm CLI가 정상 동작하는지 확인하세요:

```bash
# 1. CLI 버전 확인
wezterm --version

# 2. pane 목록 확인
wezterm cli list

# 3. 텍스트 전송 테스트
wezterm cli send-text "echo 'WezTerm CLI Test'"

# 4. 출력 캡쳐 테스트
wezterm cli get-text | head -5

# 5. 창 분할 테스트
wezterm cli split-pane --right --percent 30

# 6. 분할된 창 확인
wezterm cli list
```

---

## 참고 자료

- [WezTerm 공식 문서](https://wezterm.org/)
- [CLI Reference](https://wezterm.org/cli/cli/index.html)
- [send-text](https://wezterm.org/cli/cli/send-text.html)
- [get-text](https://wezterm.org/cli/cli/get-text.html)
- [spawn](https://wezterm.org/cli/cli/spawn.html)
- [split-pane](https://wezterm.org/cli/cli/split-pane.html)
- [list](https://wezterm.org/cli/cli/list.html)
