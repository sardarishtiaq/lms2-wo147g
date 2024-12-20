import { test, expect, describe, beforeEach, afterEach, Page } from '@playwright/test'; // v1.35.0
import { server, mockWebSocketService } from '../setup';
import { Lead } from '../../src/types/lead';
import { LeadCategory, CATEGORY_DETAILS } from '../../src/constants/leadCategories';
import { WEBSOCKET_EVENTS } from '../../src/services/websocket';

/**
 * Test configuration and constants
 */
const TEST_TENANT_ID = 'test-tenant-123';
const TEST_USER_ID = 'test-user-123';
const BASE_URL = 'http://localhost:3000';
const LEAD_BOARD_URL = `${BASE_URL}/leads`;

/**
 * Helper function to create a mock lead for testing
 */
const createMockLead = (overrides: Partial<Lead> = {}): Lead => ({
  id: `lead_${Date.now()}`,
  tenantId: TEST_TENANT_ID,
  category: LeadCategory.UNASSIGNED,
  assignedTo: null,
  status: 'active',
  priority: 3,
  company: 'Test Company',
  contactName: 'John Doe',
  email: 'john@test.com',
  phone: '+1234567890',
  source: 'website',
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString(),
  score: 50,
  ...overrides
});

/**
 * Helper function to perform drag and drop operations
 */
const dragLeadCard = async (page: Page, leadId: string, targetCategory: string) => {
  const card = page.locator(`[data-testid="lead-card-${leadId}"]`);
  const target = page.locator(`[data-testid="category-column-${targetCategory}"]`);
  
  await card.dragTo(target);
  await page.waitForResponse(
    response => response.url().includes('/api/leads') && response.status() === 200
  );
};

/**
 * Helper function to wait for lead board initialization
 */
const waitForLeadBoard = async (page: Page) => {
  await page.waitForSelector('[data-testid="lead-board"]');
  await page.waitForSelector('[data-testid="category-column-UNASSIGNED"]');
};

/**
 * Setup function for each test
 */
const setupTest = async (page: Page) => {
  // Configure authentication
  await page.setExtraHTTPHeaders({
    'Authorization': `Bearer test-token`,
    'X-Tenant-ID': TEST_TENANT_ID
  });

  // Initialize WebSocket connection
  await mockWebSocketService.connect('test-token', TEST_TENANT_ID);

  // Navigate to lead board
  await page.goto(LEAD_BOARD_URL);
  await waitForLeadBoard(page);
};

describe('Lead Board Visualization', () => {
  let page: Page;

  beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupTest(page);
  });

  afterEach(async () => {
    await mockWebSocketService.disconnect();
    await page.close();
  });

  test('displays all 12 category columns correctly', async () => {
    for (const category of CATEGORY_DETAILS) {
      const column = page.locator(`[data-testid="category-column-${category.id}"]`);
      await expect(column).toBeVisible();
      await expect(column.locator('.category-header')).toContainText(category.name);
      await expect(column.locator('.category-icon')).toHaveAttribute('data-icon', category.icon);
    }
  });

  test('shows correct lead count per category', async () => {
    const mockLeads = [
      createMockLead({ category: LeadCategory.UNASSIGNED }),
      createMockLead({ category: LeadCategory.UNASSIGNED }),
      createMockLead({ category: LeadCategory.WORKING_ON })
    ];

    // Update server with mock leads
    server.use(
      rest.get('/api/leads', (req, res, ctx) => {
        return res(ctx.json({ data: mockLeads }));
      })
    );

    await page.reload();
    await waitForLeadBoard(page);

    const unassignedCount = await page.locator('[data-testid="category-count-UNASSIGNED"]').innerText();
    const workingOnCount = await page.locator('[data-testid="category-count-WORKING_ON"]').innerText();

    expect(unassignedCount).toBe('2');
    expect(workingOnCount).toBe('1');
  });

  test('updates category counts in real-time', async () => {
    const mockLead = createMockLead({ category: LeadCategory.UNASSIGNED });
    
    await mockWebSocketService.simulateEvent(
      WEBSOCKET_EVENTS.LEAD_UPDATED,
      {
        ...mockLead,
        category: LeadCategory.WORKING_ON
      }
    );

    const unassignedCount = await page.locator('[data-testid="category-count-UNASSIGNED"]').innerText();
    const workingOnCount = await page.locator('[data-testid="category-count-WORKING_ON"]').innerText();

    expect(unassignedCount).toBe('0');
    expect(workingOnCount).toBe('1');
  });
});

