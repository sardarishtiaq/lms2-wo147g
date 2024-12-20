import React, { useCallback, useMemo } from 'react';
import { Grid, TextField, IconButton, Tooltip, InputAdornment } from '@mui/material'; // v5.0.0
import { Delete } from '@mui/icons-material'; // v5.0.0
import { useFormik } from 'formik'; // v2.4.0
import { NumericFormat } from 'react-number-format'; // v5.0.0
import { useDebounce } from 'use-debounce'; // v9.0.0

import { QuoteItem } from '../../types/quote';
import { quoteValidationSchema } from '../../utils/validation';

/**
 * Props interface for the QuoteItemForm component
 */
interface QuoteItemFormProps {
  /** The quote item data */
  item: QuoteItem;
  /** Index of the item in the parent's items array */
  index: number;
  /** Callback for when the item is updated */
  onUpdate: (item: QuoteItem, index: number) => void;
  /** Callback for when the item should be removed */
  onRemove: (index: number) => void;
  /** Whether the form is disabled */
  disabled?: boolean;
}

/**
 * Custom number input component for currency values
 */
const CurrencyInput = React.forwardRef<any, any>((props, ref) => {
  const { onChange, ...other } = props;

  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      onValueChange={(values) => {
        onChange({
          target: {
            name: props.name,
            value: values.value,
          },
        });
      }}
      thousandSeparator
      valueIsNumericString
      prefix="$"
      decimalScale={2}
      fixedDecimalScale
    />
  );
});

/**
 * Calculates the total amount for a quote item
 */
const calculateItemTotal = (quantity: number, unitPrice: number): number => {
  if (!quantity || !unitPrice) return 0;
  return Number((quantity * unitPrice).toFixed(2));
};

/**
 * QuoteItemForm component for managing individual quote line items
 */
const QuoteItemForm: React.FC<QuoteItemFormProps> = React.memo(({
  item,
  index,
  onUpdate,
  onRemove,
  disabled = false
}) => {
  // Initialize formik with quote item validation schema
  const formik = useFormik({
    initialValues: {
      description: item.description || '',
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      amount: item.amount || 0
    },
    validationSchema: quoteValidationSchema.fields.items.innerType,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: () => {}, // Handled through onUpdate callback
  });

  // Debounce the calculation to prevent excessive updates
  const [debouncedCalculate] = useDebounce(
    (values: typeof formik.values) => {
      const total = calculateItemTotal(values.quantity, values.unitPrice);
      
      // Update the amount field
      formik.setFieldValue('amount', total, false);
      
      // Notify parent of changes
      onUpdate(
        {
          ...item,
          ...values,
          amount: total
        },
        index
      );
    },
    300
  );

  // Memoize the change handler
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    formik.handleChange(event);
    debouncedCalculate(formik.values);
  }, [formik, debouncedCalculate]);

  // Memoize the remove handler
  const handleRemove = useCallback(() => {
    onRemove(index);
  }, [onRemove, index]);

  return (
    <Grid container spacing={2} alignItems="center">
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          id={`item-${index}-description`}
          name="description"
          label="Description"
          value={formik.values.description}
          onChange={handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.description && Boolean(formik.errors.description)}
          helperText={formik.touched.description && formik.errors.description}
          disabled={disabled}
          required
        />
      </Grid>
      
      <Grid item xs={12} sm={2}>
        <TextField
          fullWidth
          id={`item-${index}-quantity`}
          name="quantity"
          label="Quantity"
          type="number"
          value={formik.values.quantity}
          onChange={handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.quantity && Boolean(formik.errors.quantity)}
          helperText={formik.touched.quantity && formik.errors.quantity}
          disabled={disabled}
          InputProps={{
            inputProps: { min: 1 }
          }}
          required
        />
      </Grid>
      
      <Grid item xs={12} sm={3}>
        <TextField
          fullWidth
          id={`item-${index}-unitPrice`}
          name="unitPrice"
          label="Unit Price"
          value={formik.values.unitPrice}
          onChange={handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.unitPrice && Boolean(formik.errors.unitPrice)}
          helperText={formik.touched.unitPrice && formik.errors.unitPrice}
          disabled={disabled}
          InputProps={{
            inputComponent: CurrencyInput as any
          }}
          required
        />
      </Grid>
      
      <Grid item xs={12} sm={2}>
        <TextField
          fullWidth
          id={`item-${index}-amount`}
          name="amount"
          label="Amount"
          value={formik.values.amount}
          InputProps={{
            readOnly: true,
            startAdornment: <InputAdornment position="start">$</InputAdornment>
          }}
          disabled
        />
      </Grid>
      
      <Grid item xs={12} sm={1}>
        <Tooltip title="Remove Item">
          <IconButton
            onClick={handleRemove}
            disabled={disabled}
            color="error"
            size="large"
          >
            <Delete />
          </IconButton>
        </Tooltip>
      </Grid>
    </Grid>
  );
});

QuoteItemForm.displayName = 'QuoteItemForm';

export default QuoteItemForm;