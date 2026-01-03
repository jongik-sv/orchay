/**
 * 프로젝트 메타데이터 타입 정의
 * Task: TSK-02-03-03
 * 상세설계: 020-detail-design.md 섹션 6
 */

// ============================================================
// Entity Types
// ============================================================

/**
 * 프로젝트 목록 항목
 * 폴더 스캔 시 project.json에서 추출되는 항목
 */
export interface ProjectListItem {
  id: string;
  name: string;
  path: string;
  status: 'active' | 'archived';
  wbsDepth: 3 | 4;
  createdAt: string; // ISO 8601
}

/**
 * 프로젝트 목록 조회 결과
 * 폴더 스캔 방식으로 생성된 프로젝트 목록
 */
export interface ProjectsConfig {
  version: string;
  projects: ProjectListItem[];
  defaultProject: null;  // 미사용 (하위 호환성 유지)
}

/**
 * 개별 프로젝트 메타데이터 (project.json)
 * 폴더 스캔 방식으로 프로젝트 목록을 생성하므로
 * 기존 projects.json의 정보도 여기에 통합
 */
export interface ProjectConfig {
  id: string;
  name: string;
  description?: string;
  version: string;
  status: 'active' | 'archived';
  wbsDepth: 3 | 4;  // WBS 계층 깊이 (기존 projects.json에서 이동)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  scheduledStart?: string; // ISO date (YYYY-MM-DD)
  scheduledEnd?: string; // ISO date (YYYY-MM-DD)
}

/**
 * 팀원
 */
export interface TeamMember {
  id: string;
  name: string;
  email?: string;
  role?: string;
  avatar?: string;
  active: boolean;
}

/**
 * 팀원 목록 설정 (team.json)
 */
export interface TeamConfig {
  version: string;
  members: TeamMember[];
}

/**
 * 프로젝트 상세 응답 (project + team)
 */
export interface ProjectDetail {
  project: ProjectConfig;
  team: TeamMember[];
}

/**
 * 프로젝트 목록 응답
 */
export interface ProjectListResponse {
  projects: ProjectListItem[];
  defaultProject: string | null;
  total: number;
}

/**
 * 팀원 목록 응답
 */
export interface TeamResponse {
  members: TeamMember[];
  total: number;
}

// ============================================================
// WBS YAML Types (wbs.yaml 통합 구조)
// ============================================================

/**
 * WBS 설정 (wbs.yaml의 wbs 섹션)
 */
export interface WbsConfig {
  version: string;
  depth: 3 | 4;
  projectRoot?: string;
  strategy?: string;
}

/**
 * WBS YAML 전체 구조
 * project.json + wbs.md → wbs.yaml 통합
 */
export interface WbsYaml {
  project: ProjectConfig;
  wbs: WbsConfig;
  workPackages: unknown[]; // WP 상세 구조는 별도 타입으로 정의 필요
}

// CreateProjectDto, UpdateProjectDto는 projectValidators.ts에서 Zod로 정의됨
// import { CreateProjectDto, UpdateProjectDto } from '../validators/projectValidators';
