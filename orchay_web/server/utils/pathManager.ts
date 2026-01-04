/**
 * PathManager 싱글톤
 * Task: 홈 디렉토리 선택 기능
 *
 * 동적 경로 관리를 위한 싱글톤 클래스입니다.
 * 기존 ORCHAY_ROOT 상수를 대체하여 런타임에 경로 변경이 가능합니다.
 *
 * @example
 * ```typescript
 * import { pathManager } from './pathManager';
 *
 * // 현재 경로 조회
 * const root = pathManager.orchayRoot;
 *
 * // 경로 변경
 * pathManager.setBasePath('/new/path');
 *
 * // 변경 리스너 등록
 * const unsubscribe = pathManager.onPathChange(() => {
 *   console.log('Path changed!');
 * });
 * ```
 */

import { join, normalize, isAbsolute } from 'path';
import { existsSync } from 'fs';
import { validateBasePath } from './validators/pathValidators';

/**
 * 경로 변경 리스너 타입
 */
type PathChangeListener = () => void;

/**
 * PathManager 클래스
 * 싱글톤 패턴으로 구현된 동적 경로 관리자
 */
class PathManager {
  private static instance: PathManager;
  private _basePath: string;
  private _listeners: Set<PathChangeListener> = new Set();

  /**
   * 생성자 (private - 싱글톤)
   */
  private constructor() {
    this._basePath = this.resolveInitialPath();
    console.log(`[PathManager] Initialized with basePath: ${this._basePath}`);
  }

  /**
   * 싱글톤 인스턴스 반환
   */
  static getInstance(): PathManager {
    if (!PathManager.instance) {
      PathManager.instance = new PathManager();
    }
    return PathManager.instance;
  }

  /**
   * 초기 경로 결정
   * 우선순위: 환경변수 → process.cwd()
   */
  private resolveInitialPath(): string {
    // 1. 환경변수 확인
    const envPath = process.env.ORCHAY_BASE_PATH;
    if (envPath && isAbsolute(envPath)) {
      const normalized = normalize(envPath);
      console.log(`[PathManager] Using ORCHAY_BASE_PATH: ${normalized}`);
      return normalized;
    }

    // 2. 현재 디렉토리 사용 (호출 폴더)
    const cwd = process.cwd();
    console.log(`[PathManager] Using cwd: ${cwd}`);
    return cwd;
  }

  /**
   * 기본 경로 (basePath) 반환
   * .orchay의 부모 디렉토리
   */
  get basePath(): string {
    return this._basePath;
  }

  /**
   * .orchay 루트 경로 반환
   */
  get orchayRoot(): string {
    return join(this._basePath, '.orchay');
  }

  /**
   * 설정 폴더 경로 반환
   */
  get settingsPath(): string {
    return join(this.orchayRoot, 'settings');
  }

  /**
   * 프로젝트 폴더 경로 반환
   */
  get projectsPath(): string {
    return join(this.orchayRoot, 'projects');
  }

  /**
   * 템플릿 폴더 경로 반환
   */
  get templatesPath(): string {
    return join(this.orchayRoot, 'templates');
  }

  /**
   * 기본 경로 변경 (Hot reload 핵심)
   *
   * @param newPath - 새 기본 경로 (절대 경로)
   * @throws 경로가 유효하지 않으면 에러
   */
  setBasePath(newPath: string): void {
    // 보안 검증
    const validation = validateBasePath(newPath);
    if (!validation.valid) {
      throw new Error(`Invalid path: ${validation.error}`);
    }

    const normalized = normalize(newPath);

    // 동일 경로면 무시
    if (this._basePath === normalized) {
      console.log(`[PathManager] Path unchanged: ${normalized}`);
      return;
    }

    const previousPath = this._basePath;
    this._basePath = normalized;

    // 환경변수 동기화
    process.env.ORCHAY_BASE_PATH = normalized;

    console.log(`[PathManager] Path changed: ${previousPath} → ${normalized}`);

    // 리스너에 변경 알림
    this.notifyListeners();
  }

  /**
   * 경로 변경 리스너 등록
   *
   * @param listener - 경로 변경 시 호출될 콜백
   * @returns 리스너 해제 함수
   */
  onPathChange(listener: PathChangeListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * 모든 리스너에 변경 알림
   */
  private notifyListeners(): void {
    console.log(`[PathManager] Notifying ${this._listeners.size} listeners`);
    this._listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('[PathManager] Listener error:', error);
      }
    });
  }

  /**
   * 현재 .orchay가 초기화되어 있는지 확인
   */
  isInitialized(): boolean {
    return existsSync(this.orchayRoot);
  }

  /**
   * 경로 초기화 (테스트용)
   * 주의: 프로덕션에서는 사용하지 마세요
   */
  reset(): void {
    this._basePath = this.resolveInitialPath();
    this.notifyListeners();
  }
}

/**
 * PathManager 싱글톤 인스턴스
 */
export const pathManager = PathManager.getInstance();
