import React, { useCallback, useEffect, useMemo } from 'react';
import { useFormik } from 'formik'; // ^2.4.2
import { 
  Box,
  Button,
  CircularProgress,
  Grid,
  MenuItem,
  TextField,
  Typography,
  useTheme
} from '@mui/material'; // ^5.14.0
import { debounce } from 'lodash'; // ^4.17.21

import { Lead, LeadFormData } from '../../types/lead';
import { LeadCategory, CATEGORY_DETAILS } from '../../constants/leadCategories';
import { useLeads } from '../../hooks/useLeads';
import { leadValidationSchema } from '../../utils/validation';
import { useAppSelector } from '../../store';
import { selectAuth } from '../../store/slices/authSlice';
import { useWebSocket } from '../../services/websocket';

/**
 * Props interface for LeadForm component
 */
interface LeadFormProps {
  initialData?: Lead;
  onSubmit: (lead: Lead) => Promise<void>;
  onCancel: () => void;
  autoSave?: boolean;
}

/**
 * LeadForm component for creating and editing leads with real-time updates
 * and tenant isolation.
 */
const LeadForm: React.FC<LeadFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  autoSave = false
}) => {
  const theme = useTheme();
  const { tenantId } = useAppSelector(selectAuth);
  const { createLead, updateLead } = useLeads(tenantId);
  const { subscribe } = useWebSocket();

  // Initialize form with Formik
  const formik = useFormik<LeadFormData>({
    initialValues: {
      company: initialData?.company || '',
      contactName: initialData?.contactName || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      source: initialData?.source || '',
      category: initialData?.category || LeadCategory.UNASSIGNED,
      priority: initialData?.priority || 3,
      metadata: initialData?.metadata || {}
    },
    validationSchema: leadValidationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        const leadData = {
          ...values,
          tenantId
        };

        const result = initialData
          ? await updateLead(initialData.id, leadData)
          : await createLead(leadData);

        await onSubmit(result);
      } catch (error) {
        console.error('Lead form submission error:', error);
        formik.setStatus({ error: 'Failed to save lead' });
      } finally {
        setSubmitting(false);
      }
    }
  });

  // Auto-save functionality with debounce
  const debouncedSave = useMemo(
    () =>
      debounce(async (values: LeadFormData) => {
        if (!initialData || !autoSave) return;

        try {
          await updateLead(initialData.id, {
            ...values,
            tenantId
          });
        } catch (error) {
          console.error('Auto-save error:', error);
        }
      }, 2000),
    [initialData, tenantId, updateLead, autoSave]
  );

  // Handle form value changes for auto-save
  useEffect(() => {
    if (formik.dirty && autoSave) {
      debouncedSave(formik.values);
    }
  }, [formik.values, autoSave, debouncedSave]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!initialData) return;

    const unsubscribe = subscribe(
      'lead:updated',
      (data: Lead) => {
        if (data.id === initialData.id) {
          formik.setValues({
            company: data.company,
            contactName: data.contactName,
            email: data.email,
            phone: data.phone,
            source: data.source,
            category: data.category,
            priority: data.priority,
            metadata: data.metadata
          });
        }
      },
      { tenant: tenantId }
    );

    return () => {
      unsubscribe();
    };
  }, [initialData, tenantId, subscribe]);

  // Handle form cancellation
  const handleCancel = useCallback(() => {
    formik.resetForm();
    onCancel();
  }, [formik, onCancel]);

  return (
    <Box component="form" onSubmit={formik.handleSubmit} noValidate>
      <Grid container spacing={3}>
        {/* Company Information */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Company Information
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            id="company"
            name="company"
            label="Company Name"
            value={formik.values.company}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.company && Boolean(formik.errors.company)}
            helperText={formik.touched.company && formik.errors.company}
            required
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            id="contactName"
            name="contactName"
            label="Contact Name"
            value={formik.values.contactName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.contactName && Boolean(formik.errors.contactName)}
            helperText={formik.touched.contactName && formik.errors.contactName}
            required
          />
        </Grid>

        {/* Contact Information */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            id="email"
            name="email"
            label="Email Address"
            type="email"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.email && Boolean(formik.errors.email)}
            helperText={formik.touched.email && formik.errors.email}
            required
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            id="phone"
            name="phone"
            label="Phone Number"
            value={formik.values.phone}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.phone && Boolean(formik.errors.phone)}
            helperText={formik.touched.phone && formik.errors.phone}
            required
          />
        </Grid>

        {/* Lead Details */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Lead Details
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            select
            id="category"
            name="category"
            label="Category"
            value={formik.values.category}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.category && Boolean(formik.errors.category)}
            helperText={formik.touched.category && formik.errors.category}
            required
          >
            {CATEGORY_DETAILS.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            select
            id="priority"
            name="priority"
            label="Priority"
            value={formik.values.priority}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.priority && Boolean(formik.errors.priority)}
            helperText={formik.touched.priority && formik.errors.priority}
            required
          >
            {[1, 2, 3, 4, 5].map((priority) => (
              <MenuItem key={priority} value={priority}>
                Priority {priority}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            id="source"
            name="source"
            label="Lead Source"
            value={formik.values.source}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.source && Boolean(formik.errors.source)}
            helperText={formik.touched.source && formik.errors.source}
          />
        </Grid>

        {/* Form Actions */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleCancel}
              disabled={formik.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={formik.isSubmitting || !formik.dirty || !formik.isValid}
              startIcon={formik.isSubmitting ? <CircularProgress size={20} /> : null}
            >
              {initialData ? 'Update' : 'Create'} Lead
            </Button>
          </Box>
        </Grid>

        {/* Error Message */}
        {formik.status?.error && (
          <Grid item xs={12}>
            <Typography color="error" align="center">
              {formik.status.error}
            </Typography>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default React.memo(LeadForm);