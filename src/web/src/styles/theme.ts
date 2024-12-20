/**
 * Material-UI theme configuration for the multi-tenant CRM application.
 * Implements comprehensive design system specifications with full component customization.
 * @version 1.0.0
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';
import { 
  COLORS, 
  TYPOGRAPHY, 
  SPACING, 
  BREAKPOINTS 
} from '../constants/theme';

/**
 * Comprehensive theme configuration implementing the design system specifications
 * including typography, colors, spacing, elevation, and component customizations
 */
const themeOptions: ThemeOptions = {
  // Color palette configuration with light/dark variants
  palette: {
    primary: {
      main: COLORS.primary,
      light: '#42a5f5',
      dark: '#1565C0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: COLORS.secondary,
      light: '#4CAF50',
      dark: '#2E7D32',
      contrastText: '#ffffff',
    },
    error: {
      main: COLORS.error,
      light: '#EF5350',
      dark: '#C62828',
      contrastText: '#ffffff',
    },
    warning: {
      main: COLORS.warning,
      light: '#FFB74D',
      dark: '#F57C00',
      contrastText: '#000000',
    },
    background: {
      default: COLORS.background.secondary,
      paper: COLORS.background.primary,
    },
    text: {
      primary: COLORS.text.primary,
      secondary: COLORS.text.secondary,
      disabled: COLORS.text.disabled,
    },
  },

  // Typography system configuration
  typography: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontWeightLight: 300,
    fontWeightRegular: TYPOGRAPHY.fontWeight.regular,
    fontWeightMedium: TYPOGRAPHY.fontWeight.medium,
    fontWeightBold: TYPOGRAPHY.fontWeight.bold,
    h1: {
      fontSize: TYPOGRAPHY.fontSize.heading.h1,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      lineHeight: TYPOGRAPHY.lineHeight.heading,
      letterSpacing: '-0.01562em',
    },
    h2: {
      fontSize: TYPOGRAPHY.fontSize.heading.h2,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      lineHeight: TYPOGRAPHY.lineHeight.heading,
      letterSpacing: '-0.00833em',
    },
    h3: {
      fontSize: TYPOGRAPHY.fontSize.heading.h3,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      lineHeight: TYPOGRAPHY.lineHeight.heading,
      letterSpacing: '0em',
    },
    h4: {
      fontSize: TYPOGRAPHY.fontSize.heading.h4,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      lineHeight: TYPOGRAPHY.lineHeight.heading,
      letterSpacing: '0.00735em',
    },
    body1: {
      fontSize: TYPOGRAPHY.fontSize.body.medium,
      lineHeight: TYPOGRAPHY.lineHeight.body,
      letterSpacing: '0.00938em',
    },
    body2: {
      fontSize: TYPOGRAPHY.fontSize.body.small,
      lineHeight: TYPOGRAPHY.lineHeight.body,
      letterSpacing: '0.01071em',
    },
  },

  // Spacing configuration based on 8px grid
  spacing: SPACING.unit,

  // Responsive breakpoints configuration
  breakpoints: {
    values: {
      xs: BREAKPOINTS.mobile,
      sm: BREAKPOINTS.tablet,
      md: BREAKPOINTS.desktop,
      lg: 1280,
      xl: 1920,
    },
  },

  // Component style customizations
  components: {
    // Card component customization
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'box-shadow 0.3s ease',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
          },
        },
      },
    },

    // Button component customization
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '4px',
          padding: `${SPACING.unit}px ${SPACING.unit * 2}px`,
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        containedPrimary: {
          boxShadow: '0 2px 4px rgba(25, 118, 210, 0.25)',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(25, 118, 210, 0.35)',
          },
        },
        containedSecondary: {
          boxShadow: '0 2px 4px rgba(56, 142, 60, 0.25)',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(56, 142, 60, 0.35)',
          },
        },
      },
    },

    // Paper component customization
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        },
        elevation2: {
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        },
      },
    },

    // TextField component customization
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '&:hover fieldset': {
              borderColor: COLORS.primary,
            },
          },
        },
      },
    },

    // Table component customization
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: SPACING.unit * 2,
        },
        head: {
          fontWeight: TYPOGRAPHY.fontWeight.medium,
          backgroundColor: COLORS.background.secondary,
        },
      },
    },
  },
};

// Create and export the theme
const theme = createTheme(themeOptions);

export default theme;