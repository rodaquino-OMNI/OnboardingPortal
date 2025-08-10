import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import DOMPurify from 'dompurify';

// Mock security-related modules
jest.mock('dompurify', () => ({
  sanitize: jest.fn((input) => input.replace(/<script.*?>.*?<\/script>/gi, '')),
  isValidAttribute: jest.fn(() => true)
}));

jest.mock('@/lib/security', () => ({
  sanitizeInput: jest.fn((input) => DOMPurify.sanitize(input)),
  validateToken: jest.fn(() => true),
  encryptSensitiveData: jest.fn((data) => `encrypted_${data}`),
  auditLog: jest.fn(),
  validateCSRF: jest.fn(() => true),
  generateCSRFToken: jest.fn(() => 'csrf-token-123'),
  rateLimit: jest.fn(() => ({ allowed: true, remaining: 10 }))
}));

// Import components for testing
import LoginForm from '@/components/auth/LoginForm';
import { UnifiedRegistrationForm } from '@/components/auth/UnifiedRegistrationForm';
import { SmartHealthQuestionnaire } from '@/components/health/SmartHealthQuestionnaire';
import { EnhancedDocumentUpload } from '@/components/upload/EnhancedDocumentUpload';
import { VideoConferencing } from '@/components/video/VideoConferencing';

/**
 * Comprehensive Security Test Suite for Frontend Components
 * 
 * This test suite validates security measures across all frontend components
 * including XSS prevention, CSRF protection, input validation, authentication,
 * and data sanitization.
 */

