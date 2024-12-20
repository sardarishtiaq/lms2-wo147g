import { rest, HttpResponse } from 'msw';
import { delay } from 'msw';
import { 
  AUTH_ENDPOINTS, 
  LEAD_ENDPOINTS, 
  QUOTE_ENDPOINTS 
} from '../../src/constants/apiEndpoints';

// Constants for mock configuration
const DEFAULT_PAGE_SIZE = 10;
const MOCK_JWT_SECRET = 'test-secret';
const SIMULATED_NETWORK_DELAY = 1000;
const MOCK_ERROR_RATE = 0.1;

// Lead pipeline categories
const LEAD_CATEGORIES = [
  'unassigned',
  'assigned',
  'working',
  'pre_qualified',
  'ready_for_demo',
  'pipeline',
  'repeating_customer',
  'one_time_customer',
  'not_interested',
  'report_to_lead_gen',
  'demo_scheduled',
  'converted'
] as const;

// Mock data generators
const generateMockToken = (tenantId: string, userId: string) => {
  return `mock.${btoa(JSON.stringify({ tenantId, userId, exp: Date.now() + 900000 }))}.token`;
};

const generateMockRefreshToken = () => {
  return `refresh.${Date.now()}.token`;
};

const generateMockLead = (tenantId: string, category: string) => ({
  id: `lead_${Date.now()}`,
  tenantId,
  category,
  name: `Test Lead ${Math.random().toString(36).substring(7)}`,
  email: `lead_${Math.random().toString(36).substring(7)}@test.com`,
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

const generateMockQuote = (leadId: string, tenantId: string) => ({
  id: `quote_${Date.now()}`,
  leadId,
  tenantId,
  amount: Math.floor(Math.random() * 10000),
  status: 'draft',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// Authentication Handlers
const authHandlers = [
  // Login handler
  rest.post(AUTH_ENDPOINTS.LOGIN, async (req) => {
    await delay(SIMULATED_NETWORK_DELAY);

    const { email, password, tenantId } = await req.json();

    if (!email || !password || !tenantId) {
      return HttpResponse.json(
        { error: 'Missing required credentials' },
        { status: 400 }
      );
    }

    // Simulate authentication
    if (Math.random() < MOCK_ERROR_RATE) {
      return HttpResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const mockUserId = 'user_123';
    const accessToken = generateMockToken(tenantId, mockUserId);
    const refreshToken = generateMockRefreshToken();

    return HttpResponse.json({
      accessToken,
      refreshToken,
      user: {
        id: mockUserId,
        email,
        tenantId,
        role: 'agent'
      }
    });
  }),

  // Token refresh handler
  rest.post(AUTH_ENDPOINTS.REFRESH, async (req) => {
    await delay(SIMULATED_NETWORK_DELAY);

    const { refreshToken } = await req.json();
    
    if (!refreshToken) {
      return HttpResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    const newAccessToken = generateMockToken('tenant_123', 'user_123');
    const newRefreshToken = generateMockRefreshToken();

    return HttpResponse.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  }),

  // Logout handler
  rest.post(AUTH_ENDPOINTS.LOGOUT, async () => {
    await delay(SIMULATED_NETWORK_DELAY);
    return HttpResponse.json({ message: 'Logged out successfully' });
  })
];

// Lead Management Handlers
const leadHandlers = [
  // Get all leads
  rest.get(LEAD_ENDPOINTS.GET_ALL, async (req) => {
    await delay(SIMULATED_NETWORK_DELAY);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const category = url.searchParams.get('category');
    const tenantId = url.searchParams.get('tenantId');

    if (!tenantId) {
      return HttpResponse.json(
        { error: 'Missing tenant context' },
        { status: 400 }
      );
    }

    const mockLeads = Array(DEFAULT_PAGE_SIZE)
      .fill(null)
      .map(() => generateMockLead(tenantId, category || LEAD_CATEGORIES[0]));

    return HttpResponse.json({
      data: mockLeads,
      pagination: {
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        totalPages: 10,
        totalItems: 100
      }
    });
  }),

  // Create lead
  rest.post(LEAD_ENDPOINTS.CREATE, async (req) => {
    await delay(SIMULATED_NETWORK_DELAY);

    const { tenantId, category, ...leadData } = await req.json();

    if (!tenantId || !category) {
      return HttpResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const newLead = generateMockLead(tenantId, category);
    return HttpResponse.json(newLead);
  }),

  // Update lead category
  rest.patch(LEAD_ENDPOINTS.UPDATE_CATEGORY, async (req) => {
    await delay(SIMULATED_NETWORK_DELAY);

    const { category } = await req.json();
    
    if (!LEAD_CATEGORIES.includes(category as any)) {
      return HttpResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      message: 'Category updated successfully'
    });
  })
];

// Quote Management Handlers
const quoteHandlers = [
  // Get all quotes
  rest.get(QUOTE_ENDPOINTS.GET_ALL, async (req) => {
    await delay(SIMULATED_NETWORK_DELAY);

    const url = new URL(req.url);
    const leadId = url.searchParams.get('leadId');
    const tenantId = url.searchParams.get('tenantId');

    if (!tenantId) {
      return HttpResponse.json(
        { error: 'Missing tenant context' },
        { status: 400 }
      );
    }

    const mockQuotes = Array(DEFAULT_PAGE_SIZE)
      .fill(null)
      .map(() => generateMockQuote(leadId || 'lead_123', tenantId));

    return HttpResponse.json({
      data: mockQuotes,
      pagination: {
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        totalPages: 5,
        totalItems: 50
      }
    });
  }),

  // Create quote
  rest.post(QUOTE_ENDPOINTS.CREATE, async (req) => {
    await delay(SIMULATED_NETWORK_DELAY);

    const { leadId, tenantId, ...quoteData } = await req.json();

    if (!leadId || !tenantId) {
      return HttpResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const newQuote = generateMockQuote(leadId, tenantId);
    return HttpResponse.json(newQuote);
  }),

  // Generate quote document
  rest.post(QUOTE_ENDPOINTS.GENERATE_PDF, async (req) => {
    await delay(SIMULATED_NETWORK_DELAY);

    return HttpResponse.json({
      documentUrl: `https://mock-storage.test/quotes/quote_${Date.now()}.pdf`
    });
  })
];

// Export all handlers
export const handlers = [
  ...authHandlers,
  ...leadHandlers,
  ...quoteHandlers
];