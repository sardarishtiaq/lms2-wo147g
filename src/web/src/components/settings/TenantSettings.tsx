/**
 * @fileoverview Tenant Settings management component for the multi-tenant CRM system
 * Implements comprehensive tenant configuration with validation and security measures
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Switch,
  Button,
  CircularProgress,
  Alert,
  Tooltip,
  Divider,
  Typography,
  FormControlLabel,
  Grid,
  Chip,
} from '@mui/material';
import { Save as SaveIcon, Warning as WarningIcon } from '@mui/icons-material';
import { useTenant } from '../../hooks/useTenant';
import { PageHeader } from '../common/PageHeader';
import { TenantSettings as ITenantSettings, TenantFeatures } from '../../types/tenant';

// Form validation constants
const VALIDATION_RULES = {
  maxUsers: { min: 1, max: 1000 },
  maxLeads: { min: 100, max: 1000000 },
  domainFormat: /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/,
};

// Feature license requirements
const FEATURE_REQUIREMENTS = {
  quoteManagement: { minUsers: 5 },
  advancedReporting: { minUsers: 10 },
  apiAccess: { minUsers: 20 },
  customFields: { minUsers: 5 },
  multipleWorkflows: { minUsers: 15 },
  automatedAssignment: { minUsers: 10 },
};

interface FormErrors {
  leadCategories?: string;
  maxUsers?: string;
  maxLeads?: string;
  allowedDomains?: string;
  features?: string;
}

/**
 * TenantSettings component for managing tenant-specific configurations
 * Implements comprehensive settings management with validation and security
 */
