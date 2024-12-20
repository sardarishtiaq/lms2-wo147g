import React, { memo, Suspense, useCallback, useMemo, useState } from 'react';
import { Box, Drawer, List, ListItem, ListItemIcon, ListItemText, Collapse, Icon, Skeleton } from '@mui/material';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { PERMISSIONS } from '../../constants/permissions';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/theme';

// Version comments for external dependencies
/**
 * @external react ^18.2.0
 * @external @mui/material ^5.0.0
 * @external react-router-dom ^6.0.0
 */

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  width?: number;
  'aria-label'?: string;
  'data-testid'?: string;
}

// Lead category configuration with Material icons
const LEAD_CATEGORIES = [
  { id: 'all', label: 'All Leads', icon: 'spatial_audio', path: ROUTES.LEADS.CATEGORIES.ALL },
  { id: 'unassigned', label: 'Un-Assigned', icon: 'assignment_ind', path: ROUTES.LEADS.CATEGORIES.UNASSIGNED },
  { id: 'assigned', label: 'Assigned', icon: 'shield_moon', path: ROUTES.LEADS.CATEGORIES.ASSIGNED },
  { id: 'new_data', label: 'New Data', icon: 'headset_mic', path: ROUTES.LEADS.CATEGORIES.NEW_DATA },
  { id: 'working', label: 'Working On', icon: 'data_exploration', path: ROUTES.LEADS.CATEGORIES.WORKING },
  { id: 'pre_qualified', label: 'Pre Qualified', icon: 'data_exploration', path: ROUTES.LEADS.CATEGORIES.PRE_QUALIFIED },
  { id: 'repeating', label: 'Repeating Customer', icon: 'data_exploration', path: ROUTES.LEADS.CATEGORIES.REPEATING },
  { id: 'one_time', label: 'One Time Customer', icon: 'face_5', path: ROUTES.LEADS.CATEGORIES.ONE_TIME },
  { id: 'not_interested', label: 'Not Interested/DND', icon: 'shield_moon', path: ROUTES.LEADS.CATEGORIES.NOT_INTERESTED },
  { id: 'report_lead_gen', label: 'Report to Lead Gen', icon: 'blanket', path: ROUTES.LEADS.CATEGORIES.REPORT_TO_LEAD_GEN },
  { id: 'ready_demo', label: 'Ready for Demo', icon: 'readiness_score', path: ROUTES.LEADS.CATEGORIES.READY_FOR_DEMO },
  { id: 'pipeline', label: 'Pipeline', icon: 'data_exploration', path: ROUTES.LEADS.CATEGORIES.PIPELINE }
] as const;

// Permission check with memoization
const hasPermission = memo((permission: string, tenantId: string): boolean => {
  // Implementation would check against auth context and cache results
  return true; // Simplified for example
});

const Sidebar: React.FC<SidebarProps> = memo(({
  isOpen,
  onClose,
  width = 280,
  'aria-label': ariaLabel = 'Navigation sidebar',
  'data-testid': dataTestId = 'sidebar'
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedCategories, setExpandedCategories] = useState(true);

  // Memoize active route checking
  const isActiveRoute = useCallback((path: string): boolean => {
    return location.pathname === path;
  }, [location.pathname]);

  // Handle category navigation with analytics
  const handleCategoryClick = useCallback((categoryId: string, event: React.MouseEvent) => {
    event.preventDefault();
    // Analytics tracking would go here
    navigate(`${ROUTES.LEADS.LIST}?category=${categoryId}`);
  }, [navigate]);

  // Memoize navigation items based on permissions
  const navigationItems = useMemo(() => ([
    {
      path: ROUTES.DASHBOARD.HOME,
      label: 'Dashboard',
      icon: 'dashboard',
      permission: null
    },
    {
      path: ROUTES.LEADS.LIST,
      label: 'Leads',
      icon: 'person_search',
      permission: PERMISSIONS.LEAD_VIEW,
      hasSubmenu: true
    },
    {
      path: ROUTES.QUOTES.LIST,
      label: 'Quotes',
      icon: 'description',
      permission: PERMISSIONS.QUOTE_VIEW
    },
    {
      path: ROUTES.SETTINGS.PROFILE,
      label: 'Settings',
      icon: 'settings',
      permission: PERMISSIONS.USER_VIEW
    }
  ]), []);

  const drawerContent = (
    <Box
      role="navigation"
      aria-label={ariaLabel}
      sx={{
        width,
        height: '100%',
        backgroundColor: COLORS.background.primary,
        borderRight: `1px solid ${COLORS.text.disabled}`,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <List component="nav" sx={{ width: '100%', p: SPACING.sizes.sm }}>
        {navigationItems.map(({ path, label, icon, permission, hasSubmenu }) => {
          if (permission && !hasPermission(permission, 'current-tenant-id')) {
            return null;
          }

          return (
            <React.Fragment key={path}>
              <ListItem
                button
                component={Link}
                to={path}
                selected={isActiveRoute(path)}
                onClick={hasSubmenu ? () => setExpandedCategories(!expandedCategories) : undefined}
                sx={{
                  borderRadius: '8px',
                  mb: 1,
                  '&.Mui-selected': {
                    backgroundColor: `${COLORS.primary}14`,
                    '&:hover': {
                      backgroundColor: `${COLORS.primary}20`
                    }
                  }
                }}
              >
                <ListItemIcon>
                  <Icon>{icon}</Icon>
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  primaryTypographyProps={{
                    fontSize: TYPOGRAPHY.fontSize.body.medium,
                    fontWeight: TYPOGRAPHY.fontWeight.medium
                  }}
                />
                {hasSubmenu && (
                  <Icon>{expandedCategories ? 'expand_less' : 'expand_more'}</Icon>
                )}
              </ListItem>

              {hasSubmenu && (
                <Collapse in={expandedCategories} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {LEAD_CATEGORIES.map(category => (
                      <ListItem
                        button
                        key={category.id}
                        onClick={(e) => handleCategoryClick(category.id, e)}
                        selected={isActiveRoute(category.path)}
                        sx={{
                          pl: 4,
                          borderRadius: '8px',
                          mb: 0.5
                        }}
                      >
                        <ListItemIcon>
                          <Icon>{category.icon}</Icon>
                        </ListItemIcon>
                        <ListItemText
                          primary={category.label}
                          primaryTypographyProps={{
                            fontSize: TYPOGRAPHY.fontSize.body.small
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              )}
            </React.Fragment>
          );
        })}
      </List>
    </Box>
  );

  return (
    <ErrorBoundary>
      <Suspense fallback={<Skeleton variant="rectangular" width={width} height="100vh" />}>
        <Drawer
          open={isOpen}
          onClose={onClose}
          variant="temporary"
          anchor="left"
          data-testid={dataTestId}
          sx={{
            '& .MuiDrawer-paper': {
              width,
              boxSizing: 'border-box'
            }
          }}
        >
          {drawerContent}
        </Drawer>
      </Suspense>
    </ErrorBoundary>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;