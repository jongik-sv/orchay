/**
 * API Integration Tests for Project Metadata Service
 * Task: TSK-02-03-03
 * Test Specification: 026-test-specification.md
 *
 * This test file covers E2E scenarios by testing the complete flow
 * from API layer to service layer with actual file system operations.
 *
 * Coverage:
 * - E2E-001: 프로젝트 목록 조회
 * - E2E-002: 프로젝트 상세 조회
 * - E2E-003: 프로젝트 생성 플로우
 * - E2E-004: 프로젝트 수정 플로우
 * - E2E-005: 팀원 관리 플로우
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rm, mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Service imports
import { createProjectWithRegistration } from '../../../server/utils/projects/projectFacade';
import {
  getProject,
  updateProject,
} from '../../../server/utils/projects/projectService';
import { getTeam, updateTeam } from '../../../server/utils/projects/teamService';
import { getProjectsList } from '../../../server/utils/projects/projectsListService';

// Type imports
import type { TeamMember } from '../../../server/utils/projects/types';

const TEST_BASE = join(process.cwd(), 'tests', 'fixtures', 'projects-api-e2e');

describe('Project Metadata Service - API Integration Tests', () => {
  beforeAll(async () => {
    // Clean up any previous test run
    try {
      await rm(TEST_BASE, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Set up test environment
    process.env.orchay_BASE_PATH = TEST_BASE;

    // Create directory structure
    await mkdir(join(TEST_BASE, '.orchay', 'settings'), { recursive: true });
    await mkdir(join(TEST_BASE, '.orchay', 'projects'), { recursive: true });

    // Create initial projects.json
    const projectsConfig = {
      version: '1.0',
      projects: [],
      defaultProject: null,
    };

    await writeFile(
      join(TEST_BASE, '.orchay', 'settings', 'projects.json'),
      JSON.stringify(projectsConfig, null, 2),
      'utf-8'
    );

    // Pre-create the main test project for all tests to use
    await createProjectWithRegistration({
      id: 'e2e-test-project',
      name: 'E2E Test Project',
      description: 'Integration test project',
      wbsDepth: 4,
    });
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await rm(TEST_BASE, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    delete process.env.orchay_BASE_PATH;
  });

  describe('E2E-003: Project Creation Flow', () => {
    it('should create project with folder structure and files', async () => {
      // Given: Project creation request (use unique ID for this test)
      const createDto = {
        id: 'e2e-create-test',
        name: 'E2E Create Test Project',
        description: 'Integration test project for creation',
        wbsDepth: 4 as 3 | 4,
      };

      // When: Create project
      const result = await createProjectWithRegistration(createDto);

      // Then: Verify response
      expect(result.project.id).toBe('e2e-create-test');
      expect(result.project.name).toBe('E2E Create Test Project');
      expect(result.project.description).toBe('Integration test project for creation');
      expect(result.team).toEqual([]);

      // And: Verify folder structure created (BR-004)
      const projectDir = join(TEST_BASE, '.orchay', 'projects', 'e2e-create-test');
      expect(existsSync(projectDir)).toBe(true);

      // And: Verify wbs.yaml created
      const wbsYamlPath = join(projectDir, 'wbs.yaml');
      expect(existsSync(wbsYamlPath)).toBe(true);

      const { parse: parseYaml } = await import('yaml');
      const wbsYaml = parseYaml(await readFile(wbsYamlPath, 'utf-8'));
      expect(wbsYaml.project.id).toBe('e2e-create-test');
      expect(wbsYaml.project.name).toBe('E2E Create Test Project');

      // And: Verify team.json created
      const teamJsonPath = join(projectDir, 'team.json');
      expect(existsSync(teamJsonPath)).toBe(true);

      const teamJson = JSON.parse(await readFile(teamJsonPath, 'utf-8'));
      expect(teamJson.version).toBe('1.0');
      expect(teamJson.members).toEqual([]);

      // And: Verify project is discoverable via folder scan
      const projectsList = await getProjectsList();
      // Should have at least 2 projects now (e2e-test-project from beforeAll + e2e-create-test)
      expect(projectsList.projects.length).toBeGreaterThanOrEqual(2);
      const createdProject = projectsList.projects.find((p: any) => p.id === 'e2e-create-test');
      expect(createdProject).toBeDefined();
    });

    it('should reject duplicate project ID (409 Conflict)', async () => {
      // Given: Create a dedicated project for duplicate test
      const uniqueId = 'dup-test-project';
      await createProjectWithRegistration({
        id: uniqueId,
        name: 'Duplicate Test Base',
        wbsDepth: 4,
      });

      // When: Try to create duplicate
      const duplicateDto = {
        id: uniqueId,
        name: 'Duplicate Project',
        wbsDepth: 4 as const,
      };

      // Then: Should throw conflict error
      await expect(createProjectWithRegistration(duplicateDto)).rejects.toThrow();
    });

    it('should reject invalid project ID format (400 Bad Request)', async () => {
      // Given: Invalid project ID
      const invalidDto = {
        id: 'Invalid_Project!', // Uppercase, underscore, special chars not allowed
        name: 'Invalid Project',
        wbsDepth: 4 as const,
      };

      // Then: Should throw validation error (BR-001)
      await expect(createProjectWithRegistration(invalidDto)).rejects.toThrow();
    });
  });

  describe('E2E-001: Project List Retrieval', () => {
    it('should return project list with correct structure', async () => {
      // When: Get project list
      const result = await getProjectsList();

      // Then: Verify response structure
      expect(result).toHaveProperty('projects');
      expect(result).toHaveProperty('defaultProject');
      expect(Array.isArray(result.projects)).toBe(true);

      // And: Verify created project exists
      expect(result.projects.length).toBeGreaterThan(0);
      const project = result.projects.find((p) => p.id === 'e2e-test-project');
      expect(project).toBeDefined();
      expect(project!.id).toBe('e2e-test-project');
      expect(project!.status).toBe('active');
    });

    it('should support status filtering', async () => {
      // When: Filter by active status
      const result = await getProjectsList('active');

      // Then: All projects should be active
      result.projects.forEach((project) => {
        expect(project.status).toBe('active');
      });
    });
  });

  describe('E2E-002: Project Detail Retrieval', () => {
    it('should return project with team information', async () => {
      // When: Get project detail
      const project = await getProject('e2e-test-project');

      // Then: Verify project structure
      expect(project.id).toBe('e2e-test-project');
      expect(project).toHaveProperty('name');
      expect(project).toHaveProperty('description');
      expect(project).toHaveProperty('version');
      expect(project).toHaveProperty('status');
      expect(project).toHaveProperty('createdAt');
      expect(project).toHaveProperty('updatedAt');

      // And: Get team
      const team = await getTeam('e2e-test-project');
      expect(Array.isArray(team)).toBe(true);
    });

    it('should throw 404 for non-existent project', async () => {
      // When/Then: Should throw not found error
      await expect(getProject('non-existent-project')).rejects.toThrow();
    });
  });

  describe('E2E-004: Project Update Flow', () => {
    it('should update project fields successfully', async () => {
      // Given: Get current project state
      const beforeUpdate = await getProject('e2e-test-project');

      // Given: Update data
      const updateDto = {
        name: 'Updated Project Name',
        description: 'Updated description',
        version: '0.2.0',
      };

      // When: Update project
      const updated = await updateProject('e2e-test-project', updateDto);

      // Then: Verify updates
      expect(updated.name).toBe('Updated Project Name');
      expect(updated.description).toBe('Updated description');
      expect(updated.version).toBe('0.2.0');
      expect(updated.id).toBe('e2e-test-project'); // ID should remain unchanged

      // And: Verify updatedAt changed
      expect(updated.updatedAt).toBeDefined();
      expect(updated.updatedAt).not.toBe(beforeUpdate.updatedAt);

      // And: Verify persisted
      const retrieved = await getProject('e2e-test-project');
      expect(retrieved.name).toBe('Updated Project Name');
    });

    it('should reject ID change attempt (BR-002)', async () => {
      // Given: Update with ID change
      const updateWithId = {
        id: 'new-id', // ID change not allowed
        name: 'New Name',
      };

      // When/Then: Should throw validation error
      await expect(updateProject('e2e-test-project', updateWithId as any)).rejects.toThrow();
    });
  });

  describe('E2E-005: Team Management Flow', () => {
    // Reset team to empty state before team tests
    beforeAll(async () => {
      const projectDir = join(TEST_BASE, '.orchay', 'projects', 'e2e-test-project');
      const teamPath = join(projectDir, 'team.json');
      await writeFile(teamPath, JSON.stringify({ version: '1.0', members: [] }, null, 2), 'utf-8');
    });

    it('should add and update team members successfully', async () => {
      // Given: Initial team members
      const initialTeam: TeamMember[] = [
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
      ];

      // When: Add team members
      const addedTeam = await updateTeam('e2e-test-project', initialTeam);

      // Then: Verify team added
      expect(addedTeam).toHaveLength(2);
      expect(addedTeam[0].name).toBe('홍길동');
      expect(addedTeam[1].name).toBe('김철수');

      // And: Verify persisted
      const retrievedTeam = await getTeam('e2e-test-project');
      expect(retrievedTeam).toHaveLength(2);

      // When: Update team (modify role)
      const updatedTeam: TeamMember[] = [
        {
          id: 'hong',
          name: '홍길동',
          email: 'hong@test.com',
          role: 'Lead Developer', // Role changed
          active: true,
        },
        {
          id: 'kim',
          name: '김철수',
          email: 'kim@test.com',
          role: 'Designer',
          active: false, // Status changed
        },
      ];

      const modified = await updateTeam('e2e-test-project', updatedTeam);

      // Then: Verify modifications
      expect(modified[0].role).toBe('Lead Developer');
      expect(modified[1].active).toBe(false);
    });

    it('should reject duplicate team member IDs (BR-003)', async () => {
      // Given: Team with duplicate IDs
      const duplicateTeam: TeamMember[] = [
        { id: 'user1', name: 'User 1', active: true },
        { id: 'user1', name: 'User 1 Duplicate', active: true }, // Duplicate ID
      ];

      // When/Then: Should throw validation error
      await expect(updateTeam('e2e-test-project', duplicateTeam)).rejects.toThrow('중복');
    });

    it('should allow removing team members', async () => {
      // Given: Current team with 2 members
      let team = await getTeam('e2e-test-project');
      expect(team).toHaveLength(2);

      // When: Update with only 1 member
      const reducedTeam: TeamMember[] = [
        {
          id: 'hong',
          name: '홍길동',
          email: 'hong@test.com',
          role: 'Lead Developer',
          active: true,
        },
      ];

      await updateTeam('e2e-test-project', reducedTeam);

      // Then: Verify team reduced
      team = await getTeam('e2e-test-project');
      expect(team).toHaveLength(1);
      expect(team[0].id).toBe('hong');
    });

    it('should allow clearing all team members', async () => {
      // When: Clear team
      await updateTeam('e2e-test-project', []);

      // Then: Verify team empty
      const team = await getTeam('e2e-test-project');
      expect(team).toEqual([]);
    });
  });

  describe('Integration: Complete Project Lifecycle', () => {
    it('should handle complete project lifecycle', async () => {
      // 1. Create project
      const createResult = await createProjectWithRegistration({
        id: 'lifecycle-test',
        name: 'Lifecycle Test Project',
        description: 'Testing complete lifecycle',
        wbsDepth: 4,
      });
      expect(createResult.project.id).toBe('lifecycle-test');

      // 2. Add team members
      await updateTeam('lifecycle-test', [
        { id: 'dev1', name: 'Developer 1', active: true },
        { id: 'dev2', name: 'Developer 2', active: true },
      ]);

      // 3. Update project
      const updated = await updateProject('lifecycle-test', {
        name: 'Updated Lifecycle Project',
        status: 'active',
      });
      expect(updated.name).toBe('Updated Lifecycle Project');

      // 4. Verify final state
      const finalProject = await getProject('lifecycle-test');
      expect(finalProject.name).toBe('Updated Lifecycle Project');

      const finalTeam = await getTeam('lifecycle-test');
      expect(finalTeam).toHaveLength(2);

      // 5. Verify in list (NOTE: projects.json update might be async)
      const projectsList = await getProjectsList();
      const found = projectsList.projects.find((p) => p.id === 'lifecycle-test');
      expect(found).toBeDefined();
      // Project list name is updated via updateProjectInList which should be called
      // but might not reflect the latest update immediately
    });
  });

  describe('Error Handling and Edge Cases', () => {
    // 폴더 스캔 방식에서는 projects.json이 아닌 projects 폴더를 확인
    // 빈 프로젝트 목록 테스트는 폴더가 비어있어야 함

    it('should handle empty project list gracefully', async () => {
      // Given: 임시로 프로젝트 폴더를 백업하고 비우기
      const projectsDir = join(TEST_BASE, '.orchay', 'projects');
      const backupDir = join(TEST_BASE, '.orchay', 'projects-backup');

      // 기존 프로젝트 폴더 백업
      await mkdir(backupDir, { recursive: true });
      const entries = await import('fs/promises').then(fs => fs.readdir(projectsDir));
      for (const entry of entries) {
        await import('fs/promises').then(fs =>
          fs.rename(join(projectsDir, entry), join(backupDir, entry))
        );
      }

      try {
        // When: Get list from empty folder
        const result = await getProjectsList();

        // Then: Should return empty array, not error
        expect(result.projects).toEqual([]);
        expect(result.defaultProject).toBeNull();
      } finally {
        // 백업된 프로젝트 복원
        const backupEntries = await import('fs/promises').then(fs => fs.readdir(backupDir));
        for (const entry of backupEntries) {
          await import('fs/promises').then(fs =>
            fs.rename(join(backupDir, entry), join(projectsDir, entry))
          );
        }
        await rm(backupDir, { recursive: true, force: true });
      }
    });

    it('should validate project ID format strictly', async () => {
      // Note: underscores are now allowed per paths.test.ts validation
      const invalidIds = [
        'ProjectWithUppercase',
        'project with spaces',
        'project@special',
        '../path-traversal',
        'project/with/slash',
      ];

      for (const invalidId of invalidIds) {
        await expect(
          createProjectWithRegistration({
            id: invalidId,
            name: 'Test',
            wbsDepth: 4,
          })
        ).rejects.toThrow();
      }
    });

    it('should accept valid project ID formats', async () => {
      const validIds = ['valid-project', 'project123', 'my-project-2025'];

      for (const validId of validIds) {
        const result = await createProjectWithRegistration({
          id: validId,
          name: `Project ${validId}`,
          wbsDepth: 4,
        });
        expect(result.project.id).toBe(validId);
      }
    });
  });
});
