'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Inbox, Settings, ChevronDown, Plus, Sun, Moon } from 'lucide-react';
import { Page, useAppStore } from '@/lib/store';
import { PageTree } from './PageTree';
import { FavoritesList } from './FavoritesList';
import { SearchModal } from '../ui/SearchModal';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}

interface SectionHeaderProps {
  label: string;
}

function SidebarItem({ icon, label, shortcut, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-[14px] text-[var(--notion-text-primary)] rounded-[4px] hover:bg-[var(--notion-bg-tertiary)] transition-colors duration-[20ms] cursor-pointer"
    >
      <div className="w-4 h-4 text-[var(--notion-text-tertiary)] flex-shrink-0">{icon}</div>
      <span className="flex-1 text-left">{label}</span>
      {shortcut && <span className="text-[12px] text-[var(--notion-text-tertiary)] ml-auto">{shortcut}</span>}
    </button>
  );
}

function SectionHeader({ label }: SectionHeaderProps) {
  return (
    <div className="px-3 py-1 text-[12px] font-medium text-[var(--notion-text-tertiary)] uppercase tracking-wide">
      {label}
    </div>
  );
}

/**
 * DB API 응답을 Store Page 타입으로 변환
 */
function mapApiToStorePage(apiPage: {
  id: string;
  title: string;
  icon?: string | null;
  parentId?: string | null;
  isFavorite?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}): Page {
  return {
    id: apiPage.id,
    title: apiPage.title,
    icon: apiPage.icon || '📄',
    parentId: apiPage.parentId,
    is_favorite: apiPage.isFavorite ?? false,
    sort_order: apiPage.sortOrder ?? 0,
    createdAt: apiPage.createdAt || new Date().toISOString(),
    updatedAt: apiPage.updatedAt || new Date().toISOString(),
  };
}

/**
 * 플랫 페이지 목록을 트리 구조로 변환
 */
function buildPageTree(pages: Page[]): Page[] {
  const pageMap = new Map<string, Page>();
  const rootPages: Page[] = [];

  // 모든 페이지를 맵에 저장
  pages.forEach((page) => {
    pageMap.set(page.id, { ...page, children: [] });
  });

  // 트리 구조 구성
  pages.forEach((page) => {
    const currentPage = pageMap.get(page.id)!;
    if (page.parentId) {
      const parentPage = pageMap.get(page.parentId);
      if (parentPage) {
        parentPage.children = parentPage.children || [];
        parentPage.children.push(currentPage);
      } else {
        // 부모 없으면 루트로
        rootPages.push(currentPage);
      }
    } else {
      rootPages.push(currentPage);
    }
  });

  return rootPages;
}

/**
 * ClientSidebar - API 연동된 사이드바 컴포넌트
 */
