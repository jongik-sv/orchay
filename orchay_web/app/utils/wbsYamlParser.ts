/**
 * WBS YAML 파서 (클라이언트용)
 * Tauri 환경에서 wbs.yaml을 WbsNode[]로 변환
 *
 * 서버 파서(server/utils/wbs/yamlParser)와 동일한 결과 반환
 */

import { parse as parseYaml } from 'yaml'
import type { WbsNode, ScheduleRange, TaskCategory, Priority } from '~/types'

// ============================================================
// YAML 스키마 타입 정의 (서버 _types.ts와 동일)
// ============================================================

interface YamlWbsRoot {
  project: YamlProject
  wbs: YamlWbsConfig
  workPackages: YamlWorkPackage[]
}

interface YamlProject {
  id: string
  name: string
  description?: string
  version?: string
  status?: 'active' | 'archived' | 'completed'
  createdAt?: string
  updatedAt?: string
  scheduledStart?: string
  scheduledEnd?: string
}

interface YamlWbsConfig {
  version: string
  depth: 3 | 4
  projectRoot?: string
  strategy?: string
}

interface YamlWorkPackage {
  id: string
  title: string
  status?: string
  priority?: string
  schedule?: string
  progress?: string
  activities?: YamlActivity[]
  tasks?: YamlTask[]
}

interface YamlActivity {
  id: string
  title: string
  schedule?: string
  progress?: string
  tasks: YamlTask[]
}

interface YamlRequirements {
  prdRef?: string
  items?: string[]
  acceptance?: string[]
  techSpec?: string[]
  dataModel?: string[]
  apiSpec?: string[]
  uiSpec?: string[]
}

interface YamlTask {
  id: string
  title: string
  category?: string
  domain?: string
  status?: string
  priority?: string
  assignee?: string
  schedule?: string
  tags?: string[]
  depends?: string[]
  blockedBy?: string | null
  blocked_by?: string | null  // snake_case 지원
  testResult?: string | null
  test_result?: string | null  // snake_case 지원
  note?: string | null
  requirements?: YamlRequirements
  completed?: Record<string, string>
  execution?: string | { command?: string; startedAt?: string; started_at?: string }
  workflow?: string
}

// ============================================================
// 변환 유틸 함수 (서버 _converter.ts와 동일)
// ============================================================

/**
 * 일정 문자열 파싱
 * - 범위 형식: "YYYY-MM-DD ~ YYYY-MM-DD"
 * - 단일 날짜: "YYYY-MM-DD"
 */
function parseScheduleString(schedule: string | undefined): ScheduleRange | undefined {
  if (!schedule) return undefined

  // 문자열로 변환 (숫자나 다른 타입일 수 있음)
  const scheduleStr = String(schedule).trim()

  // 범위 형식: "YYYY-MM-DD ~ YYYY-MM-DD"
  const rangeMatch = scheduleStr.match(/^(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})$/)
  if (rangeMatch) {
    return {
      start: rangeMatch[1],
      end: rangeMatch[2],
    }
  }

  // 단일 날짜 형식: "YYYY-MM-DD"
  const singleMatch = scheduleStr.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (singleMatch) {
    return {
      start: singleMatch[1],
      end: singleMatch[1],
    }
  }

  return undefined
}

/**
 * 상태 문자열 정규화 ("[xx]" 형식 유지)
 */
function normalizeStatus(status: string | undefined): string | undefined {
  if (!status) return undefined

  if (/^\[[^\]]+\]$/.test(status)) {
    return status
  }

  const match = status.match(/\[([^\]]+)\]/)
  if (match) {
    return `[${match[1]}]`
  }

  return status
}

/**
 * 카테고리 문자열 검증
 */
function parseCategory(category: string | undefined): TaskCategory | undefined {
  if (!category) return undefined

  const validCategories: TaskCategory[] = ['development', 'defect', 'infrastructure']
  if (validCategories.includes(category as TaskCategory)) {
    return category as TaskCategory
  }

  return undefined
}

/**
 * 우선순위 문자열 검증
 */
function parsePriority(priority: string | undefined): Priority | undefined {
  if (!priority) return undefined

  const validPriorities: Priority[] = ['critical', 'high', 'medium', 'low']
  if (validPriorities.includes(priority as Priority)) {
    return priority as Priority
  }

  return undefined
}

/**
 * 진행률 문자열 파싱 ("100%" → 100)
 */
function parseProgress(progress: string | undefined): number | undefined {
  if (!progress) return undefined

  const match = progress.match(/^(\d+)%?$/)
  if (match) {
    return parseInt(match[1], 10)
  }

  return undefined
}

/**
 * YamlRequirements → 마크다운 문자열 변환
 */
function convertRequirementsToMarkdown(req: YamlRequirements | undefined): string | undefined {
  if (!req) return undefined

  const sections: string[] = []

  if (req.prdRef) {
    sections.push(`## 참조\n${req.prdRef}`)
  }

  if (req.items && req.items.length > 0) {
    sections.push(`## 요구사항\n${req.items.map(item => `- ${item}`).join('\n')}`)
  }

  if (req.acceptance && req.acceptance.length > 0) {
    sections.push(`## 인수 조건\n${req.acceptance.map(item => `- ${item}`).join('\n')}`)
  }

  if (req.techSpec && req.techSpec.length > 0) {
    sections.push(`## 기술 스펙\n${req.techSpec.map(item => `- ${item}`).join('\n')}`)
  }

  if (req.dataModel && req.dataModel.length > 0) {
    sections.push(`## 데이터 모델\n${req.dataModel.map(item => `- ${item}`).join('\n')}`)
  }

  if (req.apiSpec && req.apiSpec.length > 0) {
    sections.push(`## API 스펙\n${req.apiSpec.map(item => `- ${item}`).join('\n')}`)
  }

  if (req.uiSpec && req.uiSpec.length > 0) {
    sections.push(`## UI 스펙\n${req.uiSpec.map(item => `- ${item}`).join('\n')}`)
  }

  return sections.length > 0 ? sections.join('\n\n') : undefined
}

