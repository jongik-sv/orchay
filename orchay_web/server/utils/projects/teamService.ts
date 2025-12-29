/**
 * 팀원 서비스
 * Task: TSK-02-03-03
 * 상세설계: 020-detail-design.md 섹션 5.1
 */

import { readFile, writeFile } from 'fs/promises';
import type { TeamConfig, TeamMember } from './types';
import { getProjectFilePath } from './paths';
import { createBadRequestError, createInternalError } from '../errors/standardError';

/**
 * 팀원 목록 조회
 * FR-005
 */
export async function getTeam(projectId: string): Promise<TeamMember[]> {
  const filePath = getProjectFilePath(projectId, 'team.json');

  try {
    const content = await readFile(filePath, 'utf-8');
    const config = JSON.parse(content) as TeamConfig;
    return config.members;
  } catch (error: unknown) {
    // 파일 없으면 빈 배열
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw createInternalError('FILE_READ_ERROR', '팀원 정보를 읽는 중 오류가 발생했습니다');
  }
}

/**
 * 팀원 목록 수정
 * FR-005, BR-003
 */
export async function updateTeam(
  projectId: string,
  members: TeamMember[]
): Promise<TeamMember[]> {
  // BR-003: 팀원 ID 중복 검증
  const ids = members.map(m => m.id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    throw createBadRequestError('DUPLICATE_MEMBER_ID', '팀원 ID가 중복됩니다');
  }

  const config: TeamConfig = {
    version: '1.0',
    members,
  };

  const filePath = getProjectFilePath(projectId, 'team.json');

  try {
    await writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
    return members;
  } catch (error) {
    throw createInternalError('FILE_WRITE_ERROR', '팀원 정보를 저장하는 중 오류가 발생했습니다');
  }
}
