/**
 * @fileoverview Main layout component for multi-tenant CRM system
 * Implements core application structure with responsive AppBar, Sidebar, and content area
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import { Box, Container, useMediaQuery, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import { ThemeProvider } from '@mui/material/styles';
import AppBar from '../components/common/AppBar';
import Sidebar from '../components/common/Sidebar';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { COLORS, SPACING, BREAKPOINTS } from '../constants/theme';

// Constants for layout dimensions
const DRAWER_WIDTH = 280;
const APPBAR_HEIGHT = 64;
const STORAGE_KEYS = {
  SIDEBAR_STATE: 'layout_sidebar_state',
  THEME_MODE: 'layout_theme_mode'
} as const;

// Styled components for layout structure
const LayoutRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  overflow: 'hidden',
  backgroundColor: COLORS.background.secondary
}));

const MainContent = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'open' && prop !== 'isMobile'
})<{
  open?: boolean;
  isMobile?: boolean;
}>(({ theme, open, isMobile }) => ({
  flexGrow: 1,
  padding: SPACING.layout.padding,
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: isMobile ? 0 : -DRAWER_WIDTH,
  ...(open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: 0,
  }),
  [theme.breakpoints.up('md')]: {
    padding: SPACING.layout.padding * 2,
  },
}));

// Interface definitions
interface MainLayoutProps {
  children: React.ReactNode;
  tenantId: string;
  defaultTheme?: any; // Using any for theme type as it's not provided in the context
  errorFallback?: React.ComponentType<any>;
}

/**
 * Main layout component that provides the core application structure
 * Implements responsive behavior and tenant-specific theming
 */
const MainLayout: React.FC<MainLayoutProps> = memo(({
  children,
  tenantId,
  defaultTheme,
  errorFallback
}) => {
  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State management
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const savedState = localStorage.getItem(STORAGE_KEYS.SIDEBAR_STATE);
    return savedState ? JSON.parse(savedState) : !isMobile;
  });

  // Handle sidebar persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_STATE, JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  // Handle responsive behavior
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // Sidebar toggle handler with analytics
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => !prev);
    // Analytics tracking would go here
  }, []);

  return (
    <ErrorBoundary fallback={errorFallback}>
      <ThemeProvider theme={defaultTheme}>
        <LayoutRoot>
          <AppBar 
            onSidebarToggle={handleSidebarToggle}
            className="main-appbar"
          />
          
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            width={DRAWER_WIDTH}
            aria-label="Main navigation"
          />
          
          <MainContent
            component="main"
            open={sidebarOpen}
            isMobile={isMobile}
            sx={{
              paddingTop: `${APPBAR_HEIGHT + SPACING.layout.padding}px`,
              minHeight: '100vh'
            }}
          >
            <Container
              maxWidth={false}
              sx={{
                height: '100%',
                px: {
                  xs: SPACING.layout.padding,
                  md: SPACING.layout.padding * 2
                }
              }}
            >
              {children}
            </Container>
          </MainContent>
        </LayoutRoot>
      </ThemeProvider>
    </ErrorBoundary>
  );
});

// Display name for debugging
MainLayout.displayName = 'MainLayout';

export default MainLayout;