import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { axe } from '@axe-core/react';
import { configureStore } from '@reduxjs/toolkit';

import QuoteForm, { QuoteFormProps } from '../../../../src/components/quotes/QuoteForm';
import { Quote, QuoteStatus } from '../../../../src/types/quote';
import { useQuotes } from '../../../../src/hooks/useQuotes';
import uiReducer from '../../../../src/store/slices/uiSlice';

// Mock useQuotes hook
vi.mock('../../../../src/hooks/useQuotes', () => ({
  useQuotes: vi.fn()
}));

// Mock date picker to avoid date-fns dependency issues
vi.mock('@mui/x-date-pickers', () => ({
  DatePicker: ({ value, onChange, label, renderInput }: any) => {
    return renderInput({
      value,
      onChange: (e: any) => onChange(new Date(e.target.value)),
      label
    });
  }
}));

// Test data generators
const generateMockQuoteData = (overrides = {}) => ({
  leadId: 'lead-123',
  tenantId: 'tenant-123',
  items: [
    {
      productId: 'prod-1',
      description: 'Test Product',
      quantity: 1,
      unitPrice: 100,
      discountPercent: 0,
      taxRate: 10
    }
  ],
  validUntil: new Date('2024-12-31'),
  notes: 'Test notes',
  terms: 'Test terms',
  ...overrides
});

const mockTenantConfig = {
  taxRate: 10,
  roundingPrecision: 2,
  currency: 'USD',
  minQuoteAmount: 0,
  maxQuoteAmount: 100000
};

// Helper function to render component with required providers
const renderQuoteForm = (props: Partial<QuoteFormProps> = {}) => {
  const store = configureStore({
    reducer: { ui: uiReducer }
  });

  const defaultProps: QuoteFormProps = {
    leadId: 'lead-123',
    tenantId: 'tenant-123',
    onSubmitSuccess: vi.fn(),
    onCancel: vi.fn(),
    tenantConfig: mockTenantConfig,
    ...props
  };

  return render(
    <Provider store={store}>
      <QuoteForm {...defaultProps} />
    </Provider>
  );
};

