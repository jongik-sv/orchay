/**
 * YAML WBS 시리얼라이저
 * WbsNode[] 트리를 wbs.yaml 형식으로 변환
 */

import { stringify as stringifyYaml } from 'yaml';
import type { WbsNode, WbsMetadata, SerializerOptions } from '../../../../types';
import type { YamlWbsRoot, YamlProject, YamlWbsConfig } from '../yamlParser/_types';
import { convertToYamlWorkPackages } from './_converter';

/**
 * 기존 YAML 파일에서 project 섹션 로드
 * (시리얼라이즈 시 project 정보 유지를 위해 필요)
 */
export interface SerializeContext {
  existingProject?: YamlProject;
  existingWbsConfig?: YamlWbsConfig;
}

/**
 * WbsNode[] + WbsMetadata → YAML 문자열 변환
 *
 * @param tree - WbsNode[] 트리
 * @param metadata - WBS 메타데이터
 * @param options - 시리얼라이저 옵션
 * @param context - 기존 YAML 데이터 (project 섹션 유지용)
 * @returns YAML 문자열
 */
export function serializeWbsToYaml(
  tree: WbsNode[],
  metadata: WbsMetadata,
  options?: SerializerOptions,
  context?: SerializeContext
): string {
  // updated 날짜 갱신
  const updatedDate = options?.updateDate
    ? new Date().toISOString().split('T')[0]
    : metadata.updated;

  // project 섹션 구성 (기존 데이터 유지)
  const project: YamlProject = {
    id: context?.existingProject?.id ?? 'unknown',
    name: context?.existingProject?.name ?? 'Unknown Project',
    ...context?.existingProject,
    updatedAt: updatedDate,
  };

  // wbs 섹션 구성
  const wbs: YamlWbsConfig = {
    version: metadata.version,
    depth: metadata.depth,
    ...context?.existingWbsConfig,
  };

  // workPackages 변환
  const workPackages = convertToYamlWorkPackages(tree);

  // 최종 YAML 구조
  const root: YamlWbsRoot = {
    project,
    wbs,
    workPackages,
  };

  // YAML 문자열로 변환
  return stringifyYaml(root, {
    indent: 2,
    lineWidth: 0,  // 줄 바꿈 없음
    defaultStringType: 'QUOTE_DOUBLE',
    defaultKeyType: 'PLAIN',
  });
}

// NOTE: Converter functions are NOT re-exported here
// to avoid Nuxt auto-import duplicate warnings.
// Import directly from './_converter' if needed.
