/**
 * WBS 파서 동일성 테스트
 * 서버 파서와 클라이언트 파서의 결과 비교
 *
 * 원칙: "정확하게 동일하게 구현"
 */

import { describe, it, expect } from 'vitest'

// 서버 파서 (상대 경로 사용)
import { parseWbsMarkdown as parseWbsServer } from '../../../server/utils/wbs/parser'

// 클라이언트 파서 (Tauri용)
import { parseWbsMarkdown as parseWbsClient } from '../../../app/utils/wbsParser'

/**
 * 테스트용 WBS 마크다운 샘플
 */
const SAMPLE_WBS = `---
title: Test Project
---

## WP-01: Work Package 1

### TSK-01-01: Task with all fields
- category: development
- status: done [xx]
- priority: critical
- assignee: john
- schedule: 2025-12-01 ~ 2025-12-31
- tags: parser, test, wbs
- depends: TSK-00-01
- ref: docs/design.md
- requirements:
  - Requirement 1
  - Requirement 2
  - Requirement 3

### TSK-01-02: Infrastructure task
- category: infrastructure
- status: design [ds]
- priority: high
- schedule: 2025-12-15 ~ 2025-12-20

### TSK-01-03: Simple task
- category: development
- status: todo [ ]
`

describe('Parser Parity Tests', () => {
  describe('parseWbsMarkdown', () => {
    it('should parse the same number of nodes', () => {
      const serverResult = parseWbsServer(SAMPLE_WBS)

      // 기대값: 1 WP + 3 Task = 4 nodes (WP의 children에 Task 포함)
      expect(serverResult).toHaveLength(1)  // WP-01
      expect(serverResult[0].children).toHaveLength(3)  // 3 Tasks
    })

    it('should parse node IDs correctly', () => {
      const serverResult = parseWbsServer(SAMPLE_WBS)

      expect(serverResult[0].id).toBe('WP-01')
      expect(serverResult[0].children![0].id).toBe('TSK-01-01')
      expect(serverResult[0].children![1].id).toBe('TSK-01-02')
      expect(serverResult[0].children![2].id).toBe('TSK-01-03')
    })

    it('should parse category correctly', () => {
      const serverResult = parseWbsServer(SAMPLE_WBS)

      expect(serverResult[0].children![0].category).toBe('development')
      expect(serverResult[0].children![1].category).toBe('infrastructure')
      expect(serverResult[0].children![2].category).toBe('development')
    })

    it('should parse status correctly', () => {
      const serverResult = parseWbsServer(SAMPLE_WBS)

      expect(serverResult[0].children![0].status).toBe('[xx]')
      expect(serverResult[0].children![1].status).toBe('[ds]')
      expect(serverResult[0].children![2].status).toBe('[ ]')
    })

    it('should parse priority correctly', () => {
      const serverResult = parseWbsServer(SAMPLE_WBS)

      expect(serverResult[0].children![0].priority).toBe('critical')
      expect(serverResult[0].children![1].priority).toBe('high')
      expect(serverResult[0].children![2].priority).toBeUndefined()
    })

    it('should parse assignee correctly', () => {
      const serverResult = parseWbsServer(SAMPLE_WBS)

      expect(serverResult[0].children![0].assignee).toBe('john')
      expect(serverResult[0].children![1].assignee).toBeUndefined()
    })

    it('should parse schedule correctly', () => {
      const serverResult = parseWbsServer(SAMPLE_WBS)

      expect(serverResult[0].children![0].schedule).toEqual({
        start: '2025-12-01',
        end: '2025-12-31'
      })
      expect(serverResult[0].children![1].schedule).toEqual({
        start: '2025-12-15',
        end: '2025-12-20'
      })
    })

    it('should parse tags correctly', () => {
      const serverResult = parseWbsServer(SAMPLE_WBS)

      expect(serverResult[0].children![0].tags).toEqual(['parser', 'test', 'wbs'])
    })

    it('should parse depends correctly', () => {
      const serverResult = parseWbsServer(SAMPLE_WBS)

      // 서버는 배열로 반환
      expect(serverResult[0].children![0].depends).toEqual(['TSK-00-01'])
    })

    it('should parse requirements correctly', () => {
      const serverResult = parseWbsServer(SAMPLE_WBS)

      expect(serverResult[0].children![0].requirements).toEqual([
        'Requirement 1',
        'Requirement 2',
        'Requirement 3'
      ])
    })

    it('should parse ref correctly', () => {
      const serverResult = parseWbsServer(SAMPLE_WBS)

      expect(serverResult[0].children![0].ref).toBe('docs/design.md')
    })

    it('should have rawContent', () => {
      const serverResult = parseWbsServer(SAMPLE_WBS)

      const rawContent = serverResult[0].children![0].rawContent
      expect(rawContent).toBeDefined()
      expect(rawContent).toContain('category: development')
      expect(rawContent).toContain('status: done [xx]')
      expect(rawContent).toContain('priority: critical')
    })
  })
})

