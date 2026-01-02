'use client';

import { useEffect, useRef, useState } from 'react';
import {
  EMOJI_CATEGORIES,
  EMOJI_GRID_COLUMNS,
  getRecentEmojis,
  saveRecentEmoji,
} from './emojiData';

export interface IconPickerProps {
  isOpen: boolean;
  onIconSelect: (emoji: string) => void;
  onClose: () => void;
  position?: 'top' | 'bottom';
}

/**
 * IconPicker Component
 *
 * Displays a dropdown with emoji categories and recent emojis.
 * Supports clicking outside and ESC key to close.
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <IconPicker
 *   isOpen={isOpen}
 *   onIconSelect={(emoji) => {
 *     setPageIcon(emoji);
 *     setIsOpen(false);
 *   }}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */
export function IconPicker({
  isOpen,
  onIconSelect,
  onClose,
  position = 'bottom',
}: IconPickerProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  // Load recent emojis on mount
  useEffect(() => {
    setRecentEmojis(getRecentEmojis());
  }, []);

  // Handle outside click and ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  const handleEmojiClick = (emoji: string) => {
    saveRecentEmoji(emoji);
    setRecentEmojis(getRecentEmojis());
    onIconSelect(emoji);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      data-testid="icon-picker"
      className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} z-50 bg-white rounded-lg shadow-lg border border-gray-200`}
      style={{
        minWidth: '320px',
        maxHeight: '400px',
        overflow: 'auto',
      }}
    >
      {/* Recent Emojis Section */}
      {recentEmojis.length > 0 && (
        <div data-testid="recent-emojis-section" className="border-b border-gray-200">
          <div className="px-2 py-2">
            <div
              className="text-xs font-bold text-gray-600 uppercase px-2 py-1"
              style={{ fontSize: '12px', color: '#999' }}
            >
              Recent
            </div>
            <div
              className="grid gap-1 p-2"
              style={{
                gridTemplateColumns: `repeat(${EMOJI_GRID_COLUMNS}, 1fr)`,
              }}
            >
              {recentEmojis.map((emoji, index) => (
                <button
                  key={`recent-${index}`}
                  data-testid={`emoji-button-recent-${index}`}
                  onClick={() => handleEmojiClick(emoji)}
                  className="hover:bg-gray-200 active:bg-gray-300 rounded transition-colors"
                  style={{
                    width: '40px',
                    height: '40px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={`Select ${emoji}`}
                  aria-label={`Select emoji ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Emoji Categories */}
      {EMOJI_CATEGORIES.map((category) => (
        <div key={category.id} data-testid="emoji-category" className="border-b last:border-b-0">
          <div className="px-2 py-2">
            <div
              className="text-xs font-bold text-gray-600 uppercase px-2 py-1"
              style={{ fontSize: '12px', color: '#999' }}
            >
              {category.name}
            </div>
            <div
              className="grid gap-1 p-2"
              style={{
                gridTemplateColumns: `repeat(${EMOJI_GRID_COLUMNS}, 1fr)`,
              }}
            >
              {category.emojis.map((emoji, index) => (
                <button
                  key={`${category.id}-${index}`}
                  data-testid={`emoji-button-${category.id}-${index}`}
                  onClick={() => handleEmojiClick(emoji)}
                  className="hover:bg-gray-200 active:bg-gray-300 rounded transition-colors"
                  style={{
                    width: '40px',
                    height: '40px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={`Select ${emoji}`}
                  aria-label={`Select emoji ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
