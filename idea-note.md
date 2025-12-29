@projects\orchay\orchay-prd.md 지금 명령어가 꼬인것 같아. start 명령어는 기본 설계까지 완성하는        
것이고 draft명령어가 상세설계 완성하는 명령어인데 지금 잘못 되어 있어. 바로 잡아줘. start 명령어를       
실행할때 비즈니스 위주의 기본 설계서가 만들어지면 된다. 그렇게 적용해줘. 명령어도 그렇게 적용해줘.


## 일반적인 Phase별 필수 산출물

| Phase | 필수 문서                          |
|-------|--------------------------------|
| 요구사항  | SRS, 요구사항 추적 매트릭스, 용어집         |
| 설계    | SAD, SDD, 인터페이스 명세, DB 설계서     |
| 구현    | 소스코드, 단위테스트 결과, 코딩 표준 준수 체크리스트 |
| 테스트   | 테스트 계획서, 테스트 케이스, 테스트 결과 보고서   |
| 배포    | 배포 가이드, 운영 매뉴얼, 교육 자료          |


##  AI 코딩 착수 프롬프트 

### 핵심 규칙

1. **스택 준수**: TRD.md에 명시된 라이브러리와 버전만 사용
2. **추측 금지**: 요구사항이 불명확하면 명확화 요청
3. **편법 금지**: 완전하고 프로덕션 레디 코드 구현
4. **아키텍처 우선**: 기능 코드 작성 전 프로젝트 구조 설정
5. **테스트 커버리지**: 구현과 함께 테스트 작성

### 실행 순서

1. TRD.md의 정확한 버전으로 프로젝트 초기화
2. 명시된 대로 디렉토리 구조 설정
3. 린팅, 포매팅, pre-commit 훅 설정
4. 우선순위 순서로 기능 구현 (P0 먼저)
5. 각 기능에 대한 테스트 작성
6. 모든 이탈 사항이나 결정 문서화



## 자동 워크플로우 실행 체계
- 초기 시작 단계(todo), 설계(기본설계, ui설계, 상세설계) 까지는 의존 순위의 영향을 받지 않는다.(순서 상관없이 실행 가능)
- 구현단계부터는 depends의 영향을 받는다.
  - 이전 테스트가 끝나야 다음 태스크의 구현이 가능
  - --force 옵션으로 이전 테스트가 끝나지 않았더라도 구현을 할 수 있다.
- 태스크의 워크플로우 실행 우선 순위
  - 설계를 하지 않은 태스크의 설계를 가장 우선(태스크가 기본설계를 하면 UI설계, 상세설계까지 한번에 진행)
 
---
## 워크플로우 단계를 유연하게 결정해보자
- 명령어에서 직접 완료후 Task의 단계를 넣지 않는다.
- 명령어에 마지막 단계에 프로그램을 호출(npx 등으로 스크립트 호출)해서 그 프로그램이 결정하고 단계를 변경한다.
- 단계결정 프로그램
  - trasition 테이블을 정의
  - Task 카테고리, 프로젝트 ID(project.json에 "approvalMode": "auto" 등 참조), 현재 실행 명령어를 입력 받아서 다음 단계 결정
  - 결정된 단계를 wbs안의 Task 정보 변경


### 작업단계
- 유연화 먼저 하고 
  - 명령어, 단계 결정 프로그램, .orchay/script/workflow.json 생성
  - 현재 프로그램 수정
  - 현재 작성된 코드와 워크플로우 결합도 낮추기wo
- 단계를 줄인 카테고리를 만들자.



