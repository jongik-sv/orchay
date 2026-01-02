import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageHeader } from '../PageHeader';

// Mock IconPicker component
vi.mock('@/components/ui/IconPicker', () => ({
  IconPicker: ({ isOpen, onIconSelect, onClose }: {
    isOpen: boolean;
    onIconSelect: (emoji: string) => void;
    onClose: () => void;
  }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="icon-picker">
        <button
          data-testid="emoji-button-smileys-0"
          onClick={() => onIconSelect('😀')}
        >
          😀
        </button>
        <button
          data-testid="icon-picker-close"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    );
  },
}));

describe('PageHeader Component', () => {
  const defaultProps = {
    pageId: 'page-1',
    title: 'Test Page',
    icon: '📄',
    onTitleChange: vi.fn(),
    onIconChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('UT-001: Basic Rendering', () => {
    it('renders page header with icon and title', () => {
      render(<PageHeader {...defaultProps} />);

      expect(screen.getByTestId('page-header')).toBeInTheDocument();
      expect(screen.getByTestId('page-icon')).toHaveTextContent('📄');
      expect(screen.getByTestId('page-title-input')).toHaveValue('Test Page');
    });

    it('displays default icon (📄) when provided', () => {
      render(<PageHeader {...defaultProps} icon="📄" />);

      expect(screen.getByTestId('page-icon')).toHaveTextContent('📄');
    });

    it('displays custom icon when provided', () => {
      render(<PageHeader {...defaultProps} icon="🚀" />);

      expect(screen.getByTestId('page-icon')).toHaveTextContent('🚀');
    });

    it('shows placeholder for empty title', () => {
      render(<PageHeader {...defaultProps} title="" />);

      const input = screen.getByTestId('page-title-input');
      expect(input).toHaveValue('');
      expect(input).toHaveAttribute('placeholder', 'Untitled');
    });
  });

  describe('UT-002: IconPicker Opens', () => {
    it('opens IconPicker when change button is clicked', async () => {
      render(<PageHeader {...defaultProps} />);

      // IconPicker should not be visible initially
      expect(screen.queryByTestId('icon-picker')).not.toBeInTheDocument();

      // Click the change button
      const changeButton = screen.getByTestId('icon-change-button');
      fireEvent.click(changeButton);

      // IconPicker should now be visible
      expect(screen.getByTestId('icon-picker')).toBeInTheDocument();
    });

    it('has accessible change button with proper aria-label', () => {
      render(<PageHeader {...defaultProps} />);

      const changeButton = screen.getByTestId('icon-change-button');
      expect(changeButton).toHaveAttribute('aria-label', 'Change page icon');
      expect(changeButton).toHaveAttribute('title', 'Change page icon');
    });
  });

  describe('UT-003: Icon Selection Callback', () => {
    it('calls onIconChange when emoji is selected', async () => {
      const onIconChange = vi.fn();
      render(<PageHeader {...defaultProps} onIconChange={onIconChange} />);

      // Open IconPicker
      fireEvent.click(screen.getByTestId('icon-change-button'));

      // Select an emoji
      fireEvent.click(screen.getByTestId('emoji-button-smileys-0'));

      // Verify callback was called with selected emoji
      expect(onIconChange).toHaveBeenCalledWith('😀');
      expect(onIconChange).toHaveBeenCalledTimes(1);
    });

    it('closes IconPicker after emoji selection', async () => {
      render(<PageHeader {...defaultProps} />);

      // Open IconPicker
      fireEvent.click(screen.getByTestId('icon-change-button'));
      expect(screen.getByTestId('icon-picker')).toBeInTheDocument();

      // Select an emoji
      fireEvent.click(screen.getByTestId('emoji-button-smileys-0'));

      // IconPicker should be closed
      await waitFor(() => {
        expect(screen.queryByTestId('icon-picker')).not.toBeInTheDocument();
      });
    });
  });

  describe('UT-004: Title Input', () => {
    it('updates title value on input', async () => {
      const user = userEvent.setup();
      render(<PageHeader {...defaultProps} />);

      const input = screen.getByTestId('page-title-input');

      // Clear and type new value
      await user.clear(input);
      await user.type(input, '새 제목');

      expect(input).toHaveValue('새 제목');
    });

    it('allows editing title with keyboard', async () => {
      const user = userEvent.setup();
      render(<PageHeader {...defaultProps} />);

      const input = screen.getByTestId('page-title-input');
      await user.click(input);
      await user.type(input, ' Updated');

      expect(input).toHaveValue('Test Page Updated');
    });
  });

  describe('UT-005: Title Blur Saves', () => {
    it('calls onTitleChange on blur when value changed', async () => {
      const onTitleChange = vi.fn();
      const user = userEvent.setup();
      render(
        <PageHeader {...defaultProps} title="Old Title" onTitleChange={onTitleChange} />
      );

      const input = screen.getByTestId('page-title-input');

      // Clear and type new value
      await user.clear(input);
      await user.type(input, 'New Title');

      // Trigger blur
      fireEvent.blur(input);

      expect(onTitleChange).toHaveBeenCalledWith('New Title');
      expect(onTitleChange).toHaveBeenCalledTimes(1);
    });

    it('does not call onTitleChange on blur when value unchanged', async () => {
      const onTitleChange = vi.fn();
      render(
        <PageHeader {...defaultProps} title="Same Title" onTitleChange={onTitleChange} />
      );

      const input = screen.getByTestId('page-title-input');

      // Blur without changing value
      fireEvent.blur(input);

      expect(onTitleChange).not.toHaveBeenCalled();
    });

    it('only calls onTitleChange when actual value differs from prop', async () => {
      const onTitleChange = vi.fn();
      const user = userEvent.setup();
      render(
        <PageHeader {...defaultProps} title="Original" onTitleChange={onTitleChange} />
      );

      const input = screen.getByTestId('page-title-input');

      // Type and then delete to return to original
      await user.type(input, 'X');
      await user.type(input, '{backspace}');

      // Blur - value is still "Original"
      fireEvent.blur(input);

      expect(onTitleChange).not.toHaveBeenCalled();
    });
  });

  describe('UT-006: Cover Conditional Rendering', () => {
    it('does not render cover image when coverUrl is undefined', () => {
      render(<PageHeader {...defaultProps} coverUrl={undefined} />);

      expect(screen.queryByTestId('page-cover-image')).not.toBeInTheDocument();
    });

    it('does not render cover image when coverUrl is empty string', () => {
      render(<PageHeader {...defaultProps} coverUrl="" />);

      // Empty string is falsy, so cover should not render
      expect(screen.queryByTestId('page-cover-image')).not.toBeInTheDocument();
    });

    it('renders cover image when coverUrl is provided', () => {
      const coverUrl = 'https://example.com/cover.jpg';
      render(<PageHeader {...defaultProps} coverUrl={coverUrl} />);

      const coverImage = screen.getByTestId('page-cover-image');
      expect(coverImage).toBeInTheDocument();
      expect(coverImage).toHaveAttribute('src', coverUrl);
    });

    it('cover image has proper styling classes', () => {
      render(
        <PageHeader {...defaultProps} coverUrl="https://example.com/cover.jpg" />
      );

      const coverImage = screen.getByTestId('page-cover-image');
      expect(coverImage).toHaveClass('object-cover');
    });

    it('cover image has alt text', () => {
      render(
        <PageHeader {...defaultProps} coverUrl="https://example.com/cover.jpg" />
      );

      const coverImage = screen.getByTestId('page-cover-image');
      expect(coverImage).toHaveAttribute('alt', 'Cover');
    });
  });

  describe('Responsive Layout', () => {
    it('has proper padding classes for responsive design', () => {
      const { container } = render(<PageHeader {...defaultProps} />);

      // Check for responsive padding classes
      const iconTitleArea = container.querySelector('.px-\\[96px\\]');
      expect(iconTitleArea).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('title input is accessible', () => {
      render(<PageHeader {...defaultProps} />);

      const input = screen.getByTestId('page-title-input');
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('placeholder', 'Untitled');
    });

    it('icon change button has proper accessibility attributes', () => {
      render(<PageHeader {...defaultProps} />);

      const button = screen.getByTestId('icon-change-button');
      expect(button).toHaveAttribute('title');
      expect(button).toHaveAttribute('aria-label');
    });
  });
});
