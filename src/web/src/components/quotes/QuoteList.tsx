import React, { useCallback, useEffect, useMemo, useState } from 'react'; // ^18.0.0
import { useNavigate } from 'react-router-dom'; // ^6.0.0
import { 
  DataGrid, 
  GridColDef, 
  GridFilterModel, 
  GridSortModel,
  GridRenderCellParams,
  GridValueFormatterParams
} from '@mui/x-data-grid'; // ^6.0.0
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Alert,
  Chip,
  Tooltip,
  useTheme
} from '@mui/material'; // ^5.0.0

import { Quote, QuoteStatus } from '../../types/quote';
import useQuotes from '../../hooks/useQuotes';
import useNotification from '../../hooks/useNotification';

/**
 * Props interface for QuoteList component
 */
interface QuoteListProps {
  initialFilters?: Record<string, any>;
  onQuoteSelect?: (quoteId: string) => void;
}

/**
 * Constants for component configuration
 */
const PAGE_SIZE = 25;

/**
 * QuoteList Component
 * Displays a list of quotes in a data grid format with sorting, filtering, and pagination
 */
const QuoteList: React.FC<QuoteListProps> = ({ initialFilters, onQuoteSelect }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const notification = useNotification();
  
  // Local state
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'createdAt', sort: 'desc' }
  ]);
  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: []
  });

  // Fetch quotes using custom hook
  const { quotes, loading, error, refetch } = useQuotes();

  // Handle real-time updates
  useEffect(() => {
    const intervalId = setInterval(() => {
      refetch();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(intervalId);
  }, [refetch]);

  /**
   * Column definitions for the data grid
   */
  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'quoteNumber',
      headerName: 'Quote #',
      width: 150,
      sortable: true,
      filterable: true,
      renderCell: (params: GridRenderCellParams<Quote>) => (
        <Tooltip title="Click to view details">
          <Box
            sx={{
              color: theme.palette.primary.main,
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            {params.value}
          </Box>
        </Tooltip>
      )
    },
    {
      field: 'leadId',
      headerName: 'Lead',
      width: 200,
      sortable: true,
      filterable: true
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Quote>) => {
        const status = params.value as QuoteStatus;
        const statusColors: Record<QuoteStatus, string> = {
          [QuoteStatus.DRAFT]: 'default',
          [QuoteStatus.PENDING_APPROVAL]: 'warning',
          [QuoteStatus.APPROVED]: 'success',
          [QuoteStatus.REJECTED]: 'error',
          [QuoteStatus.EXPIRED]: 'error',
          [QuoteStatus.ACCEPTED]: 'success',
          [QuoteStatus.DECLINED]: 'error'
        };

        return (
          <Chip
            label={status.replace('_', ' ')}
            color={statusColors[status] as any}
            size="small"
          />
        );
      }
    },
    {
      field: 'total',
      headerName: 'Total',
      width: 150,
      sortable: true,
      type: 'number',
      valueFormatter: (params: GridValueFormatterParams) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(params.value as number);
      }
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 180,
      sortable: true,
      type: 'date',
      valueFormatter: (params: GridValueFormatterParams) => {
        return new Intl.DateTimeFormat('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(new Date(params.value as string));
      }
    }
  ], [theme]);

  /**
   * Handle row click navigation
   */
  const handleRowClick = useCallback((params: any) => {
    const quoteId = params.id;
    if (onQuoteSelect) {
      onQuoteSelect(quoteId);
    } else {
      navigate(`/quotes/${quoteId}`);
    }
  }, [navigate, onQuoteSelect]);

  /**
   * Handle sort model changes
   */
  const handleSortModelChange = useCallback((model: GridSortModel) => {
    setSortModel(model);
    refetch();
  }, [refetch]);

  /**
   * Handle filter model changes
   */
  const handleFilterModelChange = useCallback((model: GridFilterModel) => {
    setFilterModel(model);
    refetch();
  }, [refetch]);

  // Error handling
  if (error) {
    notification.showNotification({
      message: 'Failed to load quotes',
      severity: 'error'
    });
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load quotes. Please try again later.
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Quotes
      </Typography>
      
      <Box sx={{ height: 'calc(100vh - 200px)', width: '100%' }}>
        <DataGrid
          rows={quotes}
          columns={columns}
          pagination
          pageSize={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
          sortModel={sortModel}
          filterModel={filterModel}
          onSortModelChange={handleSortModelChange}
          onFilterModelChange={handleFilterModelChange}
          onRowClick={handleRowClick}
          loading={loading}
          disableSelectionOnClick
          components={{
            LoadingOverlay: () => (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%'
                }}
              >
                <CircularProgress />
              </Box>
            )
          }}
          sx={{
            '& .MuiDataGrid-cell:focus': {
              outline: 'none'
            },
            '& .MuiDataGrid-row:hover': {
              cursor: 'pointer',
              backgroundColor: theme.palette.action.hover
            }
          }}
        />
      </Box>
    </Box>
  );
};

export default QuoteList;