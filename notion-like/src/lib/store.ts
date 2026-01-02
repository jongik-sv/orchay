import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Page {
  id: string;
  title: string;
  icon: string;
  parentId?: string | null;
  children?: Page[] | undefined;
  is_favorite: boolean;
  sort_order: number;
  createdAt: string;
  updatedAt: string;
}

export type PageWithRequired = Required<Omit<Page, 'parentId' | 'children'>> &
  Pick<Page, 'parentId' | 'children'>;

interface AppStore {
  // UI 상태
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // 페이지 상태
  currentPageId: string | null;
  setCurrentPageId: (id: string | null) => void;

  // 페이지 목록 캐시
  pageCache: Page[];
  setPageCache: (pages: Page[]) => void;
  addPageCache: (page: Page) => void;
  removePageCache: (pageId: string) => void;

  // 폴더 확장 상태
  expandedFolders: Set<string>;
  toggleFolderExpanded: (folderId: string) => void;
  setExpandedFolders: (folderIds: string[]) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // UI 상태
      sidebarOpen: true,
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // 페이지 상태
      currentPageId: null,
      setCurrentPageId: (id: string | null) =>
        set(() => ({ currentPageId: id })),

      // 페이지 목록 캐시
      pageCache: [],
      setPageCache: (pages: Page[]) =>
        set(() => ({ pageCache: pages })),
      addPageCache: (page: Page) =>
        set((state) => ({
          pageCache: [...state.pageCache, page],
        })),
      removePageCache: (pageId: string) =>
        set((state) => ({
          pageCache: state.pageCache.filter((page) => page.id !== pageId),
        })),

      // 폴더 확장 상태
      expandedFolders: new Set<string>(),
      toggleFolderExpanded: (folderId: string) =>
        set((state) => {
          const newExpanded = new Set(state.expandedFolders);
          if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId);
          } else {
            newExpanded.add(folderId);
          }
          return { expandedFolders: newExpanded };
        }),
      setExpandedFolders: (folderIds: string[]) =>
        set(() => ({
          expandedFolders: new Set(folderIds),
        })),
    }),
    {
      name: 'app-store',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        expandedFolders: Array.from(state.expandedFolders),
      }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<AppStore>),
        expandedFolders: new Set(
          persistedState?.expandedFolders || []
        ),
      }),
    }
  )
);