## 수정 고려 사항
- Todo list에 계속 해서 다음 명령어를 수록해서 자동으로 다음 명령어를 수행하는 체계 연구
- 서브에이전트로 WP/ACT 단위 명령어를 수행할 수 있도록 수정하면?? (유튜브 참고 https://www.youtube.com/watch?v=bcmmkSEW7VI)
- **상세 설계** : LLM용(orchay) 과 사람용(DMES팀) 2가지가 있어야 하겠다.**
- **칸반에서 WP/ACT 그룹 구분** 칸반에는 Task만 표시하고, 같은 WP/ACT는 동일 색으로 구분한다.
- **유연한 워크플로우**  -> 수정함
  - WP-02_core-workflow-engine를 보면 Task category별로 각각의 워크플로우를 구현하고 있는데 이를 수정하고 싶어.
  - 카테고리 테이블 정의 (카테고리명, 설명) --> 이 테이블을 바탕으로 Task 카테고리 지정
  - 카테고리별 워크플로우 처리를 위한 룰 테이블 정의
  - 각 룰마다 실행해야 하는 카테고리, 현재상태, 칸반상태, 사용 명령어, 다음상태, LLM 실행 명령어 등
  - 이를 바탕으로 유연한 워크 플로우 체계를 만듦
  - 칸반상태(Todo, Design, Detail, Implement, Verify, Done) 정의 테이블
  - 카테고리 관리, 워크플로우 관리 화면이 필요
- **프로그래스 상태** : 워크플로우 실행중일때 빙글빙글 돌아야됨
- **프로젝트 단계 확장** : 1차 구축 후 추가 예정, .orchay의 폴더 구조만 먼저 바꿀까?
- claude code rule : 사용법 익히자.
- 상세설계에 코드가 많네. 
- 070 테스트에 관련된 문서를 다시 정리해야함
- 각 개발 에이전트가 실행되고 있는 동안 발생하는 정보는 serena를 이용해서 수집하고 요약 관리 한다.
- **설계 결과 승인 단계 또는 플래그**를 둘까 한다. 설계완료 승인된 Task만 개발 가능하도록 변경한다.
- tech-stack 명령어에 ruby on rails 사용 추가(가장 간단한 프로젝트인 경우)
- 일반 프로젝트에서는 prd, trd, dbd를 다른 task의 input으로 사용한다.
- wf-hierarchy-input.md을 skill로 바꾸면 시간과 토큰을 아낄 수 있다.
- auto 를 skill로 변환하면 프롬프트를 알아서 판별해서 명령어를 수행할 수 있다.
- test 결과에 오류가 있으면 wbs에 표시해서 테스트 결과를 확인할 수 있도록 한다. [결과 없음, 정상, 오류] - 다시 테스트를 수행할 수 있도록 한다.
- verify 단계의 정의를 다시 세우고 필요 없는 단계이면 삭제하자. 그럼 test 명령어로 대체. test 성공하면 vf 단계로 넘어가자.
- 각 명령어가 plan 도구를 사용해서 처리 하도록 프롬프트 수정하자.
- 실행가능한 Task  찾는 프로그램 next-task(아래 참조)
- 현재는 task ID로만 작업할 task를 찾는데 멀티 프로젝트 관리가 되면 task ID로 찾는 것이 아니라 프로젝트명+task ID로 찾는다. 고로 프롬프트 수정해야 한다.
- Task 찾는 공통 프롬프트가 있는데 이것도 따로 프로그램으로 빼자 next-task 처럼, 최대한 프로그램으로 많이 빼놔야 토큰도 적게 먹고 빠르고 재사용도 가능하다. 그리고 또 뭐가 있는지 열심히 찾아보자.
- 진행 상태에서 구현 버튼 위에 상태 변경 버튼이 있으면 좋겠음
- WP, ACT 단위로 담당자 지정/변경 가능해야 함
- wbs task 단위는 독립 테스트가 가능한 단위나 화면단위로 나눠야함


## 참고 사항
- continuous-claude : 생각이 나랑 같네. 알아서 순서대로 명령어를 계속 수행
- **명령행 실행방법** : claude --model opus --dangerously-skip-permissions -p "/wf:draft TSK-01-01-03
- **명령어 저장 없이 수행** : @.claude/commands/wf/review.md 명령어를 읽어서 절차 대로 `ACT-01-01`을 수행해. 현재 LLM은 gemini-2.5를 사용중이야.
- context에서 mcp를 내려버리는 방법 (MCP 검색 도구를 사용해서 컨텍스트에는 없지만 똑똑하게 알아서 사용.)
   - export ENABLE_EXPERIMENTAL_MCP_CLI=true # MAC, LINU
   - $env:ENABLE_EXPERIMENTAL_MCP_CLI="true" # WINDOWS powershell
   - set ENABLE_EXPERIMENTAL_MCP_CLI=true # WINDOWS command shell
   - claude code 내부 명령어 : mcp-cli -V 명령어 실행해줘.



## 전체 프로세스
- prd 문서를 작성한다. 대략적 화면 설계를 한다. (기능 스펙 정의, 화면 정의)
- Google AI Studio에서 react로 화면 설계를 뽑는다.
- trd 문서를 작성한다.(기술 스택 정의, 환경 설정)
- 로컬에서 prd 문서, 화면 리스트를 바탕으로 wbs 문서를 작성한다.
- wbs, prd, trd를 바탕으로 각 태스크의 기본 설계 후 기본 설계 승인
- 기본 설계 승인 후 상세설계 수행 및 상세설계 승인
- 이 후 자동 개발을 통해 전체 프로젝트를 완성한다. 각 Task 종료 시 테스트(e2e 포함)가 모두 통과하게 한다.
- 중간 중간 개발 화면을 확인하여 프로젝트의 진행 방향 검증









Script

# 기본 - JSON 출력 (자동 프로젝트)
npx tsx .orchay/script/next-task.ts

# 프로젝트 지정
npx tsx .orchay/script/next-task.ts -p myproject

# 카테고리 필터
npx tsx .orchay/script/next-task.ts -c development

# 표 형식 출력 (사람이 보기용)
npx tsx .orchay/script/next-task.ts --table

API

# 전체 조회
GET /api/wbs/executable-tasks?projectId=orchay

# 카테고리 필터
GET /api/wbs/executable-tasks?projectId=orchay&category=development

wf/run.md 프롬프트에서 사용



> 그럼 한번에 하나씩만 실행가능한거야? 

● 네, Claude CLI는 history.jsonl.lock 파일로 인해 동시에 하나만 실행 가능합니다.

  현재 제약:
  - 웹 UI에서 여러 Task의 버튼을 동시에 클릭하면 충돌
  - 터미널에서 Claude 실행 중에 웹 UI에서 실행하면 충돌

  해결 방안:

  1. UI에서 실행 중 다른 버튼 비활성화 (현재 구현됨 - Task별로만)
  2. 전역 실행 상태 관리 - 모든 Task에서 Claude 실행 중이면 버튼 비활성화

  전역 실행 상태를 추가하시겠습니까? 그러면 어떤 Task에서든 Claude가 실행 중이면 모든 Claude 관련 버튼이 비활성화됩니 다.