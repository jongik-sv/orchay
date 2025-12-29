/**
 * TaskDocuments Component Unit Tests
 * Task: TSK-05-02
 * Test Spec: 026-test-specification.md
 *
 * Coverage:
 * - Document icon and color by type
 * - File size formatting
 * - Date formatting
 * - Document type labels
 * - Row click handling (open-document event)
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskDocuments from '~/components/wbs/detail/TaskDocuments.vue'
import Panel from 'primevue/panel'
import Message from 'primevue/message'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import type { DocumentInfo } from '~/types'

// Mock DOCUMENT_TYPE_CONFIG
vi.mock('~/utils/documentConfig', () => ({
  DOCUMENT_TYPE_CONFIG: {
    design: { icon: 'pi pi-file-edit', color: '#3b82f6', label: '설계 문서' },
    implementation: { icon: 'pi pi-code', color: '#10b981', label: '구현 문서' },
    test: { icon: 'pi pi-check-circle', color: '#f59e0b', label: '테스트 문서' },
    manual: { icon: 'pi pi-book', color: '#8b5cf6', label: '매뉴얼' },
    analysis: { icon: 'pi pi-search', color: '#6366f1', label: '분석 문서' },
    review: { icon: 'pi pi-comments', color: '#ec4899', label: '리뷰 문서' }
  }
}))

describe('TaskDocuments', () => {
  // Global components for all tests
  const globalComponents = {
    components: { Panel, Message, DataTable, Column, Tag }
  }

  // Helper to create mock documents
  const createExistingDoc = (): DocumentInfo => ({
    name: '010-basic-design.md',
    path: '.orchay/projects/test/tasks/TSK-05-02/010-basic-design.md',
    exists: true,
    type: 'design',
    stage: 'current',
    size: 15500,
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T12:00:00Z'
  })

  const createExpectedDoc = (): DocumentInfo => ({
    name: '020-detail-design.md',
    path: '.orchay/projects/test/tasks/TSK-05-02/020-detail-design.md',
    exists: false,
    type: 'design',
    stage: 'expected',
    expectedAfter: '/wf:draft 실행 후 생성',
    command: '/wf:draft'
  })

  describe('Document Type Icons and Colors', () => {
    it('should return correct icon for design documents', () => {
      const doc = createExistingDoc()
      const wrapper = mount(TaskDocuments, {
        props: { documents: [doc] },
        global: globalComponents
      })

      const vm = wrapper.vm as any
      const icon = vm.getDocumentIcon(doc)
      const color = vm.getDocumentColor(doc)

      expect(icon).toBe('pi pi-file-edit')
      expect(color).toBe('#3b82f6')
    })

    it('should return fallback icon for unknown type', () => {
      const doc = { ...createExistingDoc(), type: 'unknown' as any }
      const wrapper = mount(TaskDocuments, {
        props: { documents: [doc] },
        global: globalComponents
      })

      const vm = wrapper.vm as any
      const icon = vm.getDocumentIcon(doc)
      const color = vm.getDocumentColor(doc)

      expect(icon).toBe('pi pi-file')
      expect(color).toBe('var(--color-text-muted)')
    })

    it('should return correct icons for all document types', () => {
      const wrapper = mount(TaskDocuments, {
        props: { documents: [] },
        global: globalComponents
      })

      const vm = wrapper.vm as any

      expect(vm.getDocumentIcon({ type: 'design' })).toBe('pi pi-file-edit')
      expect(vm.getDocumentIcon({ type: 'implementation' })).toBe('pi pi-code')
      expect(vm.getDocumentIcon({ type: 'test' })).toBe('pi pi-check-circle')
      expect(vm.getDocumentIcon({ type: 'manual' })).toBe('pi pi-book')
      expect(vm.getDocumentIcon({ type: 'analysis' })).toBe('pi pi-search')
      expect(vm.getDocumentIcon({ type: 'review' })).toBe('pi pi-comments')
    })
  })

  describe('File Size Formatting', () => {
    it('should format bytes correctly', () => {
      const wrapper = mount(TaskDocuments, {
        props: { documents: [] },
        global: globalComponents
      })

      const vm = wrapper.vm as any

      expect(vm.formatFileSize(500)).toBe('500 B')
      expect(vm.formatFileSize(1024)).toBe('1.0 KB')
      expect(vm.formatFileSize(1536)).toBe('1.5 KB')
      expect(vm.formatFileSize(1024 * 1024)).toBe('1.0 MB')
      expect(vm.formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB')
    })

    it('should handle edge cases', () => {
      const wrapper = mount(TaskDocuments, {
        props: { documents: [] },
        global: globalComponents
      })

      const vm = wrapper.vm as any

      expect(vm.formatFileSize(0)).toBe('0 B')
      expect(vm.formatFileSize(1023)).toBe('1023 B')
      expect(vm.formatFileSize(1024 * 1024 - 1)).toBe('1024.0 KB')
    })
  })

  describe('Date Formatting', () => {
    it('should format date string to YY.MM.DD format', () => {
      const wrapper = mount(TaskDocuments, {
        props: { documents: [] },
        global: globalComponents
      })

      const vm = wrapper.vm as any
      const formatted = vm.formatDate('2025-12-15T13:12:00Z')

      // Date will be formatted as YY.MM.DD
      expect(formatted).toBe('25.12.15')
    })

    it('should handle different date formats', () => {
      const wrapper = mount(TaskDocuments, {
        props: { documents: [] },
        global: globalComponents
      })

      const vm = wrapper.vm as any

      expect(vm.formatDate('2024-01-01T00:00:00Z')).toBe('24.01.01')
      expect(vm.formatDate('2025-06-30T23:59:59Z')).toBe('25.07.01') // UTC conversion
    })
  })

  describe('Document Type Labels', () => {
    it('should return correct label for each document type', () => {
      const wrapper = mount(TaskDocuments, {
        props: { documents: [] },
        global: globalComponents
      })

      const vm = wrapper.vm as any

      expect(vm.getDocumentTypeLabel('design')).toBe('설계 문서')
      expect(vm.getDocumentTypeLabel('implementation')).toBe('구현 문서')
      expect(vm.getDocumentTypeLabel('test')).toBe('테스트 문서')
      expect(vm.getDocumentTypeLabel('manual')).toBe('매뉴얼')
      expect(vm.getDocumentTypeLabel('analysis')).toBe('분석 문서')
      expect(vm.getDocumentTypeLabel('review')).toBe('리뷰 문서')
      expect(vm.getDocumentTypeLabel('unknown')).toBe('문서')
    })
  })

  describe('Row Click Handling', () => {
    it('should emit open-document event when clicking existing document row', () => {
      const doc = createExistingDoc()
      const wrapper = mount(TaskDocuments, {
        props: { documents: [doc] },
        global: globalComponents
      })

      const vm = wrapper.vm as any
      // Simulate row click event
      vm.onRowClick({ data: doc })

      expect(wrapper.emitted('open-document')).toBeTruthy()
      expect(wrapper.emitted('open-document')?.[0]).toEqual([doc])
    })

    it('should NOT emit open-document event when clicking expected document row', () => {
      const doc = createExpectedDoc()
      const wrapper = mount(TaskDocuments, {
        props: { documents: [doc] },
        global: globalComponents
      })

      const vm = wrapper.vm as any
      // Simulate row click event
      vm.onRowClick({ data: doc })

      // Should not emit event
      expect(wrapper.emitted('open-document')).toBeFalsy()
    })
  })

  describe('Empty State', () => {
    it('should display message when no documents exist', () => {
      const wrapper = mount(TaskDocuments, {
        props: { documents: [] },
        global: globalComponents
      })

      const message = wrapper.findComponent(Message)
      expect(message.exists()).toBe(true)
      expect(message.text()).toContain('관련 문서가 없습니다')
    })

    it('should not display DataTable when no documents', () => {
      const wrapper = mount(TaskDocuments, {
        props: { documents: [] },
        global: globalComponents
      })

      const dataTable = wrapper.findComponent(DataTable)
      expect(dataTable.exists()).toBe(false)
    })
  })

  describe('DataTable Rendering', () => {
    it('should render DataTable when documents exist', () => {
      const doc = createExistingDoc()
      const wrapper = mount(TaskDocuments, {
        props: { documents: [doc] },
        global: globalComponents
      })

      const dataTable = wrapper.findComponent(DataTable)
      expect(dataTable.exists()).toBe(true)
    })

    it('should pass correct props to DataTable', () => {
      const doc = createExistingDoc()
      const wrapper = mount(TaskDocuments, {
        props: { documents: [doc] },
        global: globalComponents
      })

      const dataTable = wrapper.findComponent(DataTable)
      expect(dataTable.props('value')).toEqual([doc])
      expect(dataTable.props('size')).toBe('small')
      expect(dataTable.props('scrollable')).toBe(true)
      expect(dataTable.props('selectionMode')).toBe('single')
      expect(dataTable.props('dataKey')).toBe('path')
    })
  })

  describe('Panel Structure', () => {
    it('should render Panel with correct header', () => {
      const wrapper = mount(TaskDocuments, {
        props: { documents: [] },
        global: globalComponents
      })

      const panel = wrapper.findComponent(Panel)
      expect(panel.exists()).toBe(true)
      expect(panel.props('header')).toBe('관련 문서')
      expect(panel.props('toggleable')).toBe(true)
    })

    it('should have correct data-testid', () => {
      const wrapper = mount(TaskDocuments, {
        props: { documents: [] },
        global: globalComponents
      })

      expect(wrapper.find('[data-testid="task-documents-panel"]').exists()).toBe(true)
    })
  })

  describe('Component Mounting', () => {
    it('should mount without errors', () => {
      expect(() =>
        mount(TaskDocuments, {
          props: { documents: [] },
          global: globalComponents
        })
      ).not.toThrow()
    })

    it('should mount with multiple documents', () => {
      const docs = [createExistingDoc(), createExpectedDoc()]
      const wrapper = mount(TaskDocuments, {
        props: { documents: docs },
        global: globalComponents
      })

      expect(wrapper.exists()).toBe(true)
    })
  })
})
