/**
 * useGraphFilter Composable 단위 테스트
 * Task: TSK-06-03
 * Test Spec: 026-test-specification.md
 */

import { describe, it, expect } from 'vitest'
import { useGraphFilter } from '~/composables/useGraphFilter'
import type { GraphFilter } from '~/types/graph'

describe('useGraphFilter', () => {
  const { encodeFilterToURL, parseURLParams } = useGraphFilter()

  describe('encodeFilterToURL', () => {
    // TC-UNIT-007: URL 파라미터 직렬화
    it('should encode filter to URL query string', () => {
      const filter: GraphFilter = {
        categories: ['development', 'infrastructure'],
        statuses: ['[im]', '[vf]', '[xx]'],
        hierarchyMode: 'wp',
        focusTask: 'TSK-06-03',
        focusDepth: 2
      }

      const queryString = encodeFilterToURL(filter)
      const params = new URLSearchParams(queryString)

      expect(params.get('categories')).toBe('development,infrastructure')
      expect(params.get('statuses')).toBe('im,vf,xx') // 괄호 제거됨
      expect(params.get('hierarchyMode')).toBe('wp')
      expect(params.get('focusTask')).toBe('TSK-06-03')
      expect(params.has('focusDepth')).toBe(false) // 기본값 2이므로 생략
    })

    it('should encode categories correctly', () => {
      const filter: GraphFilter = {
        categories: ['development'],
        statuses: [],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const queryString = encodeFilterToURL(filter)
      const params = new URLSearchParams(queryString)

      expect(params.get('categories')).toBe('development')
    })

    it('should remove brackets from status codes', () => {
      const filter: GraphFilter = {
        categories: [],
        statuses: ['[bd]', '[dd]', '[im]'],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const queryString = encodeFilterToURL(filter)
      const params = new URLSearchParams(queryString)

      expect(params.get('statuses')).toBe('bd,dd,im')
    })

    it('should omit hierarchyMode when "full"', () => {
      const filter: GraphFilter = {
        categories: [],
        statuses: [],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const queryString = encodeFilterToURL(filter)
      const params = new URLSearchParams(queryString)

      expect(params.has('hierarchyMode')).toBe(false)
    })

    it('should include hierarchyMode when not "full"', () => {
      const filterWp: GraphFilter = {
        categories: [],
        statuses: [],
        hierarchyMode: 'wp',
        focusTask: null,
        focusDepth: 2
      }

      const filterAct: GraphFilter = {
        categories: [],
        statuses: [],
        hierarchyMode: 'act',
        focusTask: null,
        focusDepth: 2
      }

      expect(new URLSearchParams(encodeFilterToURL(filterWp)).get('hierarchyMode')).toBe('wp')
      expect(new URLSearchParams(encodeFilterToURL(filterAct)).get('hierarchyMode')).toBe('act')
    })

    it('should omit focusTask when null', () => {
      const filter: GraphFilter = {
        categories: [],
        statuses: [],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const queryString = encodeFilterToURL(filter)
      const params = new URLSearchParams(queryString)

      expect(params.has('focusTask')).toBe(false)
      expect(params.has('focusDepth')).toBe(false)
    })

    it('should include focusDepth only when focusTask exists and not default', () => {
      const filterDefault: GraphFilter = {
        categories: [],
        statuses: [],
        hierarchyMode: 'full',
        focusTask: 'TSK-01-01',
        focusDepth: 2
      }

      const filterCustom: GraphFilter = {
        categories: [],
        statuses: [],
        hierarchyMode: 'full',
        focusTask: 'TSK-01-01',
        focusDepth: 3
      }

      const paramsDefault = new URLSearchParams(encodeFilterToURL(filterDefault))
      const paramsCustom = new URLSearchParams(encodeFilterToURL(filterCustom))

      expect(paramsDefault.has('focusDepth')).toBe(false) // 기본값 2
      expect(paramsCustom.get('focusDepth')).toBe('3')
    })

    // TC-UNIT-011: URL 파라미터 기본값 생략
    it('should return empty string when all values are default', () => {
      const filter: GraphFilter = {
        categories: [],
        statuses: [],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const queryString = encodeFilterToURL(filter)

      expect(queryString).toBe('')
    })

    it('should omit empty arrays', () => {
      const filter: GraphFilter = {
        categories: [],
        statuses: [],
        hierarchyMode: 'wp',
        focusTask: null,
        focusDepth: 2
      }

      const queryString = encodeFilterToURL(filter)
      const params = new URLSearchParams(queryString)

      expect(params.has('categories')).toBe(false)
      expect(params.has('statuses')).toBe(false)
      expect(params.get('hierarchyMode')).toBe('wp')
    })
  })

  describe('parseURLParams', () => {
    // TC-UNIT-008: URL 파라미터 역직렬화
    it('should parse URL params to GraphFilter', () => {
      const searchParams = new URLSearchParams(
        'categories=development,infrastructure&statuses=im,vf,xx&hierarchyMode=wp&focusTask=TSK-06-03&focusDepth=2'
      )

      const filter = parseURLParams(searchParams)

      expect(filter.categories).toEqual(['development', 'infrastructure'])
      expect(filter.statuses).toEqual(['[im]', '[vf]', '[xx]']) // 괄호 복원
      expect(filter.hierarchyMode).toBe('wp')
      expect(filter.focusTask).toBe('TSK-06-03')
      expect(filter.focusDepth).toBe(2)
    })

    it('should restore brackets to status codes', () => {
      const searchParams = new URLSearchParams('statuses=bd,dd,im,vf')

      const filter = parseURLParams(searchParams)

      expect(filter.statuses).toEqual(['[bd]', '[dd]', '[im]', '[vf]'])
    })

    it('should parse categories correctly', () => {
      const searchParams = new URLSearchParams('categories=development,defect')

      const filter = parseURLParams(searchParams)

      expect(filter.categories).toEqual(['development', 'defect'])
    })

    it('should default to empty arrays when params missing', () => {
      const searchParams = new URLSearchParams('')

      const filter = parseURLParams(searchParams)

      expect(filter.categories).toEqual([])
      expect(filter.statuses).toEqual([])
    })

    it('should default hierarchyMode to "full"', () => {
      const searchParams = new URLSearchParams('')

      const filter = parseURLParams(searchParams)

      expect(filter.hierarchyMode).toBe('full')
    })

    it('should validate hierarchyMode values', () => {
      const validWp = new URLSearchParams('hierarchyMode=wp')
      const validAct = new URLSearchParams('hierarchyMode=act')
      const validFull = new URLSearchParams('hierarchyMode=full')
      const invalid = new URLSearchParams('hierarchyMode=invalid')

      expect(parseURLParams(validWp).hierarchyMode).toBe('wp')
      expect(parseURLParams(validAct).hierarchyMode).toBe('act')
      expect(parseURLParams(validFull).hierarchyMode).toBe('full')
      expect(parseURLParams(invalid).hierarchyMode).toBe('full') // 기본값
    })

    it('should default focusTask to null', () => {
      const searchParams = new URLSearchParams('')

      const filter = parseURLParams(searchParams)

      expect(filter.focusTask).toBe(null)
    })

    it('should parse focusTask correctly', () => {
      const searchParams = new URLSearchParams('focusTask=TSK-01-02')

      const filter = parseURLParams(searchParams)

      expect(filter.focusTask).toBe('TSK-01-02')
    })

    it('should default focusDepth to 2', () => {
      const searchParams = new URLSearchParams('')

      const filter = parseURLParams(searchParams)

      expect(filter.focusDepth).toBe(2)
    })

    it('should parse focusDepth as number', () => {
      const searchParams = new URLSearchParams('focusDepth=3')

      const filter = parseURLParams(searchParams)

      expect(filter.focusDepth).toBe(3)
      expect(typeof filter.focusDepth).toBe('number')
    })

    it('should clamp focusDepth between 1 and 3', () => {
      const tooLow = new URLSearchParams('focusDepth=0')
      const tooHigh = new URLSearchParams('focusDepth=5')
      const negative = new URLSearchParams('focusDepth=-1')

      expect(parseURLParams(tooLow).focusDepth).toBe(1)
      expect(parseURLParams(tooHigh).focusDepth).toBe(3)
      expect(parseURLParams(negative).focusDepth).toBe(1)
    })

    it('should handle invalid focusDepth gracefully', () => {
      const invalid = new URLSearchParams('focusDepth=abc')

      const filter = parseURLParams(invalid)

      expect(filter.focusDepth).toBe(2) // parseInt('abc') = NaN → 기본값 2
    })

    it('should filter out empty strings from categories', () => {
      const searchParams = new URLSearchParams('categories=development,,infrastructure')

      const filter = parseURLParams(searchParams)

      expect(filter.categories).toEqual(['development', 'infrastructure'])
    })

    it('should filter out empty strings from statuses', () => {
      const searchParams = new URLSearchParams('statuses=im,,vf')

      const filter = parseURLParams(searchParams)

      expect(filter.statuses).toEqual(['[im]', '[vf]'])
    })
  })

  describe('roundtrip encoding', () => {
    it('should preserve filter data through encode/parse cycle', () => {
      const original: GraphFilter = {
        categories: ['development', 'defect'],
        statuses: ['[bd]', '[im]'],
        hierarchyMode: 'wp',
        focusTask: 'TSK-03-05',
        focusDepth: 3
      }

      const encoded = encodeFilterToURL(original)
      const decoded = parseURLParams(new URLSearchParams(encoded))

      expect(decoded).toEqual(original)
    })

    it('should handle default values correctly in roundtrip', () => {
      const original: GraphFilter = {
        categories: [],
        statuses: [],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const encoded = encodeFilterToURL(original)
      const decoded = parseURLParams(new URLSearchParams(encoded))

      expect(decoded).toEqual(original)
    })
  })
})
