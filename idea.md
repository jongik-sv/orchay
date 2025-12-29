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

  python ./orchay/launcher.py orchay_web -w 3 --web --port 8080 --font-size 9

PS C:\project\jjiban_flutter> python C:\project\jjiban_flutter\orchay\launcher.py orchay_web -w 3

http://localhost:3000/wbs

orchay_web 과 프로젝트 합치고 orchay의 웹 기능은 삭제하자. 각자 잘하는것만 하자.

1. Development (개발 워크플로우)

가장 완전한 개발 프로세스
[ ] → [bd] → [dd] → [ap] → [im] → [vf] → [xx]
시작전 기본설계 상세설계 승인 구현 검증 완료
| 상태 | 가능한 액션 |
|---------------|--------------------|
| [bd] 기본설계 | ui |
| [dd] 상세설계 | review, apply |
| [im] 구현 | test, audit, patch |
| [vf] 검증 | test |

2. Defect (결함 수정 워크플로우)

버그 수정용 간소화 프로세스
[ ] → [an] → [fx] → [vf] → [xx]
시작전 분석 수정 검증 완료
| 상태 | 가능한 액션 |
|-----------|--------------------|
| [fx] 수정 | test, audit, patch |
| [vf] 검증 | test |

3. Infrastructure (인프라 워크플로우)

인프라/설정 작업용 (설계 생략 가능)
[ ] → [ds] → [im] → [xx]
시작전 설계 구현 완료

---

상태(States) 요약

| 코드 | 이름     | Phase     | 진행률 |
| ---- | -------- | --------- | ------ |
| [ ]  | 시작 전  | todo      | 0%     |
| [bd] | 기본설계 | design    | 20%    |
| [dd] | 상세설계 | design    | 40%    |
| [ap] | 승인     | design    | 50%    |
| [an] | 분석     | design    | 30%    |
| [ds] | 설계     | design    | 30%    |
| [im] | 구현     | implement | 60%    |
| [fx] | 수정     | implement | 60%    |
| [vf] | 검증     | implement | 80%    |
| [xx] | 완료     | done      | 100%   |

Execution Mode 분석

scheduler.py에서 4가지 실행 모드가 정의되어 있습니다:

모드별 워크플로우 단계

WORKFLOW_STEPS = {
DESIGN: ["start"],
QUICK: ["start", "approve", "build", "done"],
DEVELOP: ["start", "review", "apply", "approve", "build", "audit", "patch", "test", "done"],
FORCE: ["start", "approve", "build", "done"],
}

모드별 동작 비교

| 모드    | 워크플로우 단계                                                        | 의존성 검사      | 대상 Task   |
| ------- | ---------------------------------------------------------------------- | ---------------- | ----------- |
| design  | start                                                                  | 없음             | [ ] 상태만  |
| quick   | start → approve → build → done                                         | [dd]+ 상태에서만 | 미완료 전체 |
| develop | start → review → apply → approve → build → audit → patch → test → done | [dd]+ 상태에서만 | 미완료 전체 |
| force   | start → approve → build → done                                         | 무시             | 미완료 전체 |

비즈니스 규칙 (filter_executable_tasks)

| 규칙  | 설명                                          |
| ----- | --------------------------------------------- |
| BR-01 | 완료 Task [xx]는 항상 제외                    |
| BR-02 | blocked-by 설정된 Task 제외                   |
| BR-03 | 이미 Worker에 할당된 Task 제외                |
| BR-04 | design 모드: [ ] 상태만 포함                  |
| BR-05 | quick/develop: [dd] 이상 상태에서 의존성 검사 |
| BR-06 | force 모드: 의존성 무시                       |
| BR-07 | 우선순위 정렬: critical > high > medium > low |

의존성 검사 로직

# [ ] 상태 → 의존성 검사 안 함 (설계 시작 가능)

# [dd] 이상 → 선행 Task가 [im] 이상이어야 진행 가능

IMPLEMENTED_STATUSES = {IMPLEMENT, VERIFY, DONE} # [im], [vf], [xx]

모드 선택 가이드

| 상황                                 | 추천 모드 |
| ------------------------------------ | --------- |
| 설계 문서만 생성                     | design    |
| 빠른 개발 (리뷰 생략)                | quick     |
| 전체 개발 사이클 (리뷰, 테스트 포함) | develop   |
| 의존성 무시하고 강제 실행            | force     |

CLI 사용법

python -m orchay orchay -m design # 설계 모드
python -m orchay orchay -m quick # 빠른 모드 (기본값)
python -m orchay orchay -m develop # 전체 개발 모드
python -m orchay orchay -m force # 강제 실행 모드