describe('Lead Card Interactions', () => {
  let page: Page;

  beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupTest(page);
  });

  afterEach(async () => {
    await mockWebSocketService.disconnect();
    await page.close();
  });

  test('supports drag and drop between categories', async () => {
    const mockLead = createMockLead();
    
    await dragLeadCard(page, mockLead.id, LeadCategory.WORKING_ON);
    
    await expect(
      page.locator(`[data-testid="category-column-WORKING_ON"] [data-testid="lead-card-${mockLead.id}"]`)
    ).toBeVisible();
  });

  test('shows quick action buttons on hover', async () => {
    const mockLead = createMockLead();
    const leadCard = page.locator(`[data-testid="lead-card-${mockLead.id}"]`);
    
    await leadCard.hover();
    
    await expect(leadCard.locator('[data-testid="quick-action-edit"]')).toBeVisible();
    await expect(leadCard.locator('[data-testid="quick-action-assign"]')).toBeVisible();
    await expect(leadCard.locator('[data-testid="quick-action-quote"]')).toBeVisible();
  });

  test('displays lead details modal on click', async () => {
    const mockLead = createMockLead();
    
    await page.click(`[data-testid="lead-card-${mockLead.id}"]`);
    
    const modal = page.locator('[data-testid="lead-details-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(mockLead.company);
    await expect(modal).toContainText(mockLead.contactName);
  });
});

describe('Real-time Updates', () => {
  let page: Page;

  beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupTest(page);
  });

  afterEach(async () => {
    await mockWebSocketService.disconnect();
    await page.close();
  });

  test('updates lead card position in real-time', async () => {
    const mockLead = createMockLead();
    
    await mockWebSocketService.simulateEvent(WEBSOCKET_EVENTS.LEAD_UPDATED, {
      ...mockLead,
      category: LeadCategory.WORKING_ON
    });

    await expect(
      page.locator(`[data-testid="category-column-WORKING_ON"] [data-testid="lead-card-${mockLead.id}"]`)
    ).toBeVisible();
  });

  test('shows notifications for lead updates', async () => {
    const mockLead = createMockLead();
    
    await mockWebSocketService.simulateEvent(WEBSOCKET_EVENTS.LEAD_UPDATED, {
      ...mockLead,
      status: 'updated'
    });

    await expect(page.locator('[data-testid="notification-toast"]')).toBeVisible();
    await expect(page.locator('[data-testid="notification-toast"]')).toContainText('Lead Updated');
  });

  test('handles WebSocket disconnection gracefully', async () => {
    await mockWebSocketService.disconnect();
    
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Disconnected');
    await expect(page.locator('[data-testid="reconnect-button"]')).toBeVisible();
  });

  test('maintains state during connection loss', async () => {
    const mockLead = createMockLead();
    
    // Simulate connection loss
    await mockWebSocketService.disconnect();
    
    // Verify lead data is still visible
    await expect(
      page.locator(`[data-testid="lead-card-${mockLead.id}"]`)
    ).toBeVisible();
    
    // Simulate reconnection
    await mockWebSocketService.connect('test-token', TEST_TENANT_ID);
    
    // Verify lead data is still accurate
    await expect(
      page.locator(`[data-testid="lead-card-${mockLead.id}"]`)
    ).toBeVisible();
  });
});