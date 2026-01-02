# WBS YAML 마이그레이션 가이드

> wbs.md + project.json → wbs.yaml 통합 마이그레이션

## 개요

기존 마크다운 기반 WBS 관리를 YAML 형식으로 전환합니다.

### 마이그레이션 이유

1. **파싱 안정성**: 마크다운 정규식 파싱의 형식 민감성 제거
2. **통합 관리**: project.json + wbs.md → 단일 wbs.yaml
3. **구조화된 요구사항**: requirements 블록으로 그룹핑
4. **스키마 검증**: YAML 스키마로 유효성 검증 가능

---

## 스키마 비교

### 기존 (wbs.md)
```markdown
# WBS - 프로젝트명

> version: 1.0
> depth: 3

## WP-01: Work Package
- status: planned
- priority: high

### TSK-01-01: Task 제목
- category: development
- status: [ ]
- priority: high

##### PRD 요구사항
- prd-ref: FR-001
- requirements:
  - 요구사항 1
  - 요구사항 2
- acceptance:
  - 인수조건 1

##### 기술 스펙 (TRD)
- tech-spec:
  - 기술 스펙 1
```

### 신규 (wbs.yaml)
```yaml
project:
  id: my-project
  name: "프로젝트명"
  version: "1.0"

wbs:
  version: "1.0"
  depth: 3

workPackages:
  - id: WP-01
    title: "Work Package"
    status: planned
    priority: high
    tasks:
      - id: TSK-01-01
        title: "Task 제목"
        category: development
        status: "[ ]"
        priority: high
        requirements:
          prdRef: "FR-001"
          items:
            - "요구사항 1"
            - "요구사항 2"
          acceptance:
            - "인수조건 1"
          techSpec:
            - "기술 스펙 1"
```

---

## 주요 변경사항

### 1. 프로젝트 메타데이터 통합

**기존**: `project.json` 별도 파일
```json
{
  "id": "orchay",
  "name": "orchay - WezTerm Task Scheduler",
  "version": "0.1.0",
  "status": "active"
}
```

**신규**: `wbs.yaml` 내 `project:` 섹션
```yaml
project:
  id: orchay
  name: "orchay - WezTerm Task Scheduler"
  version: "0.1.0"
  status: active
```

### 2. 상태 코드 표기 (workflows.json 기반)

| 상태 코드 | YAML 표기 | 의미 |
|-----------|-----------|------|
| `[ ]` | `"[ ]"` | 시작 전 (Todo) |
| `[dd]` | `"[dd]"` | 상세설계 (Detail Design) |
| `[ap]` | `"[ap]"` | 승인 (Approve) |
| `[im]` | `"[im]"` | 구현 (Implement) |
| `[vf]` | `"[vf]"` | 검증 (Verify) |
| `[xx]` | `"[xx]"` | 완료 (Done) |

> **참고**: YAML에서 대괄호는 배열 구문이므로 따옴표로 감싸야 합니다.
> **워크플로우**: `[ ]` → `[dd]` → `[ap]` → `[im]` → `[vf]` → `[xx]`

### 3. 요구사항 구조

