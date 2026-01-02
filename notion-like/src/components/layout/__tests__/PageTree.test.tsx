import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PageTree } from '../PageTree';
import { useAppStore } from '@/lib/store';

// Mock store
vi.mock('@/lib/store', async () => {
  const actual = await vi.importActual('@/lib/store');
  return {
    ...actual,
    useAppStore: vi.fn(),
  };
});

const mockPages = [
  {
    id: 'page-1',
    title: 'Dashboard',
    icon: '📄',
    createdAt: '2026-01-02',
    updatedAt: '2026-01-02',
    children: [
      {
        id: 'page-1-1',
        title: 'Q1 Analytics',
        icon: '📊',
        parentId: 'page-1',
        createdAt: '2026-01-02',
        updatedAt: '2026-01-02',
      },
      {
        id: 'page-1-2',
        title: 'Monthly Report',
        icon: '📈',
        parentId: 'page-1',
        createdAt: '2026-01-02',
        updatedAt: '2026-01-02',
      },
    ],
  },
  {
    id: 'page-2',
    title: 'Projects',
    icon: '📁',
    createdAt: '2026-01-02',
    updatedAt: '2026-01-02',
  },
];

describe('PageTree Component', () => {
  beforeEach(() => {
    const mockStore = {
      expandedFolders: new Set<string>(),
      toggleFolder: vi.fn(),
      setCurrentPageId: vi.fn(),
      sidebarOpen: true,
      toggleSidebar: vi.fn(),
      pages: mockPages,
      setPages: vi.fn(),
      currentPageId: null,
    };

    (useAppStore as any).mockReturnValue(mockStore);
  });

  it('페이지 목록을 렌더링해야 함', () => {
    render(<PageTree pages={mockPages} />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('하위 페이지가 없을 때 토글 버튼을 표시하지 않아야 함', () => {
    render(<PageTree pages={mockPages} />);

    const projectsItem = screen.getByTestId('page-tree-item-page-2');
    const toggleBtn = projectsItem.querySelector('[data-testid="toggle-btn-page-2"]');

    // Projects 페이지는 하위 페이지가 없으므로 토글 버튼이 없어야 함
    expect(toggleBtn).not.toBeInTheDocument();
  });

  it('하위 페이지가 있을 때 토글 버튼을 표시해야 함', () => {
    const mockStore = {
      expandedFolders: new Set<string>(),
      toggleFolder: vi.fn(),
      setCurrentPageId: vi.fn(),
      sidebarOpen: true,
      toggleSidebar: vi.fn(),
      pages: mockPages,
      setPages: vi.fn(),
      currentPageId: null,
    };

    (useAppStore as any).mockReturnValue(mockStore);

    render(<PageTree pages={mockPages} />);

    const dashboardItem = screen.getByTestId('page-tree-item-page-1');
    const toggleBtn = dashboardItem.querySelector('[data-testid="toggle-btn-page-1"]');

    // Dashboard 페이지는 하위 페이지가 있으므로 토글 버튼이 있어야 함
    expect(toggleBtn).toBeInTheDocument();
  });

  it('폴더 토글 시 toggleFolder 함수를 호출해야 함', () => {
    const mockToggleFolder = vi.fn();
    const mockStore = {
      expandedFolders: new Set<string>(),
      toggleFolder: mockToggleFolder,
      setCurrentPageId: vi.fn(),
      sidebarOpen: true,
      toggleSidebar: vi.fn(),
      pages: mockPages,
      setPages: vi.fn(),
      currentPageId: null,
    };

    (useAppStore as any).mockReturnValue(mockStore);

    render(<PageTree pages={mockPages} />);

    const toggleBtn = screen.getByTestId('toggle-btn-page-1');
    fireEvent.click(toggleBtn);

    expect(mockToggleFolder).toHaveBeenCalledWith('page-1');
  });

  it('페이지 아이템 클릭 시 setCurrentPageId 함수를 호출해야 함', () => {
    const mockSetCurrentPageId = vi.fn();
    const mockStore = {
      expandedFolders: new Set<string>(),
      toggleFolder: vi.fn(),
      setCurrentPageId: mockSetCurrentPageId,
      sidebarOpen: true,
      toggleSidebar: vi.fn(),
      pages: mockPages,
      setPages: vi.fn(),
      currentPageId: null,
    };

    (useAppStore as any).mockReturnValue(mockStore);

    render(<PageTree pages={mockPages} />);

    const pageItem = screen.getByTestId('page-tree-item-page-1');
    fireEvent.click(pageItem);

    expect(mockSetCurrentPageId).toHaveBeenCalledWith('page-1');
  });

  it('빈 페이지 목록을 처리해야 함', () => {
    const { container } = render(<PageTree pages={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('재귀적으로 하위 페이지를 렌더링해야 함', () => {
    const mockStore = {
      expandedFolders: new Set(['page-1']),
      toggleFolder: vi.fn(),
      setCurrentPageId: vi.fn(),
      sidebarOpen: true,
      toggleSidebar: vi.fn(),
      pages: mockPages,
      setPages: vi.fn(),
      currentPageId: null,
    };

    (useAppStore as any).mockReturnValue(mockStore);

    render(<PageTree pages={mockPages} />);

    // Dashboard가 확장되어 하위 페이지들이 표시되어야 함
    expect(screen.getByText('Q1 Analytics')).toBeInTheDocument();
    expect(screen.getByText('Monthly Report')).toBeInTheDocument();
  });

  it('들여쓰기가 depth에 따라 올바르게 계산되어야 함', () => {
    const mockStore = {
      expandedFolders: new Set(['page-1']),
      toggleFolder: vi.fn(),
      setCurrentPageId: vi.fn(),
      sidebarOpen: true,
      toggleSidebar: vi.fn(),
      pages: mockPages,
      setPages: vi.fn(),
      currentPageId: null,
    };

    (useAppStore as any).mockReturnValue(mockStore);

    const { container } = render(<PageTree pages={mockPages} />);

    // depth 0: paddingLeft = 0 * 12 + 8 = 8px
    const rootItems = container.querySelectorAll('[style*="8px"]');
    expect(rootItems.length).toBeGreaterThan(0);
  });
});
