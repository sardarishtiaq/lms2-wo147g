import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useLeads } from '../../../src/hooks/useLeads';
import { Lead, LeadCategory } from '../../../src/types/lead';
import { WebSocketService, WEBSOCKET_EVENTS } from '../../../src/services/websocket';
import leadReducer from '../../../src/store/slices/leadSlice';
import uiReducer from '../../../src/store/slices/uiSlice';

// Mock WebSocket service
jest.mock('../../../src/services/websocket', () => ({
  WebSocketService: jest.fn().mockImplementation(() => ({
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
  })),
  WEBSOCKET_EVENTS: {
    LEAD_UPDATED: 'lead:updated'
  }
}));

// Mock lead data for testing
const mockLead: Lead = {
  id: 'test-lead-1',
  tenantId: 'test-tenant-1',
  category: LeadCategory.NEW_DATA,
  assignedTo: null,
  status: 'active',
  priority: 3,
  company: 'Test Company',
  contactName: 'John Doe',
  email: 'john@test.com',
  phone: '+1234567890',
  source: 'website',
  metadata: {},
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  lastActivityAt: '2023-01-01T00:00:00Z',
  score: 75
};

// Test setup utilities
const setupTest = (initialState = {}) => {
  const store = configureStore({
    reducer: {
      leads: leadReducer,
      ui: uiReducer
    },
    preloadedState: initialState
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    store,
    wrapper
  };
};

describe('useLeads Hook', () => {
  const tenantId = 'test-tenant-1';
  let mockWebSocket: jest.Mocked<WebSocketService>;

  beforeEach(() => {
    mockWebSocket = new WebSocketService() as jest.Mocked<WebSocketService>;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useLeads(tenantId), { wrapper });

    expect(result.current.loading).toBeFalsy();
    expect(result.current.error).toBeNull();
    expect(result.current.retryCount).toBe(0);
    expect(result.current.optimisticUpdates.size).toBe(0);
  });

  it('should handle lead fetching with pagination and filters', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useLeads(tenantId), { wrapper });

    const filters = {
      category: [LeadCategory.NEW_DATA],
      assignedTo: [],
      status: ['active'],
      priority: [3],
      dateRange: { start: '', end: '' },
      score: { min: 0, max: 100 },
      source: []
    };

    const pagination = {
      page: 1,
      limit: 10
    };

    await act(async () => {
      await result.current.fetchLeads(filters, pagination);
    });

    expect(result.current.loading).toBeFalsy();
    expect(result.current.error).toBeNull();
  });

  it('should handle lead creation with optimistic updates', async () => {
    const { wrapper, store } = setupTest();
    const { result } = renderHook(() => useLeads(tenantId), { wrapper });

    const newLeadData = {
      company: 'New Company',
      contactName: 'Jane Doe',
      email: 'jane@test.com',
      phone: '+1987654321',
      category: LeadCategory.NEW_DATA,
      priority: 2,
      source: 'referral',
      metadata: {}
    };

    await act(async () => {
      await result.current.createLead(newLeadData);
    });

    expect(mockWebSocket.emit).toHaveBeenCalledWith(
      WEBSOCKET_EVENTS.LEAD_UPDATED,
      expect.any(Object)
    );
  });

  it('should handle real-time lead updates through WebSocket', async () => {
    const { wrapper, store } = setupTest();
    const { result } = renderHook(() => useLeads(tenantId), { wrapper });

    // Simulate WebSocket subscription
    const mockSubscribe = mockWebSocket.subscribe as jest.Mock;
    expect(mockSubscribe).toHaveBeenCalledWith(
      WEBSOCKET_EVENTS.LEAD_UPDATED,
      expect.any(Function),
      expect.objectContaining({ tenant: tenantId })
    );

    // Simulate incoming WebSocket event
    const updatedLead = { ...mockLead, status: 'updated' };
    await act(async () => {
      const handler = mockSubscribe.mock.calls[0][1];
      handler({ data: updatedLead, tenantId });
    });

    // Verify state updates
    const state = store.getState();
    expect(state.leads.leads).toContainEqual(updatedLead);
  });

  it('should maintain tenant isolation in all operations', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useLeads(tenantId), { wrapper });

    // Attempt to create lead with different tenant
    const wrongTenantLead = {
      ...mockLead,
      tenantId: 'wrong-tenant'
    };

    await act(async () => {
      try {
        await result.current.createLead(wrongTenantLead);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    // Verify WebSocket tenant isolation
    expect(mockWebSocket.subscribe).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function),
      expect.objectContaining({ tenant: tenantId })
    );
  });

  it('should handle lead category updates with optimistic updates', async () => {
    const { wrapper, store } = setupTest();
    const { result } = renderHook(() => useLeads(tenantId), { wrapper });

    const leadId = mockLead.id;
    const newCategory = LeadCategory.WORKING_ON;

    await act(async () => {
      await result.current.updateLeadCategory(leadId, newCategory);
    });

    expect(mockWebSocket.emit).toHaveBeenCalledWith(
      WEBSOCKET_EVENTS.LEAD_UPDATED,
      expect.objectContaining({
        data: expect.objectContaining({
          id: leadId,
          category: newCategory
        })
      })
    );
  });

  it('should handle errors with retry mechanism', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useLeads(tenantId), { wrapper });

    const operation = jest.fn().mockRejectedValueOnce(new Error('Test error'));

    await act(async () => {
      try {
        await result.current.retryOperation(operation);
      } catch (error) {
        expect(error).toBeDefined();
        expect(result.current.retryCount).toBeGreaterThan(0);
      }
    });
  });
});