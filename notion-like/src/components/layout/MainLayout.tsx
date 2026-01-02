'use client';

import { useAppStore } from '@/lib/store';
import { Menu } from 'lucide-react';

interface MainLayoutProps {
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}

export function MainLayout({ sidebar, children }: MainLayoutProps) {
  const { sidebarOpen, toggleSidebar } = useAppStore();

  return (
    <div className="flex h-screen" data-testid="main-layout">
      {/* 사이드바 영역 */}
      {sidebarOpen && (
        <aside
          className="w-[240px] h-screen bg-[#F7F6F3] flex flex-col border-r border-[#E9E9E7] flex-shrink-0"
          data-testid="sidebar"
        >
          {sidebar}
        </aside>
      )}

      {/* 에디터 영역 */}
      <main className="flex-1 h-screen overflow-auto relative" data-testid="editor-area">
        {/* 사이드바 접힘 시 토글 버튼 */}
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="absolute top-3 left-3 p-1.5 rounded hover:bg-[#EFEFEF] transition-colors z-10"
            aria-label="사이드바 열기"
            data-testid="sidebar-open-btn"
          >
            <Menu className="w-5 h-5 text-[#787774]" />
          </button>
        )}
        {children}
      </main>
    </div>
  );
}
