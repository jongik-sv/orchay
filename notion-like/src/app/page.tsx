'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';

export default function Home() {
  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="p-4">
        <h1>Orchay Notes</h1>
        <p>Notion-like block-based workspace application</p>
      </div>
    </MainLayout>
  );
}
