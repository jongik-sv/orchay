import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MainLayout } from '../MainLayout';
import { useAppStore } from '@/lib/store';

describe('MainLayout', () => {
  beforeEach(() => {
    useAppStore.setState({ sidebarOpen: true });
  });

  it('should render sidebar and editor area', () => {
    render(
      <MainLayout sidebar={<div data-testid="sidebar-content">Sidebar</div>}>
        <div data-testid="editor-content">Editor Content</div>
      </MainLayout>
    );

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('editor-area')).toBeInTheDocument();
    expect(screen.getByText('Sidebar')).toBeInTheDocument();
    expect(screen.getByText('Editor Content')).toBeInTheDocument();
  });

  it('should toggle sidebar visibility', async () => {
    const { rerender } = render(
      <MainLayout sidebar={<div data-testid="sidebar-content">Sidebar</div>}>
        <div data-testid="editor-content">Content</div>
      </MainLayout>
    );

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();

    // 토글 버튼 클릭 시뮬레이션
    useAppStore.setState({ sidebarOpen: false });

    // 컴포넌트 리렌더링
    rerender(
      <MainLayout sidebar={<div data-testid="sidebar-content">Sidebar</div>}>
        <div data-testid="editor-content">Content</div>
      </MainLayout>
    );

    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-open-btn')).toBeInTheDocument();
  });

  it('should have sidebar width of 240px', () => {
    render(
      <MainLayout sidebar={<div>Sidebar</div>}>
        <div>Content</div>
      </MainLayout>
    );

    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toHaveClass('w-[240px]');
  });
});
