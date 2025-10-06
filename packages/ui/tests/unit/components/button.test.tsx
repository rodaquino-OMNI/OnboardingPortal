import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { Button } from '@/ui/button';

describe('Button', () => {
  describe('Rendering', () => {
    it('should render with children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('should render with different variants', () => {
      const { rerender } = render(<Button variant="default">Default</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<Button variant="destructive">Destructive</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<Button variant="outline">Outline</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<Button variant="ghost">Ghost</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render with different sizes', () => {
      const { rerender } = render(<Button size="default">Default</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<Button size="sm">Small</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<Button size="lg">Large</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<Button size="icon">Icon</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible name from children', () => {
      render(<Button>Submit Form</Button>);
      const button = screen.getByRole('button', { name: /submit form/i });
      expect(button).toBeInTheDocument();
    });

    it('should support aria-label', () => {
      render(<Button aria-label="Close dialog">X</Button>);
      const button = screen.getByRole('button', { name: /close dialog/i });
      expect(button).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button', { name: /disabled/i });
      expect(button).toBeDisabled();
    });

    it('should not be focusable when disabled', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button', { name: /disabled/i });

      button.focus();
      expect(button).not.toHaveFocus();
    });
  });

  describe('Interactions', () => {
    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole('button', { name: /click me/i });
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button disabled onClick={handleClick}>Disabled</Button>);

      const button = screen.getByRole('button', { name: /disabled/i });
      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should support keyboard activation with Enter', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button onClick={handleClick}>Press Enter</Button>);

      const button = screen.getByRole('button', { name: /press enter/i });
      button.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should support keyboard activation with Space', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button onClick={handleClick}>Press Space</Button>);

      const button = screen.getByRole('button', { name: /press space/i });
      button.focus();
      await user.keyboard(' ');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Focus Management', () => {
    it('should be focusable', () => {
      render(<Button>Focusable</Button>);
      const button = screen.getByRole('button', { name: /focusable/i });

      button.focus();
      expect(button).toHaveFocus();
    });

    it('should support tab navigation', async () => {
      const user = userEvent.setup();

      render(
        <div>
          <Button>First</Button>
          <Button>Second</Button>
        </div>
      );

      const firstButton = screen.getByRole('button', { name: /first/i });
      const secondButton = screen.getByRole('button', { name: /second/i });

      firstButton.focus();
      expect(firstButton).toHaveFocus();

      await user.tab();
      expect(secondButton).toHaveFocus();
    });
  });

  describe('Props', () => {
    it('should support asChild prop', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );

      const link = screen.getByRole('link', { name: /link button/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/test');
    });

    it('should accept custom className', () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole('button', { name: /custom/i });
      expect(button).toHaveClass('custom-class');
    });

    it('should spread additional props', () => {
      render(
        <Button data-testid="test-button" title="Test title">
          Test
        </Button>
      );

      const button = screen.getByRole('button', { name: /test/i });
      expect(button).toHaveAttribute('data-testid', 'test-button');
      expect(button).toHaveAttribute('title', 'Test title');
    });
  });

  describe('Error States', () => {
    it('should handle missing onClick gracefully', async () => {
      const user = userEvent.setup();

      render(<Button>No handler</Button>);

      const button = screen.getByRole('button', { name: /no handler/i });

      // Should not throw
      await expect(user.click(button)).resolves.not.toThrow();
    });
  });

  describe('Loading States', () => {
    it('should render loading state if provided', () => {
      // Note: This depends on implementation
      // If Button supports a loading prop, test it here
      render(<Button disabled>Loading...</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });
});
