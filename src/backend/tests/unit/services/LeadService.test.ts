/**
 * @fileoverview Comprehensive unit test suite for LeadService class.
 * Tests lead management functionality, tenant isolation, category transitions,
 * and real-time event emission.
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { Types } from 'mongoose';
import { EventEmitter } from 'events';
import { LeadService } from '../../../src/services/LeadService';
import { ActivityService } from '../../../src/services/ActivityService';
import { LeadCategory } from '../../../src/constants/leadCategories';
import { CacheService } from 'redis-cache-service';
import { TenantContext } from '@company/tenant-context';
import { MetricsClient } from 'datadog-metrics';
import Lead from '../../../src/db/models/Lead';

// Mock dependencies
jest.mock('../../../src/services/ActivityService');
jest.mock('redis-cache-service');
jest.mock('@company/tenant-context');
jest.mock('datadog-metrics');
jest.mock('../../../src/db/models/Lead');

describe('LeadService', () => {
  let leadService: LeadService;
  let eventEmitter: EventEmitter;
  let activityService: jest.Mocked<ActivityService>;
  let cacheService: jest.Mocked<CacheService>;
  let tenantContext: jest.Mocked<TenantContext>;
  let metricsClient: jest.Mocked<MetricsClient>;
  
  // Test data
  const testTenantId = new Types.ObjectId();
  const testUserId = new Types.ObjectId();
  const testLeadId = new Types.ObjectId();

  beforeEach(() => {
    // Initialize mocks
    eventEmitter = new EventEmitter();
    activityService = {
      createActivity: jest.fn(),
    } as any;
    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any;
    tenantContext = {
      validateTenant: jest.fn(),
    } as any;
    metricsClient = {
      increment: jest.fn(),
      timing: jest.fn(),
    } as any;

    // Create service instance
    leadService = new LeadService(
      activityService,
      eventEmitter,
      cacheService,
      tenantContext,
      metricsClient
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createLead', () => {
    const validLeadData = {
      company: 'Test Company',
      contactName: 'John Doe',
      email: 'john@test.com',
      phone: '+1234567890',
      source: 'Website',
      createdBy: testUserId,
    };

    it('should create lead with valid tenant and data', async () => {
      // Setup
      const savedLead = {
        _id: testLeadId,
        ...validLeadData,
        tenantId: testTenantId,
        category: LeadCategory.UNASSIGNED,
      };
      (Lead as any).mockImplementation(() => ({
        validate: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(savedLead),
      }));

      // Execute
      const result = await leadService.createLead(testTenantId, validLeadData);

      // Verify
      expect(tenantContext.validateTenant).toHaveBeenCalledWith(testTenantId);
      expect(activityService.createActivity).toHaveBeenCalledWith(
        testTenantId,
        testLeadId,
        testUserId,
        'LEAD_CREATED',
        'Lead created',
        { category: LeadCategory.UNASSIGNED }
      );
      expect(cacheService.set).toHaveBeenCalled();
      expect(metricsClient.increment).toHaveBeenCalledWith(
        'lead.created',
        1,
        [`tenant:${testTenantId}`]
      );
      expect(result).toEqual(savedLead);
    });

    it('should enforce tenant isolation during creation', async () => {
      // Setup
      tenantContext.validateTenant.mockRejectedValue(new Error('Invalid tenant'));

      // Execute & Verify
      await expect(leadService.createLead(testTenantId, validLeadData))
        .rejects
        .toThrow('Invalid tenant');
    });

    it('should handle validation errors', async () => {
      // Setup
      const invalidData = { ...validLeadData, email: 'invalid-email' };
      (Lead as any).mockImplementation(() => ({
        validate: jest.fn().mockRejectedValue(new Error('Invalid email format')),
      }));

      // Execute & Verify
      await expect(leadService.createLead(testTenantId, invalidData))
        .rejects
        .toThrow('Invalid email format');
    });

    it('should emit lead.created event with correct payload', async () => {
      // Setup
      const savedLead = {
        _id: testLeadId,
        ...validLeadData,
        tenantId: testTenantId,
        category: LeadCategory.UNASSIGNED,
      };
      (Lead as any).mockImplementation(() => ({
        validate: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(savedLead),
      }));

      // Spy on event emission
      const eventSpy = jest.spyOn(eventEmitter, 'emit');

      // Execute
      await leadService.createLead(testTenantId, validLeadData);

      // Verify
      expect(eventSpy).toHaveBeenCalledWith('lead.created', {
        tenantId: testTenantId,
        leadId: testLeadId,
        category: LeadCategory.UNASSIGNED,
      });
    });
  });

  describe('updateLeadCategory', () => {
    const initialLead = {
      _id: testLeadId,
      tenantId: testTenantId,
      category: LeadCategory.UNASSIGNED,
      modifiedBy: testUserId,
    };

    it('should update category with valid transition', async () => {
      // Setup
      const newCategory = LeadCategory.ASSIGNED;
      cacheService.get.mockResolvedValue(initialLead);
      (Lead as any).updateCategory = jest.fn().mockResolvedValue(true);
      const updatedLead = { ...initialLead, category: newCategory };
      (Lead as any).prototype.save = jest.fn().mockResolvedValue(updatedLead);

      // Execute
      const result = await leadService.updateLeadCategory(
        testTenantId,
        testLeadId,
        newCategory,
        { validateTransition: true, createActivity: true }
      );

      // Verify
      expect(result.category).toBe(newCategory);
      expect(activityService.createActivity).toHaveBeenCalledWith(
        testTenantId,
        testLeadId,
        testUserId,
        'CATEGORY_CHANGED',
        `Category updated from ${LeadCategory.UNASSIGNED} to ${newCategory}`,
        {
          previousCategory: LeadCategory.UNASSIGNED,
          newCategory,
        }
      );
    });

    it('should prevent invalid category transitions', async () => {
      // Setup
      const invalidCategory = LeadCategory.PIPELINE;
      cacheService.get.mockResolvedValue(initialLead);
      (Lead as any).updateCategory = jest.fn().mockResolvedValue(false);

      // Execute & Verify
      await expect(
        leadService.updateLeadCategory(
          testTenantId,
          testLeadId,
          invalidCategory,
          { validateTransition: true }
        )
      ).rejects.toThrow('Invalid category transition');
    });

    it('should maintain tenant isolation during update', async () => {
      // Setup
      const wrongTenantId = new Types.ObjectId();
      tenantContext.validateTenant.mockRejectedValue(new Error('Invalid tenant'));

      // Execute & Verify
      await expect(
        leadService.updateLeadCategory(
          wrongTenantId,
          testLeadId,
          LeadCategory.ASSIGNED
        )
      ).rejects.toThrow('Invalid tenant');
    });
  });

  describe('getLeadById', () => {
    it('should retrieve lead with tenant isolation', async () => {
      // Setup
      const lead = {
        _id: testLeadId,
        tenantId: testTenantId,
        category: LeadCategory.UNASSIGNED,
      };
      cacheService.get.mockResolvedValue(null);
      (Lead as any).findOne = jest.fn().mockResolvedValue(lead);

      // Execute
      const result = await leadService.getLeadById(testTenantId, testLeadId);

      // Verify
      expect(result).toEqual(lead);
      expect(Lead.findOne).toHaveBeenCalledWith({
        _id: testLeadId,
        tenantId: testTenantId,
      });
    });

    it('should return cached lead if available', async () => {
      // Setup
      const cachedLead = {
        _id: testLeadId,
        tenantId: testTenantId,
        category: LeadCategory.ASSIGNED,
      };
      cacheService.get.mockResolvedValue(cachedLead);

      // Execute
      const result = await leadService.getLeadById(testTenantId, testLeadId);

      // Verify
      expect(result).toEqual(cachedLead);
      expect(Lead.findOne).not.toHaveBeenCalled();
    });
  });
});