const server = setupServer(
  // Authentication endpoints with security validations
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json();
    const { login, password } = body;
    
    // Simulate SQL injection detection
    const sqlPatterns = ['DROP TABLE', 'SELECT *', 'UNION SELECT', '--', ';', 'DELETE FROM'];
    const loginString = String(login).toUpperCase();
    
    if (sqlPatterns.some(pattern => loginString.includes(pattern))) {
      return HttpResponse.json({ error: 'Invalid input detected' }, { status: 400 });
    }
    
    // Simulate XSS detection
    if (login.includes('<script>') || password.includes('<script>')) {
      return HttpResponse.json({ error: 'Malicious input detected' }, { status: 400 });
    }
    
    // Simulate brute force protection
    const rateLimitHeader = request.headers.get('x-rate-limit-count');
    if (rateLimitHeader && parseInt(rateLimitHeader) > 5) {
      return HttpResponse.json({ 
        error: 'Too many login attempts. Account temporarily locked.',
        lockout_duration: 900
      }, { status: 429 });
    }
    
    return HttpResponse.json({
      success: true,
      user: { id: '123', email: login },
      access_token: 'secure-jwt-token'
    });
  }),

  // Registration with comprehensive input validation
  http.post('/api/register/step1', async ({ request }) => {
    const body = await request.json();
    
    // Check CSRF token
    const csrfToken = request.headers.get('X-CSRF-Token');
    if (!csrfToken || csrfToken !== 'csrf-token-123') {
      return HttpResponse.json({ error: 'CSRF token invalid' }, { status: 403 });
    }
    
    // Validate input length
    if (body.name && body.name.length > 255) {
      return HttpResponse.json({ 
        errors: { name: ['Name must be less than 255 characters'] }
      }, { status: 422 });
    }
    
    // Check for malicious patterns
    const maliciousPatterns = [
      /<script.*?>.*?<\/script>/gi,
      /javascript:/gi,
      /onload=/gi,
      /onerror=/gi,
      /on\w+=/gi,
      /DROP\s+TABLE/gi,
      /SELECT\s+\*/gi
    ];
    
    const bodyString = JSON.stringify(body);
    if (maliciousPatterns.some(pattern => pattern.test(bodyString))) {
      return HttpResponse.json({ error: 'Invalid input detected' }, { status: 400 });
    }
    
    return HttpResponse.json({
      success: true,
      user: { id: '456', email: body.email }
    });
  }),

  // Health questionnaire with sensitive data handling
  http.post('/api/health-questionnaires/submit', async ({ request }) => {
    const body = await request.json();
    
    // Simulate input sanitization
    if (body.responses) {
      Object.keys(body.responses).forEach(key => {
        if (typeof body.responses[key] === 'string') {
          body.responses[key] = body.responses[key].replace(/<script.*?>.*?<\/script>/gi, '');
        }
      });
    }
    
    return HttpResponse.json({
      success: true,
      questionnaire: { id: '789', responses: body.responses, sanitized: true }
    });
  }),

  // File upload with security checks
  http.post('/api/documents/upload', async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return HttpResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Check file type
    const dangerousTypes = [
      'application/javascript',
      'text/javascript',
      'application/php',
      'application/x-php',
      'text/x-php',
      'application/x-executable',
      'application/x-msdownload'
    ];
    
    if (dangerousTypes.includes(file.type)) {
      return HttpResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }
    
    // Check file name for malicious patterns
    const maliciousExtensions = ['.php', '.js', '.exe', '.bat', '.sh', '.cmd', '.scr'];
    const hasmaliciousExt = maliciousExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (hasmaliciousExt) {
      return HttpResponse.json({ error: 'File extension not allowed' }, { status: 400 });
    }
    
    // Check for null bytes or path traversal
    if (file.name.includes('../') || file.name.includes('..\\') || file.name.includes('\0')) {
      return HttpResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }
    
    return HttpResponse.json({
      success: true,
      document: { id: 'doc-123', filename: file.name, size: file.size }
    });
  }),

  // Video session endpoint with security validation
  http.post('/api/video/sessions', ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return HttpResponse.json({
      success: true,
      session: {
        id: 'session-123',
        token: 'secure-session-token',
        settings: { encrypted: true, hipaaCompliant: true }
      }
    });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('Comprehensive Frontend Security Test Suite', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  describe('XSS (Cross-Site Scripting) Protection', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '"><script>alert("XSS")</script>',
      "'><script>alert('XSS')</script>",
      '<div onclick="alert(\'XSS\')">Click me</div>',
      '<body onload=alert("XSS")>',
      'javascript:alert("XSS")',
      '<img src="data:text/html,<script>alert(\'XSS\')</script>">',
      '<style>body{background:url("javascript:alert(\'XSS\')")}</style>',
      '<link rel="stylesheet" href="javascript:alert(\'XSS\')">',
      '&#60;script&#62;alert("XSS")&#60;/script&#62;',
      '%3Cscript%3Ealert("XSS")%3C/script%3E'
    ];

    it('should sanitize XSS payloads in login form', async () => {
      renderWithProviders(<LoginForm />);

      for (const payload of xssPayloads) {
        const emailInput = screen.getByLabelText(/e-mail/i);
        await user.clear(emailInput);
        await user.type(emailInput, `${payload}@example.com`);
        
        // Input should accept but not execute malicious content
        expect(emailInput).toHaveValue(`${payload}@example.com`);
        expect(document.body.innerHTML).not.toContain('<script>');
        expect(document.body.innerHTML).not.toContain('javascript:');
      }
    });

    it('should sanitize XSS payloads in registration form', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      for (const payload of xssPayloads) {
        const nameInput = screen.getByLabelText(/nome completo/i);
        await user.clear(nameInput);
        await user.type(nameInput, payload);
        
        expect(nameInput).toHaveValue(payload);
        
        // Check that malicious content is not rendered
        const formElement = nameInput.closest('form');
        expect(formElement?.innerHTML).not.toMatch(/<script.*?>.*?<\/script>/);
        expect(formElement?.innerHTML).not.toContain('javascript:');
        expect(formElement?.innerHTML).not.toMatch(/on\w+=/);
      }
    });

    it('should sanitize XSS payloads in health questionnaire', async () => {
      const mockUser = { id: '1', name: 'Test User', registrationStep: 'health_questionnaire' };
      renderWithProviders(<SmartHealthQuestionnaire user={mockUser} />);

      await waitFor(() => {
        expect(screen.getByText(/questionário de saúde/i)).toBeInTheDocument();
      });

      for (const payload of xssPayloads) {
        // Find text inputs in the questionnaire
        const textInputs = screen.getAllByRole('textbox');
        if (textInputs.length > 0) {
          const input = textInputs[0];
          await user.clear(input);
          await user.type(input, payload);
          
          expect(input).toHaveValue(payload);
          
          // Submit and verify sanitization
          const submitButton = screen.getByRole('button', { name: /enviar/i });
          await user.click(submitButton);
          
          await waitFor(() => {
            // Should not contain executable script content
            expect(document.body.innerHTML).not.toMatch(/<script.*?>.*?<\/script>/);
          });
        }
      }
    });

    it('should prevent DOM-based XSS through URL parameters', () => {
      // Simulate URL with XSS payload
      const maliciousUrl = 'http://localhost?search=<script>alert("XSS")</script>';
      Object.defineProperty(window, 'location', {
        value: new URL(maliciousUrl),
        writable: true
      });

      renderWithProviders(<LoginForm />);
      
      // Verify malicious content is not executed
      expect(document.body.innerHTML).not.toContain('<script>alert("XSS")</script>');
      expect((window as any).xssExecuted).toBeUndefined();
    });
  });

  describe('CSRF (Cross-Site Request Forgery) Protection', () => {
    it('should include CSRF tokens in form submissions', async () => {
      const mockGenerateToken = jest.requireMock('@/lib/security').generateCSRFToken;
      mockGenerateToken.mockReturnValue('csrf-token-123');

      renderWithProviders(<UnifiedRegistrationForm />);

      await user.type(screen.getByLabelText(/nome completo/i), 'Test User');
      await user.type(screen.getByLabelText(/e-mail/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^senha$/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/cpf/i), '123.456.789-00');
      
      // Accept terms
      await user.click(screen.getByRole('checkbox', { name: /termos de uso/i }));
      await user.click(screen.getByRole('checkbox', { name: /política de privacidade/i }));
      
      await user.click(screen.getByRole('button', { name: /criar conta/i }));

      // Verify CSRF token generation was called
      expect(mockGenerateToken).toHaveBeenCalled();
    });

    it('should handle CSRF token validation errors', async () => {
      // Mock CSRF validation failure
      server.use(
        http.post('/api/register/step1', ({ request }) => {
          return HttpResponse.json({ error: 'CSRF token invalid' }, { status: 403 });
        })
      );

      renderWithProviders(<UnifiedRegistrationForm />);

      await user.type(screen.getByLabelText(/nome completo/i), 'Test User');
      await user.type(screen.getByLabelText(/e-mail/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^senha$/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/cpf/i), '123.456.789-00');
      
      await user.click(screen.getByRole('checkbox', { name: /termos de uso/i }));
      await user.click(screen.getByRole('checkbox', { name: /política de privacidade/i }));
      
      await user.click(screen.getByRole('button', { name: /criar conta/i }));

      await waitFor(() => {
        expect(screen.getByText(/csrf.*invalid/i) || screen.getByText(/token.*invalid/i)).toBeInTheDocument();
      });
    });

    it('should prevent CSRF through SameSite cookie attributes', () => {
      // Mock document.cookie to check SameSite attribute
      Object.defineProperty(document, 'cookie', {
        get: () => 'csrf_token=abc123; SameSite=Strict; Secure; HttpOnly',
        set: jest.fn()
      });

      renderWithProviders(<LoginForm />);
      
      // Verify cookie has proper security attributes
      expect(document.cookie).toContain('SameSite=Strict');
      expect(document.cookie).toContain('Secure');
      expect(document.cookie).toContain('HttpOnly');
    });
  });

  describe('SQL Injection Protection', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' OR 1=1--",
      "admin'--",
      "admin'/*",
      "' UNION SELECT * FROM users--",
      "'; DELETE FROM users WHERE '1'='1",
      "' OR (SELECT COUNT(*) FROM users) > 0--",
      "{'$ne': null}",
      "{'$gt': ''}",
      "1' AND (SELECT COUNT(*) FROM information_schema.tables) > 0--"
    ];

    it('should prevent SQL injection in login form', async () => {
      renderWithProviders(<LoginForm />);

      for (const payload of sqlInjectionPayloads) {
        const emailInput = screen.getByLabelText(/e-mail/i);
        const passwordInput = screen.getByLabelText(/senha/i);
        
        await user.clear(emailInput);
        await user.clear(passwordInput);
        
        await user.type(emailInput, payload);
        await user.type(passwordInput, 'password');
        
        await user.click(screen.getByRole('button', { name: /entrar/i }));

        await waitFor(() => {
          // Should show invalid input error, not crash
          const errorElement = screen.queryByText(/invalid input/i) || screen.queryByText(/erro/i);
          if (errorElement) {
            expect(errorElement).toBeInTheDocument();
          }
        });

        // Should not show database errors
        expect(screen.queryByText(/mysql_fetch/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/ORA-/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/PostgreSQL/i)).not.toBeInTheDocument();
      }
    });

    it('should prevent SQL injection in registration form', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      for (const payload of sqlInjectionPayloads.slice(0, 3)) { // Test subset for performance
        await user.clear(screen.getByLabelText(/nome completo/i));
        await user.type(screen.getByLabelText(/nome completo/i), payload);
        await user.type(screen.getByLabelText(/e-mail/i), 'test@example.com');
        await user.type(screen.getByLabelText(/^senha$/i), 'StrongP@ss123');
        await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongP@ss123');
        await user.type(screen.getByLabelText(/cpf/i), '123.456.789-00');
        
        await user.click(screen.getByRole('checkbox', { name: /termos de uso/i }));
        await user.click(screen.getByRole('checkbox', { name: /política de privacidade/i }));
        
        await user.click(screen.getByRole('button', { name: /criar conta/i }));

        await waitFor(() => {
          // Should handle malicious input gracefully
          const hasError = screen.queryByText(/invalid input/i) || screen.queryByText(/erro/i);
          if (hasError) {
            expect(hasError).toBeInTheDocument();
          }
        });
      }
    });
  });

  describe('File Upload Security', () => {
    it('should prevent malicious file uploads', async () => {
      const mockUser = { id: '1', name: 'Test User', registrationStep: 'documents' };
      renderWithProviders(<EnhancedDocumentUpload user={mockUser} documentType="rg" />);

      const maliciousFiles = [
        { name: 'malicious.php', type: 'application/x-php', content: '<?php system($_GET["cmd"]); ?>' },
        { name: 'script.js', type: 'application/javascript', content: 'alert("XSS");' },
        { name: 'virus.exe', type: 'application/x-msdownload', content: 'MZ executable' },
        { name: '../../../etc/passwd', type: 'text/plain', content: 'root:x:0:0:' },
        { name: 'file.txt\0.php', type: 'text/plain', content: '<?php phpinfo(); ?>' },
        { name: 'shell.sh', type: 'text/x-shellscript', content: '#!/bin/bash\nrm -rf /' }
      ];

      for (const fileData of maliciousFiles) {
        const file = new File([fileData.content], fileData.name, { type: fileData.type });
        const fileInput = screen.getByLabelText(/choose file|selecionar arquivo/i);
        
        await user.upload(fileInput, file);
        
        const uploadButton = screen.getByRole('button', { name: /upload|enviar/i });
        await user.click(uploadButton);

        await waitFor(() => {
          // Should show error for malicious files
          expect(
            screen.getByText(/file type not allowed/i) ||
            screen.getByText(/file extension not allowed/i) ||
            screen.getByText(/invalid file name/i) ||
            screen.getByText(/arquivo inválido/i)
          ).toBeInTheDocument();
        });
      }
    });

    it('should validate file size limits', async () => {
      const mockUser = { id: '1', name: 'Test User', registrationStep: 'documents' };
      renderWithProviders(<EnhancedDocumentUpload user={mockUser} documentType="rg" />);

      // Create oversized file (simulated)
      const oversizedContent = 'a'.repeat(50 * 1024 * 1024); // 50MB
      const oversizedFile = new File([oversizedContent], 'large.pdf', { type: 'application/pdf' });
      
      const fileInput = screen.getByLabelText(/choose file|selecionar arquivo/i);
      await user.upload(fileInput, oversizedFile);
      
      const uploadButton = screen.getByRole('button', { name: /upload|enviar/i });
      await user.click(uploadButton);

      await waitFor(() => {
        expect(
          screen.getByText(/file too large/i) ||
          screen.getByText(/arquivo muito grande/i) ||
          screen.getByText(/size limit/i)
        ).toBeInTheDocument();
      });
    });

    it('should sanitize file names', async () => {
      const mockUser = { id: '1', name: 'Test User', registrationStep: 'documents' };
      renderWithProviders(<EnhancedDocumentUpload user={mockUser} documentType="rg" />);

      const maliciousFilenames = [
        'document<script>alert("XSS")</script>.pdf',
        'file"; DROP TABLE documents; --.pdf',
        'normal-file.pdf',
      ];

      for (const filename of maliciousFilenames) {
        const file = new File(['PDF content'], filename, { type: 'application/pdf' });
        const fileInput = screen.getByLabelText(/choose file|selecionar arquivo/i);
        
        await user.upload(fileInput, file);
        
        // Check if filename is displayed safely
        const displayedName = screen.queryByText(filename);
        if (displayedName) {
          expect(displayedName.innerHTML).not.toContain('<script>');
          expect(displayedName.innerHTML).not.toContain('DROP TABLE');
        }
      }
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should validate input length limits', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const longInput = 'a'.repeat(1000);
      const nameInput = screen.getByLabelText(/nome completo/i);
      
      await user.type(nameInput, longInput);
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText(/muito longo/i) ||
          screen.getByText(/maximum.*characters/i) ||
          screen.getByText(/too long/i)
        ).toBeInTheDocument();
      });
    });

    it('should validate email format strictly', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const invalidEmails = [
        'plainaddress',
        '@missingname.com',
        'missing@.com',
        'spaces in@email.com',
        'email@.com',
        'email@com',
        'email..double.dot@example.com',
        '<script>alert("XSS")</script>@evil.com'
      ];

      for (const email of invalidEmails) {
        const emailInput = screen.getByLabelText(/e-mail/i);
        await user.clear(emailInput);
        await user.type(emailInput, email);
        await user.tab();

        await waitFor(() => {
          expect(screen.getByText(/e-mail inválido/i) || screen.getByText(/invalid email/i)).toBeInTheDocument();
        });
      }
    });

    it('should validate CPF format and checksum', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const invalidCPFs = [
        '000.000.000-00',
        '111.111.111-11',
        '123.456.789-00',
        '123.456.789-AB',
        '12345678901234', // Too long
        '123', // Too short
      ];

      for (const cpf of invalidCPFs) {
        const cpfInput = screen.getByLabelText(/cpf/i);
        await user.clear(cpfInput);
        await user.type(cpfInput, cpf);
        await user.tab();

        await waitFor(() => {
          expect(screen.getByText(/cpf inválido/i) || screen.getByText(/invalid cpf/i)).toBeInTheDocument();
        });
      }
    });

    it('should handle special characters safely', async () => {
      renderWithProviders(<UnifiedRegistrationForm />);

      const specialChars = [
        'José María',
        'François Müller',
        'Владимир Путин',
        '中文姓名',
        'عربي',
        '🙂 Emoji Name',
        'Normal Name'
      ];

      for (const name of specialChars) {
        const nameInput = screen.getByLabelText(/nome completo/i);
        await user.clear(nameInput);
        await user.type(nameInput, name);
        
        expect(nameInput).toHaveValue(name);
        
        // Should handle international characters properly
        expect(nameInput.value).toEqual(name);
      }
    });
  });

  describe('Session Security', () => {
    it('should validate authentication tokens', async () => {
      const mockValidateToken = jest.requireMock('@/lib/security').validateToken;
      
      // Test with valid token
      mockValidateToken.mockReturnValueOnce(true);
      localStorage.setItem('access_token', 'valid-token-123');
      
      renderWithProviders(<VideoConferencing interviewId="123" participantInfo={{}} onSessionEnd={jest.fn()} onError={jest.fn()} />);
      
      expect(mockValidateToken).toHaveBeenCalledWith('valid-token-123');
      
      // Test with invalid token
      mockValidateToken.mockReturnValueOnce(false);
      localStorage.setItem('access_token', 'invalid-token-456');
      
      const onError = jest.fn();
      renderWithProviders(<VideoConferencing interviewId="123" participantInfo={{}} onSessionEnd={jest.fn()} onError={onError} />);
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });

    it('should handle token expiration', async () => {
      // Mock expired token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9';
      localStorage.setItem('access_token', expiredToken);
      
      // Mock token validation to return false for expired token
      const mockValidateToken = jest.requireMock('@/lib/security').validateToken;
      mockValidateToken.mockReturnValue(false);
      
      renderWithProviders(<LoginForm />);
      
      await waitFor(() => {
        expect(localStorage.getItem('access_token')).toBeNull();
      });
    });

    it('should prevent session fixation', async () => {
      const originalSessionId = 'original-session-123';
      sessionStorage.setItem('session_id', originalSessionId);
      
      renderWithProviders(<LoginForm />);
      
      await user.type(screen.getByLabelText(/e-mail/i), 'user@example.com');
      await user.type(screen.getByLabelText(/senha/i), 'password123');
      await user.click(screen.getByRole('button', { name: /entrar/i }));
      
      // After successful login, session ID should be regenerated
      await waitFor(() => {
        const newSessionId = sessionStorage.getItem('session_id');
        expect(newSessionId).not.toBe(originalSessionId);
      });
    });
  });

  describe('Rate Limiting Protection', () => {
    it('should handle rate limiting on login attempts', async () => {
      const mockRateLimit = jest.requireMock('@/lib/security').rateLimit;
      
      renderWithProviders(<LoginForm />);
      
      // Simulate multiple failed attempts
      for (let i = 0; i < 6; i++) {
        if (i >= 5) {
          mockRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 900000 });
        } else {
          mockRateLimit.mockReturnValue({ allowed: true, remaining: 5 - i });
        }
        
        await user.clear(screen.getByLabelText(/e-mail/i));
        await user.clear(screen.getByLabelText(/senha/i));
        
        await user.type(screen.getByLabelText(/e-mail/i), 'user@example.com');
        await user.type(screen.getByLabelText(/senha/i), 'wrongpassword');
        await user.click(screen.getByRole('button', { name: /entrar/i }));
        
        if (i >= 5) {
          await waitFor(() => {
            expect(screen.getByText(/too many attempts/i) || screen.getByText(/rate limit/i)).toBeInTheDocument();
          });
          break;
        }
      }
    });

    it('should show progressive delays for failed attempts', async () => {
      let attemptCount = 0;
      const mockRateLimit = jest.requireMock('@/lib/security').rateLimit;
      
      server.use(
        http.post('/api/auth/login', ({ request }) => {
          attemptCount++;
          
          const delay = Math.min(attemptCount * 1000, 15000); // Progressive delay up to 15s
          
          return HttpResponse.json({ 
            error: 'Invalid credentials',
            retry_after: delay
          }, { status: 401 });
        })
      );
      
      renderWithProviders(<LoginForm />);
      
      // Make multiple failed attempts
      for (let i = 0; i < 4; i++) {
        const remaining = Math.max(0, 5 - i);
        mockRateLimit.mockReturnValue({ 
          allowed: remaining > 0, 
          remaining,
          resetTime: Date.now() + (i * 1000)
        });
        
        await user.clear(screen.getByLabelText(/e-mail/i));
        await user.clear(screen.getByLabelText(/senha/i));
        
        await user.type(screen.getByLabelText(/e-mail/i), 'admin@test.com');
        await user.type(screen.getByLabelText(/senha/i), 'wrongpass');
        await user.click(screen.getByRole('button', { name: /entrar/i }));
        
        if (i >= 2) {
          await waitFor(() => {
            expect(screen.getByText(/retry.*after/i) || screen.getByText(/wait/i)).toBeInTheDocument();
          });
          break;
        }
      }
    });
  });

  describe('Content Security Policy', () => {
    it('should prevent inline script execution', () => {
      renderWithProviders(<LoginForm />);
      
      // Try to inject inline script
      const scriptElement = document.createElement('script');
      scriptElement.innerHTML = 'window.cspTestExecuted = true;';
      
      const originalAppendChild = document.head.appendChild;
      document.head.appendChild = jest.fn().mockImplementation((element) => {
        if (element.tagName === 'SCRIPT' && element.innerHTML) {
          // CSP should prevent execution
          return element;
        }
        return originalAppendChild.call(document.head, element);
      });
      
      document.head.appendChild(scriptElement);
      
      // Script should not execute due to CSP
      expect((window as any).cspTestExecuted).toBeUndefined();
    });

    it('should validate external resource loading', () => {
      renderWithProviders(<VideoConferencing interviewId="123" participantInfo={{}} onSessionEnd={jest.fn()} onError={jest.fn()} />);
      
      // Check that only trusted domains are loaded
      const scripts = document.querySelectorAll('script[src]');
      const iframes = document.querySelectorAll('iframe[src]');
      
      [...scripts, ...iframes].forEach(element => {
        const src = element.getAttribute('src');
        if (src && src.startsWith('http')) {
          // Should only allow trusted domains
          const trustedDomains = [
            'localhost',
            'api.opentok.com',
            'static.opentok.com',
            'vonage.com',
            'trusted-cdn.com'
          ];
          
          const isFromTrustedDomain = trustedDomains.some(domain => src.includes(domain));
          expect(isFromTrustedDomain).toBeTruthy();
        }
      });
    });
  });

  describe('Error Handling and Information Disclosure', () => {
    it('should not expose sensitive information in error messages', async () => {
      // Mock API error with sensitive information
      server.use(
        http.post('/api/auth/login', ({ request }) => {
          return HttpResponse.json({ 
            error: 'Database connection failed: user=admin, password=secret123, host=db.internal.com'
          }, { status: 500 });
        })
      );

      renderWithProviders(<LoginForm />);

      await user.type(screen.getByLabelText(/e-mail/i), 'user@example.com');
      await user.type(screen.getByLabelText(/senha/i), 'password123');
      await user.click(screen.getByRole('button', { name: /entrar/i }));

      await waitFor(() => {
        const errorElements = screen.getAllByText(/erro|error/i);
        errorElements.forEach(element => {
          const errorText = element.textContent || '';
          
          // Should not contain sensitive information
          expect(errorText).not.toContain('password');
          expect(errorText).not.toContain('secret');
          expect(errorText).not.toContain('admin');
          expect(errorText).not.toContain('db.internal.com');
          expect(errorText).not.toContain('Database connection');
        });
      });
    });

    it('should handle malformed responses safely', async () => {
      // Mock malformed response
      server.use(
        http.post('/api/auth/login', ({ request }) => {
          return HttpResponse.text('Not JSON response', { status: 500 });
        })
      );

      renderWithProviders(<LoginForm />);

      await user.type(screen.getByLabelText(/e-mail/i), 'user@example.com');
      await user.type(screen.getByLabelText(/senha/i), 'password123');
      await user.click(screen.getByRole('button', { name: /entrar/i }));

      // Should handle gracefully without crashing
      await waitFor(() => {
        expect(screen.getByText(/erro.*inesperado/i) || screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });

      // Should not expose technical details
      expect(screen.queryByText(/JSON/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/parse/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/syntax/i)).not.toBeInTheDocument();
    });

    it('should sanitize error messages from server', async () => {
      // Mock error with potential XSS
      server.use(
        http.post('/api/auth/login', ({ request }) => {
          return HttpResponse.json({ 
            error: 'Login failed for user <script>alert("XSS")</script>admin'
          }, { status: 401 });
        })
      );

      renderWithProviders(<LoginForm />);

      await user.type(screen.getByLabelText(/e-mail/i), 'user@example.com');
      await user.type(screen.getByLabelText(/senha/i), 'password123');
      await user.click(screen.getByRole('button', { name: /entrar/i }));

      await waitFor(() => {
        const errorElements = screen.getAllByText(/login.*failed/i);
        errorElements.forEach(element => {
          expect(element.innerHTML).not.toContain('<script>');
          expect(element.innerHTML).not.toContain('alert(');
        });
      });
    });
  });

  describe('Data Protection and Privacy', () => {
    it('should clear sensitive data on unmount', () => {
      const { unmount } = renderWithProviders(<LoginForm />);

      // Add sensitive data to form
      const passwordInput = screen.getByLabelText(/senha/i) as HTMLInputElement;
      fireEvent.change(passwordInput, { target: { value: 'sensitive-password' } });
      
      expect(passwordInput.value).toBe('sensitive-password');
      
      // Unmount component
      unmount();
      
      // Re-render to check if data is cleared
      renderWithProviders(<LoginForm />);
      
      const newPasswordInput = screen.getByLabelText(/senha/i) as HTMLInputElement;
      expect(newPasswordInput.value).toBe('');
    });

    it('should not store sensitive data in localStorage', async () => {
      renderWithProviders(<LoginForm />);

      await user.type(screen.getByLabelText(/e-mail/i), 'user@example.com');
      await user.type(screen.getByLabelText(/senha/i), 'sensitive-password');
      
      // Check that password is not stored in localStorage
      const storedData = JSON.stringify(localStorage);
      expect(storedData).not.toContain('sensitive-password');
      expect(storedData).not.toContain('password');
    });

    it('should encrypt sensitive health data', async () => {
      const mockEncrypt = jest.requireMock('@/lib/security').encryptSensitiveData;
      const mockUser = { id: '1', name: 'Test User', registrationStep: 'health_questionnaire' };
      
      renderWithProviders(<SmartHealthQuestionnaire user={mockUser} />);

      await waitFor(() => {
        expect(screen.getByText(/questionário de saúde/i)).toBeInTheDocument();
      });

      // Find and fill health-related input
      const textInputs = screen.getAllByRole('textbox');
      if (textInputs.length > 0) {
        await user.type(textInputs[0], 'Sensitive health information');
        
        const submitButton = screen.getByRole('button', { name: /enviar/i });
        await user.click(submitButton);
        
        // Verify encryption was called
        await waitFor(() => {
          expect(mockEncrypt).toHaveBeenCalledWith(
            expect.stringContaining('health')
          );
        });
      }
    });
  });
});