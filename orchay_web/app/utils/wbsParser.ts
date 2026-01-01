/**
 * WBS 클라이언트 파서
 * Tauri 환경에서 사용하는 WBS 마크다운 파서
 *
 * 원칙: 서버 파서(server/utils/wbs/parser)와 동일한 결과를 반환해야 함
 */

import type { WbsNode } from '~/types/store'

/**
 * WBS 마크다운 파서 (클라이언트용)
 * 형식: ## WP-01: 제목, ### TSK-01-01: 제목, - status: [xx]
 */
export function parseWbsMarkdown(content: string): WbsNode[] {
  // CRLF → LF 정규화 (Windows 줄바꿈 처리)
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalizedContent.split('\n')
  const nodes: WbsNode[] = []
  const stack: { node: WbsNode; level: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 헤딩 파싱: ## WP-01: 제목 또는 ### TSK-01-01: 제목
    const headingMatch = line.match(/^(#{2,4})\s+(WP-\d+|ACT-[\d-]+|TSK-[\d-]+):?\s*(.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const id = headingMatch[2]
      const title = headingMatch[3].trim()

      // 노드 타입 결정
      let type: 'wp' | 'act' | 'task' = 'wp'
      if (id.startsWith('ACT-')) type = 'act'
      else if (id.startsWith('TSK-')) type = 'task'

      // 다음 줄들에서 status, category, priority 등 속성 찾기
      let status = '[ ]'  // 원본 status 코드 저장 (워크플로우 config와 호환)
      let progress = 0
      let category: 'development' | 'defect' | 'infrastructure' = 'development'
      let priority: 'critical' | 'high' | 'medium' | 'low' | undefined
      let assignee: string | undefined
      let scheduleStart: string | undefined
      let scheduleEnd: string | undefined
      let tags: string[] | undefined
      let depends: string[] | undefined  // 서버와 동일하게 배열로 변경
      let ref: string | undefined
      let requirements: string[] = []  // requirements 리스트
      let rawContent: string[] = []  // Task의 원본 내용 저장
      let inRequirements = false  // requirements 멀티라인 파싱 중
      let completed: Record<string, string> | undefined  // 단계별 완료시각 (TSK-03-06)
      let inCompleted = false  // completed 멀티라인 파싱 중

      // 노드 헤더 패턴: WP/ACT/TSK ID가 있는 헤더만 새 노드로 인식 (서버와 동일)
      const NODE_HEADER_PATTERN = /^#{2,4}\s+(WP|ACT|TSK)-[\d-]+:/

      for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
        const nextLine = lines[j]
        // 다음 WP/ACT/TSK 노드가 나오면 중단 (서브헤더는 계속 파싱)
        // 서버와 동일: ID 패턴이 있는 헤더만 새 노드로 인식
        if (nextLine.match(NODE_HEADER_PATTERN)) break

        // rawContent 수집 (모든 속성 라인 - 서버와 동일)
        if (nextLine.trim()) {
          rawContent.push(nextLine)
        }

        // status 속성 찾기: - status: [xx] 또는 - status: done [xx]
        const statusMatch = nextLine.match(/^-\s*status:\s*(?:\w+\s+)?(\[[^\]]*\])/)
        if (statusMatch) {
          status = statusMatch[1]  // '[xx]', '[dd]' 등 원본 저장
          const code = status.replace(/[\[\]]/g, '').trim()
          if (code === 'x' || code === 'xx') { progress = 100 }
          else if (code === 'im') { progress = 60 }
          else if (code === 'vf') { progress = 80 }
          else if (code === 'ap') { progress = 50 }
          else if (code === 'dd') { progress = 40 }
          else if (code === 'bd') { progress = 20 }
          else if (code === 'an') { progress = 30 }
          else if (code === 'fx') { progress = 60 }
          else if (code === 'ds') { progress = 30 }
        }

        // category 속성 찾기: - category: development
        const categoryMatch = nextLine.match(/^-\s*category:\s*(\w+)/)
        if (categoryMatch) {
          const cat = categoryMatch[1].toLowerCase()
          if (cat === 'development' || cat === 'defect' || cat === 'infrastructure') {
            category = cat as 'development' | 'defect' | 'infrastructure'
          }
        }

        // priority 속성 찾기: - priority: critical
        const priorityMatch = nextLine.match(/^-\s*priority:\s*(\w+)/)
        if (priorityMatch) {
          const p = priorityMatch[1].toLowerCase()
          if (p === 'critical' || p === 'high' || p === 'medium' || p === 'low') {
            priority = p as 'critical' | 'high' | 'medium' | 'low'
          }
        }

        // assignee 속성 찾기: - assignee: username
        const assigneeMatch = nextLine.match(/^-\s*assignee:\s*(.+)/)
        if (assigneeMatch) {
          const value = assigneeMatch[1].trim()
          // "-" 값은 undefined로 처리 (서버와 동일)
          assignee = value === '-' ? undefined : value
        }

        // schedule 속성 찾기: - schedule: 2025-12-28 ~ 2025-12-29 또는 - schedule.start/end
        const scheduleRangeMatch = nextLine.match(/^-\s*schedule:\s*(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/)
        if (scheduleRangeMatch) {
          scheduleStart = scheduleRangeMatch[1].trim()
          scheduleEnd = scheduleRangeMatch[2].trim()
        }

        const scheduleStartMatch = nextLine.match(/^-\s*schedule\.start:\s*(.+)/)
        if (scheduleStartMatch) {
          scheduleStart = scheduleStartMatch[1].trim()
        }

        const scheduleEndMatch = nextLine.match(/^-\s*schedule\.end:\s*(.+)/)
        if (scheduleEndMatch) {
          scheduleEnd = scheduleEndMatch[1].trim()
        }

        // tags 속성 찾기: - tags: tag1, tag2
        const tagsMatch = nextLine.match(/^-\s*tags:\s*(.+)/)
        if (tagsMatch) {
          tags = tagsMatch[1].split(',').map(t => t.trim()).filter(t => t)
        }

        // depends 속성 찾기: - depends: TSK-01-01, TSK-01-02
        const dependsMatch = nextLine.match(/^-\s*depends:\s*(.+)/)
        if (dependsMatch) {
          const value = dependsMatch[1].trim()
          // "-" 값은 undefined로 처리, 쉼표로 분리하여 배열로 저장 (서버와 동일)
          if (value === '-') {
            depends = undefined
          } else {
            depends = value.split(',').map(dep => dep.trim()).filter(dep => dep)
          }
        }

        // ref 속성 찾기: - ref: docs/design.md
        const refMatch = nextLine.match(/^-\s*ref:\s*(.+)/)
        if (refMatch) {
          ref = refMatch[1].trim()
        }

        // requirements 멀티라인 파싱: - requirements: 로 시작하면 이후 들여쓰기된 항목 수집
        if (nextLine.match(/^-\s*requirements:\s*$/)) {
          inRequirements = true
          continue
        }

        // requirements 항목 수집 (들여쓰기 + 하이픈으로 시작)
        if (inRequirements) {
          const reqItemMatch = nextLine.match(/^\s+-\s+(.+)/)
          if (reqItemMatch) {
            requirements.push(reqItemMatch[1].trim())
          } else if (nextLine.match(/^-\s/)) {
            // 새로운 최상위 속성이 나오면 requirements 파싱 종료
            inRequirements = false
          }
        }

        // completed 멀티라인 파싱: - completed: 로 시작하면 이후 들여쓰기된 항목 수집 (TSK-03-06)
        if (nextLine.match(/^-\s*completed:\s*$/)) {
          inCompleted = true
          continue
        }

        // completed 항목 수집 (들여쓰기 + 하이픈으로 시작, key: value 형식)
        if (inCompleted) {
          const completedItemMatch = nextLine.match(/^\s+-\s+(\w+):\s*(.+)/)
          if (completedItemMatch) {
            if (!completed) completed = {}
            completed[completedItemMatch[1]] = completedItemMatch[2].trim()
          } else if (nextLine.match(/^-\s/)) {
            // 새로운 최상위 속성이 나오면 completed 파싱 종료
            inCompleted = false
          }
        }
      }

      // WbsNode 생성 (모든 필드 포함)
      const node: WbsNode = {
        id,
        title,
        type,
        status,
        progress,
        category,
        priority,
        assignee,
        schedule: (scheduleStart && scheduleEnd) ? { start: scheduleStart, end: scheduleEnd } : undefined,
        tags,
        depends,
        ref,
        requirements: requirements.length > 0 ? requirements : undefined,
        rawContent: rawContent.length > 0 ? rawContent.join('\n') : undefined,
        completed,  // TSK-03-06: 단계별 완료시각
        children: []
      }

      // 스택에서 부모 찾기
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      if (stack.length > 0) {
        stack[stack.length - 1].node.children!.push(node)
      } else {
        nodes.push(node)
      }

      stack.push({ node, level })
    }
  }

  // WP/ACT 진행률 계산 (서버와 동일)
  calculateProgress(nodes)

  return nodes
}

