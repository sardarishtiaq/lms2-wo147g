/**
 * @fileoverview Lead details page component with real-time updates and tenant isolation
 * Implements comprehensive lead management capabilities for the CRM system
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Alert } from '@mui/material';
import { useDispatch } from 'react-redux';
import DashboardLayout from '../../layouts/DashboardLayout';
import LeadDetails from '../../components/leads/LeadDetails';
import { useLeads } from '../../hooks/useLeads';
import { useWebSocket } from '../../hooks/useWebSocket';
import { showNotification } from '../../store/slices/uiSlice';
import { Lead } from '../../types/lead';
import { COLORS } from '../../constants/theme';
import { WEBSOCKET_EVENTS } from '../../services/websocket';

/**
 * Lead details page component with real-time updates and tenant isolation
 * @returns JSX.Element
 */
const LeadDetailsPage: React.FC = () => {
  // Router hooks
  const { id: leadId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Redux hooks
  const dispatch = useDispatch();

  // Local state
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Refs for cleanup
  const wsCleanupRef = useRef<(() => void) | null>(null);

  // Custom hooks
  const { fetchLeadById, updateLead } = useLeads('current-tenant-id'); // Tenant ID would come from context
  const ws = useWebSocket({
    url: process.env.REACT_APP_WS_URL || '',
    tenantId: 'current-tenant-id', // Tenant ID would come from context
    options: {
      reconnection: true,
      auth: {
        token: localStorage.getItem('token') || ''
      }
    }
  });

  /**
   * Handles WebSocket connection and subscription
   */
  const setupWebSocket = useCallback(() => {
    if (!leadId) return;

    ws.connect();

    const unsubscribe = ws.subscribe<Lead>(WEBSOCKET_EVENTS.LEAD_UPDATED, (updatedLead) => {
      if (updatedLead.id === leadId) {
        setLead(updatedLead);
        dispatch(showNotification({
          message: 'Lead updated in real-time',
          severity: 'info',
          duration: 3000
        }));
      }
    });

    wsCleanupRef.current = unsubscribe;
    setWsConnected(true);
  }, [leadId, ws, dispatch]);

  /**
   * Fetches lead data with error handling
   */
  const fetchLeadData = useCallback(async () => {
    if (!leadId) return;

    try {
      setLoading(true);
      setError(null);
      const leadData = await fetchLeadById(leadId);
      setLead(leadData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch lead details');
      dispatch(showNotification({
        message: 'Failed to fetch lead details',
        severity: 'error',
        duration: 5000
      }));
    } finally {
      setLoading(false);
    }
  }, [leadId, fetchLeadById, dispatch]);

  /**
   * Handles lead updates with optimistic UI
   */
  const handleLeadUpdate = useCallback(async (updatedData: Partial<Lead>) => {
    if (!lead?.id) return;

    // Optimistic update
    const previousLead = { ...lead };
    setLead(prev => prev ? { ...prev, ...updatedData } : null);

    try {
      const result = await updateLead(lead.id, updatedData);
      setLead(result);
      dispatch(showNotification({
        message: 'Lead updated successfully',
        severity: 'success',
        duration: 3000
      }));
    } catch (err) {
      // Revert optimistic update
      setLead(previousLead);
      dispatch(showNotification({
        message: 'Failed to update lead',
        severity: 'error',
        duration: 5000
      }));
    }
  }, [lead, updateLead, dispatch]);

  /**
   * Handles navigation back to leads list
   */
  const handleBack = useCallback(() => {
    navigate('/leads');
  }, [navigate]);

  // Initial data fetch and WebSocket setup
  useEffect(() => {
    fetchLeadData();
    setupWebSocket();

    return () => {
      if (wsCleanupRef.current) {
        wsCleanupRef.current();
      }
      ws.disconnect();
    };
  }, [fetchLeadData, setupWebSocket, ws]);

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, height: '100%' }}>
        {loading && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%' 
          }}>
            <CircularProgress size={40} sx={{ color: COLORS.primary }} />
          </Box>
        )}

        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {!loading && !error && lead && (
          <LeadDetails
            lead={lead}
            isLoading={loading}
            onClose={handleBack}
            tenantId="current-tenant-id" // Tenant ID would come from context
            onUpdate={handleLeadUpdate}
            wsConnected={wsConnected}
          />
        )}
      </Box>
    </DashboardLayout>
  );
};

export default LeadDetailsPage;