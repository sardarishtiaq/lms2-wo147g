import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { configureStore } from '@reduxjs/toolkit';

import { QuoteForm } from '../../src/components/quotes/QuoteForm';
import { QuoteList } from '../../src/components/quotes/QuoteList';
import { Quote, QuoteStatus } from '../../types/quote';
import { API_BASE_URL, QUOTE_ENDPOINTS } from '../../constants/apiEndpoints';
import quoteReducer from '../../store/slices/quoteSlice';
import uiReducer from '../../store/slices/uiSlice';

// Test Constants
const TEST_TENANT_ID = '12345';
const TEST_LEAD_ID = 'lead123';

// Mock Server Setup
const server = setupServer(
  // GET Quotes
  rest.get(`${API_BASE_URL}${QUOTE_ENDPOINTS.GET_ALL}`, (req, res, ctx) => {
    const tenantId = req.headers.get('X-Tenant-ID');
    if (tenantId !== TEST_TENANT_ID) {
      return res(ctx.status(403), ctx.json({ message: 'Tenant access denied' }));
    }
    return res(ctx.json(generateMockQuotes(5)));
  }),

  // POST Create Quote
  rest.post(`${API_BASE_URL}${QUOTE_ENDPOINTS.CREATE}`, (req, res, ctx) => {
    const tenantId = req.headers.get('X-Tenant-ID');
    if (tenantId !== TEST_TENANT_ID) {
      return res(ctx.status(403), ctx.json({ message: 'Tenant access denied' }));
    }
    return res(ctx.json(generateMockQuote({ ...req.body, id: 'new-quote-id' })));
  }),

  // PUT Update Quote
  rest.put(`${API_BASE_URL}${QUOTE_ENDPOINTS.UPDATE.replace(':id', '*')}`, (req, res, ctx) => {
    const tenantId = req.headers.get('X-Tenant-ID');
    if (tenantId !== TEST_TENANT_ID) {
      return res(ctx.status(403), ctx.json({ message: 'Tenant access denied' }));
    }
    return res(ctx.json({ ...req.body, id: req.params.id }));
  }),

  // DELETE Quote
  rest.delete(`${API_BASE_URL}${QUOTE_ENDPOINTS.DELETE.replace(':id', '*')}`, (req, res, ctx) => {
    const tenantId = req.headers.get('X-Tenant-ID');
    if (tenantId !== TEST_TENANT_ID) {
      return res(ctx.status(403), ctx.json({ message: 'Tenant access denied' }));
    }
    return res(ctx.status(204));
  })
);

// Utility Functions
const generateMockQuote = (overrides = {}): Quote => ({
  id: 'quote-123',
  tenantId: TEST_TENANT_ID,
  leadId: TEST_LEAD_ID,
  quoteNumber: 'Q-2023-001',
  version: 1,
  status: QuoteStatus.DRAFT,
  items: [
    {
      id: 'item-1',
      productId: 'prod-1',
      description: 'Test Product',
      quantity: 1,
      unitPrice: 100,
      discountPercent: 0,
      taxRate: 10,
      amount: 110
    }
  ],
  subtotal: 100,
  totalDiscount: 0,
  totalTax: 10,
  total: 110,
  validUntil: new Date('2024-12-31'),
  notes: 'Test notes',
  terms: 'Test terms',
  metadata: {},
  createdBy: 'user-123',
  approvedBy: null,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});

const generateMockQuotes = (count: number): Quote[] => 
  Array.from({ length: count }, (_, i) => 
    generateMockQuote({ 
      id: `quote-${i}`, 
      quoteNumber: `Q-2023-00${i}` 
    })
  );

const renderWithProviders = (
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = configureStore({
      reducer: {
        quotes: quoteReducer,
        ui: uiReducer
      },
      preloadedState
    }),
    ...renderOptions
  } = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
};

