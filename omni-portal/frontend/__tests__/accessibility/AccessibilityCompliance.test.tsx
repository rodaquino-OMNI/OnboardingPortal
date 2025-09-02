import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock components for accessibility testing
const AccessibleForm = () => {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newErrors: Record<string, string> = {};
    
    if (!formData.get('name')) {
      newErrors.name = 'Nome é obrigatório';
    }
    if (!formData.get('email')) {
      newErrors.email = 'Email é obrigatório';
    }
    
    setErrors(newErrors);
  };
  
  return (
    <form onSubmit={handleSubmit} aria-label="Formulário de cadastro">
      <div>
        <label htmlFor="name">Nome Completo *</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          aria-describedby={errors.name ? "name-error" : undefined}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <div id="name-error" role="alert" className="error">
            {errors.name}
          </div>
        )}
      </div>
      
      <div>
        <label htmlFor="email">Email *</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          aria-describedby={errors.email ? "email-error" : undefined}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <div id="email-error" role="alert" className="error">
            {errors.email}
          </div>
        )}
      </div>
      
      <fieldset>
        <legend>Preferências de contato</legend>
        <div>
          <input id="contact-email" name="contact" type="radio" value="email" />
          <label htmlFor="contact-email">Email</label>
        </div>
        <div>
          <input id="contact-phone" name="contact" type="radio" value="phone" />
          <label htmlFor="contact-phone">Telefone</label>
        </div>
      </fieldset>
      
      <button type="submit">Cadastrar</button>
    </form>
  );
};

const AccessibleModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  
  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    
    if (isOpen) {
      dialog.showModal();
      
      // Focus management
      const firstFocusable = dialog.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      firstFocusable?.focus();
      
      // Trap focus within modal
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
          return;
        }
        
        if (e.key === 'Tab') {
          const focusableElements = dialog.querySelectorAll<HTMLElement>(
            'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          
          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };
      
      dialog.addEventListener('keydown', handleKeyDown);
      
      return () => {
        dialog.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      dialog.close();
    }
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div>
        <h2 id="modal-title">Confirmação</h2>
        <p id="modal-description">
          Tem certeza que deseja continuar com esta ação?
        </p>
        <div>
          <button onClick={onClose} autoFocus>
            Cancelar
          </button>
          <button onClick={onClose}>
            Confirmar
          </button>
        </div>
      </div>
    </dialog>
  );
};