describe('QuoteForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useQuotes as jest.Mock).mockReturnValue({
      createQuote: vi.fn(),
      updateQuote: vi.fn()
    });
  });

  describe('Rendering and Material Design Implementation', () => {
    it('renders all form fields with proper Material-UI components', () => {
      renderQuoteForm();

      // Verify form structure
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByText('Quote Items')).toBeInTheDocument();
      
      // Verify Material-UI components
      expect(screen.getByRole('button', { name: /add item/i })).toHaveClass('MuiButton-outlined');
      expect(screen.getByRole('textbox', { name: /notes/i })).toHaveClass('MuiInputBase-root');
      expect(screen.getByRole('textbox', { name: /terms and conditions/i })).toHaveClass('MuiInputBase-root');
    });

    it('implements responsive layout with proper grid spacing', () => {
      renderQuoteForm();
      
      const gridContainer = screen.getByRole('form').firstChild;
      expect(gridContainer).toHaveClass('MuiGrid-container');
      expect(gridContainer).toHaveStyle({ gap: '24px' }); // MUI default spacing of 3
    });

    it('displays tenant-specific currency and tax rate', () => {
      renderQuoteForm({
        tenantConfig: {
          ...mockTenantConfig,
          currency: 'EUR',
          taxRate: 20
        }
      });

      expect(screen.getByText(/EUR/)).toBeInTheDocument();
      expect(screen.getByText(/20%/)).toBeInTheDocument();
    });
  });

  describe('Quote Item Management', () => {
    it('handles adding and removing quote items with proper calculations', async () => {
      renderQuoteForm();

      // Add new item
      fireEvent.click(screen.getByRole('button', { name: /add item/i }));
      
      // Verify new item form is displayed
      const items = screen.getAllByRole('group', { name: /quote item/i });
      expect(items).toHaveLength(2);

      // Fill in item details
      const newItem = items[1];
      fireEvent.change(within(newItem).getByRole('textbox', { name: /description/i }), {
        target: { value: 'New Product' }
      });
      fireEvent.change(within(newItem).getByRole('spinbutton', { name: /quantity/i }), {
        target: { value: '2' }
      });
      fireEvent.change(within(newItem).getByRole('textbox', { name: /unit price/i }), {
        target: { value: '50' }
      });

      // Wait for calculations to update
      await waitFor(() => {
        expect(screen.getByText(/subtotal: USD 200/i)).toBeInTheDocument();
        expect(screen.getByText(/tax \(10%\): USD 20/i)).toBeInTheDocument();
        expect(screen.getByText(/total: USD 220/i)).toBeInTheDocument();
      });

      // Remove an item
      fireEvent.click(within(items[1]).getByRole('button', { name: /remove item/i }));
      expect(screen.getAllByRole('group', { name: /quote item/i })).toHaveLength(1);
    });

    it('validates quote items against tenant configuration', async () => {
      renderQuoteForm({
        tenantConfig: {
          ...mockTenantConfig,
          minQuoteAmount: 100,
          maxQuoteAmount: 1000
        }
      });

      const item = screen.getByRole('group', { name: /quote item/i });
      
      // Test minimum amount validation
      fireEvent.change(within(item).getByRole('textbox', { name: /unit price/i }), {
        target: { value: '50' }
      });

      await waitFor(() => {
        expect(screen.getByText(/quote total is below minimum/i)).toBeInTheDocument();
      });

      // Test maximum amount validation
      fireEvent.change(within(item).getByRole('textbox', { name: /unit price/i }), {
        target: { value: '2000' }
      });

      await waitFor(() => {
        expect(screen.getByText(/quote total exceeds maximum/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission and Tenant Isolation', () => {
    it('submits form with proper tenant context and validation', async () => {
      const mockCreateQuote = vi.fn().mockResolvedValue({ id: 'quote-123' });
      (useQuotes as jest.Mock).mockReturnValue({ createQuote: mockCreateQuote });

      const onSubmitSuccess = vi.fn();
      renderQuoteForm({ onSubmitSuccess });

      // Fill required fields
      fireEvent.change(screen.getByRole('textbox', { name: /terms and conditions/i }), {
        target: { value: 'Test Terms' }
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /create quote/i }));

      await waitFor(() => {
        expect(mockCreateQuote).toHaveBeenCalledWith(expect.objectContaining({
          tenantId: 'tenant-123',
          leadId: 'lead-123'
        }));
        expect(onSubmitSuccess).toHaveBeenCalled();
      });
    });

    it('handles form submission errors with proper error display', async () => {
      const mockError = new Error('Submission failed');
      const mockCreateQuote = vi.fn().mockRejectedValue(mockError);
      (useQuotes as jest.Mock).mockReturnValue({ createQuote: mockCreateQuote });

      renderQuoteForm();

      fireEvent.click(screen.getByRole('button', { name: /create quote/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to save quote');
      });
    });
  });

  describe('Accessibility Requirements', () => {
    it('meets WCAG accessibility standards', async () => {
      const { container } = renderQuoteForm();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('implements proper keyboard navigation', () => {
      renderQuoteForm();

      const form = screen.getByRole('form');
      const focusableElements = form.querySelectorAll('button, input, textarea, [tabindex="0"]');
      
      // Verify tab order
      focusableElements.forEach((element) => {
        element.focus();
        expect(document.activeElement).toBe(element);
      });
    });

    it('provides proper ARIA labels and roles', () => {
      renderQuoteForm();

      expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Quote Form');
      expect(screen.getByRole('button', { name: /create quote/i })).toHaveAttribute('type', 'submit');
      expect(screen.getByRole('textbox', { name: /notes/i })).toHaveAttribute('aria-label', 'Quote Notes');
    });
  });
});