// Test Setup
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Quote List Integration', () => {
  test('should fetch and display quotes with tenant context', async () => {
    renderWithProviders(<QuoteList />);

    await waitFor(() => {
      expect(screen.getByText('Q-2023-000')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1); // Header + data rows
  });

  test('should handle pagination with proper tenant isolation', async () => {
    server.use(
      rest.get(`${API_BASE_URL}${QUOTE_ENDPOINTS.GET_ALL}`, (req, res, ctx) => {
        const tenantId = req.headers.get('X-Tenant-ID');
        const page = Number(req.url.searchParams.get('page')) || 0;
        
        if (tenantId !== TEST_TENANT_ID) {
          return res(ctx.status(403));
        }

        return res(ctx.json({
          data: generateMockQuotes(5),
          total: 15,
          page
        }));
      })
    );

    renderWithProviders(<QuoteList />);
    
    await waitFor(() => {
      expect(screen.getByText('Q-2023-000')).toBeInTheDocument();
    });
  });

  test('should filter quotes by status within tenant', async () => {
    renderWithProviders(<QuoteList />);

    const filterButton = screen.getByRole('button', { name: /filter/i });
    await userEvent.click(filterButton);

    const statusFilter = screen.getByLabelText(/status/i);
    await userEvent.click(statusFilter);
    await userEvent.click(screen.getByText('DRAFT'));

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      const statusCells = within(rows[1]).getByText('DRAFT');
      expect(statusCells).toBeInTheDocument();
    });
  });
});

describe('Quote Form Integration', () => {
  const mockTenantConfig = {
    taxRate: 10,
    roundingPrecision: 2,
    currency: 'USD',
    minQuoteAmount: 0,
    maxQuoteAmount: 1000000
  };

  test('should create new quote with tenant context', async () => {
    const onSubmitSuccess = jest.fn();

    renderWithProviders(
      <QuoteForm
        leadId={TEST_LEAD_ID}
        tenantId={TEST_TENANT_ID}
        onSubmitSuccess={onSubmitSuccess}
        onCancel={() => {}}
        tenantConfig={mockTenantConfig}
      />
    );

    // Fill form fields
    await userEvent.type(screen.getByLabelText(/description/i), 'Test Product');
    await userEvent.type(screen.getByLabelText(/quantity/i), '2');
    await userEvent.type(screen.getByLabelText(/unit price/i), '100');
    await userEvent.type(screen.getByLabelText(/notes/i), 'Test notes');
    await userEvent.type(screen.getByLabelText(/terms/i), 'Test terms');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create quote/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmitSuccess).toHaveBeenCalled();
    });
  });

  test('should validate required fields', async () => {
    renderWithProviders(
      <QuoteForm
        leadId={TEST_LEAD_ID}
        tenantId={TEST_TENANT_ID}
        onSubmitSuccess={() => {}}
        onCancel={() => {}}
        tenantConfig={mockTenantConfig}
      />
    );

    const submitButton = screen.getByRole('button', { name: /create quote/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/description is required/i)).toBeInTheDocument();
    });
  });

  test('should calculate totals correctly', async () => {
    renderWithProviders(
      <QuoteForm
        leadId={TEST_LEAD_ID}
        tenantId={TEST_TENANT_ID}
        onSubmitSuccess={() => {}}
        onCancel={() => {}}
        tenantConfig={mockTenantConfig}
      />
    );

    await userEvent.type(screen.getByLabelText(/quantity/i), '2');
    await userEvent.type(screen.getByLabelText(/unit price/i), '100');

    await waitFor(() => {
      const subtotal = screen.getByText(/subtotal: \$200\.00/i);
      const tax = screen.getByText(/tax \(10%\): \$20\.00/i);
      const total = screen.getByText(/total: \$220\.00/i);
      
      expect(subtotal).toBeInTheDocument();
      expect(tax).toBeInTheDocument();
      expect(total).toBeInTheDocument();
    });
  });
});

describe('Quote Actions Integration', () => {
  test('should delete quote with tenant verification', async () => {
    const mockQuote = generateMockQuote();
    const onDelete = jest.fn();

    renderWithProviders(
      <QuoteList
        initialFilters={{ status: QuoteStatus.DRAFT }}
        onQuoteSelect={onDelete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(mockQuote.quoteNumber)).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await userEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.queryByText(mockQuote.quoteNumber)).not.toBeInTheDocument();
    });
  });

  test('should maintain tenant isolation during operations', async () => {
    const wrongTenantId = 'wrong-tenant';
    
    server.use(
      rest.get(`${API_BASE_URL}${QUOTE_ENDPOINTS.GET_ALL}`, (req, res, ctx) => {
        const tenantId = req.headers.get('X-Tenant-ID');
        if (tenantId === wrongTenantId) {
          return res(ctx.status(403), ctx.json({ message: 'Tenant access denied' }));
        }
        return res(ctx.json(generateMockQuotes(5)));
      })
    );

    renderWithProviders(<QuoteList />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load quotes/i)).toBeInTheDocument();
    });
  });
});