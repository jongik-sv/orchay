/**
 * Documents API 단위 테스트
 * Task: TSK-05-04
 * 테스트 명세: 026-test-specification.md 섹션 3.2 (TC-024~025)
 *
 * @nuxt/test-utils 대신 유틸리티 함수 직접 테스트
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock fs promises
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    access: vi.fn(),
    stat: vi.fn(),
  }
}));

import { promises as fs } from 'fs';

// 테스트 대상 함수들 import
import { validateDocument } from '../../../server/utils/validators/documentValidator';
import { readTaskDocument } from '../../../server/utils/documentService';

describe('Documents API - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateDocument', () => {
    test('TC-024-1: 유효한 파일명 검증 통과', async () => {
      // Given
      const validFilename = '010-basic-design.md';
      const validPath = '/test/path/010-basic-design.md';

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1024,
        isFile: () => true,
      } as any);

      // When
      const result = await validateDocument(validFilename, validPath);

      // Then
      expect(result.valid).toBe(true);
    });

    test('TC-024-2: 유효하지 않은 파일명 패턴 거부', async () => {
      // Given
      const invalidFilename = 'invalid.txt';
      const path = '/test/path/invalid.txt';

      // When
      const result = await validateDocument(invalidFilename, path);

      // Then
      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_FILENAME');
    });

    test('TC-024-3: 경로 탐색 공격 차단', async () => {
      // Given
      const maliciousFilename = '../../../etc/passwd';
      const path = '/test/path/../../../etc/passwd';

      // When
      const result = await validateDocument(maliciousFilename, path);

      // Then
      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_PATH');
    });

    test('TC-024-4: 파일 크기 제한 (10MB 초과 거부)', async () => {
      // Given
      const filename = '010-basic-design.md';
      const path = '/test/path/010-basic-design.md';

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 11 * 1024 * 1024, // 11MB
        isFile: () => true,
      } as any);

      // When
      const result = await validateDocument(filename, path);

      // Then
      expect(result.valid).toBe(false);
      expect(result.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('readTaskDocument', () => {
    test('TC-024-5: 문서 정상 조회', async () => {
      // Given
      const mockContent = '# Test Document\n\nContent here';
      const mockStat = {
        size: mockContent.length,
        mtime: new Date('2025-01-01'),
        isFile: () => true,
      };

      vi.mocked(fs.readFile).mockResolvedValue(mockContent);
      vi.mocked(fs.stat).mockResolvedValue(mockStat as any);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // When
      const result = await readTaskDocument('orchay', 'TSK-01-01', '010-basic-design.md');

      // Then
      expect(result.content).toBe(mockContent);
      expect(result.filename).toBe('010-basic-design.md');
      expect(result.size).toBe(mockContent.length);
    });

    test('TC-025: 존재하지 않는 문서 조회 시 에러', async () => {
      // Given
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      // When & Then
      await expect(
        readTaskDocument('orchay', 'INVALID-TASK', '010-basic-design.md')
      ).rejects.toThrow('DOCUMENT_NOT_FOUND');
    });
  });
});
