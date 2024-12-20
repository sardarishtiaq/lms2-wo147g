import { test, expect, Page } from '@playwright/test';
import { Quote, QuoteStatus, QuoteItem, QuoteFormData } from '../../src/types/quote';
import { Lead } from '../../src/types/lead';

/**
 * Test configuration and constants
 * @version Playwright ^1.35.0
 */
const TEST_SELECTORS = {
    quoteList: "[data-testid='quote-list']",
    quoteItem: "[data-testid='quote-item']",
    createQuoteBtn: "[data-testid='create-quote-button']",
    quoteForm: "[data-testid='quote-form']",
    itemsContainer: "[data-testid='quote-items-container']",
    addItemBtn: "[data-testid='add-quote-item-button']",
    submitBtn: "[data-testid='submit-quote-button']",
    statusSelect: "[data-testid='quote-status-select']",
    emptyState: "[data-testid='empty-quote-list']",
    searchInput: "[data-testid='quote-search-input']",
    tenantContext: "[data-testid='tenant-context']"
};

const TEST_DATA = {
    tenantOne: {
        id: 'test-tenant-1',
        name: 'Test Tenant 1'
    },
    tenantTwo: {
        id: 'test-tenant-2',
        name: 'Test Tenant 2'
    },
    mockQuote: {
        leadId: 'test-lead-123',
        items: [
            {
                productId: 'test-product-1',
                description: 'Test Product 1',
                quantity: 2,
                unitPrice: 100,
                discountPercent: 10,
                taxRate: 8
            }
        ],
        validUntil: new Date('2024-12-31'),
        notes: 'Test quote notes',
        terms: 'Standard terms and conditions'
    } as QuoteFormData
};

/**
 * Helper function to create a test quote
 */
async function createTestQuote(page: Page, quoteData: QuoteFormData, tenantId: string): Promise<void> {
    await page.click(TEST_SELECTORS.createQuoteBtn);
    
    // Fill form fields
    await page.fill("[data-testid='lead-id-input']", quoteData.leadId);
    
    // Add quote items
    for (const item of quoteData.items) {
        await page.click(TEST_SELECTORS.addItemBtn);
        const itemContainer = page.locator(TEST_SELECTORS.itemsContainer).last();
        await itemContainer.locator("[data-testid='product-id-input']").fill(item.productId);
        await itemContainer.locator("[data-testid='description-input']").fill(item.description);
        await itemContainer.locator("[data-testid='quantity-input']").fill(item.quantity.toString());
        await itemContainer.locator("[data-testid='unit-price-input']").fill(item.unitPrice.toString());
        await itemContainer.locator("[data-testid='discount-input']").fill(item.discountPercent.toString());
        await itemContainer.locator("[data-testid='tax-rate-input']").fill(item.taxRate.toString());
    }

    await page.fill("[data-testid='valid-until-input']", quoteData.validUntil.toISOString().split('T')[0]);
    await page.fill("[data-testid='notes-input']", quoteData.notes);
    await page.fill("[data-testid='terms-input']", quoteData.terms);

    await page.click(TEST_SELECTORS.submitBtn);
}

/**
 * Helper function to set tenant context
 */
async function setTenantContext(page: Page, tenantId: string): Promise<void> {
    await page.evaluate((id) => {
        localStorage.setItem('currentTenantId', id);
    }, tenantId);
    await page.reload();
}

