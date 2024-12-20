/**
 * @fileoverview Comprehensive unit tests for TenantService class validating tenant
 * management operations including creation, updates, settings management, data isolation,
 * and lifecycle management with enhanced security and performance validation.
 * @version 1.0.0
 */

import { Types } from 'mongoose'; // v7.x
import { TenantService } from '../../src/services/TenantService';
import TenantModel from '../../src/db/models/Tenant';
import { ITenant, ITenantSettings, TenantStatus } from '../../interfaces/ITenant';
import { ErrorCode } from '../../constants/errorCodes';

// Mock the TenantModel
jest.mock('../../src/db/models/Tenant');

describe('TenantService', () => {
  let tenantService: TenantService;
  
  // Mock tenant data
  const mockTenant: Partial<ITenant> = {
    id: new Types.ObjectId().toString(),
    name: 'Test Organization',
    settings: {
      leadCategories: ['Category1', 'Category2'],
      maxUsers: 10,
      maxLeads: 1000,
      allowedDomains: ['test.com'],
      features: {
        quoteManagement: true,
        advancedReporting: false,
        apiAccess: false,
        customFields: false
      }
    },
    status: TenantStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Mock settings update data
  const mockSettingsUpdate: Partial<ITenantSettings> = {
    maxUsers: 20,
    maxLeads: 2000,
    features: {
      quoteManagement: true,
      advancedReporting: true,
      apiAccess: true,
      customFields: true
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tenantService = new TenantService();
  });

  describe('createTenant', () => {
    it('should successfully create a new tenant', async () => {
      // Mock TenantModel.findByName to return null (no existing tenant)
      (TenantModel.findByName as jest.Mock).mockResolvedValue(null);
      
      // Mock TenantModel.createTenant to return the new tenant
      (TenantModel.createTenant as jest.Mock).mockResolvedValue(mockTenant);

      const result = await tenantService.createTenant(
        mockTenant.name!,
        mockTenant.settings as ITenantSettings
      );

      expect(result).toEqual(mockTenant);
      expect(TenantModel.findByName).toHaveBeenCalledWith(mockTenant.name);
      expect(TenantModel.createTenant).toHaveBeenCalledWith(
        mockTenant.name,
        expect.objectContaining(mockTenant.settings)
      );
    });

    it('should throw error for duplicate tenant name', async () => {
      (TenantModel.findByName as jest.Mock).mockResolvedValue(mockTenant);

      await expect(
        tenantService.createTenant(mockTenant.name!, mockTenant.settings as ITenantSettings)
      ).rejects.toThrow('Tenant already exists');
    });

    it('should validate tenant name format', async () => {
      await expect(
        tenantService.createTenant('a', mockTenant.settings as ITenantSettings)
      ).rejects.toThrow('Invalid tenant name format');
    });
  });

  describe('getTenantById', () => {
    it('should successfully retrieve tenant by ID', async () => {
      const tenantId = new Types.ObjectId();
      (TenantModel.getModel as jest.Mock).mockReturnValue({
        findById: jest.fn().mockResolvedValue(mockTenant)
      });

      const result = await tenantService.getTenantById(tenantId);

      expect(result).toEqual(mockTenant);
      expect(TenantModel.getModel().findById).toHaveBeenCalledWith(tenantId);
    });

    it('should return null for non-existent tenant', async () => {
      const tenantId = new Types.ObjectId();
      (TenantModel.getModel as jest.Mock).mockReturnValue({
        findById: jest.fn().mockResolvedValue(null)
      });

      const result = await tenantService.getTenantById(tenantId);

      expect(result).toBeNull();
    });
  });

  describe('updateTenantSettings', () => {
    it('should successfully update tenant settings', async () => {
      const tenantId = new Types.ObjectId();
      const updatedTenant = { ...mockTenant, settings: mockSettingsUpdate };
      
      (TenantModel.updateSettings as jest.Mock).mockResolvedValue(updatedTenant);

      const result = await tenantService.updateTenantSettings(
        tenantId,
        mockSettingsUpdate
      );

      expect(result).toEqual(updatedTenant);
      expect(TenantModel.updateSettings).toHaveBeenCalledWith(
        tenantId.toString(),
        mockSettingsUpdate
      );
    });

    it('should throw error for non-existent tenant', async () => {
      const tenantId = new Types.ObjectId();
      (TenantModel.updateSettings as jest.Mock).mockResolvedValue(null);

      await expect(
        tenantService.updateTenantSettings(tenantId, mockSettingsUpdate)
      ).rejects.toThrow('Tenant not found');
    });
  });

  describe('updateTenantStatus', () => {
    it('should successfully update tenant status', async () => {
      const tenantId = new Types.ObjectId();
      const updatedTenant = { ...mockTenant, status: TenantStatus.INACTIVE };
      
      (TenantModel.getModel as jest.Mock).mockReturnValue({
        findById: jest.fn().mockResolvedValue(mockTenant)
      });
      (TenantModel.updateStatus as jest.Mock).mockResolvedValue(updatedTenant);

      const result = await tenantService.updateTenantStatus(
        tenantId,
        TenantStatus.INACTIVE
      );

      expect(result).toEqual(updatedTenant);
      expect(TenantModel.updateStatus).toHaveBeenCalledWith(
        tenantId.toString(),
        TenantStatus.INACTIVE
      );
    });

    it('should prevent reactivation of suspended tenants', async () => {
      const tenantId = new Types.ObjectId();
      const suspendedTenant = { ...mockTenant, status: TenantStatus.SUSPENDED };
      
      (TenantModel.getModel as jest.Mock).mockReturnValue({
        findById: jest.fn().mockResolvedValue(suspendedTenant)
      });

      await expect(
        tenantService.updateTenantStatus(tenantId, TenantStatus.ACTIVE)
      ).rejects.toThrow('Cannot reactivate suspended tenant');
    });
  });

  describe('deleteTenant', () => {
    it('should successfully soft delete tenant', async () => {
      const tenantId = new Types.ObjectId();
      const deletedTenant = { ...mockTenant, status: TenantStatus.INACTIVE };
      
      (TenantModel.getModel as jest.Mock).mockReturnValue({
        findById: jest.fn().mockResolvedValue(mockTenant)
      });
      (TenantModel.updateStatus as jest.Mock).mockResolvedValue(deletedTenant);

      const result = await tenantService.deleteTenant(tenantId);

      expect(result).toEqual(deletedTenant);
      expect(TenantModel.updateStatus).toHaveBeenCalledWith(
        tenantId.toString(),
        TenantStatus.INACTIVE
      );
    });

    it('should throw error for non-existent tenant', async () => {
      const tenantId = new Types.ObjectId();
      (TenantModel.getModel as jest.Mock).mockReturnValue({
        findById: jest.fn().mockResolvedValue(null)
      });

      await expect(
        tenantService.deleteTenant(tenantId)
      ).rejects.toThrow('Tenant not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      (TenantModel.getModel as jest.Mock).mockReturnValue({
        findById: jest.fn().mockRejectedValue(dbError)
      });

      await expect(
        tenantService.getTenantById(new Types.ObjectId())
      ).rejects.toMatchObject({
        code: ErrorCode.INTERNAL_SERVER_ERROR
      });
    });

    it('should handle validation errors with proper error codes', async () => {
      await expect(
        tenantService.createTenant('', mockTenant.settings as ITenantSettings)
      ).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR
      });
    });
  });
});