**기존**: 섹션 기반 (##### PRD 요구사항)
```markdown
##### PRD 요구사항
- prd-ref: FR-001
- requirements:
  - 요구사항 1
- acceptance:
  - 인수조건 1

##### 기술 스펙 (TRD)
- tech-spec:
  - 기술 스펙 1
```

**신규**: requirements 블록으로 그룹핑
```yaml
requirements:
  prdRef: "FR-001"
  items:
    - "요구사항 1"
  acceptance:
    - "인수조건 1"
  techSpec:
    - "기술 스펙 1"
  apiSpec: []
  dataModel: []
  uiSpec: []
```

### 4. 완료 타임스탬프

**기존**: 별도 속성으로 분산
```markdown
- completed:
  - ds: 2025-12-15 22:13
  - im: 2025-12-15 22:13
```

**신규**: completed 블록 (상태 전이 기록)
```yaml
completed:
  dd: "2025-12-15T22:13:00"   # 상세설계 완료
  ap: "2025-12-15T22:30:00"   # 승인 완료
  im: "2025-12-15T23:00:00"   # 구현 완료
  vf: "2025-12-15T23:30:00"   # 검증 완료
  xx: "2025-12-15T23:45:00"   # 최종 완료
```

### 5. 계층 구조 (depth)

**3단계 (WP → TSK)**:
```yaml
workPackages:
  - id: WP-01
    tasks:
      - id: TSK-01-01
```

**4단계 (WP → ACT → TSK)**:
```yaml
workPackages:
  - id: WP-01
    activities:
      - id: ACT-01-01
        tasks:
          - id: TSK-01-01-01
```

---

## 마이그레이션 절차

### 수동 마이그레이션

1. **wbs.yaml 생성**
   ```bash
   # 새 파일 생성
   touch .orchay/projects/{project}/wbs.yaml
   ```

2. **project.json 내용 복사**
   ```yaml
   project:
     id: {project.id}
     name: "{project.name}"
     description: "{project.description}"
     version: "{project.version}"
     status: {project.status}
     createdAt: "{project.createdAt}"
     updatedAt: "{project.updatedAt}"
   ```

3. **wbs.md 메타데이터 변환**
   ```yaml
   wbs:
     version: "1.0"
     depth: 3
     projectRoot: {project-root}
   ```

4. **Work Package 변환**
   - `## WP-XX:` → `- id: WP-XX`
   - 속성들을 YAML 형식으로

5. **Task 변환**
   - `### TSK-XX-XX:` → `- id: TSK-XX-XX`
   - `status: [ ]` → `status: "[ ]"` (따옴표 필수)
   - `status: [xx]` → `status: "[xx]"` (따옴표 필수)
   - 요구사항 섹션을 requirements 블록으로 통합

6. **백업 및 정리**
   ```bash
   mv wbs.md wbs.md.bak
   mv project.json project.json.bak
   ```

### 자동 마이그레이션 (향후 구현)

```bash
# Python 스크립트 실행
python -m orchay.utils.migrate_wbs .orchay/projects/{project}/

# 결과
# - wbs.yaml 생성
# - wbs.md.bak 백업
# - project.json.bak 백업
```

---

## 파서 수정 계획

### 현재 파서 (wbs_parser.py)

- 마크다운 정규식 기반
- `TASK_HEADER_PATTERN = re.compile(r"^###\s+(TSK-\d+-\d+(?:-\d+)?):\s*(.+)$")`
- 형식 민감, 파싱 오류 빈발

### 신규 파서 (wbs_yaml_parser.py)

```python
import yaml
from pathlib import Path
from orchay.models import Task, TaskStatus

def parse_wbs_yaml(path: Path) -> list[Task]:
    """YAML WBS 파일 파싱"""
    with path.open('r', encoding='utf-8') as f:
        doc = yaml.safe_load(f)

    tasks = []
    depth = doc.get('wbs', {}).get('depth', 3)

    for wp in doc.get('workPackages', []):
        if depth == 4:
            for act in wp.get('activities', []):
                for task in act.get('tasks', []):
                    tasks.append(_create_task(task))
        else:
            for task in wp.get('tasks', []):
                tasks.append(_create_task(task))

    return tasks

def _create_task(data: dict) -> Task:
    """딕셔너리에서 Task 객체 생성"""
    req = data.get('requirements', {})
    return Task(
        id=data['id'],
        title=data['title'],
        category=_parse_category(data.get('category', 'development')),
        status=_parse_status(data.get('status', '[ ]')),  # "[ ]", "[dd]", "[ap]", "[im]", "[vf]", "[xx]"
        priority=_parse_priority(data.get('priority', 'medium')),
        # ...
        prd_ref=req.get('prdRef', ''),
        requirements=req.get('items', []),
        acceptance=req.get('acceptance', []),
        tech_spec=req.get('techSpec', []),
        # ...
    )
```

### 확장자 분기

```python
async def parse_wbs(path: Path) -> list[Task]:
    """확장자에 따라 적절한 파서 선택"""
    if path.suffix in ('.yaml', '.yml'):
        return await parse_wbs_yaml(path)
    else:
        return await parse_wbs_md(path)
```

---

## Task 모델 확장

### 추가 필드

```python
class Task(BaseModel):
    # 기존 필드...

    # 신규 필드
    completed: dict[str, str] = Field(
        default_factory=dict,
        description="상태 전이 완료 타임스탬프"
    )
    test_result: str | None = Field(
        default=None,
        description="테스트 결과 (none, pass, fail)"
    )
    data_model: list[str] = Field(
        default_factory=list,
        description="데이터 모델 스펙"
    )
```

---

## 마이그레이션 완료 프로젝트

| 프로젝트 | 경로 | depth | 상태 |
|----------|------|-------|------|
| orchay | `.orchay/projects/orchay/wbs.yaml` | 3 | ✅ 완료 |
| orchay_web | `.orchay/projects/orchay_web/wbs.yaml` | 4 | ✅ 완료 |
| deployment | `.orchay/projects/deployment/wbs.yaml` | 3 | ✅ 완료 |
| table-order/mvp | `/home/jji/project/table-order/.orchay/projects/mvp/wbs.yaml` | 3 | ✅ 완료 |

---

## 검증 체크리스트

- [ ] wbs.yaml 파일 문법 검증 (YAML lint)
- [ ] 모든 Task ID 고유성 확인
- [ ] 의존성 참조 유효성 확인
- [ ] 상태 코드 유효성 확인
- [ ] 필수 필드 존재 확인 (id, title, category, status)

---

## 롤백 방법

문제 발생 시 백업 파일로 복구:

```bash
cd .orchay/projects/{project}/
mv wbs.yaml wbs.yaml.failed
mv wbs.md.bak wbs.md
mv project.json.bak project.json
```

---

## 향후 계획

1. **YAML 파서 구현**: `orchay/src/orchay/wbs_yaml_parser.py`
2. **마이그레이션 CLI**: `orchay migrate <project>`
3. **스키마 검증**: JSON Schema 기반 유효성 검사
4. **orchay_web 연동**: YAML 파일 읽기/쓰기 지원

---

## 참조

- [plan:wbs-yaml 명령어](/.claude/commands/plan/wbs-yaml.md)
- [WBS 스키마 정의](/home/jji/.claude/plans/peppy-moseying-starfish.md)
