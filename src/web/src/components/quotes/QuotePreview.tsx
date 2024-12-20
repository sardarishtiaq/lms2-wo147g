import React, { useMemo } from 'react';
import { 
  Paper, 
  Typography, 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Box,
  Chip,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Quote, QuoteStatus } from '../../types/quote';
import { formatCurrency } from '../../utils/format';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorBoundary from '../common/ErrorBoundary';

// Styled components for consistent layout
const PreviewContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  '@media print': {
    margin: 0,
    padding: theme.spacing(2),
    boxShadow: 'none'
  }
}));

const QuoteTable = styled(Table)(({ theme }) => ({
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(3),
  minWidth: '100%',
  '& th': {
    fontWeight: theme.typography.fontWeightMedium,
    backgroundColor: theme.palette.background.default
  },
  '@media (max-width: 600px)': {
    '& td': {
      padding: theme.spacing(1)
    }
  }
}));

const StatusChip = styled(Chip)(({ theme }) => ({
  marginLeft: theme.spacing(2),
  '& .MuiChip-label': {
    fontWeight: theme.typography.fontWeightMedium
  }
}));

// Props interface
interface QuotePreviewProps {
  quote: Quote | null;
  loading?: boolean;
  showActions?: boolean;
  onPrint?: () => void;
  onExport?: () => void;
}

// Status color mapping
const STATUS_COLORS: Record<QuoteStatus, string> = {
  [QuoteStatus.DRAFT]: '#9e9e9e',
  [QuoteStatus.PENDING_APPROVAL]: '#f57c00',
  [QuoteStatus.APPROVED]: '#388e3c',
  [QuoteStatus.REJECTED]: '#d32f2f',
  [QuoteStatus.EXPIRED]: '#757575',
  [QuoteStatus.ACCEPTED]: '#2e7d32',
  [QuoteStatus.DECLINED]: '#c62828'
};

/**
 * QuotePreview Component
 * 
 * Displays a formatted preview of a quote with responsive design and accessibility features.
 */
const QuotePreview: React.FC<QuotePreviewProps> = ({
  quote,
  loading = false,
  showActions = false,
  onPrint,
  onExport
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Memoized quote metadata
  const quoteMetadata = useMemo(() => {
    if (!quote) return null;
    return {
      createdDate: new Date(quote.createdAt).toLocaleDateString(),
      validUntil: new Date(quote.validUntil).toLocaleDateString(),
      formattedSubtotal: formatCurrency(quote.subtotal),
      formattedTax: formatCurrency(quote.totalTax),
      formattedTotal: formatCurrency(quote.total)
    };
  }, [quote]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <LoadingSpinner size="large" ariaLabel="Loading quote preview" />
      </Box>
    );
  }

  if (!quote) {
    return null;
  }

  return (
    <ErrorBoundary>
      <PreviewContainer elevation={2}>
        {/* Quote Header */}
        <Box display="flex" alignItems="center" mb={3}>
          <Typography variant={isMobile ? 'h6' : 'h5'} component="h1">
            Quote #{quote.quoteNumber}
          </Typography>
          <StatusChip
            label={quote.status}
            size={isMobile ? 'small' : 'medium'}
            sx={{ backgroundColor: STATUS_COLORS[quote.status] }}
            aria-label={`Quote status: ${quote.status}`}
          />
        </Box>

        {/* Quote Metadata */}
        <Box mb={3}>
          <Typography variant="body2" color="textSecondary">
            Created: {quoteMetadata?.createdDate}
            {' | '}
            Valid Until: {quoteMetadata?.validUntil}
          </Typography>
        </Box>

        {/* Quote Items Table */}
        <QuoteTable aria-label="Quote items">
          <TableHead>
            <TableRow>
              <TableCell>Description</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Unit Price</TableCell>
              <TableCell align="right">Discount</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {quote.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.description}</TableCell>
                <TableCell align="right">{item.quantity}</TableCell>
                <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                <TableCell align="right">
                  {item.discountPercent > 0 ? `${item.discountPercent}%` : '-'}
                </TableCell>
                <TableCell align="right">{formatCurrency(item.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </QuoteTable>

        {/* Quote Totals */}
        <Box display="flex" flexDirection="column" alignItems="flex-end" mb={2}>
          <Typography variant="body1">
            Subtotal: {quoteMetadata?.formattedSubtotal}
          </Typography>
          <Typography variant="body1">
            Tax: {quoteMetadata?.formattedTax}
          </Typography>
          <Typography variant="h6" sx={{ mt: 1 }}>
            Total: {quoteMetadata?.formattedTotal}
          </Typography>
        </Box>

        {/* Notes and Terms */}
        {(quote.notes || quote.terms) && (
          <Box mt={3}>
            {quote.notes && (
              <Typography variant="body2" color="textSecondary" paragraph>
                <strong>Notes:</strong> {quote.notes}
              </Typography>
            )}
            {quote.terms && (
              <Typography variant="body2" color="textSecondary">
                <strong>Terms:</strong> {quote.terms}
              </Typography>
            )}
          </Box>
        )}
      </PreviewContainer>
    </ErrorBoundary>
  );
};

export default QuotePreview;