/**
 * Core theme constants and design system specifications for the multi-tenant CRM application.
 * Implements Material Design principles with custom brand colors and typography.
 * @version 1.0.0
 */

/**
 * Core color palette constants including brand colors and semantic color tokens
 */
export const COLORS = {
  // Brand colors
  primary: '#1976D2',
  secondary: '#388E3C',
  error: '#D32F2F',
  warning: '#FFA000',

  // Background colors
  background: {
    primary: '#FFFFFF',
    secondary: '#F5F5F5',
    dark: '#121212',
  },

  // Text colors
  text: {
    primary: '#333333',
    secondary: '#666666',
    disabled: '#9E9E9E',
  },
} as const;

/**
 * Typography configuration constants based on Material Design specifications
 * Uses Roboto as the primary font family with defined size and weight scales
 */
export const TYPOGRAPHY = {
  fontFamily: 'Roboto, sans-serif',
  
  fontSize: {
    heading: {
      h1: '32px',
      h2: '24px',
      h3: '20px',
      h4: '16px',
    },
    body: {
      large: '16px',
      medium: '14px',
      small: '12px',
    },
    label: '12px',
  },

  fontWeight: {
    regular: 400,
    medium: 500,
    bold: 700,
  },

  lineHeight: {
    heading: 1.2,
    body: 1.5,
  },
} as const;

/**
 * Spacing constants based on 8px grid system
 * Provides consistent spacing across components and layouts
 */
export const SPACING = {
  unit: 8,
  
  sizes: {
    xs: 8,    // 1 unit
    sm: 16,   // 2 units
    md: 24,   // 3 units
    lg: 32,   // 4 units
    xl: 40,   // 5 units
  },

  layout: {
    gutter: 24,
    margin: 16,
    padding: 16,
  },
} as const;

/**
 * Responsive breakpoint constants and media query helpers
 * Defines standard breakpoints for mobile, tablet and desktop layouts
 */
export const BREAKPOINTS = {
  mobile: 320,
  tablet: 768,
  desktop: 1024,

  mediaQueries: {
    mobile: '(min-width: 320px)',
    tablet: '(min-width: 768px)', 
    desktop: '(min-width: 1024px)',
  },
} as const;

/**
 * Material Design elevation constants for shadow effects
 * Provides consistent elevation levels across components
 */
export const ELEVATION = {
  levels: {
    '0': 'none',
    '1': '0 2px 1px -1px rgba(0,0,0,0.2)',
    '2': '0 3px 3px -2px rgba(0,0,0,0.2)',
    '4': '0 2px 4px -1px rgba(0,0,0,0.2)',
    '8': '0 5px 5px -3px rgba(0,0,0,0.2)',
    '16': '0 8px 10px -5px rgba(0,0,0,0.2)',
    '24': '0 11px 15px -7px rgba(0,0,0,0.2)',
  },
} as const;

// Type exports for theme constants
export type Colors = typeof COLORS;
export type Typography = typeof TYPOGRAPHY;
export type Spacing = typeof SPACING;
export type Breakpoints = typeof BREAKPOINTS;
export type Elevation = typeof ELEVATION;