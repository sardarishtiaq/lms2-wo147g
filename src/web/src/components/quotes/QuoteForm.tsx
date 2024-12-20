import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Grid, 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Alert,
  CircularProgress,
  Box,
  Divider
} from '@mui/material'; // ^5.0.0
import { DatePicker } from '@mui/x-date-pickers'; // ^5.0.0
import { useFormik } from 'formik'; // ^2.4.0
import * as yup from 'yup'; // ^1.0.0
import { debounce } from 'lodash'; // ^4.17.21

import { Quote, QuoteStatus, QuoteFormData, QuoteItem } from '../../types/quote';
import QuoteItemForm from './QuoteItemForm';
import { useQuotes } from '../../hooks/useQuotes';
import { quoteValidationSchema } from '../../utils/validation';

// Interface for component props
interface QuoteFormProps {
  leadId: string;
  tenantId: string;
  initialData?: Quote;
  onSubmitSuccess: (quote: Quote) => void;
  onCancel: () => void;
  tenantConfig: {
    taxRate: number;
    roundingPrecision: number;
    currency: string;
    minQuoteAmount: number;
    maxQuoteAmount: number;
  };
}

// Interface for calculated totals
interface CalculatedTotals {
  subtotal: number;
  tax: number;
  total: number;
  itemTotals: number[];
}

/**
 * QuoteForm component for creating and editing quotes
 * Implements comprehensive quote management with real-time calculations
 */
const QuoteForm: React.FC<QuoteFormProps> = ({
  leadId,
  tenantId,
  initialData,
  onSubmitSuccess,
  onCancel,
  tenantConfig
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculatedTotals, setCalculatedTotals] = useState<CalculatedTotals>({
    subtotal: 0,
    tax: 0,
    total: 0,
    itemTotals: []
  });

  // Hooks
  const { createQuote, updateQuote } = useQuotes();

  // Form validation schema
  const validationSchema = useMemo(() => 
    quoteValidationSchema.concat(
      yup.object().shape({
        total: yup.number()
          .min(tenantConfig.minQuoteAmount, 'Quote total is below minimum allowed amount')
          .max(tenantConfig.maxQuoteAmount, 'Quote total exceeds maximum allowed amount')
      })
    ), [tenantConfig]);

  // Initialize formik
  const formik = useFormik<QuoteFormData>({
    initialValues: {
      leadId,
      items: initialData?.items || [{ 
        productId: '', 
        description: '', 
        quantity: 1, 
        unitPrice: 0,
        discountPercent: 0,
        taxRate: tenantConfig.taxRate
      }],
      validUntil: initialData?.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: initialData?.notes || '',
      terms: initialData?.terms || ''
    },
    validationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values) => {
      try {
        setIsLoading(true);
        setError(null);

        const quoteData = {
          ...values,
          tenantId,
          status: QuoteStatus.DRAFT,
          subtotal: calculatedTotals.subtotal,
          totalTax: calculatedTotals.tax,
          total: calculatedTotals.total
        };

        const result = initialData
          ? await updateQuote(initialData.id, quoteData)
          : await createQuote(quoteData);

        onSubmitSuccess(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save quote');
      } finally {
        setIsLoading(false);
      }
    }
  });

  // Calculate totals with tenant-specific rules
  const calculateTotals = useCallback((items: QuoteItem[]) => {
    const itemTotals = items.map(item => {
      const baseAmount = item.quantity * item.unitPrice;
      const discountAmount = baseAmount * (item.discountPercent / 100);
      return Number((baseAmount - discountAmount).toFixed(tenantConfig.roundingPrecision));
    });

    const subtotal = itemTotals.reduce((sum, total) => sum + total, 0);
    const tax = Number((subtotal * (tenantConfig.taxRate / 100)).toFixed(tenantConfig.roundingPrecision));
    const total = Number((subtotal + tax).toFixed(tenantConfig.roundingPrecision));

    return { subtotal, tax, total, itemTotals };
  }, [tenantConfig]);

  // Debounced calculation to prevent excessive updates
  const debouncedCalculation = useMemo(
    () => debounce((items: QuoteItem[]) => {
      const totals = calculateTotals(items);
      setCalculatedTotals(totals);
    }, 300),
    [calculateTotals]
  );

  // Update calculations when items change
  useEffect(() => {
    debouncedCalculation(formik.values.items);
    return () => {
      debouncedCalculation.cancel();
    };
  }, [formik.values.items, debouncedCalculation]);

  // Handle item updates
  const handleItemUpdate = useCallback((item: QuoteItem, index: number) => {
    const newItems = [...formik.values.items];
    newItems[index] = item;
    formik.setFieldValue('items', newItems);
  }, [formik]);

  // Handle item removal
  const handleItemRemove = useCallback((index: number) => {
    const newItems = formik.values.items.filter((_, i) => i !== index);
    formik.setFieldValue('items', newItems);
  }, [formik]);

  // Add new item
  const handleAddItem = useCallback(() => {
    formik.setFieldValue('items', [
      ...formik.values.items,
      {
        productId: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        discountPercent: 0,
        taxRate: tenantConfig.taxRate
      }
    ]);
  }, [formik, tenantConfig.taxRate]);

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <form onSubmit={formik.handleSubmit}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Quote Items Section */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Quote Items
            </Typography>
            {formik.values.items.map((item, index) => (
              <Box key={index} sx={{ mb: 2 }}>
                <QuoteItemForm
                  item={item}
                  index={index}
                  onUpdate={handleItemUpdate}
                  onRemove={handleItemRemove}
                  disabled={isLoading}
                />
              </Box>
            ))}
            <Button
              variant="outlined"
              onClick={handleAddItem}
              disabled={isLoading}
              sx={{ mt: 1 }}
            >
              Add Item
            </Button>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
          </Grid>

          {/* Totals Section */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Subtotal: {tenantConfig.currency} {calculatedTotals.subtotal.toFixed(2)}
            </Typography>
            <Typography variant="subtitle1" gutterBottom>
              Tax ({tenantConfig.taxRate}%): {tenantConfig.currency} {calculatedTotals.tax.toFixed(2)}
            </Typography>
            <Typography variant="h6" gutterBottom>
              Total: {tenantConfig.currency} {calculatedTotals.total.toFixed(2)}
            </Typography>
          </Grid>

          {/* Quote Details Section */}
          <Grid item xs={12} md={6}>
            <DatePicker
              label="Valid Until"
              value={formik.values.validUntil}
              onChange={(date) => formik.setFieldValue('validUntil', date)}
              disabled={isLoading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  error={formik.touched.validUntil && Boolean(formik.errors.validUntil)}
                  helperText={formik.touched.validUntil && formik.errors.validUntil}
                />
              )}
            />
          </Grid>

          {/* Notes and Terms Section */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              name="notes"
              label="Notes"
              value={formik.values.notes}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.notes && Boolean(formik.errors.notes)}
              helperText={formik.touched.notes && formik.errors.notes}
              disabled={isLoading}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              name="terms"
              label="Terms and Conditions"
              value={formik.values.terms}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.terms && Boolean(formik.errors.terms)}
              helperText={formik.touched.terms && formik.errors.terms}
              disabled={isLoading}
            />
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={isLoading || !formik.isValid}
                startIcon={isLoading && <CircularProgress size={20} />}
              >
                {initialData ? 'Update Quote' : 'Create Quote'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
};

export default QuoteForm;