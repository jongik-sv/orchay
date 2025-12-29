/**
 * 의존관계 그래프 타입 정의 (Vue Flow 기반)
 * Task: TSK-06-01
 */

import type { Node, Edge } from '@vue-flow/core'

// Vue Flow 노드 데이터
export interface TaskNodeData {
  taskId: string          // Task ID (예: "TSK-06-01")
  title: string           // Task 제목
  status: string          // 상태 코드 (예: "[bd]")
  statusName: string      // 상태 이름 (예: "기본설계")
  category: string        // 카테고리 (development, defect, infrastructure)
  categoryName: string    // 카테고리 이름 (개발, 결함, 인프라)
  assignee?: string       // 담당자
  depends?: string        // 의존 Task 목록
}

// Vue Flow 노드 타입
export type TaskNode = Node<TaskNodeData>

// Vue Flow 그룹 노드 타입 (TSK-06-03)
export type GroupNode = Node<GroupNodeData>

// Vue Flow 엣지 타입
export type TaskEdge = Edge

// 그래프 전체 데이터 (TSK-06-03: GroupNode 포함)
export interface GraphData {
  nodes: (TaskNode | GroupNode)[]
  edges: TaskEdge[]
}

// 필터링 옵션 (TSK-06-03 확장)
export interface GraphFilter {
  categories: string[]                    // 선택된 카테고리
  statuses: string[]                      // 선택된 상태
  hierarchyMode: 'full' | 'wp' | 'act'   // 계층 표시 모드
  focusTask: string | null                // 초점 Task ID
  focusDepth: number                      // 초점 깊이 (1~3)
}

// 그룹 노드 데이터 (TSK-06-03)
export interface GroupNodeData {
  groupId: string          // 그룹 ID (예: "WP-01", "ACT-02")
  groupType: 'wp' | 'act'  // 그룹 타입
  title: string            // 그룹 제목
  taskCount: number        // 포함된 Task 개수
  completedCount: number   // 완료된 Task 개수
  isExpanded: boolean      // 확장/축소 상태
  childTaskIds: string[]   // 포함된 Task ID 목록
}

// 초점 뷰 설정 (TSK-06-03)
export interface FocusViewConfig {
  focusTaskId: string       // 초점 Task ID
  depth: number             // 탐색 깊이 (1~3)
  includesNodes: Set<string> // depth 내 Task ID 집합
}

// 카테고리별 색상 정의
export const GRAPH_COLORS = {
  development: {
    background: '#3b82f6',
    border: '#2563eb',
    text: '#ffffff'
  },
  defect: {
    background: '#ef4444',
    border: '#dc2626',
    text: '#ffffff'
  },
  infrastructure: {
    background: '#22c55e',
    border: '#16a34a',
    text: '#ffffff'
  }
} as const

// 상태별 색상 (완료 상태용)
export const STATUS_COLORS = {
  done: {
    background: '#4b5563',
    border: '#374151',
    text: '#9ca3af'
  }
} as const

// 하이라이트 색상
export const HIGHLIGHT_COLORS = {
  selected: {
    background: '#fbbf24',
    border: '#f59e0b',
    text: '#000000'
  },
  dependsOn: {
    background: '#ef4444',
    border: '#dc2626',
    text: '#ffffff'
  },
  dependedBy: {
    background: '#22c55e',
    border: '#16a34a',
    text: '#ffffff'
  },
  dimmed: {
    background: '#374151',
    border: '#4b5563',
    text: '#6b7280'
  }
} as const