/**
 * 트리 전체의 progress와 taskCount 계산
 * 서버의 _tree.ts:calculateProgress()와 동일한 로직
 */
function calculateProgress(nodes: WbsNode[]): void {
  for (const node of nodes) {
    updateNodeMetrics(node)
  }
}

/**
 * 노드의 progress와 taskCount를 재귀적으로 계산
 */
function updateNodeMetrics(node: WbsNode): { progress: number; taskCount: number } {
  if (node.type === 'task') {
    // Task 노드: 이미 파싱 시 progress가 계산되어 있음
    return { progress: node.progress || 0, taskCount: 1 }
  }

  // WP 또는 ACT: 자식 노드의 평균 progress 계산
  let totalProgress = 0
  let totalTasks = 0

  for (const child of node.children || []) {
    const childMetrics = updateNodeMetrics(child)
    totalProgress += childMetrics.progress * childMetrics.taskCount
    totalTasks += childMetrics.taskCount
  }

  const avgProgress = totalTasks > 0 ? Math.round(totalProgress / totalTasks) : 0

  node.progress = avgProgress
  // taskCount 필드가 WbsNode 타입에 있으면 설정
  if ('taskCount' in node || node.type === 'wp' || node.type === 'act') {
    (node as WbsNode & { taskCount?: number }).taskCount = totalTasks
  }

  return { progress: avgProgress, taskCount: totalTasks }
}