test.describe('Quote Management E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Setup: Navigate to quotes page and ensure clean state
        await page.goto('/quotes');
        await page.waitForLoadState('networkidle');
    });

    test.describe('Quote List Page', () => {
        test('should display empty state when no quotes exist', async ({ page }) => {
            await setTenantContext(page, TEST_DATA.tenantOne.id);
            
            const emptyState = page.locator(TEST_SELECTORS.emptyState);
            await expect(emptyState).toBeVisible();
            await expect(emptyState).toContainText('No quotes found');
            await expect(page.locator(TEST_SELECTORS.createQuoteBtn)).toBeVisible();
        });

        test('should only display quotes for current tenant', async ({ page }) => {
            // Create quotes for tenant 1
            await setTenantContext(page, TEST_DATA.tenantOne.id);
            await createTestQuote(page, TEST_DATA.mockQuote, TEST_DATA.tenantOne.id);
            
            // Verify quote is visible for tenant 1
            await expect(page.locator(TEST_SELECTORS.quoteItem)).toHaveCount(1);
            
            // Switch to tenant 2
            await setTenantContext(page, TEST_DATA.tenantTwo.id);
            
            // Verify no quotes visible for tenant 2
            await expect(page.locator(TEST_SELECTORS.quoteItem)).toHaveCount(0);
        });

        test('should support quote search and filtering', async ({ page }) => {
            await setTenantContext(page, TEST_DATA.tenantOne.id);
            await createTestQuote(page, TEST_DATA.mockQuote, TEST_DATA.tenantOne.id);
            
            // Test search functionality
            await page.fill(TEST_SELECTORS.searchInput, TEST_DATA.mockQuote.items[0].description);
            await expect(page.locator(TEST_SELECTORS.quoteItem)).toHaveCount(1);
            
            // Test status filtering
            await page.selectOption(TEST_SELECTORS.statusSelect, QuoteStatus.DRAFT);
            await expect(page.locator(TEST_SELECTORS.quoteItem)).toHaveCount(1);
        });
    });

    test.describe('Quote Creation', () => {
        test('should create new quote with valid data', async ({ page }) => {
            await setTenantContext(page, TEST_DATA.tenantOne.id);
            await createTestQuote(page, TEST_DATA.mockQuote, TEST_DATA.tenantOne.id);
            
            // Verify quote creation
            const quoteItem = page.locator(TEST_SELECTORS.quoteItem).first();
            await expect(quoteItem).toBeVisible();
            await expect(quoteItem).toContainText(TEST_DATA.mockQuote.items[0].description);
        });

        test('should validate required fields', async ({ page }) => {
            await setTenantContext(page, TEST_DATA.tenantOne.id);
            await page.click(TEST_SELECTORS.createQuoteBtn);
            await page.click(TEST_SELECTORS.submitBtn);
            
            // Verify validation messages
            await expect(page.locator("[data-testid='lead-id-error']")).toBeVisible();
            await expect(page.locator("[data-testid='items-error']")).toBeVisible();
        });
    });

    test.describe('Quote Workflow', () => {
        test('should follow correct status transitions', async ({ page }) => {
            await setTenantContext(page, TEST_DATA.tenantOne.id);
            await createTestQuote(page, TEST_DATA.mockQuote, TEST_DATA.tenantOne.id);
            
            // Verify initial status
            const statusCell = page.locator(`${TEST_SELECTORS.quoteItem} [data-testid='quote-status']`);
            await expect(statusCell).toHaveText(QuoteStatus.DRAFT);
            
            // Test status transitions
            await page.click(`${TEST_SELECTORS.quoteItem} [data-testid='submit-for-approval-btn']`);
            await expect(statusCell).toHaveText(QuoteStatus.PENDING_APPROVAL);
            
            await page.click(`${TEST_SELECTORS.quoteItem} [data-testid='approve-quote-btn']`);
            await expect(statusCell).toHaveText(QuoteStatus.APPROVED);
        });

        test('should enforce status transition permissions', async ({ page }) => {
            await setTenantContext(page, TEST_DATA.tenantOne.id);
            await createTestQuote(page, TEST_DATA.mockQuote, TEST_DATA.tenantOne.id);
            
            // Verify restricted actions
            await expect(page.locator("[data-testid='approve-quote-btn']")).toBeDisabled();
            await expect(page.locator("[data-testid='reject-quote-btn']")).toBeDisabled();
        });
    });
});