/**
 * YAML WBS 스키마 타입 정의
 * wbs.yaml 파일 구조에 대응하는 TypeScript 타입
 */

/**
 * wbs.yaml 루트 구조
 */
export interface YamlWbsRoot {
  project: YamlProject;
  wbs: YamlWbsConfig;
  workPackages: YamlWorkPackage[];
}

/**
 * project 섹션
 */
export interface YamlProject {
  id: string;
  name: string;
  description?: string;
  version?: string;
  status?: 'active' | 'archived' | 'completed';
  createdAt?: string;
  updatedAt?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

/**
 * wbs 섹션 (메타데이터)
 */
export interface YamlWbsConfig {
  version: string;
  depth: 3 | 4;
  projectRoot?: string;
  strategy?: string;
}

/**
 * Work Package
 */
export interface YamlWorkPackage {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  schedule?: string;  // "YYYY-MM-DD ~ YYYY-MM-DD"
  progress?: string;  // "100%"
  activities?: YamlActivity[];  // 4-level
  tasks?: YamlTask[];           // 3-level (ACT 없음)
}

/**
 * Activity (4-level 구조에서 사용)
 */
export interface YamlActivity {
  id: string;
  title: string;
  schedule?: string;
  progress?: string;
  tasks: YamlTask[];
}

/**
 * Task 요구사항
 */
export interface YamlRequirements {
  prdRef?: string;
  items?: string[];
  acceptance?: string[];
  techSpec?: string[];
  dataModel?: string[];
  apiSpec?: string[];
  uiSpec?: string[];
}

/**
 * Task 실행 정보
 */
export interface YamlExecution {
  command?: string;
  startedAt?: string;
}

/**
 * Task
 */
export interface YamlTask {
  id: string;
  title: string;
  category?: string;
  domain?: string;
  status?: string;        // "[xx]", "[im]", "[dd]" 등
  priority?: string;
  assignee?: string;
  schedule?: string;
  tags?: string[];
  depends?: string[];
  blockedBy?: string | null;
  testResult?: string | null;
  note?: string | null;
  requirements?: YamlRequirements;
  completed?: Record<string, string>;  // { bd: "2025-12-15 10:30", dd: "2025-12-15 14:20" }
  execution?: YamlExecution;
  workflow?: string;  // "quick", "develop", "force"
}
