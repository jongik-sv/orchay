'use client';

import { Search, Inbox, Settings, ChevronDown, Plus } from 'lucide-react';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}

interface SectionHeaderProps {
  label: string;
}

/**
 * SidebarItem - 재사용 가능한 사이드바 아이템
 */
function SidebarItem({ icon, label, shortcut, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-[14px] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEF] transition-colors duration-[20ms] cursor-pointer"
    >
      <div className="w-4 h-4 text-[#787774] flex-shrink-0">{icon}</div>
      <span className="flex-1 text-left">{label}</span>
      {shortcut && <span className="text-[12px] text-[#B4B4B3] ml-auto">{shortcut}</span>}
    </button>
  );
}

/**
 * SectionHeader - 페이지 트리 섹션 헤더
 */
function SectionHeader({ label }: SectionHeaderProps) {
  return (
    <div className="px-3 py-1 text-[12px] font-medium text-[#787774] uppercase tracking-wide">
      {label}
    </div>
  );
}

/**
 * Sidebar - 메인 사이드바 컴포넌트
 * Notion 스타일의 워크스페이스 네비게이션 및 페이지 트리 제공
 */
export function Sidebar() {
  const handleSearchClick = () => console.log('Search clicked');
  const handleUpdatesClick = () => console.log('Updates clicked');
  const handleSettingsClick = () => console.log('Settings clicked');
  const handleNewPageClick = () => console.log('New page clicked');
  const handleWorkspaceClick = () => console.log('Workspace menu clicked');

  return (
    <div className="w-[240px] h-screen bg-[#F7F6F3] flex flex-col border-r border-[#E9E9E7]">
      {/* Workspace Header */}
      <button
        onClick={handleWorkspaceClick}
        className="px-3 py-3 flex items-center justify-between hover:bg-[#EFEFEF] cursor-pointer rounded-[4px] mx-2 mt-1 transition-colors duration-[20ms]"
      >
        <span className="text-[14px] font-semibold text-[#37352F]">🏠 Orchay Notes</span>
        <ChevronDown className="w-4 h-4 text-[#787774]" />
      </button>

      {/* Quick Actions */}
      <div className="px-2 py-1 space-y-0.5">
        <SidebarItem
          icon={<Search />}
          label="Search"
          shortcut="⌘K"
          onClick={handleSearchClick}
        />
        <SidebarItem icon={<Inbox />} label="Updates" onClick={handleUpdatesClick} />
        <SidebarItem
          icon={<Settings />}
          label="Settings & members"
          onClick={handleSettingsClick}
        />
      </div>

      {/* Page Tree Area */}
      <div className="flex-1 overflow-auto px-2 py-2 space-y-1 border-t border-[#E9E9E7]">
        <SectionHeader label="Favorites" />
        {/* Placeholder for TSK-02-03 */}

        <SectionHeader label="Private" />
        {/* Placeholder for TSK-02-03 */}
      </div>

      {/* New Page Button */}
      <div className="p-2 border-t border-[#E9E9E7]">
        <button
          onClick={handleNewPageClick}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[14px] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEF] transition-colors duration-[20ms] cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#787774]" />
          <span>New page</span>
        </button>
      </div>
    </div>
  );
}
