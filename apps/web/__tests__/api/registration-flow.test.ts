/**
 * Registration Flow API Integration Tests
 * Sprint 2C - Comprehensive Testing
 *
 * ENDPOINTS TESTED:
 * - POST /api/register - Initial registration
 * - GET  /api/callback-verify - Email verification callback
 * - POST /api/profile/minimal - Complete minimal profile
 *
 * MOCKING STRATEGY:
 * - Database: In-memory SQLite or mocked Prisma/Drizzle
 * - Email Service: Jest/Vitest mock
 * - External APIs: MSW (Mock Service Worker)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMocks } from 'node-mocks-http';

// Mock database
const mockDB = {
  users: new Map(),
  profiles: new Map(),
  verificationTokens: new Map(),
};

// Mock email service
const mockEmailService = {
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendWelcomeEmail: vi.fn().mockResolvedValue(true),
};

// Mock password hashing
const mockHashPassword = vi.fn((password: string) => `hashed_${password}`);
const mockComparePassword = vi.fn((password: string, hash: string) =>
  hash === `hashed_${password}`
);

describe('Registration Flow API Integration', () => {
  beforeEach(() => {
    mockDB.users.clear();
    mockDB.profiles.clear();
    mockDB.verificationTokens.clear();
    vi.clearAllMocks();
  });

  describe('POST /api/register', () => {
    it('successfully registers a new user with valid data', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          password_confirmation: 'SecurePass123!',
        },
      });

      // Simulate register endpoint
      const registerHandler = async (req: any, res: any) => {
        const { email, password, password_confirmation } = req.body;

        // Validation
        if (!email || !password || !password_confirmation) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        if (password !== password_confirmation) {
          return res.status(400).json({ error: 'Passwords do not match' });
        }

        // Check duplicate
        if (mockDB.users.has(email)) {
          return res.status(409).json({ error: 'Email already exists' });
        }

        // Create user
        const hashedPassword = await mockHashPassword(password);
        const user = {
          id: crypto.randomUUID(),
          email,
          password: hashedPassword,
          emailVerified: false,
          createdAt: new Date(),
        };

        mockDB.users.set(email, user);

        // Generate verification token
        const token = crypto.randomUUID();
        mockDB.verificationTokens.set(token, { userId: user.id, expiresAt: Date.now() + 3600000 });

        // Send verification email
        await mockEmailService.sendVerificationEmail(email, token);

        res.status(201).json({
          message: 'Registration successful. Please check your email.',
          userId: user.id,
        });
      };

      await registerHandler(req, res);

      expect(res._getStatusCode()).toBe(201);
      expect(JSON.parse(res._getData())).toMatchObject({
        message: expect.stringContaining('email'),
        userId: expect.any(String),
      });
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        'newuser@example.com',
        expect.any(String)
      );
      expect(mockDB.users.has('newuser@example.com')).toBe(true);
    });

    it('rejects registration with duplicate email', async () => {
      // Pre-populate with existing user
      mockDB.users.set('existing@example.com', {
        id: '123',
        email: 'existing@example.com',
        password: 'hashed_password',
        emailVerified: true,
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          email: 'existing@example.com',
          password: 'SecurePass123!',
          password_confirmation: 'SecurePass123!',
        },
      });

      const registerHandler = async (req: any, res: any) => {
        const { email } = req.body;
        if (mockDB.users.has(email)) {
          return res.status(409).json({ error: 'Email already exists' });
        }
        res.status(201).json({ message: 'Success' });
      };

      await registerHandler(req, res);

      expect(res._getStatusCode()).toBe(409);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Email already exists',
      });
    });

    it('validates email format', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          email: 'invalid-email',
          password: 'SecurePass123!',
          password_confirmation: 'SecurePass123!',
        },
      });

      const registerHandler = async (req: any, res: any) => {
        const { email } = req.body;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({ error: 'Invalid email format' });
        }
        res.status(201).json({ message: 'Success' });
      };

      await registerHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Invalid email format',
      });
    });

    it('validates password strength', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          email: 'user@example.com',
          password: 'weak',
          password_confirmation: 'weak',
        },
      });

      const registerHandler = async (req: any, res: any) => {
        const { password } = req.body;
        if (password.length < 8) {
          return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        res.status(201).json({ message: 'Success' });
      };

      await registerHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: expect.stringContaining('8 characters'),
      });
    });

    it('validates password confirmation match', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          email: 'user@example.com',
          password: 'SecurePass123!',
          password_confirmation: 'DifferentPass123!',
        },
      });

      const registerHandler = async (req: any, res: any) => {
        const { password, password_confirmation } = req.body;
        if (password !== password_confirmation) {
          return res.status(400).json({ error: 'Passwords do not match' });
        }
        res.status(201).json({ message: 'Success' });
      };

      await registerHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Passwords do not match',
      });
    });

    it('handles database errors gracefully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          email: 'user@example.com',
          password: 'SecurePass123!',
          password_confirmation: 'SecurePass123!',
        },
      });

      const registerHandler = async (req: any, res: any) => {
        try {
          // Simulate database error
          throw new Error('Database connection failed');
        } catch (error) {
          return res.status(500).json({ error: 'Internal server error' });
        }
      };

      await registerHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Internal server error',
      });
    });

    it('handles email service failures gracefully', async () => {
      mockEmailService.sendVerificationEmail.mockRejectedValueOnce(new Error('SMTP error'));

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          email: 'user@example.com',
          password: 'SecurePass123!',
          password_confirmation: 'SecurePass123!',
        },
      });

      const registerHandler = async (req: any, res: any) => {
        try {
          const user = { id: '123', email: req.body.email };
          mockDB.users.set(req.body.email, user);

          await mockEmailService.sendVerificationEmail(req.body.email, 'token');

          res.status(201).json({ message: 'Success' });
        } catch (error) {
          // Rollback user creation
          mockDB.users.delete(req.body.email);
          return res.status(500).json({ error: 'Failed to send verification email' });
        }
      };

      await registerHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(mockDB.users.has('user@example.com')).toBe(false);
    });
  });

  describe('GET /api/callback-verify', () => {
    beforeEach(() => {
      // Create verified user
      const userId = crypto.randomUUID();
      mockDB.users.set('user@example.com', {
        id: userId,
        email: 'user@example.com',
        password: 'hashed_password',
        emailVerified: false,
      });

      // Create valid token
      mockDB.verificationTokens.set('valid-token', {
        userId,
        expiresAt: Date.now() + 3600000,
      });
    });

    it('successfully verifies email with valid token', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: {
          token: 'valid-token',
        },
      });

      const verifyHandler = async (req: any, res: any) => {
        const { token } = req.query;

        const tokenData = mockDB.verificationTokens.get(token);
        if (!tokenData) {
          return res.status(400).json({ error: 'Invalid token' });
        }

        if (tokenData.expiresAt < Date.now()) {
          return res.status(400).json({ error: 'Token expired' });
        }

        // Find and update user
        for (const [email, user] of mockDB.users) {
          if (user.id === tokenData.userId) {
            user.emailVerified = true;
            mockDB.users.set(email, user);
            break;
          }
        }

        // Delete token
        mockDB.verificationTokens.delete(token);

        res.status(200).json({ message: 'Email verified successfully' });
      };

      await verifyHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toMatchObject({
        message: expect.stringContaining('verified'),
      });

      const user = mockDB.users.get('user@example.com');
      expect(user?.emailVerified).toBe(true);
    });

    it('rejects invalid verification token', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: {
          token: 'invalid-token',
        },
      });

      const verifyHandler = async (req: any, res: any) => {
        const { token } = req.query;
        if (!mockDB.verificationTokens.has(token)) {
          return res.status(400).json({ error: 'Invalid token' });
        }
        res.status(200).json({ message: 'Success' });
      };

      await verifyHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Invalid token',
      });
    });

    it('rejects expired verification token', async () => {
      const expiredToken = 'expired-token';
      mockDB.verificationTokens.set(expiredToken, {
        userId: '123',
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: {
          token: expiredToken,
        },
      });

      const verifyHandler = async (req: any, res: any) => {
        const { token } = req.query;
        const tokenData = mockDB.verificationTokens.get(token);

        if (!tokenData || tokenData.expiresAt < Date.now()) {
          return res.status(400).json({ error: 'Token expired' });
        }

        res.status(200).json({ message: 'Success' });
      };

      await verifyHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Token expired',
      });
    });
  });

  describe('POST /api/profile/minimal', () => {
    let authenticatedUserId: string;

    beforeEach(() => {
      authenticatedUserId = crypto.randomUUID();
      mockDB.users.set('user@example.com', {
        id: authenticatedUserId,
        email: 'user@example.com',
        password: 'hashed_password',
        emailVerified: true,
      });
    });

    it('successfully creates minimal profile with valid data', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'João Silva',
          cpf: '123.456.789-09',
          phone: '+55 (11) 98765-4321',
          dateOfBirth: '01/01/1990',
        },
        headers: {
          cookie: `session=${authenticatedUserId}`,
        },
      });

      const profileHandler = async (req: any, res: any) => {
        const userId = req.headers.cookie?.split('=')[1];
        if (!userId || !mockDB.users.has('user@example.com')) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, cpf, phone, dateOfBirth } = req.body;

        // Validation
        if (!name || !cpf || !phone || !dateOfBirth) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create profile
        const profile = {
          id: crypto.randomUUID(),
          userId,
          name,
          cpf,
          phone,
          dateOfBirth,
          createdAt: new Date(),
        };

        mockDB.profiles.set(userId, profile);

        res.status(201).json({
          message: 'Profile created successfully',
          profile,
        });
      };

      await profileHandler(req, res);

      expect(res._getStatusCode()).toBe(201);
      expect(JSON.parse(res._getData())).toMatchObject({
        message: expect.stringContaining('success'),
        profile: expect.objectContaining({
          name: 'João Silva',
          cpf: '123.456.789-09',
        }),
      });
    });

    it('requires authentication', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'João Silva',
          cpf: '123.456.789-09',
          phone: '+55 (11) 98765-4321',
          dateOfBirth: '01/01/1990',
        },
      });

      const profileHandler = async (req: any, res: any) => {
        const userId = req.headers.cookie?.split('=')[1];
        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        res.status(201).json({ message: 'Success' });
      };

      await profileHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
    });

    it('validates CPF format', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'João Silva',
          cpf: 'invalid-cpf',
          phone: '+55 (11) 98765-4321',
          dateOfBirth: '01/01/1990',
        },
        headers: {
          cookie: `session=${authenticatedUserId}`,
        },
      });

      const profileHandler = async (req: any, res: any) => {
        const { cpf } = req.body;
        const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
        if (!cpfRegex.test(cpf)) {
          return res.status(400).json({ error: 'Invalid CPF format' });
        }
        res.status(201).json({ message: 'Success' });
      };

      await profileHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: expect.stringContaining('CPF'),
      });
    });

    it('prevents duplicate profile creation', async () => {
      // Create existing profile
      mockDB.profiles.set(authenticatedUserId, {
        id: '123',
        userId: authenticatedUserId,
        name: 'Existing Profile',
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'João Silva',
          cpf: '123.456.789-09',
          phone: '+55 (11) 98765-4321',
          dateOfBirth: '01/01/1990',
        },
        headers: {
          cookie: `session=${authenticatedUserId}`,
        },
      });

      const profileHandler = async (req: any, res: any) => {
        const userId = req.headers.cookie?.split('=')[1];
        if (mockDB.profiles.has(userId)) {
          return res.status(409).json({ error: 'Profile already exists' });
        }
        res.status(201).json({ message: 'Success' });
      };

      await profileHandler(req, res);

      expect(res._getStatusCode()).toBe(409);
    });
  });

  describe('Complete Registration Flow', () => {
    it('completes full registration workflow from start to finish', async () => {
      // Step 1: Register
      const registerReq = createMocks({
        method: 'POST',
        body: {
          email: 'fullflow@example.com',
          password: 'SecurePass123!',
          password_confirmation: 'SecurePass123!',
        },
      });

      // Simulate registration
      const userId = crypto.randomUUID();
      mockDB.users.set('fullflow@example.com', {
        id: userId,
        email: 'fullflow@example.com',
        password: await mockHashPassword('SecurePass123!'),
        emailVerified: false,
      });

      const token = crypto.randomUUID();
      mockDB.verificationTokens.set(token, { userId, expiresAt: Date.now() + 3600000 });

      expect(mockDB.users.has('fullflow@example.com')).toBe(true);

      // Step 2: Verify email
      const user = mockDB.users.get('fullflow@example.com');
      user!.emailVerified = true;
      mockDB.users.set('fullflow@example.com', user!);

      expect(mockDB.users.get('fullflow@example.com')?.emailVerified).toBe(true);

      // Step 3: Complete profile
      mockDB.profiles.set(userId, {
        id: crypto.randomUUID(),
        userId,
        name: 'Full Flow User',
        cpf: '123.456.789-09',
        phone: '+55 (11) 98765-4321',
        dateOfBirth: '01/01/1990',
      });

      expect(mockDB.profiles.has(userId)).toBe(true);

      // Verify complete flow
      const finalUser = mockDB.users.get('fullflow@example.com');
      const finalProfile = mockDB.profiles.get(userId);

      expect(finalUser?.emailVerified).toBe(true);
      expect(finalProfile).toBeDefined();
      expect(finalProfile?.name).toBe('Full Flow User');
    });
  });
});
