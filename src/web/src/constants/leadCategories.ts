// @mui/material version ^5.0.0
import { SvgIconProps } from '@mui/material';

/**
 * Enumeration of all possible lead categories in the CRM's 12-stage pipeline process.
 * Used for type-safe category identification throughout the application.
 */
export enum LeadCategory {
    ALL_LEADS = 'ALL_LEADS',
    UNASSIGNED = 'UNASSIGNED',
    ASSIGNED = 'ASSIGNED',
    NEW_DATA = 'NEW_DATA',
    WORKING_ON = 'WORKING_ON',
    PRE_QUALIFIED = 'PRE_QUALIFIED',
    REPEATING_CUSTOMER = 'REPEATING_CUSTOMER',
    ONE_TIME_CUSTOMER = 'ONE_TIME_CUSTOMER',
    NOT_INTERESTED = 'NOT_INTERESTED',
    REPORT_TO_LEAD_GEN = 'REPORT_TO_LEAD_GEN',
    READY_FOR_DEMO = 'READY_FOR_DEMO',
    PIPELINE = 'PIPELINE'
}

/**
 * Interface defining the structure of category configuration objects.
 * Provides comprehensive metadata for each lead category.
 */
export interface CategoryConfig {
    /** Unique identifier matching the LeadCategory enum */
    id: LeadCategory;
    /** Human-readable category name */
    name: string;
    /** Material-UI icon name for category visualization */
    icon: string;
    /** Detailed description of the category's purpose */
    description: string;
    /** Technical implementation details */
    implementation: string;
    /** Display order in the pipeline (1-based) */
    order: number;
}

/**
 * Comprehensive configuration for all lead categories in the CRM system.
 * Frozen array to prevent runtime modifications to category definitions.
 */
export const CATEGORY_DETAILS: readonly CategoryConfig[] = Object.freeze([
    {
        id: LeadCategory.ALL_LEADS,
        name: 'All Leads',
        icon: 'spatial_audio',
        description: 'Global view with aggregated metrics',
        implementation: 'Global view with aggregated metrics',
        order: 1
    },
    {
        id: LeadCategory.UNASSIGNED,
        name: 'Un-Assigned',
        icon: 'assignment_ind',
        description: 'Leads pending assignment to agents',
        implementation: 'Queue-based distribution system',
        order: 2
    },
    {
        id: LeadCategory.ASSIGNED,
        name: 'Assigned',
        icon: 'shield_moon',
        description: 'Leads assigned to agents',
        implementation: 'Agent workload balancing',
        order: 3
    },
    {
        id: LeadCategory.NEW_DATA,
        name: 'New Data',
        icon: 'headset_mic',
        description: 'Fresh leads requiring processing',
        implementation: 'Real-time data ingestion pipeline',
        order: 4
    },
    {
        id: LeadCategory.WORKING_ON,
        name: 'Working On',
        icon: 'data_exploration',
        description: 'Leads under active processing',
        implementation: 'Activity tracking system',
        order: 5
    },
    {
        id: LeadCategory.PRE_QUALIFIED,
        name: 'Pre Qualified',
        icon: 'data_exploration',
        description: 'Leads that passed initial qualification',
        implementation: 'Scoring algorithm integration',
        order: 6
    },
    {
        id: LeadCategory.REPEATING_CUSTOMER,
        name: 'Repeating Customer',
        icon: 'data_exploration',
        description: 'Returning customer leads',
        implementation: 'Customer history analysis',
        order: 7
    },
    {
        id: LeadCategory.ONE_TIME_CUSTOMER,
        name: 'One Time Customer',
        icon: 'face_5',
        description: 'Single transaction customers',
        implementation: 'Transaction pattern detection',
        order: 8
    },
    {
        id: LeadCategory.NOT_INTERESTED,
        name: 'Not Interested/DND',
        icon: 'shield_moon',
        description: 'Leads that opted out',
        implementation: 'Automated blacklist management',
        order: 9
    },
    {
        id: LeadCategory.REPORT_TO_LEAD_GEN,
        name: 'Report to Lead Gen',
        icon: 'blanket',
        description: 'Leads requiring source review',
        implementation: 'Analytics feedback loop',
        order: 10
    },
    {
        id: LeadCategory.READY_FOR_DEMO,
        name: 'Ready for Demo',
        icon: 'readiness_score',
        description: 'Leads prepared for demonstration',
        implementation: 'Scheduling system integration',
        order: 11
    },
    {
        id: LeadCategory.PIPELINE,
        name: 'Pipeline',
        icon: 'data_exploration',
        description: 'Leads in final conversion stage',
        implementation: 'Revenue forecasting engine',
        order: 12
    }
]);

/**
 * Helper function to get category configuration by ID.
 * @param categoryId - The ID of the category to retrieve
 * @returns The category configuration or undefined if not found
 */
export const getCategoryById = (categoryId: LeadCategory): CategoryConfig | undefined => 
    CATEGORY_DETAILS.find(category => category.id === categoryId);

/**
 * Helper function to get category configuration by order.
 * @param order - The order number of the category to retrieve
 * @returns The category configuration or undefined if not found
 */
export const getCategoryByOrder = (order: number): CategoryConfig | undefined =>
    CATEGORY_DETAILS.find(category => category.order === order);

/**
 * Helper function to get the next category in the pipeline sequence.
 * @param currentCategory - The current category ID
 * @returns The next category configuration or undefined if at the end
 */
export const getNextCategory = (currentCategory: LeadCategory): CategoryConfig | undefined => {
    const current = CATEGORY_DETAILS.find(category => category.id === currentCategory);
    return current ? getCategoryByOrder(current.order + 1) : undefined;
};

/**
 * Helper function to get the previous category in the pipeline sequence.
 * @param currentCategory - The current category ID
 * @returns The previous category configuration or undefined if at the start
 */
export const getPreviousCategory = (currentCategory: LeadCategory): CategoryConfig | undefined => {
    const current = CATEGORY_DETAILS.find(category => category.id === currentCategory);
    return current ? getCategoryByOrder(current.order - 1) : undefined;
};