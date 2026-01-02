'use client';

import { useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAppStore, type Page } from '@/lib/store';

// 목 데이터 (개발용)
const mockPages: Page[] = [
  {
    id: 'page-1',
    title: 'Dashboard',
    icon: '📄',
    is_favorite: false,
    sort_order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children: [
      {
        id: 'page-1-1',
        title: 'Q1 Analytics',
        icon: '📊',
        parentId: 'page-1',
        is_favorite: false,
        sort_order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        children: [
          {
            id: 'page-1-1-1',
            title: 'Q1 Revenue Report',
            icon: '💰',
            parentId: 'page-1-1',
            is_favorite: false,
            sort_order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      {
        id: 'page-1-2',
        title: 'Monthly Report',
        icon: '📈',
        parentId: 'page-1',
        is_favorite: false,
        sort_order: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'page-2',
    title: 'Projects',
    icon: '📁',
    is_favorite: false,
    sort_order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children: [
      {
        id: 'page-2-1',
        title: 'Orchay Notes',
        icon: '🚀',
        parentId: 'page-2',
        is_favorite: false,
        sort_order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'page-2-2',
        title: 'Website Redesign',
        icon: '🎨',
        parentId: 'page-2',
        is_favorite: false,
        sort_order: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'page-3',
    title: 'Archive',
    icon: '📦',
    is_favorite: false,
    sort_order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function Home() {
  const { setPageCache } = useAppStore();

  useEffect(() => {
    // 초기 페이지 데이터 로드
    setPageCache(mockPages);
  }, [setPageCache]);

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-2">Orchay Notes</h1>
        <p className="text-gray-600">
          Notion-like block-based workspace application
        </p>
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="font-semibold text-blue-900 mb-2">개발 안내</h2>
          <p className="text-sm text-blue-800">
            왼쪽 사이드바에서 페이지를 선택하여 탐색할 수 있습니다. 폴더를 클릭하면 하위 페이지를 확인할 수
            있습니다.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
