import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DragDropContext } from 'react-beautiful-dnd';
import { LeadBoard } from '../../src/components/leads/LeadBoard';
import { useLeads } from '../../src/hooks/useLeads';
import { LeadCategory } from '../../src/constants/leadCategories';
import leadReducer from '../../src/store/slices/leadSlice';
import uiReducer from '../../src/store/slices/uiSlice';
import { WebSocketService } from '../../src/services/websocket';

// Mock WebSocket service
jest.mock('../../src/services/websocket');

// Mock data for testing
const mockLeadData = [
  {
    id: 'lead-1',
    tenantId: 'tenant-1',
    category: LeadCategory.UNASSIGNED,
    company: 'Test Company 1',
    contactName: 'John Doe',
    email: 'john@test.com',
    phone: '+1234567890',
    status: 'active',
    priority: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    metadata: {}
  },
  {
    id: 'lead-2',
    tenantId: 'tenant-1',
    category: LeadCategory.WORKING_ON,
    company: 'Test Company 2',
    contactName: 'Jane Smith',
    email: 'jane@test.com',
    phone: '+1234567891',
    status: 'active',
    priority: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    metadata: {}
  }
];

// Helper function to render components with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    preloadedState = {},
    tenantId = 'tenant-1',
    store = configureStore({
      reducer: {
        leads: leadReducer,
        ui: uiReducer
      },
      preloadedState,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: false,
          thunk: {
            extraArgument: { tenantId }
          }
        })
    })
  } = {}
) => {
  return {
    store,
    ...render(
      <Provider store={store}>
        {ui}
      </Provider>
    )
  };
};

// Helper function to setup LeadBoard with all dependencies
const setupLeadBoard = async (
  initialState = {},
  tenantId = 'tenant-1'
) => {
  const mockWebSocket = new WebSocketService({
    url: 'ws://test',
    tenantId
  });

  const utils = renderWithProviders(
    <DragDropContext onDragEnd={jest.fn()}>
      <LeadBoard
        leads={mockLeadData}
        onCategoryChange={jest.fn()}
        isLoading={false}
        error={null}
      />
    </DragDropContext>,
    {
      preloadedState: initialState,
      tenantId
    }
  );

  return {
    ...utils,
    mockWebSocket
  };
};