const TenantSettings: React.FC = () => {
  // Custom hook for tenant operations
  const { tenant, loading, error, updateSettings } = useTenant();

  // Local state management
  const [formData, setFormData] = useState<ITenantSettings | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newDomain, setNewDomain] = useState('');

  // Initialize form with tenant data
  useEffect(() => {
    if (tenant?.settings) {
      setFormData(tenant.settings);
    }
  }, [tenant]);

  // Validation functions
  const validateForm = useCallback((data: ITenantSettings): FormErrors => {
    const newErrors: FormErrors = {};

    // Validate lead categories
    if (!data.leadCategories?.length) {
      newErrors.leadCategories = 'At least one lead category is required';
    }

    // Validate user limits
    if (data.maxUsers < VALIDATION_RULES.maxUsers.min || 
        data.maxUsers > VALIDATION_RULES.maxUsers.max) {
      newErrors.maxUsers = `User limit must be between ${VALIDATION_RULES.maxUsers.min} and ${VALIDATION_RULES.maxUsers.max}`;
    }

    // Validate lead limits
    if (data.maxLeads < VALIDATION_RULES.maxLeads.min || 
        data.maxLeads > VALIDATION_RULES.maxLeads.max) {
      newErrors.maxLeads = `Lead limit must be between ${VALIDATION_RULES.maxLeads.min} and ${VALIDATION_RULES.maxLeads.max}`;
    }

    // Validate domains
    if (data.allowedDomains?.some(domain => !VALIDATION_RULES.domainFormat.test(domain))) {
      newErrors.allowedDomains = 'Invalid domain format detected';
    }

    return newErrors;
  }, []);

  // Feature eligibility check
  const checkFeatureEligibility = useCallback((
    feature: keyof TenantFeatures,
    maxUsers: number
  ): boolean => {
    const requirement = FEATURE_REQUIREMENTS[feature];
    return maxUsers >= requirement.minUsers;
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !tenant) return;

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    try {
      await updateSettings(formData);
      setIsDirty(false);
    } catch (err) {
      setErrors({ ...errors, features: 'Failed to update settings' });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle feature toggle
  const handleFeatureToggle = useCallback((feature: keyof TenantFeatures) => {
    if (!formData) return;

    const isEligible = checkFeatureEligibility(feature, formData.maxUsers);
    if (!isEligible) {
      setErrors(prev => ({
        ...prev,
        features: `Upgrade required for ${feature}`
      }));
      return;
    }

    setFormData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        features: {
          ...prev.features,
          [feature]: !prev.features[feature]
        }
      };
    });
    setIsDirty(true);
  }, [formData, checkFeatureEligibility]);

  // Handle domain management
  const handleAddDomain = useCallback(() => {
    if (!formData || !VALIDATION_RULES.domainFormat.test(newDomain)) {
      setErrors(prev => ({
        ...prev,
        allowedDomains: 'Invalid domain format'
      }));
      return;
    }

    setFormData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        allowedDomains: [...prev.allowedDomains, newDomain]
      };
    });
    setNewDomain('');
    setIsDirty(true);
  }, [formData, newDomain]);

  const handleRemoveDomain = useCallback((domain: string) => {
    setFormData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        allowedDomains: prev.allowedDomains.filter(d => d !== domain)
      };
    });
    setIsDirty(true);
  }, []);

  // Render loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // Render error state
  if (error || !formData) {
    return (
      <Alert severity="error">
        {error || 'Failed to load tenant settings'}
      </Alert>
    );
  }

  return (
    <>
      <PageHeader
        title="Tenant Settings"
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSubmit}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        }
      />

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Lead Categories Section */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Lead Categories
                </Typography>
                <TextField
                  fullWidth
                  label="Lead Categories"
                  value={formData.leadCategories.join(', ')}
                  onChange={(e) => {
                    const categories = e.target.value.split(',').map(c => c.trim());
                    setFormData(prev => prev ? {
                      ...prev,
                      leadCategories: categories
                    } : null);
                    setIsDirty(true);
                  }}
                  error={!!errors.leadCategories}
                  helperText={errors.leadCategories}
                  multiline
                />
              </Grid>

              {/* User and Lead Limits Section */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Maximum Users"
                  value={formData.maxUsers}
                  onChange={(e) => {
                    setFormData(prev => prev ? {
                      ...prev,
                      maxUsers: parseInt(e.target.value)
                    } : null);
                    setIsDirty(true);
                  }}
                  error={!!errors.maxUsers}
                  helperText={errors.maxUsers}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Maximum Leads"
                  value={formData.maxLeads}
                  onChange={(e) => {
                    setFormData(prev => prev ? {
                      ...prev,
                      maxLeads: parseInt(e.target.value)
                    } : null);
                    setIsDirty(true);
                  }}
                  error={!!errors.maxLeads}
                  helperText={errors.maxLeads}
                />
              </Grid>

              {/* Allowed Domains Section */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Allowed Domains
                </Typography>
                <Box display="flex" gap={1} mb={2}>
                  <TextField
                    fullWidth
                    label="Add Domain"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    error={!!errors.allowedDomains}
                    helperText={errors.allowedDomains}
                  />
                  <Button
                    variant="contained"
                    onClick={handleAddDomain}
                    disabled={!newDomain}
                  >
                    Add
                  </Button>
                </Box>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {formData.allowedDomains.map((domain) => (
                    <Chip
                      key={domain}
                      label={domain}
                      onDelete={() => handleRemoveDomain(domain)}
                    />
                  ))}
                </Box>
              </Grid>

              {/* Features Section */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Features
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(formData.features).map(([feature, enabled]) => (
                    <Grid item xs={12} sm={6} key={feature}>
                      <Tooltip
                        title={
                          !checkFeatureEligibility(feature as keyof TenantFeatures, formData.maxUsers)
                            ? `Requires ${FEATURE_REQUIREMENTS[feature as keyof TenantFeatures].minUsers} users`
                            : ''
                        }
                      >
                        <FormControlLabel
                          control={
                            <Switch
                              checked={enabled}
                              onChange={() => handleFeatureToggle(feature as keyof TenantFeatures)}
                              disabled={!checkFeatureEligibility(feature as keyof TenantFeatures, formData.maxUsers)}
                            />
                          }
                          label={feature.replace(/([A-Z])/g, ' $1').trim()}
                        />
                      </Tooltip>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </>
  );
};

export default TenantSettings;