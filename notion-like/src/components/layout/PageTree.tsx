'use client';

import { Page, useAppStore } from '@/lib/store';
import { PageTreeItem } from './PageTreeItem';

interface PageTreeProps {
  pages: Page[];
  depth?: number;
}

export function PageTree({ pages, depth = 0 }: PageTreeProps) {
  const { expandedFolders, toggleFolderExpanded, setCurrentPageId } = useAppStore();

  const handleSelect = (pageId: string) => {
    setCurrentPageId(pageId);
    console.log(`Navigate to page: ${pageId}`);
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
        />
      ))}
    </div>
  );
}
