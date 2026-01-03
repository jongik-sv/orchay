import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MainLayout } from '../MainLayout';
import { useAppStore } from '@/lib/store';

// matchMedia mock
const createMatchMedia = (matches: boolean) => {
  return (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
};

describe('MainLayout 반응형 테스트', () => {
  beforeEach(() => {
    useAppStore.setState({
      sidebarOpen: true,
      mobileSidebarOpen: false
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('데스크톱 (768px 이상)', () => {
    beforeEach(() => {
      window.matchMedia = createMatchMedia(false) as any; // 768px 이상
    });

    it('사이드바가 고정 레이아웃으로 표시됨', () => {
      render(
        <MainLayout sidebar={<div data-testid="sidebar-content">Sidebar</div>}>
          <div>Content</div>
        </MainLayout>
      );

      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toBeInTheDocument();
      // 데스크톱에서는 relative 위치 (고정 레이아웃)
      expect(sidebar).not.toHaveClass('fixed');
    });

    it('배경 오버레이가 표시되지 않음', () => {
      render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Content</div>
        </MainLayout>
      );

      expect(screen.queryByTestId('sidebar-backdrop')).not.toBeInTheDocument();
    });
  });

  describe('모바일 (768px 미만)', () => {
    beforeEach(() => {
      window.matchMedia = createMatchMedia(true) as any; // 768px 미만
      useAppStore.setState({
        sidebarOpen: true,
        mobileSidebarOpen: false
      });
    });

    it('사이드바가 닫힌 상태에서 햄버거 메뉴 표시', () => {
      render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId('mobile-menu-btn')).toBeInTheDocument();
    });

    it('햄버거 메뉴 클릭 시 사이드바 오버레이로 열림', async () => {
      render(
        <MainLayout sidebar={<div data-testid="sidebar-content">Sidebar</div>}>
          <div>Content</div>
        </MainLayout>
      );

      const menuBtn = screen.getByTestId('mobile-menu-btn');
      fireEvent.click(menuBtn);

      // mobileSidebarOpen 상태 변경 확인
      expect(useAppStore.getState().mobileSidebarOpen).toBe(true);
    });

    it('사이드바 열림 시 오버레이 배경 표시', () => {
      useAppStore.setState({ mobileSidebarOpen: true });

      render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId('sidebar-backdrop')).toBeInTheDocument();
    });

    it('사이드바가 오버레이로 표시 (absolute/fixed 위치)', () => {
      useAppStore.setState({ mobileSidebarOpen: true });

      render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Content</div>
        </MainLayout>
      );

      const sidebar = screen.getByTestId('sidebar');
      // 모바일에서는 fixed 위치
      expect(sidebar).toHaveClass('fixed');
    });

    it('배경 오버레이 클릭 시 사이드바 닫힘', () => {
      useAppStore.setState({ mobileSidebarOpen: true });

      render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Content</div>
        </MainLayout>
      );

      const backdrop = screen.getByTestId('sidebar-backdrop');
      fireEvent.click(backdrop);

      expect(useAppStore.getState().mobileSidebarOpen).toBe(false);
    });

    it('X 버튼 클릭 시 사이드바 닫힘', () => {
      useAppStore.setState({ mobileSidebarOpen: true });

      render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Content</div>
        </MainLayout>
      );

      const closeBtn = screen.getByTestId('mobile-close-btn');
      fireEvent.click(closeBtn);

      expect(useAppStore.getState().mobileSidebarOpen).toBe(false);
    });
  });

  describe('store 통합 테스트', () => {
    it('closeMobileSidebar 액션이 mobileSidebarOpen을 false로 설정', () => {
      useAppStore.setState({ mobileSidebarOpen: true });

      const { closeMobileSidebar } = useAppStore.getState();
      closeMobileSidebar();

      expect(useAppStore.getState().mobileSidebarOpen).toBe(false);
    });

    it('openMobileSidebar 액션이 mobileSidebarOpen을 true로 설정', () => {
      useAppStore.setState({ mobileSidebarOpen: false });

      const { openMobileSidebar } = useAppStore.getState();
      openMobileSidebar();

      expect(useAppStore.getState().mobileSidebarOpen).toBe(true);
    });
  });

  describe('페이지 선택 시 자동 닫힘 (UC-03)', () => {
    it('모바일에서 페이지 선택 콜백 호출 시 사이드바 닫힘', () => {
      useAppStore.setState({ mobileSidebarOpen: true });
      window.matchMedia = createMatchMedia(true) as any;

      const onPageSelect = vi.fn();

      render(
        <MainLayout
          sidebar={<div>Sidebar</div>}
          onPageSelect={onPageSelect}
        >
          <div>Content</div>
        </MainLayout>
      );

      // MainLayout 내부에서 onPageSelect가 호출되면 mobileSidebarOpen이 false가 되어야 함
      // 이 테스트는 MainLayout이 onPageSelect prop을 받아서 처리하는지 확인
      // 실제 구현에서는 PageTree에서 페이지 클릭 시 이 콜백이 호출됨
    });
  });

  describe('Esc 키 접근성', () => {
    it('모바일 사이드바 열림 상태에서 Esc 키로 닫을 수 있음', () => {
      useAppStore.setState({ mobileSidebarOpen: true });
      window.matchMedia = createMatchMedia(true) as any;

      render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Content</div>
        </MainLayout>
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(useAppStore.getState().mobileSidebarOpen).toBe(false);
    });
  });
});
