import React, { useCallback, useMemo, useEffect } from 'react';
import { debounce } from 'lodash'; // ^4.17.21
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Grid,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material'; // ^5.0.0
import { DateRangePicker } from '@mui/x-date-pickers-pro'; // ^5.0.0
import {
  FilterAlt as FilterIcon,
  Clear as ClearIcon,
  ErrorOutline as ErrorIcon
} from '@mui/icons-material'; // ^5.0.0

import { LeadFilters } from '../../types/lead';
import { CATEGORY_DETAILS } from '../../constants/leadCategories';
import { useLeads } from '../../hooks/useLeads';

// Constants for filter debounce and validation
const FILTER_DEBOUNCE_MS = 300;
const DATE_FORMAT = 'yyyy-MM-dd';

export interface LeadFiltersProps {
  initialFilters?: LeadFilters;
  onFilterChange: (filters: LeadFilters) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * LeadFilters Component - Provides comprehensive filtering interface for leads
 * with real-time updates, accessibility support, and mobile responsiveness
 */
export const LeadFilters: React.FC<LeadFiltersProps> = ({
  initialFilters,
  onFilterChange,
  disabled = false,
  className
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { setFilters, getFilteredLeads } = useLeads();

  // Local state for filters and validation
  const [filters, setLocalFilters] = React.useState<LeadFilters>(
    initialFilters || {
      category: [],
      assignedTo: [],
      status: [],
      priority: [],
      dateRange: { start: '', end: '' },
      score: { min: 0, max: 100 },
      source: []
    }
  );

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Memoized category options with icons
  const categoryOptions = useMemo(() => 
    CATEGORY_DETAILS.map(category => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      description: category.description
    })), []
  );

  // Debounced filter update handler
  const debouncedFilterUpdate = useMemo(
    () => debounce((newFilters: LeadFilters) => {
      onFilterChange(newFilters);
      setFilters(newFilters);
      getFilteredLeads();
    }, FILTER_DEBOUNCE_MS),
    [onFilterChange, setFilters, getFilteredLeads]
  );

  // Handle individual filter changes
  const handleFilterChange = useCallback((
    field: keyof LeadFilters,
    value: any
  ) => {
    setLocalFilters(prev => {
      const newFilters = { ...prev, [field]: value };
      
      // Validate filters
      const newErrors = { ...errors };
      delete newErrors[field];

      // Specific validation rules
      if (field === 'dateRange') {
        if (value.start && value.end && new Date(value.start) > new Date(value.end)) {
          newErrors[field] = 'Start date must be before end date';
        }
      }

      if (field === 'score') {
        if (value.min < 0 || value.max > 100 || value.min > value.max) {
          newErrors[field] = 'Invalid score range';
        }
      }

      setErrors(newErrors);
      
      // Only trigger update if no errors
      if (Object.keys(newErrors).length === 0) {
        debouncedFilterUpdate(newFilters);
      }

      return newFilters;
    });
  }, [debouncedFilterUpdate, errors]);

  // Handle filter reset
  const handleClearFilters = useCallback(() => {
    const defaultFilters: LeadFilters = {
      category: [],
      assignedTo: [],
      status: [],
      priority: [],
      dateRange: { start: '', end: '' },
      score: { min: 0, max: 100 },
      source: []
    };

    setLocalFilters(defaultFilters);
    setErrors({});
    onFilterChange(defaultFilters);
    setFilters(defaultFilters);
  }, [onFilterChange, setFilters]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedFilterUpdate.cancel();
    };
  }, [debouncedFilterUpdate]);

  return (
    <Box
      className={className}
      sx={{
        p: 2,
        backgroundColor: 'background.paper',
        borderRadius: 1,
        boxShadow: 1
      }}
    >
      <Grid container spacing={2} alignItems="center">
        {/* Category Filter */}
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth error={!!errors.category} disabled={disabled}>
            <InputLabel>Categories</InputLabel>
            <Select
              multiple
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              renderValue={(selected) => 
                selected.map(id => 
                  categoryOptions.find(cat => cat.id === id)?.name
                ).join(', ')
              }
            >
              {categoryOptions.map(category => (
                <MenuItem key={category.id} value={category.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <span className="material-icons" style={{ marginRight: 8 }}>
                      {category.icon}
                    </span>
                    {category.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Priority Filter */}
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth error={!!errors.priority} disabled={disabled}>
            <InputLabel>Priority</InputLabel>
            <Select
              multiple
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
            >
              {[1, 2, 3, 4, 5].map(priority => (
                <MenuItem key={priority} value={priority}>
                  Priority {priority}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Date Range Filter */}
        <Grid item xs={12} sm={12} md={4}>
          <DateRangePicker
            disabled={disabled}
            value={[filters.dateRange.start, filters.dateRange.end]}
            onChange={(newValue) => {
              handleFilterChange('dateRange', {
                start: newValue[0] || '',
                end: newValue[1] || ''
              });
            }}
            renderInput={(startProps, endProps) => (
              <React.Fragment>
                <TextField {...startProps} />
                <Box sx={{ mx: 2 }}> to </Box>
                <TextField {...endProps} />
              </React.Fragment>
            )}
          />
          {errors.dateRange && (
            <Box sx={{ color: 'error.main', mt: 1, display: 'flex', alignItems: 'center' }}>
              <ErrorIcon fontSize="small" sx={{ mr: 1 }} />
              {errors.dateRange}
            </Box>
          )}
        </Grid>

        {/* Score Range Filter */}
        <Grid item xs={12} sm={12} md={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              label="Min Score"
              type="number"
              disabled={disabled}
              value={filters.score.min}
              onChange={(e) => handleFilterChange('score', {
                ...filters.score,
                min: parseInt(e.target.value)
              })}
              error={!!errors.score}
              inputProps={{ min: 0, max: 100 }}
            />
            <TextField
              label="Max Score"
              type="number"
              disabled={disabled}
              value={filters.score.max}
              onChange={(e) => handleFilterChange('score', {
                ...filters.score,
                max: parseInt(e.target.value)
              })}
              error={!!errors.score}
              inputProps={{ min: 0, max: 100 }}
            />
          </Box>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12} sm={12} md={1}>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Tooltip title="Clear Filters">
              <IconButton
                onClick={handleClearFilters}
                disabled={disabled}
                size={isMobile ? 'small' : 'medium'}
              >
                <ClearIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Apply Filters">
              <IconButton
                color="primary"
                disabled={disabled || Object.keys(errors).length > 0}
                size={isMobile ? 'small' : 'medium'}
              >
                <FilterIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LeadFilters;