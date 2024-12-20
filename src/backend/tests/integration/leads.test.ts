/**
 * @fileoverview Integration tests for lead management functionality in the multi-tenant CRM system.
 * Tests cover the complete lead lifecycle including creation, updates, category transitions,
 * tenant isolation, activity tracking, and real-time event emissions.
 * @version 1.0.0
 */

import { describe, beforeAll, afterAll, beforeEach, it, expect } from '@jest/globals'; // ^29.0.0
import mongoose, { Types } from 'mongoose'; // ^7.0.0
import { EventEmitter } from 'events'; // Node.js built-in
import { createClient } from 'redis-mock'; // ^0.56.3
import { LeadService } from '../../src/services/LeadService';
import { ActivityService } from '../../src/services/ActivityService';
import Lead from '../../src/db/models/Lead';
import { LeadCategory } from '../../src/constants/leadCategories';
import logger from '../../src/utils/logger';

// Test configuration
const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/crm_test';
const TEST_TENANT_ID = new Types.ObjectId();
const TEST_USER_ID = new Types.ObjectId();
const TEST_ADMIN_ID = new Types.ObjectId();

// Service instances
let leadService: LeadService;
let activityService: ActivityService;
let eventEmitter: EventEmitter;
let redisClient: ReturnType<typeof createClient>;

// Event tracking for assertions
let emittedEvents: Record<string, any[]> = {};

