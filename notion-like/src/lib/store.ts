import { create } from 'zustand';

export interface Page {
  id: string;
  title: string;
  icon: string;
  parentId?: string;
  children?: Page[];
  createdAt: string;
  updatedAt: string;
}

interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // 페이지 트리 상태
  pages: Page[];
  setPages: (pages: Page[]) => void;
  expandedFolders: Set<string>;
  toggleFolder: (folderId: string) => void;
  currentPageId: string | null;
  setCurrentPageId: (pageId: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  pages: [],
  setPages: (pages: Page[]) =>
    set(() => ({ pages })),

  expandedFolders: new Set<string>(),
  toggleFolder: (folderId: string) =>
    set((state) => {
      const newExpanded = new Set(state.expandedFolders);
      if (newExpanded.has(folderId)) {
        newExpanded.delete(folderId);
      } else {
        newExpanded.add(folderId);
      }
      return { expandedFolders: newExpanded };
    }),

  currentPageId: null,
  setCurrentPageId: (pageId: string | null) =>
    set(() => ({ currentPageId: pageId })),
}));
