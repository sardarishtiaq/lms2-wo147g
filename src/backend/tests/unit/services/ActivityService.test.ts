/**
 * @fileoverview Unit tests for ActivityService class
 * Tests activity tracking, real-time updates, and multi-tenant data isolation
 * @version 1.0.0
 */

import { jest } from '@jest/globals'; // ^29.x
import { EventEmitter } from 'events';
import { Types } from 'mongoose'; // ^7.x
import { ActivityService } from '../../../src/services/ActivityService';
import Activity from '../../../src/db/models/Activity';
import { ActivityType, IActivity } from '../../../src/interfaces/IActivity';

// Mock dependencies
jest.mock('../../../src/db/models/Activity');
jest.mock('events');
jest.mock('../../../src/utils/logger');

describe('ActivityService', () => {
    let activityService: ActivityService;
    let mockEventEmitter: jest.Mocked<EventEmitter>;
    const mockTenantId = new Types.ObjectId();
    const mockLeadId = new Types.ObjectId();
    const mockUserId = new Types.ObjectId();

    // Sample activity data
    const mockActivityData = {
        _id: new Types.ObjectId(),
        tenantId: mockTenantId,
        leadId: mockLeadId,
        userId: mockUserId,
        type: ActivityType.LEAD_CREATED,
        description: 'Test activity',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    };

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Initialize mocked event emitter
        mockEventEmitter = new EventEmitter() as jest.Mocked<EventEmitter>;
        mockEventEmitter.emit = jest.fn();
        
        // Initialize service with mocked dependencies
        activityService = new ActivityService(mockEventEmitter);
    });

    describe('createActivity', () => {
        it('should create activity with proper tenant isolation', async () => {
            // Mock Activity.createActivity
            const createActivitySpy = jest.spyOn(Activity, 'createActivity')
                .mockResolvedValueOnce(mockActivityData as IActivity);

            // Test activity creation
            const result = await activityService.createActivity(
                mockTenantId,
                mockLeadId,
                mockUserId,
                ActivityType.LEAD_CREATED,
                'Test activity'
            );

            // Verify tenant isolation
            expect(createActivitySpy).toHaveBeenCalledWith({
                tenantId: mockTenantId,
                leadId: mockLeadId,
                userId: mockUserId,
                type: ActivityType.LEAD_CREATED,
                description: 'Test activity',
                metadata: {}
            });

            // Verify event emission
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('activity.created', {
                tenantId: mockTenantId,
                leadId: mockLeadId,
                activity: result
            });

            expect(result).toEqual(mockActivityData);
        });

        it('should throw error for missing required parameters', async () => {
            await expect(activityService.createActivity(
                undefined as unknown as Types.ObjectId,
                mockLeadId,
                mockUserId,
                ActivityType.LEAD_CREATED,
                'Test activity'
            )).rejects.toThrow('Missing required parameters for activity creation');
        });

        it('should retry on failure up to maximum attempts', async () => {
            const createActivitySpy = jest.spyOn(Activity, 'createActivity')
                .mockRejectedValueOnce(new Error('DB Error'))
                .mockRejectedValueOnce(new Error('DB Error'))
                .mockResolvedValueOnce(mockActivityData as IActivity);

            const result = await activityService.createActivity(
                mockTenantId,
                mockLeadId,
                mockUserId,
                ActivityType.LEAD_CREATED,
                'Test activity'
            );

            expect(createActivitySpy).toHaveBeenCalledTimes(3);
            expect(result).toEqual(mockActivityData);
        });
    });

    describe('getLeadActivities', () => {
        const mockPaginationOptions = { page: 1, limit: 50 };
        const mockPaginatedResult = {
            data: [mockActivityData],
            total: 1,
            page: 1,
            totalPages: 1
        };

        it('should retrieve activities for a specific lead with tenant isolation', async () => {
            // Mock Activity.getLeadTimeline
            jest.spyOn(Activity, 'getLeadTimeline')
                .mockResolvedValueOnce(mockPaginatedResult);

            const result = await activityService.getLeadActivities(
                mockLeadId,
                mockTenantId,
                mockPaginationOptions
            );

            expect(Activity.getLeadTimeline).toHaveBeenCalledWith(
                mockLeadId,
                mockTenantId,
                mockPaginationOptions
            );
            expect(result).toEqual(mockPaginatedResult);
        });

        it('should handle cache hits for lead activities', async () => {
            // Mock Redis get operation (implementation detail)
            const mockRedisGet = jest.spyOn(activityService['_redisClient'], 'get')
                .mockResolvedValueOnce(JSON.stringify(mockPaginatedResult));

            const result = await activityService.getLeadActivities(
                mockLeadId,
                mockTenantId
            );

            expect(mockRedisGet).toHaveBeenCalledWith(`activity:${mockLeadId}`);
            expect(result).toEqual(mockPaginatedResult);
            expect(Activity.getLeadTimeline).not.toHaveBeenCalled();
        });

        it('should enforce tenant isolation in queries', async () => {
            const wrongTenantId = new Types.ObjectId();
            jest.spyOn(Activity, 'getLeadTimeline')
                .mockResolvedValueOnce({ ...mockPaginatedResult, data: [] });

            const result = await activityService.getLeadActivities(
                mockLeadId,
                wrongTenantId
            );

            expect(result.data).toHaveLength(0);
        });
    });

    describe('getTenantActivities', () => {
        const mockFilterOptions = {
            type: [ActivityType.LEAD_CREATED],
            startDate: new Date(),
            endDate: new Date()
        };
        const mockPaginationOptions = { page: 1, limit: 50 };
        const mockPaginatedResult = {
            data: [mockActivityData],
            total: 1,
            page: 1,
            totalPages: 1
        };

        it('should retrieve activities for a tenant with filtering', async () => {
            jest.spyOn(Activity, 'findByTenant')
                .mockResolvedValueOnce(mockPaginatedResult);

            const result = await activityService.getTenantActivities(
                mockTenantId,
                mockFilterOptions,
                mockPaginationOptions
            );

            expect(Activity.findByTenant).toHaveBeenCalledWith(
                mockTenantId,
                mockPaginationOptions,
                mockFilterOptions
            );
            expect(result).toEqual(mockPaginatedResult);
        });

        it('should handle empty filter options', async () => {
            jest.spyOn(Activity, 'findByTenant')
                .mockResolvedValueOnce(mockPaginatedResult);

            await activityService.getTenantActivities(mockTenantId);

            expect(Activity.findByTenant).toHaveBeenCalledWith(
                mockTenantId,
                { page: 1, limit: 50 },
                {}
            );
        });

        it('should enforce tenant data isolation', async () => {
            const wrongTenantId = new Types.ObjectId();
            jest.spyOn(Activity, 'findByTenant')
                .mockResolvedValueOnce({ ...mockPaginatedResult, data: [] });

            const result = await activityService.getTenantActivities(wrongTenantId);

            expect(result.data).toHaveLength(0);
        });
    });

    describe('cleanup', () => {
        it('should properly clean up resources', async () => {
            const redisQuitSpy = jest.spyOn(activityService['_redisClient'], 'quit')
                .mockResolvedValueOnce('OK');

            await activityService.cleanup();

            expect(redisQuitSpy).toHaveBeenCalled();
        });

        it('should handle cleanup errors', async () => {
            jest.spyOn(activityService['_redisClient'], 'quit')
                .mockRejectedValueOnce(new Error('Redis quit error'));

            await expect(activityService.cleanup())
                .rejects.toThrow('Redis quit error');
        });
    });
});