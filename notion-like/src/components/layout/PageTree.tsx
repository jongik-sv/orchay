'use client';

import { useRouter } from 'next/navigation';
import { Page, useAppStore } from '@/lib/store';
import { PageTreeItem } from './PageTreeItem';

interface PageTreeProps {
  pages: Page[];
  depth?: number;
  onAddSubpage?: (parentId: string) => void;
  onDeletePage?: (pageId: string) => void;
}

export function PageTree({ pages, depth = 0, onAddSubpage, onDeletePage }: PageTreeProps) {
  const router = useRouter();
  const { expandedFolders, toggleFolderExpanded, setCurrentPageId } = useAppStore();

  const handleSelect = (pageId: string) => {
    setCurrentPageId(pageId);
    router.push(`/${pageId}`);
  };

  if (!pages || pages.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-0" data-testid="page-tree">
      {pages.map((page) => (
        <PageTreeItem
          key={page.id}
          page={page}
          depth={depth}
          isExpanded={expandedFolders.has(page.id)}
          onToggleExpand={() => toggleFolderExpanded(page.id)}
          onSelect={handleSelect}
          onAddSubpage={onAddSubpage}
          onDeletePage={onDeletePage}
        />
      ))}
    </div>
  );
}
