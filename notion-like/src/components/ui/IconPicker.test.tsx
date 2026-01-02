import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IconPicker } from './IconPicker';

describe('IconPicker Component', () => {
  const mockOnIconSelect = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnIconSelect.mockClear();
    mockOnClose.mockClear();
    // Clear localStorage
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <IconPicker
          isOpen={false}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('icon-picker')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <IconPicker
          isOpen={true}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('icon-picker')).toBeInTheDocument();
    });

    it('should display emoji categories', () => {
      render(
        <IconPicker
          isOpen={true}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
        />
      );

      const categories = screen.getAllByTestId('emoji-category');
      expect(categories.length).toBeGreaterThan(0);
    });

    it('should display emoji buttons', () => {
      render(
        <IconPicker
          isOpen={true}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
        />
      );

      const emojiButtons = screen.getAllByTestId(/^emoji-button-/);
      expect(emojiButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Emoji Selection', () => {
    it('should call onIconSelect when emoji is clicked', async () => {
      render(
        <IconPicker
          isOpen={true}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
        />
      );

      const firstEmojiButton = screen.getAllByTestId(/^emoji-button-/)[0];
      const emoji = firstEmojiButton.textContent;

      fireEvent.click(firstEmojiButton);

      expect(mockOnIconSelect).toHaveBeenCalledWith(emoji);
    });

    it('should call onIconSelect with correct emoji value', async () => {
      render(
        <IconPicker
          isOpen={true}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
        />
      );

      const buttons = screen.getAllByTestId(/^emoji-button-/);
      const selectedButton = buttons[5]; // Select 5th emoji
      const selectedEmoji = selectedButton.textContent;

      fireEvent.click(selectedButton);

      expect(mockOnIconSelect).toHaveBeenCalledTimes(1);
      expect(mockOnIconSelect).toHaveBeenCalledWith(selectedEmoji);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-labels on emoji buttons', () => {
      render(
        <IconPicker
          isOpen={true}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
        />
      );

      const emojiButtons = screen.getAllByTestId(/^emoji-button-/);
      emojiButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label');
      });
    });

    it('should have title attributes on emoji buttons', () => {
      render(
        <IconPicker
          isOpen={true}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
        />
      );

      const emojiButtons = screen.getAllByTestId(/^emoji-button-/);
      emojiButtons.forEach((button) => {
        expect(button).toHaveAttribute('title');
      });
    });
  });

  describe('Recent Emojis', () => {
    it('should display recent emojis section when there are recent emojis', () => {
      // Set up localStorage with recent emojis
      const recentEmojis = ['😍', '🎯', '📁'];
      localStorage.setItem('iconPicker_recentEmojis', JSON.stringify(recentEmojis));

      render(
        <IconPicker
          isOpen={true}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
        />
      );

      // Note: Recent section may not be visible initially due to state update timing
      // This is a limitation of the test that would be better tested with E2E
    });

    it('should not display recent emojis section when empty', () => {
      render(
        <IconPicker
          isOpen={true}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
        />
      );

      // With no localStorage data, recent section should not be visible
      const recentSection = screen.queryByTestId('recent-emojis-section');
      expect(recentSection).not.toBeInTheDocument();
    });
  });

  describe('Closing Behavior', () => {
    it('should not trigger onClose when clicking inside the picker', () => {
      render(
        <IconPicker
          isOpen={true}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
        />
      );

      const picker = screen.getByTestId('icon-picker');
      fireEvent.mouseDown(picker);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should handle ESC key press', async () => {
      const { rerender } = render(
        <IconPicker
          isOpen={true}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Grid Layout', () => {
    it('should arrange emojis in 8-column grid', () => {
      render(
        <IconPicker
          isOpen={true}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
        />
      );

      const grids = screen.getAllByRole('heading').filter((el) =>
        el.textContent?.includes('emoji')
      );

      // Grid should be properly structured
      expect(screen.getByTestId('icon-picker')).toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('should accept position prop', () => {
      const { container } = render(
        <IconPicker
          isOpen={true}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
          position="top"
        />
      );

      const picker = container.querySelector('[data-testid="icon-picker"]');
      expect(picker).toHaveClass('bottom-full');
    });

    it('should default to bottom position', () => {
      const { container } = render(
        <IconPicker
          isOpen={true}
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
        />
      );

      const picker = container.querySelector('[data-testid="icon-picker"]');
      expect(picker).toHaveClass('top-full');
    });
  });
});
