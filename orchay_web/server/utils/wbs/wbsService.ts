/**
 * WBS 서비스
 * Task: TSK-03-02, TSK-09-01
 * 상세설계: 020-detail-design.md 섹션 5.1
 *
 * WBS 트리 조회/저장 비즈니스 로직
 */

import { promises as fs } from 'fs';
import type { WbsNode, WbsMetadata, AllWbsResponse, ProjectWbsNode } from '../../../types';
import type { ProjectListItem } from '../projects/types';
import { parseWbsMarkdown } from './parser/index';
import { serializeWbs } from './serializer';
import { validateWbs } from './validation/index';
import {
  readMarkdownFile,
  writeMarkdownFile,
  fileExists,
  getWbsPath,
  getProjectPath,
} from '../file';
import {
  createNotFoundError,
  createBadRequestError,
  createConflictError,
  createInternalError,
} from '../errors/standardError';
import { getProjectsList } from '../projects/projectsListService';
import { getProject } from '../projects/projectService';

/**
 * Markdown에서 메타데이터 섹션 파싱
 * @param markdown - wbs.md 파일 내용
 * @returns WbsMetadata
 */
function parseMetadata(markdown: string): WbsMetadata {
  const lines = markdown.split('\n');
  const metadata: Partial<WbsMetadata> = {
    version: '1.0',
    depth: 4,
    updated: new Date().toISOString().split('T')[0],
    start: '',
  };

  let inMetadataSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // 메타데이터 섹션 시작 (> 블록)
    if (trimmed.startsWith('>')) {
      inMetadataSection = true;
      const content = trimmed.substring(1).trim();

      if (content.startsWith('version:')) {
        metadata.version = content.substring(8).trim();
      } else if (content.startsWith('depth:')) {
        const depth = parseInt(content.substring(6).trim());
        metadata.depth = (depth === 3 || depth === 4 ? depth : 4) as 3 | 4;
      } else if (content.startsWith('updated:')) {
        metadata.updated = content.substring(8).trim();
      } else if (content.startsWith('start:')) {
        metadata.start = content.substring(6).trim();
      }
    } else if (trimmed === '---' && inMetadataSection) {
      // 메타데이터 섹션 종료
      break;
    }
  }

  return metadata as WbsMetadata;
}

/**
 * 낙관적 잠금 확인
 * @param requestUpdated - 요청의 updated 필드
 * @param currentUpdated - 현재 파일의 updated 필드
 * @throws CONFLICT_ERROR - updated 불일치 시
 */
function checkUpdatedDate(requestUpdated: string, currentUpdated: string): void {
  if (requestUpdated !== currentUpdated) {
    throw createConflictError(
      'CONFLICT_ERROR',
      '다른 사용자가 수정했습니다. 새로고침 후 재시도하세요'
    );
  }
}

/**
 * WBS 트리 조회
 * @param projectId - 프로젝트 ID
 * @returns { metadata, tree }
 * @throws PROJECT_NOT_FOUND - 프로젝트 또는 wbs.md 없음
 * @throws PARSE_ERROR - 파싱 실패
 * @throws FILE_ACCESS_ERROR - 파일 읽기 실패
 *
 * FR-001: WBS 트리 조회
 * FR-005: 진행률 자동 계산
 * BR-003: 진행률 자동 계산 (파서에서 수행)
 */