/**
 * 클라이언트 파서와 서버 파서 비교 테스트
 * 원칙: "정확하게 동일하게 구현"
 */
describe('Client-Server Parser Parity', () => {
  it('should parse the same number of nodes', () => {
    const serverResult = parseWbsServer(SAMPLE_WBS)
    const clientResult = parseWbsClient(SAMPLE_WBS)

    expect(clientResult).toHaveLength(serverResult.length)
    expect(clientResult[0].children).toHaveLength(serverResult[0].children!.length)
  })

  it('should parse node IDs identically', () => {
    const serverResult = parseWbsServer(SAMPLE_WBS)
    const clientResult = parseWbsClient(SAMPLE_WBS)

    expect(clientResult[0].id).toBe(serverResult[0].id)
    expect(clientResult[0].children![0].id).toBe(serverResult[0].children![0].id)
    expect(clientResult[0].children![1].id).toBe(serverResult[0].children![1].id)
    expect(clientResult[0].children![2].id).toBe(serverResult[0].children![2].id)
  })

  it('should parse category identically', () => {
    const serverResult = parseWbsServer(SAMPLE_WBS)
    const clientResult = parseWbsClient(SAMPLE_WBS)

    expect(clientResult[0].children![0].category).toBe(serverResult[0].children![0].category)
    expect(clientResult[0].children![1].category).toBe(serverResult[0].children![1].category)
    expect(clientResult[0].children![2].category).toBe(serverResult[0].children![2].category)
  })

  it('should parse status identically', () => {
    const serverResult = parseWbsServer(SAMPLE_WBS)
    const clientResult = parseWbsClient(SAMPLE_WBS)

    expect(clientResult[0].children![0].status).toBe(serverResult[0].children![0].status)
    expect(clientResult[0].children![1].status).toBe(serverResult[0].children![1].status)
    expect(clientResult[0].children![2].status).toBe(serverResult[0].children![2].status)
  })

  it('should parse priority identically', () => {
    const serverResult = parseWbsServer(SAMPLE_WBS)
    const clientResult = parseWbsClient(SAMPLE_WBS)

    expect(clientResult[0].children![0].priority).toBe(serverResult[0].children![0].priority)
    expect(clientResult[0].children![1].priority).toBe(serverResult[0].children![1].priority)
    expect(clientResult[0].children![2].priority).toBe(serverResult[0].children![2].priority)
  })

  it('should parse assignee identically', () => {
    const serverResult = parseWbsServer(SAMPLE_WBS)
    const clientResult = parseWbsClient(SAMPLE_WBS)

    expect(clientResult[0].children![0].assignee).toBe(serverResult[0].children![0].assignee)
  })

  it('should parse schedule identically', () => {
    const serverResult = parseWbsServer(SAMPLE_WBS)
    const clientResult = parseWbsClient(SAMPLE_WBS)

    expect(clientResult[0].children![0].schedule).toEqual(serverResult[0].children![0].schedule)
    expect(clientResult[0].children![1].schedule).toEqual(serverResult[0].children![1].schedule)
  })

  it('should parse tags identically', () => {
    const serverResult = parseWbsServer(SAMPLE_WBS)
    const clientResult = parseWbsClient(SAMPLE_WBS)

    expect(clientResult[0].children![0].tags).toEqual(serverResult[0].children![0].tags)
  })

  it('should parse depends identically', () => {
    const serverResult = parseWbsServer(SAMPLE_WBS)
    const clientResult = parseWbsClient(SAMPLE_WBS)

    expect(clientResult[0].children![0].depends).toEqual(serverResult[0].children![0].depends)
  })

  it('should parse requirements identically', () => {
    const serverResult = parseWbsServer(SAMPLE_WBS)
    const clientResult = parseWbsClient(SAMPLE_WBS)

    expect(clientResult[0].children![0].requirements).toEqual(serverResult[0].children![0].requirements)
  })

  it('should parse ref identically', () => {
    const serverResult = parseWbsServer(SAMPLE_WBS)
    const clientResult = parseWbsClient(SAMPLE_WBS)

    expect(clientResult[0].children![0].ref).toBe(serverResult[0].children![0].ref)
  })

  it('should have rawContent with same content (not necessarily identical)', () => {
    const serverResult = parseWbsServer(SAMPLE_WBS)
    const clientResult = parseWbsClient(SAMPLE_WBS)

    const serverRaw = serverResult[0].children![0].rawContent || ''
    const clientRaw = clientResult[0].children![0].rawContent || ''

    // rawContent에 동일한 핵심 정보 포함 확인
    expect(clientRaw).toContain('category: development')
    expect(clientRaw).toContain('priority: critical')
    expect(serverRaw).toContain('category: development')
    expect(serverRaw).toContain('priority: critical')
  })
})
