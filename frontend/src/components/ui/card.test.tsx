import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';

describe('Card components', () => {
  describe('Card', () => {
    it('should render with default classes', () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('rounded-2xl');
      expect(card).toHaveClass('bg-card');
    });

    it('should apply custom className', () => {
      render(<Card data-testid="card" className="custom-class">Content</Card>);
      expect(screen.getByTestId('card')).toHaveClass('custom-class');
    });

    it('should forward ref', () => {
      const ref = { current: null };
      render(<Card ref={ref}>Content</Card>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CardHeader', () => {
    it('should render with default classes', () => {
      render(<CardHeader data-testid="header">Header</CardHeader>);
      const header = screen.getByTestId('header');
      expect(header).toHaveClass('flex');
      expect(header).toHaveClass('flex-col');
      expect(header).toHaveClass('p-6');
    });

    it('should apply custom className', () => {
      render(<CardHeader data-testid="header" className="custom">Header</CardHeader>);
      expect(screen.getByTestId('header')).toHaveClass('custom');
    });
  });

  describe('CardTitle', () => {
    it('should render with default classes', () => {
      render(<CardTitle data-testid="title">Title</CardTitle>);
      const title = screen.getByTestId('title');
      expect(title).toHaveClass('font-semibold');
    });

    it('should apply custom className', () => {
      render(<CardTitle data-testid="title" className="text-xl">Title</CardTitle>);
      expect(screen.getByTestId('title')).toHaveClass('text-xl');
    });
  });

  describe('CardDescription', () => {
    it('should render with default classes', () => {
      render(<CardDescription data-testid="desc">Description</CardDescription>);
      const desc = screen.getByTestId('desc');
      expect(desc).toHaveClass('text-sm');
      expect(desc).toHaveClass('text-muted-foreground');
    });

    it('should apply custom className', () => {
      render(<CardDescription data-testid="desc" className="custom">Description</CardDescription>);
      expect(screen.getByTestId('desc')).toHaveClass('custom');
    });
  });

  describe('CardContent', () => {
    it('should render with default classes', () => {
      render(<CardContent data-testid="content">Content</CardContent>);
      const content = screen.getByTestId('content');
      expect(content).toHaveClass('p-6');
      expect(content).toHaveClass('pt-0');
    });

    it('should apply custom className', () => {
      render(<CardContent data-testid="content" className="custom">Content</CardContent>);
      expect(screen.getByTestId('content')).toHaveClass('custom');
    });
  });

  describe('CardFooter', () => {
    it('should render with default classes', () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);
      const footer = screen.getByTestId('footer');
      expect(footer).toHaveClass('flex');
      expect(footer).toHaveClass('items-center');
      expect(footer).toHaveClass('p-6');
    });

    it('should apply custom className', () => {
      render(<CardFooter data-testid="footer" className="justify-between">Footer</CardFooter>);
      expect(screen.getByTestId('footer')).toHaveClass('justify-between');
    });
  });

  describe('Full Card composition', () => {
    it('should render complete card with all subcomponents', () => {
      render(
        <Card data-testid="card">
          <CardHeader>
            <CardTitle>Test Title</CardTitle>
            <CardDescription>Test Description</CardDescription>
          </CardHeader>
          <CardContent>Test Content</CardContent>
          <CardFooter>Test Footer</CardFooter>
        </Card>
      );

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
      expect(screen.getByText('Test Footer')).toBeInTheDocument();
    });
  });
});
