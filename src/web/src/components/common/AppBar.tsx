/**
 * @fileoverview Top-level navigation component for multi-tenant CRM system
 * Implements Material-UI AppBar with tenant context, notifications, and user profile
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import {
  AppBar as MuiAppBar,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Avatar,
  Badge,
  Box,
  styled,
} from '@mui/material'; // ^5.0.0
import {
  NotificationsOutlined,
  AccountCircle,
  Settings,
  Menu as MenuIcon,
} from '@mui/icons-material'; // ^5.0.0
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { COLORS } from '../../constants/theme';
import { ROLES } from '../../../backend/src/constants/roles';

// Styled components
const StyledAppBar = styled(MuiAppBar)(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
  backgroundColor: COLORS.background.primary,
  color: COLORS.text.primary,
  boxShadow: theme.shadows[2],
}));

const LogoContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  marginRight: 24,
});

const ActionContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  marginLeft: 'auto',
  gap: 8,
});

// Interface definitions
interface AppBarProps {
  onSidebarToggle: () => void;
  className?: string;
}

interface NotificationItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: Date;
}

/**
 * Top-level navigation component with multi-tenant support
 * @param props - Component props
 * @returns JSX.Element
 */
export const AppBar: React.FC<AppBarProps> = ({ onSidebarToggle, className }) => {
  // Hooks
  const { user, tenant, logout } = useAuth();
  const { showNotification, notification } = useNotification();

  // State
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationAnchor, setNotificationAnchor] = useState<null | HTMLElement>(null);

  // Handlers
  const handleProfileMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleNotificationMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    setNotificationAnchor(null);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      showNotification({
        message: 'Successfully logged out',
        severity: 'success',
        duration: 3000,
      });
    } catch (error) {
      showNotification({
        message: 'Failed to logout. Please try again.',
        severity: 'error',
        duration: 5000,
      });
    }
    handleMenuClose();
  }, [logout, showNotification, handleMenuClose]);

  // Menu items based on user role
  const menuItems = [
    { label: 'Profile', onClick: handleMenuClose },
    { label: 'Settings', onClick: handleMenuClose, roles: [ROLES.ADMIN, ROLES.MANAGER] },
    { label: 'Help & Support', onClick: handleMenuClose },
    { label: 'Logout', onClick: handleLogout },
  ].filter(item => !item.roles || (user?.role && item.roles.includes(user.role)));

  return (
    <StyledAppBar position="fixed" className={className}>
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          aria-label="toggle sidebar"
          onClick={onSidebarToggle}
          sx={{ marginRight: 2 }}
        >
          <MenuIcon />
        </IconButton>

        <LogoContainer>
          <Typography variant="h6" noWrap component="div">
            {tenant?.name || 'CRM System'}
          </Typography>
        </LogoContainer>

        <ActionContainer>
          <IconButton
            color="inherit"
            aria-label="show notifications"
            onClick={handleNotificationMenuOpen}
          >
            <Badge badgeContent={notification?.queue?.length || 0} color="error">
              <NotificationsOutlined />
            </Badge>
          </IconButton>

          <IconButton
            edge="end"
            aria-label="account settings"
            aria-controls="profile-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            {user?.firstName ? (
              <Avatar sx={{ width: 32, height: 32 }}>
                {user.firstName[0]}
                {user.lastName?.[0]}
              </Avatar>
            ) : (
              <AccountCircle />
            )}
          </IconButton>
        </ActionContainer>

        {/* Profile Menu */}
        <Menu
          id="profile-menu"
          anchorEl={anchorEl}
          keepMounted
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          {menuItems.map((item) => (
            <MenuItem
              key={item.label}
              onClick={item.onClick}
              sx={{ minWidth: 200 }}
            >
              {item.label}
            </MenuItem>
          ))}
        </Menu>

        {/* Notifications Menu */}
        <Menu
          id="notifications-menu"
          anchorEl={notificationAnchor}
          keepMounted
          open={Boolean(notificationAnchor)}
          onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          {notification?.queue?.length ? (
            notification.queue.map((item: NotificationItem) => (
              <MenuItem key={item.id} onClick={handleMenuClose}>
                {item.message}
              </MenuItem>
            ))
          ) : (
            <MenuItem onClick={handleMenuClose}>No new notifications</MenuItem>
          )}
        </Menu>
      </Toolbar>
    </StyledAppBar>
  );
};

export default AppBar;