export function ClientSidebar() {
  const router = useRouter();
  const {
    pageCache,
    setPageCache,
    addPageCache,
    removePageCache,
    currentPageId,
    setCurrentPageId,
    toggleFolderExpanded,
    setExpandedFolders,
  } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Initialize theme from localStorage or system preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    } else {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(systemDark ? 'dark' : 'light');
      if (systemDark) {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  // 페이지 목록 로드
  const loadPages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/pages');
      if (!response.ok) {
        throw new Error('Failed to load pages');
      }

      const data = await response.json();
      const pages = data.map(mapApiToStorePage);
      setPageCache(pages);
    } catch (err) {
      console.error('[ClientSidebar] Failed to load pages:', err);
      setError('페이지 목록을 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [setPageCache]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  // 새 페이지 생성
  const handleNewPage = useCallback(async (parentId?: string) => {
    try {
      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parentId ? { parentId } : {}),
      });

      if (!response.ok) {
        throw new Error('Failed to create page');
      }

      const newPage = await response.json();
      const storePage = mapApiToStorePage(newPage);

      // 스토어에 추가
      addPageCache(storePage);

      // 부모 페이지가 있으면 펼치기
      if (parentId) {
        toggleFolderExpanded(parentId);
      }

      // 새 페이지로 이동
      setCurrentPageId(storePage.id);
      router.push(`/${storePage.id}`);
    } catch (err) {
      console.error('[ClientSidebar] Failed to create page:', err);
      alert('페이지 생성에 실패했습니다.');
    }
  }, [addPageCache, toggleFolderExpanded, setCurrentPageId, router]);

  // 페이지 삭제
  const handleDeletePage = useCallback(async (pageId: string) => {
    try {
      const response = await fetch(`/api/pages/${pageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete page');
      }

      // 스토어에서 제거 (하위 페이지도 제거)
      const pagesToRemove = [pageId];
      const findChildren = (pid: string) => {
        pageCache.forEach((p) => {
          if (p.parentId === pid) {
            pagesToRemove.push(p.id);
            findChildren(p.id);
          }
        });
      };
      findChildren(pageId);

      pagesToRemove.forEach((pid) => removePageCache(pid));

      // 현재 페이지가 삭제된 경우 다른 페이지로 이동
      if (currentPageId && pagesToRemove.includes(currentPageId)) {
        const remainingPages = pageCache.filter((p) => !pagesToRemove.includes(p.id));
        if (remainingPages.length > 0) {
          const firstPage = remainingPages.find((p) => !p.parentId) || remainingPages[0];
          setCurrentPageId(firstPage.id);
          router.push(`/${firstPage.id}`);
        } else {
          setCurrentPageId(null);
          router.push('/');
        }
      }
    } catch (err) {
      console.error('[ClientSidebar] Failed to delete page:', err);
      alert('페이지 삭제에 실패했습니다.');
    }
  }, [pageCache, removePageCache, currentPageId, setCurrentPageId, router]);

  // 즐겨찾기 토글
  const handleToggleFavorite = useCallback(async (pageId: string, isFavorite: boolean) => {
    try {
      const response = await fetch(`/api/pages/${pageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: isFavorite }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle favorite');
      }

      // 스토어 업데이트
      const updatedPages = pageCache.map((p) =>
        p.id === pageId ? { ...p, is_favorite: isFavorite } : p
      );
      setPageCache(updatedPages);
    } catch (err) {
      console.error('[ClientSidebar] Failed to toggle favorite:', err);
      alert('즐겨찾기 변경에 실패했습니다.');
    }
  }, [pageCache, setPageCache]);

  const handleSearchClick = useCallback(() => setSearchOpen(true), []);
  const handleUpdatesClick = () => console.log('Updates clicked');
  const handleSettingsClick = () => console.log('Settings clicked');
  const handleWorkspaceClick = () => console.log('Workspace menu clicked');

  // 전역 Cmd+K 단축키 이벤트 리스너
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 트리 구조로 변환
  const pageTree = buildPageTree(pageCache);
  const favoritePages = pageCache.filter((p) => p.is_favorite);

  return (
    <>
      {/* 검색 모달 */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      <div className="h-full flex flex-col">
      {/* Workspace Header */}
      <button
        onClick={handleWorkspaceClick}
        className="px-3 py-3 flex items-center justify-between hover:bg-[var(--notion-bg-tertiary)] cursor-pointer rounded-[4px] mx-2 mt-1 transition-colors duration-[20ms]"
      >
        <span className="text-[14px] font-semibold text-[var(--notion-text-primary)]">🏠 Orchay Notes</span>
        <ChevronDown className="w-4 h-4 text-[var(--notion-text-tertiary)]" />
      </button>

      {/* Quick Actions */}
      <div className="px-2 py-1 space-y-0.5">
        <SidebarItem
          icon={<Search />}
          label="Search"
          shortcut="⌘K"
          onClick={handleSearchClick}
        />
        <SidebarItem icon={<Inbox />} label="Updates" onClick={handleUpdatesClick} />
        <SidebarItem
          icon={<Settings />}
          label="Settings & members"
          onClick={handleSettingsClick}
        />
      </div>

      {/* Page Tree Area */}
      <div className="flex-1 overflow-auto px-2 py-2 space-y-1 border-t border-[var(--notion-border-light)]">
        {/* Favorites Section */}
        <SectionHeader label="Favorites" />
        <FavoritesList
          favorites={favoritePages}
          onToggleFavorite={handleToggleFavorite}
        />

        {/* Private Section */}
        <SectionHeader label="Private" />
        {loading ? (
          <div className="px-3 py-2 text-sm text-[var(--notion-text-tertiary)]">불러오는 중...</div>
        ) : error ? (
          <div className="px-3 py-2 text-sm text-red-500">{error}</div>
        ) : pageTree.length === 0 ? (
          <div className="px-3 py-2 text-sm text-[var(--notion-text-tertiary)]">
            페이지가 없습니다. 새 페이지를 만들어보세요.
          </div>
        ) : (
          <PageTree
            pages={pageTree}
            onAddSubpage={handleNewPage}
            onDeletePage={handleDeletePage}
          />
        )}
      </div>

      {/* New Page Button & Theme Toggle */}
      <div className="p-2 border-t border-[var(--notion-border-light)] space-y-1">
        <SidebarItem
          icon={theme === 'dark' ? <Sun /> : <Moon />}
          label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={toggleTheme}
        />
        <button
          onClick={() => handleNewPage()}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[14px] text-[var(--notion-text-primary)] rounded-[4px] hover:bg-[var(--notion-bg-tertiary)] transition-colors duration-[20ms] cursor-pointer"
          data-testid="new-page-btn"
        >
          <Plus className="w-4 h-4 text-[var(--notion-text-tertiary)]" />
          <span>New page</span>
        </button>
      </div>
    </div>
    </>
  );
}
