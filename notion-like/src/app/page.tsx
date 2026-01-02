'use client';

import { MainLayout } from '@/components/layout/MainLayout';

export default function Home() {
  return (
    <MainLayout sidebar={<div className="p-4"><h2>Sidebar</h2></div>}>
      <div className="p-4">
        <h1>Orchay Notes</h1>
        <p>Notion-like block-based workspace application</p>
      </div>
    </MainLayout>
  );
}