export async function getWbsTree(projectId: string): Promise<{
  metadata: WbsMetadata;
  tree: WbsNode[];
}> {
  const wbsPath = getWbsPath(projectId);

  // 파일 존재 확인
  const exists = await fileExists(wbsPath);
  if (!exists) {
    throw createNotFoundError(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  }

  // 파일 읽기
  const markdown = await readMarkdownFile(wbsPath);
  if (markdown === null) {
    throw createInternalError(
      'FILE_ACCESS_ERROR',
      'WBS 파일을 읽을 수 없습니다'
    );
  }

  try {
    // 메타데이터 파싱
    const metadata = parseMetadata(markdown);

    // 트리 파싱 (진행률 자동 계산 포함)
    const tree = parseWbsMarkdown(markdown);

    return { metadata, tree };
  } catch (error) {
    throw createInternalError(
      'PARSE_ERROR',
      `WBS 파일을 파싱할 수 없습니다: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * WBS 트리 저장
 * @param projectId - 프로젝트 ID
 * @param metadata - WBS 메타데이터
 * @param tree - WBS 노드 트리
 * @returns { success: true, updated: 새로운 날짜 }
 * @throws PROJECT_NOT_FOUND - 프로젝트 없음
 * @throws VALIDATION_ERROR - 유효성 검증 실패
 * @throws CONFLICT_ERROR - updated 불일치 (동시성 충돌)
 * @throws FILE_WRITE_ERROR - 파일 쓰기 실패
 * @throws SERIALIZATION_ERROR - 시리얼라이즈 실패
 *
 * FR-002: WBS 트리 저장
 * BR-001: Task 필수 속성 검증
 * BR-002: ID 중복 검사
 * BR-004: 백업/롤백 메커니즘
 * BR-006: updated 필드 자동 갱신
 */
export async function saveWbsTree(
  projectId: string,
  metadata: WbsMetadata,
  tree: WbsNode[]
): Promise<{ success: boolean; updated: string }> {
  const wbsPath = getWbsPath(projectId);
  const backupPath = `${wbsPath}.bak`;

  // 프로젝트 존재 확인
  const projectPath = getProjectPath(projectId);
  const projectExists = await fileExists(projectPath);
  if (!projectExists) {
    throw createNotFoundError(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  }

  // 유효성 검증 (BR-001, BR-002)
  const validationResult = validateWbs(tree);
  if (!validationResult.isValid) {
    const errorMessages = validationResult.errors
      .map((e) => e.message)
      .join(', ');
    throw createBadRequestError(
      'VALIDATION_ERROR',
      `WBS 데이터가 유효하지 않습니다: ${errorMessages}`
    );
  }

  // 낙관적 잠금 확인 (BR-006)
  const exists = await fileExists(wbsPath);
  if (exists) {
    const currentMarkdown = await readMarkdownFile(wbsPath);
    if (currentMarkdown) {
      const currentMetadata = parseMetadata(currentMarkdown);
      checkUpdatedDate(metadata.updated, currentMetadata.updated);
    }
  }

  try {
    // 백업 생성 (BR-004)
    if (exists) {
      await fs.copyFile(wbsPath, backupPath);
    }

    // 시리얼라이즈 (BR-006: updated 필드 자동 갱신)
    const markdown = serializeWbs(tree, metadata, { updateDate: true });

    // 파일 쓰기
    const writeSuccess = await writeMarkdownFile(wbsPath, markdown);
    if (!writeSuccess) {
      // 롤백 (BR-004)
      if (exists) {
        await fs.copyFile(backupPath, wbsPath);
      }
      throw createInternalError(
        'FILE_WRITE_ERROR',
        '데이터 저장에 실패했습니다'
      );
    }

    // 백업 파일 삭제
    if (exists) {
      await fs.unlink(backupPath).catch(() => {
        // 백업 파일 삭제 실패는 무시
      });
    }

    // 새로운 updated 날짜 추출
    const savedMarkdown = await readMarkdownFile(wbsPath);
    const savedMetadata = savedMarkdown ? parseMetadata(savedMarkdown) : metadata;

    return {
      success: true,
      updated: savedMetadata.updated,
    };
  } catch (error) {
    // 롤백 (BR-004)
    if (exists && (await fileExists(backupPath))) {
      await fs.copyFile(backupPath, wbsPath).catch(() => {
        // 롤백 실패는 로그만 (이미 에러 상황)
      });
    }

    // 에러가 이미 표준 에러인 경우 그대로 throw
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    throw createInternalError(
      'SERIALIZATION_ERROR',
      `WBS 데이터를 변환할 수 없습니다: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * 모든 프로젝트 WBS 조회 (TSK-09-01)
 * @returns AllWbsResponse
 * @throws WBS_FETCH_ERROR - 프로젝트 목록 조회 실패
 *
 * FR-001: 다중 프로젝트 WBS 통합 뷰
 * 개별 프로젝트 로드 실패 시 전체 실패 방지 (resilience)
 */
export async function getAllProjectsWbs(): Promise<AllWbsResponse> {
  // 1. 프로젝트 목록 조회
  const { projects: projectsList } = await getProjectsList();

  // 2. 병렬로 각 프로젝트 WBS 로드
  const projectsWbs = await Promise.all(
    projectsList.map(async (project) => {
      try {
        const { metadata, tree } = await getWbsTree(project.id);
        const projectNode = await createProjectNode(project, metadata, tree);
        return projectNode;
      } catch (error) {
        // 개별 프로젝트 로드 실패 시 경고 로그만 (전체 실패 방지)
        console.warn(`[getAllProjectsWbs] Failed to load ${project.id}:`, error);
        return null;
      }
    })
  );

  // 3. null 제거 (로드 실패한 프로젝트)
  const validProjects = projectsWbs.filter(p => p !== null) as ProjectWbsNode[];

  return { projects: validProjects };
}

/**
 * 노드 ID에 프로젝트 프리픽스 추가 (재귀)
 * 다중 프로젝트 모드에서 노드 ID 충돌 방지
 * @param nodes WBS 노드 트리
 * @param projectId 프로젝트 ID
 * @returns 프리픽스가 추가된 노드 트리
 */
function addProjectPrefixToNodes(nodes: WbsNode[], projectId: string): WbsNode[] {
  return nodes.map(node => ({
    ...node,
    id: `${projectId}:${node.id}`,
    projectId,  // 노드에 projectId 필드 추가
    children: node.children?.length > 0
      ? addProjectPrefixToNodes(node.children, projectId)
      : [],
  }));
}

/**
 * 프로젝트 WBS 노드 생성 (TSK-09-01)
 * @param project 프로젝트 목록 항목
 * @param metadata WBS 메타데이터
 * @param tree WBS 노드 트리
 * @returns ProjectWbsNode
 */
async function createProjectNode(
  project: ProjectListItem,
  metadata: WbsMetadata,
  tree: WbsNode[]
): Promise<ProjectWbsNode> {
  // 진행률 + Task 개수 계산 (단일 순회) - 프리픽스 추가 전에 계산
  const stats = calculateProjectStats(tree);

  // project.json에서 추가 정보 로드
  let description: string | undefined;
  let scheduledEnd: string | undefined;

  try {
    const projectConfig = await getProject(project.id);
    description = projectConfig.description;
    scheduledEnd = projectConfig.scheduledEnd;
  } catch (error) {
    // project.json 읽기 실패 시 기본값 사용
    console.warn(`[createProjectNode] Failed to load project config for ${project.id}`);
  }

  // 다중 프로젝트 모드: 노드 ID에 프로젝트 프리픽스 추가
  const prefixedTree = addProjectPrefixToNodes(tree, project.id);

  return {
    id: project.id,
    type: 'project',
    title: project.name,
    projectMeta: {
      name: project.name,
      status: project.status,
      wbsDepth: project.wbsDepth,
      scheduledStart: metadata.start,
      scheduledEnd,
      description,
      createdAt: project.createdAt,
    },
    progress: stats.progress,
    taskCount: stats.taskCount,
    children: prefixedTree,
  };
}

/**
 * 프로젝트 통계 계산 (진행률 + Task 개수, 단일 순회) (TSK-09-01)
 * 성능 최적화: 2N → N (50% 감소)
 * @param tree WBS 노드 트리
 * @returns { progress: number, taskCount: number }
 */
function calculateProjectStats(tree: WbsNode[]): { progress: number; taskCount: number } {
  let totalProgress = 0;
  let taskCount = 0;

  function traverse(nodes: WbsNode[]): void {
    for (const node of nodes) {
      if (node.type === 'task') {
        totalProgress += node.progress || 0;
        taskCount++;
      }
      if (node.children?.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);

  return {
    progress: taskCount > 0 ? Math.round(totalProgress / taskCount) : 0,
    taskCount
  };
}
