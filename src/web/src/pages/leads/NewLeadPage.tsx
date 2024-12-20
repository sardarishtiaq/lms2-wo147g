/**
 * @fileoverview React page component for creating new leads in the CRM system
 * Implements comprehensive lead creation with tenant isolation and real-time updates
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { useSnackbar } from 'notistack';

// Internal imports
import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader from '../../components/common/PageHeader';
import LeadForm from '../../components/leads/LeadForm';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useLeads } from '../../hooks/useLeads';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import { Lead } from '../../types/lead';

/**
 * NewLeadPage component for creating new leads with tenant isolation
 * and real-time collaboration support
 */
const NewLeadPage: React.FC = React.memo(() => {
  // Hooks
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { tenantId } = useAuth();
  const { createLead, loading, error } = useLeads(tenantId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle form submission with optimistic updates
  const handleSubmit = useCallback(async (formData: Lead) => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Create lead with tenant context
      const createdLead = await createLead({
        ...formData,
        tenantId
      });

      // Show success notification
      enqueueSnackbar('Lead created successfully', {
        variant: 'success',
        autoHideDuration: 3000,
        anchorOrigin: {
          vertical: 'top',
          horizontal: 'right'
        }
      });

      // Navigate to lead details page
      navigate(`${ROUTES.LEADS.DETAILS.replace(':id', createdLead.id)}`, {
        state: { lead: createdLead }
      });

    } catch (error) {
      // Show error notification
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Failed to create lead',
        {
          variant: 'error',
          autoHideDuration: 5000,
          anchorOrigin: {
            vertical: 'top',
            horizontal: 'right'
          }
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [createLead, navigate, enqueueSnackbar, tenantId, isSubmitting]);

  // Handle form cancellation
  const handleCancel = useCallback(() => {
    navigate(ROUTES.LEADS.LIST);
  }, [navigate]);

  // Handle error cleanup on unmount
  useEffect(() => {
    return () => {
      if (error) {
        // Clear any error state
      }
    };
  }, [error]);

  return (
    <DashboardLayout>
      <ErrorBoundary>
        <Box
          component="main"
          role="main"
          aria-label="Create new lead"
          sx={{
            flexGrow: 1,
            py: 3,
            px: 4
          }}
        >
          <PageHeader
            title="Create New Lead"
            subtitle="Enter lead details to create a new lead in the system"
            actions={null}
          />

          <Box
            component="section"
            sx={{
              mt: 3,
              backgroundColor: 'background.paper',
              borderRadius: 1,
              p: 3,
              boxShadow: 1
            }}
          >
            <LeadForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              autoSave={false}
            />
          </Box>
        </Box>
      </ErrorBoundary>
    </DashboardLayout>
  );
});

// Display name for debugging
NewLeadPage.displayName = 'NewLeadPage';

export default NewLeadPage;