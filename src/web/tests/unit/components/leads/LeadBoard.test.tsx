import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';

import LeadBoard from '../../../../src/components/leads/LeadBoard';
import { Lead } from '../../../../src/types/lead';
import { LeadCategory, CATEGORY_DETAILS } from '../../../../src/constants/leadCategories';
import theme from '../../../../src/styles/theme';
import { store } from '../../../../src/store';
import { WebSocketProvider } from '../../../../src/contexts/WebSocketContext';

// Mock WebSocket service
const mockWebSocket = {
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
};

// Mock lead data
const mockLeads: Lead[] = [
  {
    id: 'lead-1',
    tenantId: 'tenant-1',
    category: LeadCategory.UNASSIGNED,
    assignedTo: null,
    status: 'new',
    priority: 3,
    company: 'Test Company 1',
    contactName: 'John Doe',
    email: 'john@test.com',
    phone: '+1234567890',
    source: 'website',
    metadata: {},
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    lastActivityAt: '2023-01-01T00:00:00Z',
    score: 75
  },
  {
    id: 'lead-2',
    tenantId: 'tenant-1',
    category: LeadCategory.WORKING_ON,
    assignedTo: 'agent-1',
    status: 'active',
    priority: 2,
    company: 'Test Company 2',
    contactName: 'Jane Smith',
    email: 'jane@test.com',
    phone: '+1234567891',
    source: 'referral',
    metadata: {},
    createdAt: '2023-01-02T00:00:00Z',
    updatedAt: '2023-01-02T00:00:00Z',
    lastActivityAt: '2023-01-02T00:00:00Z',
    score: 85
  }
];

// Custom render function with providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <WebSocketProvider value={mockWebSocket}>
          {ui}
        </WebSocketProvider>
      </ThemeProvider>
    </Provider>
  );
};

// Mock drag and drop events
const mockDragStart = vi.fn();
const mockDragUpdate = vi.fn();
const mockDragEnd = vi.fn();

describe('LeadBoard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders all category columns correctly', () => {
    renderWithProviders(
      <LeadBoard
        leads={mockLeads}
        onCategoryChange={vi.fn()}
        isLoading={false}
        error={null}
      />
    );

    // Verify all category columns are rendered
    CATEGORY_DETAILS.forEach(category => {
      const column = screen.getByText(category.name);
      expect(column).toBeInTheDocument();
    });
  });

  it('displays leads in correct category columns', () => {
    renderWithProviders(
      <LeadBoard
        leads={mockLeads}
        onCategoryChange={vi.fn()}
        isLoading={false}
        error={null}
      />
    );

    // Check unassigned category
    const unassignedColumn = screen.getByText(
      CATEGORY_DETAILS.find(c => c.id === LeadCategory.UNASSIGNED)!.name
    ).closest('[role="region"]');
    expect(within(unassignedColumn!).getByText('Test Company 1')).toBeInTheDocument();

    // Check working on category
    const workingOnColumn = screen.getByText(
      CATEGORY_DETAILS.find(c => c.id === LeadCategory.WORKING_ON)!.name
    ).closest('[role="region"]');
    expect(within(workingOnColumn!).getByText('Test Company 2')).toBeInTheDocument();
  });

  it('handles drag and drop between categories', async () => {
    const onCategoryChange = vi.fn();

    renderWithProviders(
      <LeadBoard
        leads={mockLeads}
        onCategoryChange={onCategoryChange}
        isLoading={false}
        error={null}
      />
    );

    // Simulate drag and drop
    const result = {
      destination: {
        droppableId: LeadCategory.WORKING_ON,
        index: 0
      },
      source: {
        droppableId: LeadCategory.UNASSIGNED,
        index: 0
      },
      draggableId: 'lead-1'
    };

    fireEvent(window, new CustomEvent('dragend', { detail: result }));

    await waitFor(() => {
      expect(onCategoryChange).toHaveBeenCalledWith(
        'lead-1',
        LeadCategory.WORKING_ON
      );
    });
  });

  it('prevents dropping in NOT_INTERESTED category', () => {
    renderWithProviders(
      <LeadBoard
        leads={mockLeads}
        onCategoryChange={vi.fn()}
        isLoading={false}
        error={null}
      />
    );

    const notInterestedColumn = screen.getByText(
      CATEGORY_DETAILS.find(c => c.id === LeadCategory.NOT_INTERESTED)!.name
    ).closest('[role="region"]');

    expect(notInterestedColumn).toHaveAttribute('aria-dropeffect', 'none');
  });

  it('displays loading state correctly', () => {
    renderWithProviders(
      <LeadBoard
        leads={[]}
        onCategoryChange={vi.fn()}
        isLoading={true}
        error={null}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays error state correctly', () => {
    const errorMessage = 'Failed to load leads';
    renderWithProviders(
      <LeadBoard
        leads={[]}
        onCategoryChange={vi.fn()}
        isLoading={false}
        error={errorMessage}
      />
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('subscribes to WebSocket updates on mount', () => {
    renderWithProviders(
      <LeadBoard
        leads={mockLeads}
        onCategoryChange={vi.fn()}
        isLoading={false}
        error={null}
      />
    );

    expect(mockWebSocket.subscribe).toHaveBeenCalledWith(
      'lead:updated',
      expect.any(Function)
    );
  });

  it('unsubscribes from WebSocket updates on unmount', () => {
    const { unmount } = renderWithProviders(
      <LeadBoard
        leads={mockLeads}
        onCategoryChange={vi.fn()}
        isLoading={false}
        error={null}
      />
    );

    unmount();

    expect(mockWebSocket.unsubscribe).toHaveBeenCalledWith(
      'lead:updated',
      expect.any(Function)
    );
  });

  it('updates lead category on WebSocket event', async () => {
    const onCategoryChange = vi.fn();
    renderWithProviders(
      <LeadBoard
        leads={mockLeads}
        onCategoryChange={onCategoryChange}
        isLoading={false}
        error={null}
      />
    );

    // Get the subscribed handler
    const [[, handler]] = mockWebSocket.subscribe.mock.calls;

    // Simulate WebSocket update
    handler({
      id: 'lead-1',
      category: LeadCategory.WORKING_ON
    });

    await waitFor(() => {
      expect(onCategoryChange).toHaveBeenCalledWith(
        'lead-1',
        LeadCategory.WORKING_ON
      );
    });
  });
});