describe('Lead Board Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders lead board with tenant-specific leads', async () => {
    const { container } = await setupLeadBoard();

    // Verify all categories are rendered
    Object.values(LeadCategory).forEach(category => {
      expect(screen.getByText(category, { exact: false })).toBeInTheDocument();
    });

    // Verify tenant-specific leads are rendered in correct categories
    const unassignedColumn = screen.getByText(LeadCategory.UNASSIGNED).closest('[role="region"]');
    const workingOnColumn = screen.getByText(LeadCategory.WORKING_ON).closest('[role="region"]');

    expect(within(unassignedColumn!).getByText('Test Company 1')).toBeInTheDocument();
    expect(within(workingOnColumn!).getByText('Test Company 2')).toBeInTheDocument();
  });

  it('updates lead category with drag and drop while maintaining tenant isolation', async () => {
    const onCategoryChange = jest.fn();
    const { container } = await setupLeadBoard();

    // Simulate drag and drop
    const lead = screen.getByText('Test Company 1').closest('[draggable="true"]');
    const targetCategory = screen.getByText(LeadCategory.WORKING_ON).closest('[role="region"]');

    userEvent.drag(lead!, targetCategory!);

    await waitFor(() => {
      expect(onCategoryChange).toHaveBeenCalledWith(
        'lead-1',
        LeadCategory.WORKING_ON
      );
    });

    // Verify tenant isolation
    expect(onCategoryChange).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ tenantId: 'tenant-1' })
    );
  });

  it('filters leads by category across all 12 stages', async () => {
    const { container } = await setupLeadBoard();

    // Test each category filter
    for (const category of Object.values(LeadCategory)) {
      const categoryTab = screen.getByText(category);
      userEvent.click(categoryTab);

      await waitFor(() => {
        const visibleLeads = screen.getAllByRole('button').filter(
          lead => lead.textContent?.includes('Test Company')
        );
        
        visibleLeads.forEach(lead => {
          expect(lead).toHaveAttribute('data-category', category);
        });
      });
    }
  });

  it('updates lead status in real-time with WebSocket events', async () => {
    const { mockWebSocket } = await setupLeadBoard();

    // Simulate WebSocket lead update event
    const updatedLead = {
      ...mockLeadData[0],
      category: LeadCategory.WORKING_ON
    };

    mockWebSocket.emit('lead:updated', {
      tenantId: 'tenant-1',
      data: updatedLead
    });

    await waitFor(() => {
      const workingOnColumn = screen.getByText(LeadCategory.WORKING_ON).closest('[role="region"]');
      expect(within(workingOnColumn!).getByText('Test Company 1')).toBeInTheDocument();
    });
  });

  it('handles error states and boundary conditions', async () => {
    const { container } = await setupLeadBoard({}, 'tenant-1');

    // Test error boundary
    const errorMessage = 'Test error message';
    const ErrorComponent = () => { throw new Error(errorMessage); };

    render(
      <ErrorComponent />,
      { wrapper: container.firstChild }
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('maintains accessibility during drag-drop operations', async () => {
    const { container } = await setupLeadBoard();

    // Test keyboard navigation
    const lead = screen.getByText('Test Company 1').closest('[draggable="true"]');
    
    userEvent.tab();
    expect(lead).toHaveFocus();

    // Test ARIA attributes
    expect(lead).toHaveAttribute('aria-grabbed');
    expect(container.querySelector('[role="region"]')).toHaveAttribute('aria-dropeffect');
  });
});

describe('Lead Operations Integration Tests', () => {
  it('creates new lead with tenant context', async () => {
    const { store } = await setupLeadBoard();
    const newLead = {
      company: 'New Company',
      category: LeadCategory.UNASSIGNED,
      contactName: 'New Contact',
      email: 'new@test.com',
      phone: '+1234567892'
    };

    await store.dispatch(useLeads().createLead(newLead));

    expect(screen.getByText('New Company')).toBeInTheDocument();
    expect(screen.getByText('New Contact')).toBeInTheDocument();
  });

  it('handles concurrent lead updates', async () => {
    const { mockWebSocket } = await setupLeadBoard();

    // Simulate concurrent updates
    const update1 = {
      ...mockLeadData[0],
      category: LeadCategory.WORKING_ON,
      updatedAt: new Date().toISOString()
    };

    const update2 = {
      ...mockLeadData[0],
      category: LeadCategory.PRE_QUALIFIED,
      updatedAt: new Date(Date.now() + 1000).toISOString()
    };

    mockWebSocket.emit('lead:updated', { tenantId: 'tenant-1', data: update1 });
    mockWebSocket.emit('lead:updated', { tenantId: 'tenant-1', data: update2 });

    await waitFor(() => {
      const preQualifiedColumn = screen.getByText(LeadCategory.PRE_QUALIFIED).closest('[role="region"]');
      expect(within(preQualifiedColumn!).getByText('Test Company 1')).toBeInTheDocument();
    });
  });
});

describe('Lead Data Synchronization Tests', () => {
  it('handles WebSocket reconnection scenarios', async () => {
    const { mockWebSocket } = await setupLeadBoard();

    // Simulate disconnection
    mockWebSocket.emit('disconnect', { reason: 'test' });

    // Verify reconnection attempt
    await waitFor(() => {
      expect(mockWebSocket.connect).toHaveBeenCalled();
    });

    // Verify data resyncs after reconnection
    mockWebSocket.emit('connect');
    expect(screen.getAllByRole('button').length).toBe(mockLeadData.length);
  });

  it('maintains category counts across real-time updates', async () => {
    const { mockWebSocket } = await setupLeadBoard();

    const initialCounts = Object.values(LeadCategory).map(category => {
      const categoryHeader = screen.getByText(category).closest('div');
      return parseInt(within(categoryHeader!).getByText(/\d+/).textContent || '0');
    });

    // Simulate lead update
    const updatedLead = {
      ...mockLeadData[0],
      category: LeadCategory.WORKING_ON
    };

    mockWebSocket.emit('lead:updated', {
      tenantId: 'tenant-1',
      data: updatedLead
    });

    await waitFor(() => {
      const newCounts = Object.values(LeadCategory).map(category => {
        const categoryHeader = screen.getByText(category).closest('div');
        return parseInt(within(categoryHeader!).getByText(/\d+/).textContent || '0');
      });

      expect(newCounts.reduce((a, b) => a + b)).toBe(initialCounts.reduce((a, b) => a + b));
    });
  });
});