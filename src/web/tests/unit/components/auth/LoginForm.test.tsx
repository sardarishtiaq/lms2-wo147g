/**
 * @fileoverview Unit test suite for LoginForm component
 * Tests authentication flow, form validation, and multi-tenant functionality
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import LoginForm from '../../../../src/components/auth/LoginForm';
import * as useAuthModule from '../../../../src/hooks/useAuth';

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Mock useAuth hook
const mockLogin = vi.fn();
vi.mock('../../../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    error: null,
    loading: false
  })
}));

// Test data constants
const VALID_CREDENTIALS = {
  email: 'test@example.com',
  password: 'Test@123456',
  tenantId: '123e4567-e89b-12d3-a456-426614174000'
};

const INVALID_CREDENTIALS = {
  email: 'invalid-email',
  password: 'weak',
  tenantId: 'invalid-tenant'
};

describe('LoginForm Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Helper function to render component with providers
  const renderLoginForm = () => {
    return render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );
  };

  describe('Form Rendering', () => {
    it('should render all form fields with proper labels and attributes', () => {
      renderLoginForm();

      // Email field
      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('name', 'email');
      expect(emailInput).toBeRequired();

      // Password field
      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('name', 'password');
      expect(passwordInput).toBeRequired();

      // Tenant ID field
      const tenantInput = screen.getByLabelText(/tenant id/i);
      expect(tenantInput).toHaveAttribute('name', 'tenantId');
      expect(tenantInput).toBeRequired();

      // Submit button
      const submitButton = screen.getByRole('button', { name: /login/i });
      expect(submitButton).toBeEnabled();
    });

    it('should render password visibility toggle', async () => {
      renderLoginForm();
      
      const passwordInput = screen.getByLabelText(/password/i);
      const visibilityToggle = screen.getByRole('button', { 
        name: /toggle password visibility/i 
      });

      expect(passwordInput).toHaveAttribute('type', 'password');
      await user.click(visibilityToggle);
      expect(passwordInput).toHaveAttribute('type', 'text');
      await user.click(visibilityToggle);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Form Validation', () => {
    it('should validate email format', async () => {
      renderLoginForm();
      
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, INVALID_CREDENTIALS.email);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
      });
    });

    it('should validate password complexity requirements', async () => {
      renderLoginForm();
      
      const passwordInput = screen.getByLabelText(/password/i);
      await user.type(passwordInput, INVALID_CREDENTIALS.password);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/password must contain/i)).toBeInTheDocument();
      });
    });

    it('should validate tenant ID format', async () => {
      renderLoginForm();
      
      const tenantInput = screen.getByLabelText(/tenant id/i);
      await user.type(tenantInput, INVALID_CREDENTIALS.tenantId);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/invalid tenant id format/i)).toBeInTheDocument();
      });
    });

    it('should require all fields', async () => {
      renderLoginForm();
      
      const submitButton = screen.getByRole('button', { name: /login/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getAllByText(/required/i)).toHaveLength(3);
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should handle successful login', async () => {
      renderLoginForm();
      
      // Fill form with valid credentials
      await user.type(screen.getByLabelText(/email/i), VALID_CREDENTIALS.email);
      await user.type(screen.getByLabelText(/password/i), VALID_CREDENTIALS.password);
      await user.type(screen.getByLabelText(/tenant id/i), VALID_CREDENTIALS.tenantId);

      // Submit form
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: VALID_CREDENTIALS.email,
          password: VALID_CREDENTIALS.password,
          tenantId: VALID_CREDENTIALS.tenantId
        });
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should show loading state during authentication', async () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        login: vi.fn(() => new Promise(resolve => setTimeout(resolve, 100))),
        error: null,
        loading: true
      });

      renderLoginForm();
      
      await user.type(screen.getByLabelText(/email/i), VALID_CREDENTIALS.email);
      await user.type(screen.getByLabelText(/password/i), VALID_CREDENTIALS.password);
      await user.type(screen.getByLabelText(/tenant id/i), VALID_CREDENTIALS.tenantId);

      await user.click(screen.getByRole('button', { name: /login/i }));

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should handle authentication errors', async () => {
      const errorMessage = 'Invalid credentials';
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        login: vi.fn().mockRejectedValue(new Error(errorMessage)),
        error: errorMessage,
        loading: false
      });

      renderLoginForm();
      
      await user.type(screen.getByLabelText(/email/i), VALID_CREDENTIALS.email);
      await user.type(screen.getByLabelText(/password/i), VALID_CREDENTIALS.password);
      await user.type(screen.getByLabelText(/tenant id/i), VALID_CREDENTIALS.tenantId);

      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should implement rate limiting after max attempts', async () => {
      renderLoginForm();
      
      // Simulate multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByLabelText(/email/i), VALID_CREDENTIALS.email);
        await user.type(screen.getByLabelText(/password/i), 'WrongPass@123');
        await user.type(screen.getByLabelText(/tenant id/i), VALID_CREDENTIALS.tenantId);
        await user.click(screen.getByRole('button', { name: /login/i }));
      }

      await waitFor(() => {
        expect(screen.getByText(/too many failed attempts/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /login/i })).toBeDisabled();
      });
    });
  });

  describe('Security Features', () => {
    it('should trim and sanitize input values', async () => {
      renderLoginForm();
      
      await user.type(screen.getByLabelText(/email/i), ' test@example.com ');
      await user.type(screen.getByLabelText(/password/i), VALID_CREDENTIALS.password);
      await user.type(screen.getByLabelText(/tenant id/i), ' 123e4567-e89b-12d3-a456-426614174000 ');

      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: VALID_CREDENTIALS.password,
          tenantId: '123e4567-e89b-12d3-a456-426614174000'
        });
      });
    });

    it('should prevent form submission during lockout period', async () => {
      const { rerender } = renderLoginForm();
      
      // Simulate lockout
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        login: mockLogin,
        error: 'Account locked. Try again later',
        loading: false
      });

      rerender(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      );

      const submitButton = screen.getByRole('button', { name: /login/i });
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/account locked/i)).toBeInTheDocument();
    });
  });
});