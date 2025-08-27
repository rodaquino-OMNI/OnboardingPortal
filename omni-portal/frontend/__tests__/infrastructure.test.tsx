import { render, screen } from '@testing-library/react';

describe('Test Infrastructure', () => {
  test('Jest and React Testing Library work correctly', () => {
    const TestComponent = () => <div data-testid="test">Hello Test</div>;
    render(<TestComponent />);
    expect(screen.getByTestId('test')).toBeInTheDocument();
  });

  test('Mocks are working', () => {
    const mockFn = jest.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });
});