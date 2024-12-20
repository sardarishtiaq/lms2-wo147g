/**
 * @fileoverview Frontend route constants for the multi-tenant CRM system
 * Provides centralized route management with TypeScript support and permission mapping
 * @version 1.0.0
 */

import {
  PERMISSIONS,
  type PermissionType
} from './permissions';

/**
 * Type definition for route parameters
 */
type RouteParams = {
  id?: string;
  token?: string;
};

/**
 * Type definition for route configuration
 */
type RouteConfig = {
  path: string;
  permissions?: PermissionType[];
};

/**
 * Application route constants with type-safe paths
 * Organized by feature domain for maintainability
 */
export const ROUTES = {
  AUTH: {
    LOGIN: '/auth/login',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password/:token',
    TENANT_SELECT: '/auth/tenant-select'
  },

  DASHBOARD: {
    HOME: '/',
    METRICS: '/dashboard/metrics',
    ACTIVITY: '/dashboard/activity',
    ANALYTICS: '/dashboard/analytics'
  },

  LEADS: {
    LIST: '/leads',
    NEW: '/leads/new',
    DETAILS: '/leads/:id',
    EDIT: '/leads/:id/edit',
    CATEGORIES: {
      ALL: '/leads/all',
      UNASSIGNED: '/leads/unassigned',
      ASSIGNED: '/leads/assigned',
      NEW_DATA: '/leads/new-data',
      WORKING: '/leads/working',
      PRE_QUALIFIED: '/leads/pre-qualified',
      REPEATING: '/leads/repeating',
      ONE_TIME: '/leads/one-time',
      NOT_INTERESTED: '/leads/not-interested',
      REPORT_TO_LEAD_GEN: '/leads/report-lead-gen',
      READY_FOR_DEMO: '/leads/ready-for-demo',
      PIPELINE: '/leads/pipeline'
    },
    ACTIVITIES: '/leads/:id/activities',
    TIMELINE: '/leads/:id/timeline'
  },

  QUOTES: {
    LIST: '/quotes',
    NEW: '/quotes/new',
    DETAILS: '/quotes/:id',
    EDIT: '/quotes/:id/edit',
    PREVIEW: '/quotes/:id/preview',
    HISTORY: '/quotes/:id/history'
  },

  SETTINGS: {
    PROFILE: '/settings/profile',
    TENANT: '/settings/tenant',
    USERS: '/settings/users',
    CATEGORIES: '/settings/categories',
    PERMISSIONS: '/settings/permissions',
    INTEGRATIONS: '/settings/integrations'
  },

  ACTIVITIES: {
    LIST: '/activities',
    DETAILS: '/activities/:id'
  }
} as const;

/**
 * Maps routes to their required permissions for access control
 * Provides granular permission requirements for each route
 */
export const ROUTE_PERMISSIONS: Record<string, PermissionType[]> = {
  // Lead Management Routes
  [ROUTES.LEADS.LIST]: [PERMISSIONS.LEAD_VIEW],
  [ROUTES.LEADS.NEW]: [PERMISSIONS.LEAD_CREATE],
  [ROUTES.LEADS.DETAILS]: [PERMISSIONS.LEAD_VIEW],
  [ROUTES.LEADS.EDIT]: [PERMISSIONS.LEAD_UPDATE],
  [ROUTES.LEADS.ACTIVITIES]: [PERMISSIONS.LEAD_VIEW],
  [ROUTES.LEADS.TIMELINE]: [PERMISSIONS.LEAD_VIEW],

  // Lead Category Routes
  [ROUTES.LEADS.CATEGORIES.ALL]: [PERMISSIONS.LEAD_VIEW],
  [ROUTES.LEADS.CATEGORIES.UNASSIGNED]: [PERMISSIONS.LEAD_VIEW],
  [ROUTES.LEADS.CATEGORIES.ASSIGNED]: [PERMISSIONS.LEAD_VIEW],
  [ROUTES.LEADS.CATEGORIES.NEW_DATA]: [PERMISSIONS.LEAD_VIEW, PERMISSIONS.LEAD_CREATE],
  [ROUTES.LEADS.CATEGORIES.WORKING]: [PERMISSIONS.LEAD_VIEW, PERMISSIONS.LEAD_UPDATE],
  [ROUTES.LEADS.CATEGORIES.PRE_QUALIFIED]: [PERMISSIONS.LEAD_VIEW],
  [ROUTES.LEADS.CATEGORIES.REPEATING]: [PERMISSIONS.LEAD_VIEW],
  [ROUTES.LEADS.CATEGORIES.ONE_TIME]: [PERMISSIONS.LEAD_VIEW],
  [ROUTES.LEADS.CATEGORIES.NOT_INTERESTED]: [PERMISSIONS.LEAD_VIEW],
  [ROUTES.LEADS.CATEGORIES.REPORT_TO_LEAD_GEN]: [PERMISSIONS.LEAD_VIEW],
  [ROUTES.LEADS.CATEGORIES.READY_FOR_DEMO]: [PERMISSIONS.LEAD_VIEW],
  [ROUTES.LEADS.CATEGORIES.PIPELINE]: [PERMISSIONS.LEAD_VIEW],

  // Quote Management Routes
  [ROUTES.QUOTES.LIST]: [PERMISSIONS.QUOTE_VIEW],
  [ROUTES.QUOTES.NEW]: [PERMISSIONS.QUOTE_CREATE],
  [ROUTES.QUOTES.DETAILS]: [PERMISSIONS.QUOTE_VIEW],
  [ROUTES.QUOTES.EDIT]: [PERMISSIONS.QUOTE_UPDATE],
  [ROUTES.QUOTES.PREVIEW]: [PERMISSIONS.QUOTE_VIEW],
  [ROUTES.QUOTES.HISTORY]: [PERMISSIONS.QUOTE_VIEW],

  // Settings Routes
  [ROUTES.SETTINGS.USERS]: [PERMISSIONS.USER_VIEW],
  [ROUTES.SETTINGS.TENANT]: [PERMISSIONS.TENANT_SETTINGS_VIEW],
  [ROUTES.SETTINGS.CATEGORIES]: [PERMISSIONS.TENANT_SETTINGS_VIEW],
  [ROUTES.SETTINGS.PERMISSIONS]: [PERMISSIONS.TENANT_SETTINGS_VIEW],
  [ROUTES.SETTINGS.INTEGRATIONS]: [PERMISSIONS.TENANT_SETTINGS_VIEW]
};

/**
 * Helper function to build route paths with parameters
 * @param route Base route path
 * @param params Route parameters
 * @returns Compiled route path with parameters
 */
export const buildRoute = (route: string, params?: RouteParams): string => {
  let path = route;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      path = path.replace(`:${key}`, value);
    });
  }
  return path;
};

/**
 * Type definition for all route paths
 * Provides type safety when referencing routes
 */
export type RoutePath = typeof ROUTES[keyof typeof ROUTES];

/**
 * Type guard to check if a string is a valid route
 * @param path Route path to check
 * @returns True if the path is a valid route
 */
export const isValidRoute = (path: string): path is RoutePath => {
  const allRoutes = Object.values(ROUTES).flatMap(domain => 
    typeof domain === 'string' ? domain : Object.values(domain)
  );
  return allRoutes.includes(path);
};