/**
 * Integration Tests for Infinite Loop Fix
 * Tests the complete user journey with the fix in place
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnifiedRegistrationForm } from '@/components/auth/UnifiedRegistrationForm';
import { LoginForm } from '@/components/auth/LoginForm';
import { EnhancedDocumentUpload } from '@/components/upload/EnhancedDocumentUpload';

// Mock all external dependencies
jest.mock('@/lib/api/unified-auth');
jest.mock('@/lib/api/auth');
jest.mock('@/hooks/useGamification');
jest.mock('@/services/api');
jest.mock('@/lib/ocr-service');

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Infinite Loop Fix - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete Registration Flow', () => {
    test('should complete full registration without infinite loops', async () => {
      const user = userEvent.setup();
      const startTime = performance.now();
      
      render(
        <TestWrapper>
          <UnifiedRegistrationForm />
        </TestWrapper>
      );

      // Step 1 - Personal Information
      await user.type(screen.getByLabelText(/nome completo/i), 'João Silva');
      await user.type(screen.getByLabelText(/email/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      await user.click(screen.getByLabelText(/aceito o tratamento/i));
      await user.click(screen.getByRole('button', { name: /próximo/i }));

      // Wait for step transition
      await waitFor(() => {
        expect(screen.getByText(/detalhes do perfil/i)).toBeInTheDocument();
      });

      // Step 2 - Profile Details
      await user.type(screen.getByLabelText(/data de nascimento/i), '1990-01-01');
      await user.type(screen.getByLabelText(/telefone/i), '11987654321');
      await user.selectOptions(screen.getByRole('combobox', { name: /gênero/i }), 'masculine');
      await user.selectOptions(screen.getByRole('combobox', { name: /estado civil/i }), 'single');
      await user.type(screen.getByLabelText(/departamento/i), 'TI');
      await user.type(screen.getByLabelText(/cargo/i), 'Desenvolvedor');
      await user.type(screen.getByLabelText(/id do funcionário/i), 'EMP001');
      await user.type(screen.getByLabelText(/data de início/i), '2024-01-01');
      await user.click(screen.getByRole('button', { name: /próximo/i }));

      // Wait for next step
      await waitFor(() => {
        expect(screen.getByText(/endereço/i)).toBeInTheDocument();
      });

      // Step 3 - Address (optional)
      await user.click(screen.getByRole('button', { name: /próximo/i }));

      // Wait for security step
      await waitFor(() => {
        expect(screen.getByText(/segurança/i)).toBeInTheDocument();
      });

      // Step 4 - Security
      await user.type(screen.getByLabelText(/senha/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirmar senha/i), 'SecurePass123!');
      await user.selectOptions(screen.getByRole('combobox', { name: /pergunta de segurança/i }), 'Qual o nome da sua primeira escola?');
      await user.type(screen.getByLabelText(/resposta de segurança/i), 'Escola Primária');
      await user.click(screen.getByLabelText(/aceito os termos/i));

      // Submit final form
      await user.click(screen.getByRole('button', { name: /finalizar cadastro/i }));

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds max
      
      // No infinite loop errors
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringMatching(/maximum.*update.*depth|too.*many.*re.*renders/i)
      );
    });

    test('should handle navigation between steps without loops', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <UnifiedRegistrationForm />
        </TestWrapper>
      );

      // Fill first step
      await user.type(screen.getByLabelText(/nome completo/i), 'Test User');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      await user.click(screen.getByLabelText(/aceito o tratamento/i));

      // Navigate forward and backward multiple times
      for (let i = 0; i < 3; i++) {
        await user.click(screen.getByRole('button', { name: /próximo/i }));
        
        await waitFor(() => {
          expect(screen.getByText(/detalhes do perfil/i)).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /anterior/i }));
        
        await waitFor(() => {
          expect(screen.getByText(/informações pessoais/i)).toBeInTheDocument();
        });
      }

      // Should not cause infinite loops
      expect(console.error).not.toHaveBeenCalledWith(expect.stringMatching(/infinite|loop/i));
    });
  });

  describe('Login Flow Integration', () => {
    test('should handle login attempts without causing loops', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Multiple rapid login attempts
      for (let i = 0; i < 3; i++) {
        await user.type(screen.getByLabelText(/email/i), `test${i}@example.com`);
        await user.type(screen.getByLabelText(/senha/i), 'password');
        await user.click(screen.getByRole('button', { name: /entrar/i }));
        
        // Clear fields for next attempt
        await user.clear(screen.getByLabelText(/email/i));
        await user.clear(screen.getByLabelText(/senha/i));
      }

      // Should not cause loops or excessive renders
      expect(console.warn).not.toHaveBeenCalledWith(expect.stringMatching(/re.*render.*loop/i));
    });
  });

  describe('Document Upload Integration', () => {
    test('should handle file uploads without infinite processing loops', async () => {
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const user = userEvent.setup();

      const mockProps = {
        documentType: {
          id: 'rg',
          name: 'RG',
          required: true,
          type: 'identity' as const
        },
        onUploadComplete: jest.fn(),
        onUploadProgress: jest.fn()
      };

      render(
        <TestWrapper>
          <EnhancedDocumentUpload {...mockProps} />
        </TestWrapper>
      );

      // Upload multiple files rapidly
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      
      await act(async () => {
        await user.upload(fileInput, [mockFile, mockFile, mockFile]);
      });

      // Should handle multiple uploads without loops
      expect(console.error).not.toHaveBeenCalledWith(expect.stringMatching(/loop|infinite/i));
    });
  });

  describe('Cross-Component State Management', () => {
    test('should handle shared state updates without cascading loops', async () => {
      const SharedStateComponent = () => {
        const [count, setCount] = React.useState(0);
        const [data, setData] = React.useState<any[]>([]);

        // Pattern that might cause loops if not handled properly
        React.useEffect(() => {
          if (count > 0) {
            setData(prev => [...prev, { id: count, value: `item-${count}` }]);
          }
        }, [count]);

        React.useEffect(() => {
          if (data.length > 0 && data.length < 5) {
            // This could cause infinite loops if not implemented correctly
            setCount(prev => prev + 1);
          }
        }, [data.length]);

        return (
          <div>
            <div data-testid="count">Count: {count}</div>
            <div data-testid="data-length">Data length: {data.length}</div>
            <button onClick={() => setCount(1)}>Start</button>
          </div>
        );
      };

      const user = userEvent.setup();
      render(<SharedStateComponent />);

      await user.click(screen.getByText('Start'));

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('Count: 5');
        expect(screen.getByTestId('data-length')).toHaveTextContent('Data length: 5');
      }, { timeout: 2000 });

      // Should stabilize without infinite loops
      expect(console.error).not.toHaveBeenCalledWith(expect.stringMatching(/maximum.*update/i));
    });
  });

  describe('Performance Under Load', () => {
    test('should maintain performance with multiple components', async () => {
      const MultiComponentTest = () => {
        const [activeTab, setActiveTab] = React.useState(0);
        
        const components = [
          <UnifiedRegistrationForm key="reg" />,
          <LoginForm key="login" />,
          <EnhancedDocumentUpload 
            key="upload"
            documentType={{ id: 'rg', name: 'RG', required: true, type: 'identity' }}
            onUploadComplete={() => {}}
            onUploadProgress={() => {}}
          />
        ];

        return (
          <div>
            <div>
              {[0, 1, 2].map(index => (
                <button key={index} onClick={() => setActiveTab(index)}>
                  Tab {index}
                </button>
              ))}
            </div>
            <div>
              {components[activeTab]}
            </div>
          </div>
        );
      };

      const user = userEvent.setup();
      const startTime = performance.now();

      render(
        <TestWrapper>
          <MultiComponentTest />
        </TestWrapper>
      );

      // Rapidly switch between tabs
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByText(`Tab ${i % 3}`));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly without performance issues
      expect(duration).toBeLessThan(5000); // 5 seconds max
      expect(console.warn).not.toHaveBeenCalledWith(expect.stringMatching(/slow.*component/i));
    });
  });

  describe('Error Recovery', () => {
    test('should recover from errors without entering infinite error loops', async () => {
      const ErrorProneComponent = () => {
        const [shouldError, setShouldError] = React.useState(false);
        const [errorCount, setErrorCount] = React.useState(0);

        React.useEffect(() => {
          if (shouldError && errorCount < 3) {
            setErrorCount(prev => prev + 1);
            throw new Error(`Test error ${errorCount + 1}`);
          }
        }, [shouldError, errorCount]);

        if (shouldError && errorCount >= 3) {
          return <div>Recovered from errors</div>;
        }

        return (
          <button onClick={() => setShouldError(true)}>
            Trigger Error
          </button>
        );
      };

      const ErrorBoundary = class extends React.Component<
        { children: React.ReactNode },
        { hasError: boolean; errorCount: number }
      > {
        constructor(props: any) {
          super(props);
          this.state = { hasError: false, errorCount: 0 };
        }

        static getDerivedStateFromError() {
          return { hasError: true };
        }

        componentDidCatch() {
          this.setState(prev => ({ 
            errorCount: prev.errorCount + 1,
            hasError: prev.errorCount < 2 // Reset after 2 errors
          }));
        }

        render() {
          if (this.state.hasError) {
            return <div>Error boundary caught error {this.state.errorCount}</div>;
          }

          return this.props.children;
        }
      };

      const user = userEvent.setup();
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ErrorProneComponent />
        </ErrorBoundary>
      );

      await user.click(screen.getByText('Trigger Error'));

      // Should recover without infinite error loops
      await waitFor(() => {
        expect(screen.getByText(/error boundary caught error/i)).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });
  });
});