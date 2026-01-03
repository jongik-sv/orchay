'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Menu, X } from 'lucide-react';

interface MainLayoutProps {
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  onPageSelect?: () => void;
}

const MOBILE_BREAKPOINT = 768;

export function MainLayout({ sidebar, children, onPageSelect }: MainLayoutProps) {
  const {
    sidebarOpen,
    toggleSidebar,
    mobileSidebarOpen,
    openMobileSidebar,
    closeMobileSidebar
  } = useAppStore();

  const [isMobile, setIsMobile] = useState(false);

  // 뷰포트 크기 감지
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
      setIsMobile(mobile);
      // 모바일에서 데스크톱으로 전환 시 모바일 사이드바 닫기
      if (!mobile && mobileSidebarOpen) {
        closeMobileSidebar();
      }
    };

    checkMobile();

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mediaQuery.addEventListener('change', checkMobile);

    return () => mediaQuery.removeEventListener('change', checkMobile);
  }, [mobileSidebarOpen, closeMobileSidebar]);

  // Esc 키로 모바일 사이드바 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobile && mobileSidebarOpen) {
        closeMobileSidebar();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, mobileSidebarOpen, closeMobileSidebar]);

  // 페이지 선택 시 모바일 사이드바 자동 닫기
  useEffect(() => {
    if (onPageSelect && isMobile) {
      closeMobileSidebar();
    }
  }, [onPageSelect, isMobile, closeMobileSidebar]);

  // 모바일 여부에 따른 사이드바 표시 로직
  const shouldShowSidebar = isMobile
    ? mobileSidebarOpen
    : sidebarOpen;

  // 모바일 메뉴 버튼 표시 여부
  const showMobileMenuBtn = isMobile && !mobileSidebarOpen;
  const showDesktopMenuBtn = !isMobile && !sidebarOpen;

  return (
    <div className="flex h-screen" data-testid="main-layout">
      {/* 모바일 배경 오버레이 */}
      {isMobile && mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-200"
          data-testid="sidebar-backdrop"
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      {/* 사이드바 영역 */}
      {shouldShowSidebar && (
        <aside
          className={`
            w-[240px] h-screen bg-[var(--notion-bg-secondary)] flex flex-col border-r border-[var(--notion-border-light)] flex-shrink-0
            ${isMobile
              ? 'fixed left-0 top-0 z-50 shadow-xl transition-transform duration-200'
              : ''
            }
          `}
          data-testid="sidebar"
        >
          {/* 모바일에서 닫기 버튼 */}
          {isMobile && (
            <div className="flex justify-end p-2 border-b border-[var(--notion-border-light)]">
              <button
                onClick={closeMobileSidebar}
                className="p-1.5 rounded hover:bg-[var(--notion-bg-tertiary)] transition-colors"
                aria-label="사이드바 닫기"
                data-testid="mobile-close-btn"
              >
                <X className="w-5 h-5 text-[var(--notion-text-tertiary)]" />
              </button>
            </div>
          )}
          {sidebar}
        </aside>
      )}

      {/* 에디터 영역 */}
      <main className="flex-1 h-screen overflow-auto relative" data-testid="editor-area">
        {/* 모바일 햄버거 메뉴 버튼 */}
        {showMobileMenuBtn && (
          <button
            onClick={openMobileSidebar}
            className="absolute top-3 left-3 p-1.5 rounded hover:bg-[var(--notion-bg-tertiary)] transition-colors z-10"
            aria-label="사이드바 열기"
            data-testid="mobile-menu-btn"
          >
            <Menu className="w-5 h-5 text-[var(--notion-text-tertiary)]" />
          </button>
        )}

        {/* 데스크톱 사이드바 접힘 시 토글 버튼 */}
        {showDesktopMenuBtn && (
          <button
            onClick={toggleSidebar}
            className="absolute top-3 left-3 p-1.5 rounded hover:bg-[var(--notion-bg-tertiary)] transition-colors z-10"
            aria-label="사이드바 열기"
            data-testid="sidebar-open-btn"
          >
            <Menu className="w-5 h-5 text-[var(--notion-text-tertiary)]" />
          </button>
        )}

        {children}
      </main>
    </div>
  );
}
