/**
 * TeamService Unit Tests
 *
 * @see TSK-02-03-03
 * @see 026-test-specification.md
 *
 * Test Coverage:
 * - UT-007: getTeam 정상 조회
 * - UT-008: updateTeam 중복 팀원 ID
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as teamService from '../../../server/utils/projects/teamService';
import * as paths from '../../../server/utils/projects/paths';

// Mock fs/promises
vi.mock('fs/promises');

// Mock paths module
vi.mock('../../../server/utils/projects/paths', () => ({
  getProjectFilePath: vi.fn((id: string, fileName: string) => `/test/.orchay/projects/${id}/${fileName}`),
  validateProjectId: vi.fn(),
  getBasePath: vi.fn(() => '/test'),
}));

describe('TeamService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTeam', () => {
    /**
     * UT-007: TeamService.getTeam 정상 조회
     * @requirement FR-005
     */
    it('UT-007: should return team members', async () => {
      // Arrange: Mock 팀원 데이터
      const mockTeamConfig = {
        version: '1.0',
        members: [
          {
            id: 'hong',
            name: '홍길동',
            email: 'hong@test.com',
            role: 'Developer',
            active: true,
          },
          {
            id: 'kim',
            name: '김철수',
            email: 'kim@test.com',
            role: 'Designer',
            active: true,
          },
          {
            id: 'lee',
            name: '이영희',
            email: 'lee@test.com',
            role: 'PM',
            active: false,
          },
        ],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockTeamConfig));

      // Act
      const result = await teamService.getTeam('test-project');

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('id', 'hong');
      expect(result[0]).toHaveProperty('name', '홍길동');
      expect(result[0]).toHaveProperty('email', 'hong@test.com');
      expect(result[0]).toHaveProperty('role', 'Developer');
      expect(result[0]).toHaveProperty('active', true);
    });

    it('should return empty array when team.json does not exist', async () => {
      // Arrange: 파일 없음 시뮬레이션
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      // Act
      const result = await teamService.getTeam('test-project');

      // Assert: 빈 배열 반환
      expect(result).toEqual([]);
    });

    it('should throw on file read error (non-ENOENT)', async () => {
      // Arrange: 일반 읽기 오류
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

      // Act & Assert
      await expect(teamService.getTeam('test-project')).rejects.toThrow();
    });
  });

  describe('updateTeam', () => {
    /**
     * UT-008: TeamService.updateTeam 중복 팀원 ID
     * @requirement BR-003
     */
    it('UT-008: should throw on duplicate member ID', async () => {
      // Arrange: 중복 ID를 가진 팀원 목록
      const duplicateMembers = [
        { id: 'user1', name: 'User 1', active: true },
        { id: 'user1', name: 'User 1 Duplicate', active: true }, // 중복 ID
      ];

      // Act & Assert: DUPLICATE_MEMBER_ID 에러 발생
      await expect(teamService.updateTeam('test-project', duplicateMembers)).rejects.toThrow();
    });

    it('should update team successfully with unique member IDs', async () => {
      // Arrange
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const validMembers = [
        { id: 'hong', name: '홍길동', email: 'hong@test.com', role: 'Developer', active: true },
        { id: 'kim', name: '김철수', email: 'kim@test.com', role: 'Designer', active: true },
      ];

      // Act
      const result = await teamService.updateTeam('test-project', validMembers);

      // Assert
      expect(result).toEqual(validMembers);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle empty team update', async () => {
      // Arrange
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Act
      const result = await teamService.updateTeam('test-project', []);

      // Assert
      expect(result).toEqual([]);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw on file write error', async () => {
      // Arrange
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      const members = [
        { id: 'user1', name: 'User 1', active: true },
      ];

      // Act & Assert
      await expect(teamService.updateTeam('test-project', members)).rejects.toThrow();
    });

    it('should preserve all member fields', async () => {
      // Arrange
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const membersWithAllFields = [
        {
          id: 'hong',
          name: '홍길동',
          email: 'hong@test.com',
          role: 'Lead Developer',
          avatar: 'https://example.com/avatar.png',
          active: true,
        },
      ];

      // Act
      const result = await teamService.updateTeam('test-project', membersWithAllFields);

      // Assert
      expect(result[0]).toHaveProperty('avatar', 'https://example.com/avatar.png');
      expect(result[0]).toHaveProperty('role', 'Lead Developer');
    });
  });
});