describe('Lead Management Integration Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(TEST_DB_URI);

    // Initialize Redis mock
    redisClient = createClient();
    await redisClient.connect();

    // Initialize event emitter with tracking
    eventEmitter = new EventEmitter();
    eventEmitter.setMaxListeners(20);
    
    ['lead.created', 'lead.updated', 'lead.categoryChanged', 'lead.assigned'].forEach(event => {
      eventEmitter.on(event, (data) => {
        emittedEvents[event] = emittedEvents[event] || [];
        emittedEvents[event].push(data);
      });
    });

    // Initialize services
    activityService = new ActivityService(eventEmitter);
    leadService = new LeadService(
      activityService,
      eventEmitter,
      redisClient,
      { validateTenant: async () => true },
      { increment: () => {}, timing: () => {} }
    );

    logger.debug('Test environment initialized');
  });

  afterAll(async () => {
    // Cleanup database
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();

    // Cleanup Redis
    await redisClient.quit();

    // Remove event listeners
    eventEmitter.removeAllListeners();

    logger.debug('Test environment cleaned up');
  });

  beforeEach(async () => {
    // Reset collections
    await Lead.deleteMany({});

    // Reset event tracking
    emittedEvents = {};

    // Reset Redis cache
    await redisClient.flushAll();

    logger.debug('Test state reset');
  });

  describe('Lead Creation', () => {
    it('should create lead with valid data and verify tenant isolation', async () => {
      const leadData = {
        company: 'Test Company',
        contactName: 'John Doe',
        email: 'john@testcompany.com',
        phone: '+1234567890',
        source: 'Website',
        createdBy: TEST_USER_ID
      };

      // Create lead for first tenant
      const lead1 = await leadService.createLead(TEST_TENANT_ID, leadData);
      
      // Create lead for second tenant
      const lead2 = await leadService.createLead(
        new Types.ObjectId(),
        { ...leadData, email: 'jane@testcompany.com' }
      );

      // Verify tenant isolation
      const tenant1Leads = await Lead.find({ tenantId: TEST_TENANT_ID });
      expect(tenant1Leads).toHaveLength(1);
      expect(tenant1Leads[0]._id).toEqual(lead1._id);

      // Verify event emission
      expect(emittedEvents['lead.created']).toHaveLength(2);
      expect(emittedEvents['lead.created'][0].tenantId).toEqual(TEST_TENANT_ID);
    });

    it('should enforce required fields validation', async () => {
      const invalidLeadData = {
        company: 'Test Company',
        // Missing required fields
        createdBy: TEST_USER_ID
      };

      await expect(
        leadService.createLead(TEST_TENANT_ID, invalidLeadData)
      ).rejects.toThrow(/required/);
    });

    it('should generate creation activity with correct metadata', async () => {
      const leadData = {
        company: 'Test Company',
        contactName: 'John Doe',
        email: 'john@testcompany.com',
        phone: '+1234567890',
        source: 'Website',
        createdBy: TEST_USER_ID
      };

      const lead = await leadService.createLead(TEST_TENANT_ID, leadData);
      
      const activities = await activityService.getLeadActivities(
        lead._id,
        TEST_TENANT_ID
      );

      expect(activities.data).toHaveLength(1);
      expect(activities.data[0].type).toBe('LEAD_CREATED');
      expect(activities.data[0].metadata).toMatchObject({
        category: LeadCategory.UNASSIGNED
      });
    });
  });

  describe('Lead Category Management', () => {
    let testLead: any;

    beforeEach(async () => {
      testLead = await leadService.createLead(TEST_TENANT_ID, {
        company: 'Test Company',
        contactName: 'John Doe',
        email: 'john@testcompany.com',
        phone: '+1234567890',
        source: 'Website',
        createdBy: TEST_USER_ID
      });
    });

    it('should validate category transition rules', async () => {
      // Valid transition
      await expect(
        leadService.updateLeadCategory(
          TEST_TENANT_ID,
          testLead._id,
          LeadCategory.ASSIGNED,
          { validateTransition: true }
        )
      ).resolves.toBeDefined();

      // Invalid transition (skipping stages)
      await expect(
        leadService.updateLeadCategory(
          TEST_TENANT_ID,
          testLead._id,
          LeadCategory.PIPELINE,
          { validateTransition: true }
        )
      ).rejects.toThrow(/Invalid category transition/);
    });

    it('should track category change history', async () => {
      await leadService.updateLeadCategory(
        TEST_TENANT_ID,
        testLead._id,
        LeadCategory.ASSIGNED,
        { createActivity: true }
      );

      const updatedLead = await Lead.findById(testLead._id);
      expect(updatedLead?.categoryChangeHistory).toHaveLength(1);
      expect(updatedLead?.categoryChangeHistory[0]).toMatchObject({
        fromCategory: LeadCategory.UNASSIGNED,
        toCategory: LeadCategory.ASSIGNED
      });
    });

    it('should emit category update events', async () => {
      await leadService.updateLeadCategory(
        TEST_TENANT_ID,
        testLead._id,
        LeadCategory.ASSIGNED
      );

      expect(emittedEvents['lead.categoryUpdated']).toBeDefined();
      expect(emittedEvents['lead.categoryUpdated'][0]).toMatchObject({
        tenantId: TEST_TENANT_ID,
        leadId: testLead._id,
        previousCategory: LeadCategory.UNASSIGNED,
        newCategory: LeadCategory.ASSIGNED
      });
    });
  });

  describe('Lead Assignment', () => {
    let testLead: any;

    beforeEach(async () => {
      testLead = await leadService.createLead(TEST_TENANT_ID, {
        company: 'Test Company',
        contactName: 'John Doe',
        email: 'john@testcompany.com',
        phone: '+1234567890',
        source: 'Website',
        createdBy: TEST_USER_ID
      });
    });

    it('should assign lead to eligible user', async () => {
      const assignedLead = await leadService.assignLead(
        TEST_TENANT_ID,
        testLead._id,
        TEST_USER_ID
      );

      expect(assignedLead.assignedTo).toEqual(TEST_USER_ID);
      expect(assignedLead.category).toBe(LeadCategory.ASSIGNED);
    });

    it('should validate user workload limits', async () => {
      // Create multiple leads assigned to the same user
      const promises = Array(5).fill(null).map(() =>
        leadService.createLead(TEST_TENANT_ID, {
          company: 'Test Company',
          contactName: 'John Doe',
          email: 'john@testcompany.com',
          phone: '+1234567890',
          source: 'Website',
          createdBy: TEST_USER_ID,
          assignToAgent: TEST_USER_ID
        })
      );

      await Promise.all(promises);

      // Attempt to assign another lead
      await expect(
        leadService.assignLead(TEST_TENANT_ID, testLead._id, TEST_USER_ID)
      ).rejects.toThrow(/workload limit/);
    });
  });

  describe('Lead Retrieval', () => {
    beforeEach(async () => {
      // Create test leads with different categories
      const categories = [
        LeadCategory.UNASSIGNED,
        LeadCategory.ASSIGNED,
        LeadCategory.WORKING_ON
      ];

      const promises = categories.map((category, index) =>
        leadService.createLead(TEST_TENANT_ID, {
          company: `Company ${index}`,
          contactName: 'John Doe',
          email: `john${index}@testcompany.com`,
          phone: '+1234567890',
          source: 'Website',
          createdBy: TEST_USER_ID,
          category
        })
      );

      await Promise.all(promises);
    });

    it('should get leads by category with pagination', async () => {
      const result = await leadService.getLeadsByCategory(
        TEST_TENANT_ID,
        LeadCategory.UNASSIGNED,
        { page: 1, limit: 10 }
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].category).toBe(LeadCategory.UNASSIGNED);
    });

    it('should enforce tenant isolation in queries', async () => {
      // Create lead for different tenant
      await leadService.createLead(new Types.ObjectId(), {
        company: 'Other Tenant Company',
        contactName: 'Jane Doe',
        email: 'jane@othertenant.com',
        phone: '+1234567890',
        source: 'Website',
        createdBy: TEST_USER_ID
      });

      const result = await leadService.getLeadsByCategory(
        TEST_TENANT_ID,
        LeadCategory.ALL_LEADS,
        { page: 1, limit: 10 }
      );

      expect(result.data.every(lead => 
        lead.tenantId.toString() === TEST_TENANT_ID.toString()
      )).toBe(true);
    });
  });
});