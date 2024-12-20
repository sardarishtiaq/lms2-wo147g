// @mui/icons-material version ^5.0.0
import {
  SpatialAudio as SpatialAudioIcon,
  AssignmentInd as AssignmentIndIcon,
  ShieldMoon as ShieldMoonIcon,
  HeadsetMic as HeadsetMicIcon,
  DataExploration as DataExplorationIcon,
  Face5 as Face5Icon,
  Blanket as BlanketIcon,
  ReadinessScore as ReadinessScoreIcon,
} from '@mui/icons-material';

// @mui/material version ^5.0.0
import { SvgIconProps } from '@mui/material';

import { LeadCategory } from '../constants/leadCategories';

/**
 * Interface defining the structure of category icon configuration.
 * Includes the Material-UI icon component and its color property.
 */
export interface CategoryIcon {
  /** The Material-UI icon component to be rendered */
  component: React.ComponentType<SvgIconProps>;
  /** The color to be applied to the icon */
  color: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
}

/**
 * Mapping of lead categories to their corresponding Material-UI icon configurations.
 * This constant provides a centralized icon management solution for consistent
 * visual representation across the application.
 * 
 * @remarks
 * - Icons are chosen based on the semantic meaning of each category
 * - Colors are selected to provide visual hierarchy and status indication
 * - Configuration is frozen to prevent runtime modifications
 */
export const CATEGORY_ICONS: Readonly<Record<LeadCategory, CategoryIcon>> = Object.freeze({
  [LeadCategory.ALL_LEADS]: {
    component: SpatialAudioIcon,
    color: 'primary',
  },
  [LeadCategory.UNASSIGNED]: {
    component: AssignmentIndIcon,
    color: 'warning',
  },
  [LeadCategory.ASSIGNED]: {
    component: ShieldMoonIcon,
    color: 'success',
  },
  [LeadCategory.NEW_DATA]: {
    component: HeadsetMicIcon,
    color: 'info',
  },
  [LeadCategory.WORKING_ON]: {
    component: DataExplorationIcon,
    color: 'primary',
  },
  [LeadCategory.PRE_QUALIFIED]: {
    component: DataExplorationIcon,
    color: 'success',
  },
  [LeadCategory.REPEATING_CUSTOMER]: {
    component: DataExplorationIcon,
    color: 'success',
  },
  [LeadCategory.ONE_TIME_CUSTOMER]: {
    component: Face5Icon,
    color: 'info',
  },
  [LeadCategory.NOT_INTERESTED]: {
    component: ShieldMoonIcon,
    color: 'error',
  },
  [LeadCategory.REPORT_TO_LEAD_GEN]: {
    component: BlanketIcon,
    color: 'warning',
  },
  [LeadCategory.READY_FOR_DEMO]: {
    component: ReadinessScoreIcon,
    color: 'success',
  },
  [LeadCategory.PIPELINE]: {
    component: DataExplorationIcon,
    color: 'primary',
  },
});

/**
 * Helper function to get the icon configuration for a specific category.
 * Provides type-safe access to category icons.
 * 
 * @param category - The lead category to get the icon configuration for
 * @returns The icon configuration for the specified category
 */
export const getCategoryIcon = (category: LeadCategory): CategoryIcon => {
  return CATEGORY_ICONS[category];
};

/**
 * Type guard to check if a category has a specific icon configuration.
 * Useful for runtime checking before icon usage.
 * 
 * @param category - The category to check
 * @returns Boolean indicating if the category has an icon configuration
 */
export const hasCategoryIcon = (category: LeadCategory): boolean => {
  return category in CATEGORY_ICONS;
};