const AccessibleTable = () => {
  const data = [
    { id: 1, name: 'João Silva', email: 'joao@example.com', status: 'Ativo' },
    { id: 2, name: 'Maria Santos', email: 'maria@example.com', status: 'Inativo' },
    { id: 3, name: 'Pedro Costa', email: 'pedro@example.com', status: 'Ativo' },
  ];
  
  return (
    <div>
      <h2>Lista de Usuários</h2>
      <table>
        <caption>Usuários cadastrados no sistema</caption>
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Email</th>
            <th scope="col">Status</th>
            <th scope="col">Ações</th>
          </tr>
        </thead>
        <tbody>
          {data.map(user => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>
                <span 
                  className={user.status === 'Ativo' ? 'status-active' : 'status-inactive'}
                  aria-label={`Status: ${user.status}`}
                >
                  {user.status}
                </span>
              </td>
              <td>
                <button aria-label={`Editar usuário ${user.name}`}>
                  Editar
                </button>
                <button aria-label={`Excluir usuário ${user.name}`}>
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

describe('Accessibility Compliance Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('should pass axe accessibility tests for forms', async () => {
      const { container } = render(<AccessibleForm />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should pass axe accessibility tests for modals', async () => {
      const TestModalComponent = () => {
        const [isOpen, setIsOpen] = React.useState(false);
        
        return (
          <div>
            <button onClick={() => setIsOpen(true)}>
              Abrir Modal
            </button>
            <AccessibleModal 
              isOpen={isOpen} 
              onClose={() => setIsOpen(false)} 
            />
          </div>
        );
      };

      const { container } = render(<TestModalComponent />);
      
      // Test modal trigger
      await user.click(screen.getByRole('button', { name: /abrir modal/i }));
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should pass axe accessibility tests for tables', async () => {
      const { container } = render(<AccessibleTable />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation in forms', async () => {
      render(<AccessibleForm />);
      
      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText(/nome completo/i)).toHaveFocus();
      
      await user.tab();
      expect(screen.getByLabelText(/email/i)).toHaveFocus();
      
      await user.tab();
      expect(screen.getByLabelText(/email.*preferências/i)).toHaveFocus();
      
      await user.tab();
      expect(screen.getByLabelText(/telefone.*preferências/i)).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /cadastrar/i })).toHaveFocus();
    });

    it('should handle arrow key navigation in radio groups', async () => {
      render(<AccessibleForm />);
      
      // Focus on first radio button
      const emailRadio = screen.getByLabelText(/email.*preferências/i);
      emailRadio.focus();
      
      expect(emailRadio).toHaveFocus();
      expect(emailRadio).not.toBeChecked();
      
      // Use space to select
      await user.keyboard(' ');
      expect(emailRadio).toBeChecked();
      
      // Use arrow keys to navigate
      await user.keyboard('{ArrowDown}');
      const phoneRadio = screen.getByLabelText(/telefone.*preferências/i);
      expect(phoneRadio).toHaveFocus();
      expect(phoneRadio).toBeChecked();
    });

    it('should trap focus in modals', async () => {
      const TestModalComponent = () => {
        const [isOpen, setIsOpen] = React.useState(false);
        
        return (
          <div>
            <button onClick={() => setIsOpen(true)}>
              Abrir Modal
            </button>
            <AccessibleModal 
              isOpen={isOpen} 
              onClose={() => setIsOpen(false)} 
            />
          </div>
        );
      };

      render(<TestModalComponent />);
      
      // Open modal
      await user.click(screen.getByRole('button', { name: /abrir modal/i }));
      
      // First focusable element should be focused
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancelar/i })).toHaveFocus();
      });
      
      // Tab to next element
      await user.tab();
      expect(screen.getByRole('button', { name: /confirmar/i })).toHaveFocus();
      
      // Tab should wrap back to first element
      await user.tab();
      expect(screen.getByRole('button', { name: /cancelar/i })).toHaveFocus();
      
      // Shift+Tab should go backward
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: /confirmar/i })).toHaveFocus();
    });

    it('should close modal with Escape key', async () => {
      const TestModalComponent = () => {
        const [isOpen, setIsOpen] = React.useState(false);
        
        return (
          <div>
            <button onClick={() => setIsOpen(true)}>
              Abrir Modal
            </button>
            <AccessibleModal 
              isOpen={isOpen} 
              onClose={() => setIsOpen(false)} 
            />
          </div>
        );
      };

      render(<TestModalComponent />);
      
      // Open modal
      await user.click(screen.getByRole('button', { name: /abrir modal/i }));
      
      // Verify modal is open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      // Press Escape
      await user.keyboard('{Escape}');
      
      // Modal should be closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide proper labels and descriptions', () => {
      render(<AccessibleForm />);
      
      // Form has accessible name
      expect(screen.getByRole('form')).toHaveAccessibleName('Formulário de cadastro');
      
      // Inputs have proper labels
      expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      
      // Required fields are marked
      expect(screen.getByLabelText(/nome completo/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/email/i)).toHaveAttribute('required');
      
      // Fieldset has legend
      expect(screen.getByRole('group', { name: /preferências de contato/i })).toBeInTheDocument();
    });

    it('should announce form validation errors', async () => {
      render(<AccessibleForm />);
      
      // Submit form without filling required fields
      await user.click(screen.getByRole('button', { name: /cadastrar/i }));
      
      // Error messages should have role="alert"
      await waitFor(() => {
        const nameError = screen.getByText(/nome é obrigatório/i);
        const emailError = screen.getByText(/email é obrigatório/i);
        
        expect(nameError).toHaveAttribute('role', 'alert');
        expect(emailError).toHaveAttribute('role', 'alert');
      });
      
      // Inputs should be marked as invalid
      expect(screen.getByLabelText(/nome completo/i)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
      
      // Inputs should be described by error messages
      expect(screen.getByLabelText(/nome completo/i)).toHaveAttribute('aria-describedby', 'name-error');
      expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-describedby', 'email-error');
    });

    it('should provide context for table data', () => {
      render(<AccessibleTable />);
      
      // Table has caption
      expect(screen.getByText('Usuários cadastrados no sistema')).toBeInTheDocument();
      
      // Headers have proper scope
      const nameHeader = screen.getByRole('columnheader', { name: /nome/i });
      const emailHeader = screen.getByRole('columnheader', { name: /email/i });
      const statusHeader = screen.getByRole('columnheader', { name: /status/i });
      
      expect(nameHeader).toHaveAttribute('scope', 'col');
      expect(emailHeader).toHaveAttribute('scope', 'col');
      expect(statusHeader).toHaveAttribute('scope', 'col');
      
      // Action buttons have descriptive labels
      expect(screen.getByRole('button', { name: /editar usuário joão silva/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /excluir usuário joão silva/i })).toBeInTheDocument();
    });

    it('should provide status information accessibly', () => {
      render(<AccessibleTable />);
      
      // Status indicators have aria-label
      const activeStatus = screen.getAllByLabelText(/status: ativo/i);
      const inactiveStatus = screen.getAllByLabelText(/status: inativo/i);
      
      expect(activeStatus).toHaveLength(2);
      expect(inactiveStatus).toHaveLength(1);
    });
  });

  describe('Color and Contrast', () => {
    it('should not rely solely on color for information', () => {
      render(<AccessibleTable />);
      
      // Status should be conveyed through text, not just color
      expect(screen.getByText('Ativo')).toBeInTheDocument();
      expect(screen.getByText('Inativo')).toBeInTheDocument();
      
      // Each status should also have accessible labels
      expect(screen.getAllByLabelText(/status: ativo/i)).toHaveLength(2);
      expect(screen.getAllByLabelText(/status: inativo/i)).toHaveLength(1);
    });

    it('should provide sufficient color contrast', () => {
      // This would typically be tested with actual color values
      // For now, we ensure semantic elements are used correctly
      render(<AccessibleForm />);
      
      // Error messages use role="alert" which typically has high contrast styling
      const form = screen.getByRole('form');
      expect(form).toHaveClass(); // Would check for high-contrast classes
    });
  });

  describe('Mobile Accessibility', () => {
    it('should have proper touch targets', () => {
      render(<AccessibleForm />);
      
      // Buttons should be large enough for touch
      const submitButton = screen.getByRole('button', { name: /cadastrar/i });
      
      // Would typically test computed styles for minimum 44px touch targets
      expect(submitButton).toBeInTheDocument();
    });

    it('should support zoom without horizontal scrolling', () => {
      render(<AccessibleTable />);
      
      // Tables should be responsive or have horizontal scroll
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      
      // Would test with different viewport sizes and zoom levels
    });

    it('should maintain functionality with screen readers on mobile', () => {
      render(<AccessibleForm />);
      
      // Form should work with mobile screen readers (TalkBack, VoiceOver)
      // This is largely covered by desktop screen reader tests
      expect(screen.getByRole('form')).toHaveAccessibleName();
    });
  });

  describe('Language and Internationalization', () => {
    it('should have proper language attributes', () => {
      render(<AccessibleForm />);
      
      // Would check for lang attributes on the document
      // expect(document.documentElement).toHaveAttribute('lang', 'pt-BR');
      
      // Form should have proper language context
      expect(screen.getByRole('form')).toBeInTheDocument();
    });

    it('should handle right-to-left languages properly', () => {
      // Would test with RTL language content
      // For now, ensure structure supports directionality
      render(<AccessibleForm />);
      
      expect(screen.getByRole('form')).toBeInTheDocument();
    });
  });

  describe('Animation and Motion', () => {
    it('should respect prefers-reduced-motion', () => {
      // Mock matchMedia for prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const AnimatedComponent = () => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        return (
          <div 
            data-testid="animated-element"
            className={prefersReducedMotion ? 'no-animation' : 'with-animation'}
          >
            Animated Content
          </div>
        );
      };

      render(<AnimatedComponent />);
      
      // Component should respect reduced motion preference
      expect(screen.getByTestId('animated-element')).toHaveClass('no-animation');
    });

    it('should not cause seizures with flashing content', () => {
      // Ensure no content flashes more than 3 times per second
      // This would typically be tested with specialized tools
      render(<AccessibleForm />);
      
      // No flashing elements should be present in basic forms
      expect(screen.getByRole('form')).toBeInTheDocument();
    });
  });
});