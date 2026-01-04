| 라이브러리 | 플랫폼   | 설명                              |
| ---------- | -------- | --------------------------------- |
| pexpect    | Unix/Mac | PTY 기반 프로세스 제어, 가장 유명 |
| wexpect    | Windows  | pexpect의 Windows 포트            |
| pywinpty   | Windows  | winpty Python 바인딩              |
| pyte       | 모두     | 순수 Python 터미널 에뮬레이터     |
| ptyprocess | Unix/Mac | pexpect 하위 라이브러리           |

파워쉘 업그레이드 https://dong-it-engineer.tistory.com/39
파워쉘 7버전에서 가능함
wezterm cli send-text --no-paste --pane-id 1 프롬프트 # 예 : /wf:design TSK-01-01
wezterm cli send-text --no-paste --pane-id 1 `r # 명령어를 submit 하기 위한 enter 키

python C:\project\orchay_flutter\orchay\launcher.py
PS C:\project\table-order>  python C:\project\orchay\orchay\src\orchay\launcher.py mvp


# orchay

## 1. 기능

### 1.1 보조 도구 설치

- claude code
  - commands
  - includes
  - skills : orchay-init, user-manual-create
  - hooks 설정 : 아 이것은 어떻게 해야하나?
- orchay 폴더

  - script, settings, templates

## ochary_web 수정할 기능
- wbs 편집 기능
  - wbs 내용 
  - 수동 승인 : **force모드가 아닐 때** queue에서 아무 작업이 걸려있지 않은 [dd] 상태의 Task를 승인 상태로 바꾸는 기능이 있으면 좋겠어. 명령어 호출이 아닌 단순 값을 [dd]에서 [ap]으로 변경하는 것
- Task 상태
  - 보류 상태 : 진행을 풀기 전까지 진행이 되지 않는 상태
  - 

## 공통 수정
- 코드 리펙토링
- 


## **아주 중요**
- wbs.md 파일을 YAML로 변경


릴리즈 리스트
gh release list --repo jongik-sv/orchay

build-20251230-232844  Pre-release  build-20251230-232844  about 13 hours ago
v0.1.0                 Latest       v0.1.0                 about 1 day ago


릴리즈 삭제
gh release delete build-20251230-232844 --repo jongik-sv/orchay --yes
gh release delete v0.1.0 --repo jongik-sv/orchay --yes




  # orchay (Python CLI)
  gh workflow run "Build & Release" -f version=v0.1.2

  # orchay_web (Electron)
  gh workflow run "Build & Release Electron App" -f version=v0.1.2




PS C:\project\table-order>  python C:\project\orchay\orchay\src\orchay\launcher.py mvp

설피
cd C:\project\orchay\orchay
  uv venv
  uv pip install -e ".[dev]"


  cd C:\project\orchay\orchay
  pip install -e ".[dev]"

