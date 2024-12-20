/**
 * Reusable styled components and Material-UI component style overrides
 * Implements design system specifications for consistent UI styling
 * @version 1.0.0
 */

import { styled } from '@mui/material/styles';
import { Paper, Card } from '@mui/material';
import { COLORS, SPACING, BREAKPOINTS } from '../constants/theme';

/**
 * Interface for components that support elevation
 */
interface ElevationProps {
  elevation?: number;
}

/**
 * Enhanced Card component with consistent styling, hover effects, and accessibility
 * Implements Material Design elevation and interaction patterns
 */
export const StyledCard = styled(Card)<ElevationProps>(({ elevation = 1 }) => ({
  padding: SPACING.sizes.md,
  margin: SPACING.sizes.sm,
  borderRadius: '4px',
  backgroundColor: COLORS.background.primary,
  boxShadow: `0 ${elevation * 2}px ${elevation * 4}px rgba(0,0,0,0.1)`,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  
  '&:hover': {
    boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
    transform: 'translateY(-2px)',
  },
  
  '&:focus-within': {
    outline: `2px solid ${COLORS.primary}`,
    outlineOffset: '2px',
  },

  [`@media (max-width: ${BREAKPOINTS.mobile}px)`]: {
    margin: SPACING.sizes.xs,
    padding: SPACING.sizes.sm,
  },
}));

/**
 * Container component for main content areas with proper spacing and responsive behavior
 * Provides consistent padding and background styling across the application
 */
export const ContentContainer = styled(Paper)(({ theme }) => ({
  padding: SPACING.sizes.lg,
  margin: SPACING.sizes.md,
  minHeight: 'calc(100vh - 64px)', // Accounts for header height
  backgroundColor: COLORS.background.primary,
  borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',

  [`@media (max-width: ${BREAKPOINTS.tablet}px)`]: {
    padding: SPACING.sizes.md,
    margin: SPACING.sizes.sm,
  },

  [`@media (max-width: ${BREAKPOINTS.mobile}px)`]: {
    padding: SPACING.sizes.sm,
    margin: SPACING.sizes.xs,
    borderRadius: '4px',
  },
}));

/**
 * Top-level container for page layouts with responsive width and padding
 * Implements max-width constraints and responsive padding based on viewport
 */
export const PageContainer = styled('div')({
  maxWidth: '1200px',
  margin: '0 auto',
  padding: SPACING.sizes.xl,
  width: '100%',
  boxSizing: 'border-box',

  [`@media (max-width: ${BREAKPOINTS.desktop}px)`]: {
    maxWidth: '100%',
    padding: SPACING.sizes.lg,
  },

  [`@media (max-width: ${BREAKPOINTS.tablet}px)`]: {
    padding: SPACING.sizes.md,
  },

  [`@media (max-width: ${BREAKPOINTS.mobile}px)`]: {
    padding: SPACING.sizes.sm,
  },
});

/**
 * Grid container with responsive column layout
 * Provides consistent grid spacing and responsive breakpoints
 */
export const GridContainer = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: SPACING.sizes.md,
  width: '100%',
  
  [`@media (max-width: ${BREAKPOINTS.tablet}px)`]: {
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: SPACING.sizes.sm,
  },

  [`@media (max-width: ${BREAKPOINTS.mobile}px)`]: {
    gridTemplateColumns: '1fr',
    gap: SPACING.sizes.xs,
  },
});

/**
 * Flex container with common alignment patterns
 * Supports row/column layout with responsive spacing
 */
interface FlexContainerProps {
  direction?: 'row' | 'column';
  align?: 'flex-start' | 'center' | 'flex-end';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  gap?: keyof typeof SPACING.sizes;
}

export const FlexContainer = styled('div')<FlexContainerProps>(({
  direction = 'row',
  align = 'center',
  justify = 'flex-start',
  gap = 'md'
}) => ({
  display: 'flex',
  flexDirection: direction,
  alignItems: align,
  justifyContent: justify,
  gap: SPACING.sizes[gap],

  [`@media (max-width: ${BREAKPOINTS.mobile}px)`]: {
    gap: SPACING.sizes.sm,
  },
}));

/**
 * Section container with consistent spacing and optional dividers
 * Used for grouping related content with proper vertical spacing
 */
interface SectionContainerProps {
  withDivider?: boolean;
}

export const SectionContainer = styled('section')<SectionContainerProps>(({
  withDivider = false
}) => ({
  padding: `${SPACING.sizes.lg}px 0`,
  
  ...(withDivider && {
    borderBottom: `1px solid ${COLORS.text.disabled}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  }),

  [`@media (max-width: ${BREAKPOINTS.mobile}px)`]: {
    padding: `${SPACING.sizes.md}px 0`,
  },
}));