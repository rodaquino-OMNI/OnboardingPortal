import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add provider options here as needed
}

/**
 * Custom render that wraps components with common providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { ...renderOptions } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    // Add providers here as needed (e.g., TooltipProvider, ThemeProvider)
    return <>{children}</>;
  };

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from RTL
export * from '@testing-library/react';
export { renderWithProviders as render };