// ============================================================
// 노드 변환 함수
// ============================================================

/**
 * YamlTask → WbsNode 변환
 */
function convertTask(task: YamlTask): WbsNode {
  const node: WbsNode = {
    id: task.id,
    type: 'task',
    title: task.title,
    status: normalizeStatus(task.status),
    category: parseCategory(task.category),
    priority: parsePriority(task.priority),
    assignee: task.assignee === '-' ? undefined : task.assignee,
    schedule: parseScheduleString(task.schedule),
    tags: task.tags,
    depends: task.depends,
    requirements: task.requirements?.items,
    children: [],
    completed: task.completed,
    rawContent: convertRequirementsToMarkdown(task.requirements),
  }

  // execution 필드 처리 (스피너 표시용)
  // "design" 또는 { command: "design" } 형태 모두 지원
  if (task.execution) {
    if (typeof task.execution === 'string') {
      node.execution = task.execution
    } else if (task.execution.command) {
      node.execution = task.execution.command
    }
  }

  // 커스텀 속성 처리
  const attributes: Record<string, string> = {}

  // snake_case와 camelCase 모두 지원
  const testResult = task.testResult || task.test_result
  if (testResult) {
    attributes['test-result'] = testResult
  }
  if (task.workflow) {
    attributes['workflow'] = task.workflow
  }
  if (task.domain) {
    attributes['domain'] = task.domain
  }
  if (task.requirements?.prdRef) {
    node.ref = task.requirements.prdRef
  }

  if (Object.keys(attributes).length > 0) {
    node.attributes = attributes
  }

  return node
}

/**
 * YamlActivity → WbsNode 변환 (4-level)
 */
function convertActivity(activity: YamlActivity): WbsNode {
  return {
    id: activity.id,
    type: 'act',
    title: activity.title,
    schedule: parseScheduleString(activity.schedule),
    progress: parseProgress(activity.progress),
    children: activity.tasks.map(convertTask),
  }
}

/**
 * YamlWorkPackage → WbsNode 변환
 */
function convertWorkPackage(wp: YamlWorkPackage): WbsNode {
  const children: WbsNode[] = []

  // 4-level: activities가 있는 경우
  if (wp.activities && wp.activities.length > 0) {
    children.push(...wp.activities.map(convertActivity))
  }

  // 3-level: tasks가 직접 있는 경우 (ACT 없음)
  if (wp.tasks && wp.tasks.length > 0) {
    children.push(...wp.tasks.map(convertTask))
  }

  return {
    id: wp.id,
    type: 'wp',
    title: wp.title,
    priority: parsePriority(wp.priority),
    schedule: parseScheduleString(wp.schedule),
    progress: parseProgress(wp.progress),
    children,
  }
}

/**
 * workPackages 배열 → WbsNode[] 트리 변환
 */
function convertWorkPackages(workPackages: YamlWorkPackage[]): WbsNode[] {
  return workPackages.map(convertWorkPackage)
}

// ============================================================
// 진행률 계산 (서버 index.ts와 동일)
// ============================================================

/**
 * 상태 코드에서 진행률 계산
 */
function getProgressFromStatus(status: string | undefined): number {
  if (!status) return 0

  const statusMap: Record<string, number> = {
    '[ ]': 0,
    '[bd]': 20,
    '[dd]': 40,
    '[an]': 40,
    '[ds]': 40,
    '[ap]': 50,
    '[im]': 60,
    '[fx]': 70,
    '[vf]': 80,
    '[xx]': 100,
  }

  return statusMap[status] ?? 0
}

/**
 * 진행률 자동 계산 (재귀)
 * Task는 상태에서 계산, WP/ACT는 자식 평균
 */
function calculateProgress(nodes: WbsNode[]): void {
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      // 자식 먼저 계산
      calculateProgress(node.children)

      // 자식 Task들의 평균 진행률
      let totalProgress = 0
      let taskCount = 0

      const countTasks = (children: WbsNode[]) => {
        for (const child of children) {
          if (child.type === 'task') {
            totalProgress += child.progress ?? 0
            taskCount++
          } else if (child.children && child.children.length > 0) {
            countTasks(child.children)
          }
        }
      }

      countTasks(node.children)

      if (taskCount > 0) {
        node.progress = Math.round(totalProgress / taskCount)
        node.taskCount = taskCount
      }
    } else if (node.type === 'task') {
      // Task 노드: 상태에서 진행률 계산
      node.progress = node.progress ?? getProgressFromStatus(node.status)
      node.taskCount = 1
    }
  }
}

// ============================================================
// 메인 파서 함수
// ============================================================

/**
 * YAML 문자열을 WbsNode[] 트리로 파싱
 *
 * @param yamlContent - wbs.yaml 파일 내용
 * @returns WbsNode[] 트리
 */
export function parseWbsYaml(yamlContent: string): WbsNode[] {
  // YAML 파싱
  const root = parseYaml(yamlContent) as YamlWbsRoot

  // workPackages → WbsNode[] 변환
  const tree = convertWorkPackages(root.workPackages ?? [])

  // 진행률 자동 계산
  calculateProgress(tree)

  return tree
}
