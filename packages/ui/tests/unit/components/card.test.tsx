import { describe, it, expect } from 'vitest';
import { render, screen } from '@/tests/helpers/render';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/ui/card';

describe('Card', () => {
  describe('Card', () => {
    it('should render children', () => {
      render(
        <Card data-testid="card">
          <div>Card content</div>
        </Card>
      );

      const card = screen.getByTestId('card');
      expect(card).toBeInTheDocument();
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('should accept custom className', () => {
      render(
        <Card className="custom-card" data-testid="card">
          Content
        </Card>
      );

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-card');
    });

    it('should spread additional props', () => {
      render(
        <Card data-testid="card" role="article">
          Content
        </Card>
      );

      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('role', 'article');
    });
  });

  describe('CardHeader', () => {
    it('should render header content', () => {
      render(
        <CardHeader data-testid="header">
          <div>Header content</div>
        </CardHeader>
      );

      const header = screen.getByTestId('header');
      expect(header).toBeInTheDocument();
      expect(screen.getByText('Header content')).toBeInTheDocument();
    });

    it('should accept custom className', () => {
      render(
        <CardHeader className="custom-header" data-testid="header">
          Content
        </CardHeader>
      );

      const header = screen.getByTestId('header');
      expect(header).toHaveClass('custom-header');
    });
  });

  describe('CardTitle', () => {
    it('should render title text', () => {
      render(<CardTitle>Card Title</CardTitle>);
      expect(screen.getByText('Card Title')).toBeInTheDocument();
    });

    it('should accept custom className', () => {
      render(
        <CardTitle className="custom-title" data-testid="title">
          Title
        </CardTitle>
      );

      const title = screen.getByTestId('title');
      expect(title).toHaveClass('custom-title');
    });
  });

  describe('CardDescription', () => {
    it('should render description text', () => {
      render(<CardDescription>Card description</CardDescription>);
      expect(screen.getByText('Card description')).toBeInTheDocument();
    });

    it('should accept custom className', () => {
      render(
        <CardDescription className="custom-desc" data-testid="desc">
          Description
        </CardDescription>
      );

      const desc = screen.getByTestId('desc');
      expect(desc).toHaveClass('custom-desc');
    });
  });

  describe('CardContent', () => {
    it('should render content', () => {
      render(
        <CardContent data-testid="content">
          <p>Card content text</p>
        </CardContent>
      );

      const content = screen.getByTestId('content');
      expect(content).toBeInTheDocument();
      expect(screen.getByText('Card content text')).toBeInTheDocument();
    });

    it('should accept custom className', () => {
      render(
        <CardContent className="custom-content" data-testid="content">
          Content
        </CardContent>
      );

      const content = screen.getByTestId('content');
      expect(content).toHaveClass('custom-content');
    });
  });

  describe('CardFooter', () => {
    it('should render footer content', () => {
      render(
        <CardFooter data-testid="footer">
          <button>Action</button>
        </CardFooter>
      );

      const footer = screen.getByTestId('footer');
      expect(footer).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /action/i })).toBeInTheDocument();
    });

    it('should accept custom className', () => {
      render(
        <CardFooter className="custom-footer" data-testid="footer">
          Footer
        </CardFooter>
      );

      const footer = screen.getByTestId('footer');
      expect(footer).toHaveClass('custom-footer');
    });
  });

  describe('Composition', () => {
    it('should render complete card with all parts', () => {
      render(
        <Card data-testid="complete-card">
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>Test description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Main content</p>
          </CardContent>
          <CardFooter>
            <button>Submit</button>
          </CardFooter>
        </Card>
      );

      expect(screen.getByTestId('complete-card')).toBeInTheDocument();
      expect(screen.getByText('Test Card')).toBeInTheDocument();
      expect(screen.getByText('Test description')).toBeInTheDocument();
      expect(screen.getByText('Main content')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should support semantic HTML', () => {
      render(
        <Card data-testid="card">
          <CardHeader>
            <CardTitle>Accessible Card</CardTitle>
          </CardHeader>
          <CardContent>Content</CardContent>
        </Card>
      );

      const card = screen.getByTestId('card');
      expect(card).toBeInTheDocument();

      // Should have heading for title
      expect(screen.getByText('Accessible Card')).toBeInTheDocument();
    });

    it('should support ARIA attributes', () => {
      render(
        <Card
          data-testid="card"
          role="region"
          aria-labelledby="card-title"
        >
          <CardHeader>
            <CardTitle id="card-title">ARIA Card</CardTitle>
          </CardHeader>
          <CardContent>Content</CardContent>
        </Card>
      );

      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('role', 'region');
      expect(card).toHaveAttribute('aria-labelledby', 'card-title');
    });
  });

  describe('Layout', () => {
    it('should handle empty card gracefully', () => {
      render(<Card data-testid="empty-card" />);
      const card = screen.getByTestId('empty-card');
      expect(card).toBeInTheDocument();
    });

    it('should handle nested content', () => {
      render(
        <Card data-testid="nested-card">
          <CardContent>
            <div>
              <h3>Nested heading</h3>
              <p>Nested paragraph</p>
            </div>
          </CardContent>
        </Card>
      );

      expect(screen.getByText('Nested heading')).toBeInTheDocument();
      expect(screen.getByText('Nested paragraph')).toBeInTheDocument();
    });
  });
});
