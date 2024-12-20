/**
 * @fileoverview Profile page component for the multi-tenant CRM system
 * Implements user profile management with tenant isolation and analytics tracking
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { Container } from '@mui/material'; // ^5.14.0
import { useAnalytics } from '@segment/analytics-react'; // ^1.0.0
import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader from '../../components/common/PageHeader';
import ProfileSettings from '../../components/settings/ProfileSettings';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useAuth } from '../../hooks/useAuth';

/**
 * Profile page component providing user profile management functionality
 * Implements tenant-isolated profile settings with analytics tracking
 */
const ProfilePage: React.FC = () => {
  const { track } = useAnalytics();
  const { user } = useAuth();

  // Track page view on component mount
  useEffect(() => {
    track('Profile Page Viewed', {
      userId: user?.id,
      tenantId: user?.tenantId,
      timestamp: new Date().toISOString()
    });

    // Cleanup tracking on unmount
    return () => {
      track('Profile Page Exited', {
        userId: user?.id,
        tenantId: user?.tenantId,
        duration: Date.now() - new Date().getTime(),
        timestamp: new Date().toISOString()
      });
    };
  }, [track, user]);

  return (
    <DashboardLayout>
      <Container maxWidth={false}>
        <PageHeader
          title="Profile Settings"
          subtitle="Manage your account preferences and security settings"
        />
        
        <ErrorBoundary>
          <Container
            sx={{
              marginTop: theme => theme.spacing(3),
              marginBottom: theme => theme.spacing(3),
              position: 'relative',
              minHeight: 'calc(100vh - 200px)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <ProfileSettings />
          </Container>
        </ErrorBoundary>
      </Container>
    </DashboardLayout>
  );
};

// Export the component
export default ProfilePage;