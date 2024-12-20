import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  IconButton,
  Divider,
  Chip,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Edit as EditIcon, Save as SaveIcon, Close as CloseIcon } from '@mui/icons-material';
import { useDispatch } from 'react-redux';
import { io } from 'socket.io-client';
import { Lead } from '../../types/lead';
import LeadTimeline from './LeadTimeline';
import { useLeads } from '../../hooks/useLeads';
import { COLORS, TYPOGRAPHY } from '../../constants/theme';
import { LeadCategory, CATEGORY_DETAILS } from '../../constants/leadCategories';
import { showNotification } from '../../store/slices/uiSlice';
import LoadingSpinner from '../common/LoadingSpinner';

interface LeadDetailsProps {
  lead: Lead;
  isLoading: boolean;
  onClose: () => void;
  tenantId: string;
}

const LeadDetails: React.FC<LeadDetailsProps> = ({
  lead,
  isLoading,
  onClose,
  tenantId,
}) => {
  const dispatch = useDispatch();
  const { updateLead, updateCategory } = useLeads(tenantId);

  // Local state management
  const [isEditing, setIsEditing] = useState(false);
  const [editedLead, setEditedLead] = useState<Lead>(lead);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const socket = io(process.env.REACT_APP_WS_URL || '', {
      query: { tenantId },
      auth: { token: localStorage.getItem('token') },
    });

    socket.on('lead:updated', (updatedLead: Lead) => {
      if (updatedLead.id === lead.id) {
        setEditedLead(updatedLead);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [lead.id, tenantId]);

  // Memoized category options
  const categoryOptions = useMemo(() => 
    CATEGORY_DETAILS.map(category => ({
      value: category.id,
      label: category.name,
      icon: category.icon,
    })), []
  );

  // Handle category change with optimistic update
  const handleCategoryChange = useCallback(async (newCategory: LeadCategory) => {
    try {
      setIsSaving(true);
      setError(null);

      // Optimistic update
      setEditedLead(prev => ({ ...prev, category: newCategory }));

      await updateCategory(lead.id, newCategory);

      dispatch(showNotification({
        message: 'Lead category updated successfully',
        severity: 'success',
      }));
    } catch (err) {
      setError('Failed to update lead category');
      // Revert optimistic update
      setEditedLead(prev => ({ ...prev, category: lead.category }));
      
      dispatch(showNotification({
        message: 'Failed to update lead category',
        severity: 'error',
      }));
    } finally {
      setIsSaving(false);
    }
  }, [lead.id, lead.category, updateCategory, dispatch]);

  // Handle save with validation
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const updatedLead = await updateLead(lead.id, editedLead);
      setEditedLead(updatedLead);
      setIsEditing(false);

      dispatch(showNotification({
        message: 'Lead updated successfully',
        severity: 'success',
      }));
    } catch (err) {
      setError('Failed to update lead');
      dispatch(showNotification({
        message: 'Failed to update lead',
        severity: 'error',
      }));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner size="large" />;
  }

  return (
    <Card sx={{ minHeight: '600px', position: 'relative' }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: TYPOGRAPHY.fontWeight.medium }}>
            Lead Details
          </Typography>
          <Box>
            {isEditing ? (
              <>
                <IconButton
                  onClick={handleSave}
                  disabled={isSaving}
                  color="primary"
                  sx={{ mr: 1 }}
                >
                  <SaveIcon />
                </IconButton>
                <IconButton
                  onClick={() => {
                    setIsEditing(false);
                    setEditedLead(lead);
                  }}
                  disabled={isSaving}
                >
                  <CloseIcon />
                </IconButton>
              </>
            ) : (
              <>
                <IconButton onClick={() => setIsEditing(true)} sx={{ mr: 1 }}>
                  <EditIcon />
                </IconButton>
                <IconButton onClick={onClose}>
                  <CloseIcon />
                </IconButton>
              </>
            )}
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Lead Information */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Company"
              value={editedLead.company}
              onChange={(e) => setEditedLead(prev => ({ ...prev, company: e.target.value }))}
              disabled={!isEditing || isSaving}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Contact Name"
              value={editedLead.contactName}
              onChange={(e) => setEditedLead(prev => ({ ...prev, contactName: e.target.value }))}
              disabled={!isEditing || isSaving}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Email"
              value={editedLead.email}
              onChange={(e) => setEditedLead(prev => ({ ...prev, email: e.target.value }))}
              disabled={!isEditing || isSaving}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Phone"
              value={editedLead.phone}
              onChange={(e) => setEditedLead(prev => ({ ...prev, phone: e.target.value }))}
              disabled={!isEditing || isSaving}
              sx={{ mb: 2 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="Category"
              value={editedLead.category}
              onChange={(e) => handleCategoryChange(e.target.value as LeadCategory)}
              disabled={isSaving}
              sx={{ mb: 2 }}
            >
              {categoryOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Priority"
              type="number"
              value={editedLead.priority}
              onChange={(e) => setEditedLead(prev => ({ ...prev, priority: Number(e.target.value) }))}
              disabled={!isEditing || isSaving}
              InputProps={{ inputProps: { min: 1, max: 5 } }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Source"
              value={editedLead.source}
              onChange={(e) => setEditedLead(prev => ({ ...prev, source: e.target.value }))}
              disabled={!isEditing || isSaving}
              sx={{ mb: 2 }}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Activity Timeline */}
        <Typography variant="h6" sx={{ mb: 2 }}>
          Activity Timeline
        </Typography>
        <LeadTimeline
          leadId={lead.id}
          activities={[]}
          enableRealtime={true}
        />
      </CardContent>

      {/* Loading Overlay */}
      {isSaving && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
          }}
        >
          <CircularProgress />
        </Box>
      )}
    </Card>
  );
};

export default React.memo(LeadDetails);