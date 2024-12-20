/**
 * @fileoverview Integration tests for tenant management functionality
 * Tests tenant creation, settings management, status updates, and data isolation
 * @version 1.0.0
 */

import request from 'supertest'; // v6.3.3
import { expect } from 'jest'; // v29.5.0
import { Types } from 'mongoose'; // v7.x
import { ITenant, ITenantSettings, TenantStatus } from '../../src/interfaces/ITenant';
import TenantModel from '../../src/db/models/Tenant';
import app from '../../src/app'; // Main Express application

/**
 * Test tenant data factory with comprehensive settings
 */
const createTestTenantData = (overrides: Partial<ITenantSettings> = {}): Partial<ITenant> => ({
  name: `Test Tenant ${Date.now()}`,
  settings: {
    leadCategories: ['New', 'Contacted', 'Qualified', 'Converted'],
    maxUsers: 10,
    maxLeads: 1000,
    allowedDomains: ['test.com'],
    features: {
      quoteManagement: true,
      advancedReporting: false,
      apiAccess: true,
      customFields: false
    },
    ...overrides
  },
  status: TenantStatus.ACTIVE
});

/**
 * Helper to create a test tenant in the database
 */
const setupTestTenant = async (settings: Partial<ITenantSettings> = {}): Promise<ITenant> => {
  const tenantData = createTestTenantData(settings);
  const tenant = await TenantModel.getModel().create(tenantData);
  return tenant;
};

/**
 * Helper to cleanup test tenants
 */
const cleanupTestTenants = async (): Promise<void> => {
  await TenantModel.getModel().deleteMany({
    name: { $regex: /^Test Tenant/ }
  });
};

describe('Tenant Management API Integration Tests', () => {
  beforeAll(async () => {
    // Ensure clean test environment
    await cleanupTestTenants();
  });

  afterAll(async () => {
    // Cleanup after all tests
    await cleanupTestTenants();
  });

  describe('POST /api/tenants', () => {
    it('should create new tenant with valid data and verify settings', async () => {
      const tenantData = createTestTenantData();
      
      const response = await request(app)
        .post('/api/tenants')
        .send(tenantData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(tenantData.name);
      expect(response.body.settings.maxUsers).toBe(tenantData.settings.maxUsers);
      expect(response.body.status).toBe(TenantStatus.ACTIVE);
    });

    it('should enforce tenant name uniqueness', async () => {
      const tenant = await setupTestTenant();
      const duplicateData = createTestTenantData();
      duplicateData.name = tenant.name;

      await request(app)
        .post('/api/tenants')
        .send(duplicateData)
        .expect(409);
    });

    it('should validate settings structure and limits', async () => {
      const invalidData = createTestTenantData({
        maxUsers: 1001, // Exceeds maximum limit
        maxLeads: 50 // Below minimum limit
      });

      const response = await request(app)
        .post('/api/tenants')
        .send(invalidData)
        .expect(400);

      expect(response.body.errors).toContain('Maximum 1000 users allowed');
      expect(response.body.errors).toContain('Minimum 100 leads required');
    });

    it('should initialize default feature flags', async () => {
      const minimalData = {
        name: `Test Tenant ${Date.now()}`,
        settings: {
          maxUsers: 5,
          maxLeads: 500,
          leadCategories: ['New']
        }
      };

      const response = await request(app)
        .post('/api/tenants')
        .send(minimalData)
        .expect(201);

      expect(response.body.settings.features).toEqual({
        quoteManagement: true,
        advancedReporting: false,
        apiAccess: false,
        customFields: false
      });
    });
  });

  describe('GET /api/tenants/:id', () => {
    it('should retrieve tenant with complete settings', async () => {
      const tenant = await setupTestTenant();

      const response = await request(app)
        .get(`/api/tenants/${tenant.id}`)
        .expect(200);

      expect(response.body.id).toBe(tenant.id);
      expect(response.body.settings).toMatchObject(tenant.settings);
    });

    it('should prevent cross-tenant data access', async () => {
      const tenant1 = await setupTestTenant();
      const tenant2 = await setupTestTenant();

      // Attempt to access tenant2 with tenant1's context
      await request(app)
        .get(`/api/tenants/${tenant2.id}`)
        .set('X-Tenant-ID', tenant1.id)
        .expect(403);
    });

    it('should handle non-existent tenant requests', async () => {
      const nonExistentId = new Types.ObjectId().toString();

      await request(app)
        .get(`/api/tenants/${nonExistentId}`)
        .expect(404);
    });
  });

  describe('PATCH /api/tenants/:id/settings', () => {
    it('should update tenant settings within limits', async () => {
      const tenant = await setupTestTenant();
      const updatedSettings = {
        maxUsers: 20,
        leadCategories: ['New', 'Working', 'Closed']
      };

      const response = await request(app)
        .patch(`/api/tenants/${tenant.id}/settings`)
        .send(updatedSettings)
        .expect(200);

      expect(response.body.settings.maxUsers).toBe(20);
      expect(response.body.settings.leadCategories).toEqual(updatedSettings.leadCategories);
    });

    it('should validate feature flag combinations', async () => {
      const tenant = await setupTestTenant();
      const invalidFeatures = {
        features: {
          advancedReporting: true,
          apiAccess: false // Invalid: Advanced reporting requires API access
        }
      };

      await request(app)
        .patch(`/api/tenants/${tenant.id}/settings`)
        .send(invalidFeatures)
        .expect(400);
    });

    it('should maintain existing settings when partially updating', async () => {
      const tenant = await setupTestTenant();
      const partialUpdate = {
        maxUsers: 15
      };

      const response = await request(app)
        .patch(`/api/tenants/${tenant.id}/settings`)
        .send(partialUpdate)
        .expect(200);

      expect(response.body.settings.maxUsers).toBe(15);
      expect(response.body.settings.maxLeads).toBe(tenant.settings.maxLeads);
      expect(response.body.settings.features).toEqual(tenant.settings.features);
    });
  });

  describe('PATCH /api/tenants/:id/status', () => {
    it('should handle valid status transitions', async () => {
      const tenant = await setupTestTenant();

      const response = await request(app)
        .patch(`/api/tenants/${tenant.id}/status`)
        .send({ status: TenantStatus.INACTIVE })
        .expect(200);

      expect(response.body.status).toBe(TenantStatus.INACTIVE);
    });

    it('should prevent invalid status changes', async () => {
      const tenant = await setupTestTenant();
      await TenantModel.getModel().findByIdAndUpdate(
        tenant.id,
        { status: TenantStatus.SUSPENDED }
      );

      // Attempt to reactivate suspended tenant
      await request(app)
        .patch(`/api/tenants/${tenant.id}/status`)
        .send({ status: TenantStatus.ACTIVE })
        .expect(400);
    });

    it('should track status change history', async () => {
      const tenant = await setupTestTenant();

      const response = await request(app)
        .patch(`/api/tenants/${tenant.id}/status`)
        .send({ status: TenantStatus.INACTIVE })
        .expect(200);

      expect(response.body.version).toBe(tenant.version + 1);
      expect(response.body.updatedAt).not.toBe(tenant.updatedAt);
    });
  });
});