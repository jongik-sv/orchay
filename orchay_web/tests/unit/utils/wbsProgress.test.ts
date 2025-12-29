import { describe, it, expect } from 'vitest'
import { calculateProgressStats, getStatusSeverity } from '~/utils/wbsProgress'
import type { WbsNode } from '~/types'

describe('calculateProgressStats', () => {
  describe('빈 노드 처리', () => {
    it('빈 WP 노드는 total=0 반환', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Empty WP',
        children: []
      }

      const stats = calculateProgressStats(node)

      expect(stats.total).toBe(0)
      expect(stats.completed).toBe(0)
      expect(stats.inProgress).toBe(0)
      expect(stats.todo).toBe(0)
      expect(Object.keys(stats.byStatus).length).toBe(0)
    })
  })

  describe('단일 레벨 구조', () => {
    it('완료된 Task만 있는 WP는 completed=total', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Completed WP',
        children: [
          { id: 'TSK-01', type: 'task', title: 'T1', status: '[xx]', children: [] },
          { id: 'TSK-02', type: 'task', title: 'T2', status: '[xx]', children: [] }
        ]
      }

      const stats = calculateProgressStats(node)

      expect(stats.total).toBe(2)
      expect(stats.completed).toBe(2)
      expect(stats.inProgress).toBe(0)
      expect(stats.todo).toBe(0)
      expect(stats.byStatus['[xx]']).toBe(2)
    })

    it('다양한 상태의 Task가 있는 WP는 정확한 카운트', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Mixed WP',
        children: [
          {
            id: 'ACT-01-01',
            type: 'act',
            title: 'Act 1',
            children: [
              { id: 'TSK-01', type: 'task', title: 'T1', status: '[ ]', children: [] },
              { id: 'TSK-02', type: 'task', title: 'T2', status: '[bd]', children: [] },
              { id: 'TSK-03', type: 'task', title: 'T3', status: '[xx]', children: [] }
            ]
          },
          { id: 'TSK-04', type: 'task', title: 'T4', status: '[im]', children: [] }
        ]
      }

      const stats = calculateProgressStats(node)

      expect(stats.total).toBe(4)
      expect(stats.todo).toBe(1)           // [ ]
      expect(stats.inProgress).toBe(2)     // [bd], [im]
      expect(stats.completed).toBe(1)      // [xx]
      expect(stats.byStatus['[ ]']).toBe(1)
      expect(stats.byStatus['[bd]']).toBe(1)
      expect(stats.byStatus['[im]']).toBe(1)
      expect(stats.byStatus['[xx]']).toBe(1)
    })
  })

  describe('중첩 구조', () => {
    it('중첩된 ACT 구조에서 모든 Task 수집', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Nested WP',
        children: [
          {
            id: 'ACT-01-01',
            type: 'act',
            title: 'Act 1',
            children: [
              {
                id: 'ACT-01-01-01',
                type: 'act',
                title: 'Sub Act',
                children: [
                  { id: 'TSK-01', type: 'task', title: 'T1', status: '[xx]', children: [] }
                ]
              }
            ]
          }
        ]
      }

      const stats = calculateProgressStats(node)

      expect(stats.total).toBe(1)
      expect(stats.completed).toBe(1)
    })
  })

  describe('상태별 카운팅', () => {
    it('Defect 및 Infrastructure 카테고리 상태 처리', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Mixed Categories',
        children: [
          { id: 'TSK-01', type: 'task', title: 'T1', status: '[an]', category: 'defect', children: [] },
          { id: 'TSK-02', type: 'task', title: 'T2', status: '[ds]', category: 'infrastructure', children: [] },
          { id: 'TSK-03', type: 'task', title: 'T3', status: '[fx]', category: 'defect', children: [] }
        ]
      }

      const stats = calculateProgressStats(node)

      expect(stats.total).toBe(3)
      expect(stats.inProgress).toBe(3)     // [an], [ds], [fx] 모두 진행 중
      expect(stats.byStatus['[an]']).toBe(1)
      expect(stats.byStatus['[ds]']).toBe(1)
      expect(stats.byStatus['[fx]']).toBe(1)
    })
  })

  describe('엣지 케이스', () => {
    it('status가 undefined인 Task는 [ ]로 처리', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Undefined Status',
        children: [
          { id: 'TSK-01', type: 'task', title: 'T1', children: [] },  // status 없음
          { id: 'TSK-02', type: 'task', title: 'T2', status: '[bd]', children: [] }
        ]
      }

      const stats = calculateProgressStats(node)

      expect(stats.total).toBe(2)
      expect(stats.todo).toBe(1)           // status undefined → '[ ]'
      expect(stats.inProgress).toBe(1)     // [bd]
      expect(stats.byStatus['[ ]']).toBe(1)
    })

    it('null 노드 방어', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Test',
        children: []
      }

      const stats = calculateProgressStats(node)

      expect(stats.total).toBe(0)
    })
  })
})

describe('getStatusSeverity', () => {
  it.each([
    { status: '[ ]', severity: 'secondary' },
    { status: '[bd]', severity: 'info' },
    { status: '[dd]', severity: 'info' },
    { status: '[an]', severity: 'warning' },
    { status: '[ds]', severity: 'info' },
    { status: '[im]', severity: 'warning' },
    { status: '[fx]', severity: 'warning' },
    { status: '[vf]', severity: 'success' },
    { status: '[xx]', severity: 'success' }
  ])('상태 $status는 $severity 반환', ({ status, severity }) => {
    expect(getStatusSeverity(status)).toBe(severity)
  })

  it('알 수 없는 상태는 secondary 반환', () => {
    expect(getStatusSeverity('[unknown]')).toBe('secondary')
  })
})
