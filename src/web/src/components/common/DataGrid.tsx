import React, { useCallback, useMemo } from 'react';
import { 
  DataGrid as MuiDataGrid, 
  GridColDef, 
  GridRowParams,
  GridSortModel,
  GridFilterModel,
  GridPaginationModel,
  GridOverlay
} from '@mui/x-data-grid';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';

// Constants for component configuration
const DEFAULT_PAGE_SIZE = 25;
const MIN_HEIGHT = 400;
const LOADING_OVERLAY_PROPS = {
  style: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 1
  }
};

// Styled components
const StyledDataGrid = styled(MuiDataGrid)(({ theme }) => ({
  minHeight: MIN_HEIGHT,
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  border: '1px solid',
  borderColor: theme.palette.divider,
  
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: theme.palette.grey[100],
    fontWeight: theme.typography.fontWeightBold
  },
  
  '& .MuiDataGrid-row:hover': {
    backgroundColor: theme.palette.action.hover,
    cursor: 'pointer'
  },
  
  '& .MuiDataGrid-cell': {
    padding: theme.spacing(1),
    fontSize: theme.typography.body2.fontSize
  },

  '& .MuiDataGrid-footerContainer': {
    borderTop: `1px solid ${theme.palette.divider}`
  },

  '& .MuiDataGrid-columnSeparator': {
    visibility: 'hidden'
  }
}));

// Custom overlay components
const CustomNoRowsOverlay = () => (
  <GridOverlay>
    <EmptyState
      title="No Data Available"
      subtitle="There are no items to display at this time."
    />
  </GridOverlay>
);

const CustomLoadingOverlay = () => (
  <GridOverlay>
    <LoadingSpinner size="medium" />
  </GridOverlay>
);

const CustomErrorOverlay = ({ error }: { error: string }) => (
  <GridOverlay>
    <EmptyState
      title="Error Loading Data"
      subtitle={error}
    />
  </GridOverlay>
);

// Component props interface with generic type support
export interface CustomDataGridProps<T extends object = any> {
  rows: T[];
  columns: GridColDef[];
  loading: boolean;
  error?: string | null;
  onRowClick?: (params: GridRowParams<T>) => void;
  onSortModelChange?: (model: GridSortModel) => void;
  onFilterModelChange?: (model: GridFilterModel) => void;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  totalRows: number;
  disableSelectionOnClick?: boolean;
  checkboxSelection?: boolean;
  autoHeight?: boolean;
}

/**
 * CustomDataGrid Component
 * 
 * A production-ready data grid component that provides enterprise-grade features
 * including sorting, filtering, pagination, and comprehensive state handling.
 * Implements Material-UI design system specifications for consistent data display.
 */
export const CustomDataGrid = React.memo(<T extends object>({
  rows,
  columns,
  loading,
  error,
  onRowClick,
  onSortModelChange,
  onFilterModelChange,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  totalRows,
  disableSelectionOnClick = true,
  checkboxSelection = false,
  autoHeight = false
}: CustomDataGridProps<T>) => {
  // Memoized handlers for performance optimization
  const handlePageChange = useCallback(
    (params: GridPaginationModel) => {
      onPageChange?.(params.page);
    },
    [onPageChange]
  );

  const handleRowClick = useCallback(
    (params: GridRowParams<T>) => {
      onRowClick?.(params);
    },
    [onRowClick]
  );

  // Memoized pagination settings
  const paginationModel = useMemo(
    () => ({
      pageSize,
      totalRows
    }),
    [pageSize, totalRows]
  );

  return (
    <Box sx={{ width: '100%', height: autoHeight ? 'auto' : MIN_HEIGHT }}>
      <StyledDataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        error={error}
        paginationModel={paginationModel}
        onPaginationModelChange={handlePageChange}
        onRowClick={handleRowClick}
        onSortModelChange={onSortModelChange}
        onFilterModelChange={onFilterModelChange}
        disableSelectionOnClick={disableSelectionOnClick}
        checkboxSelection={checkboxSelection}
        autoHeight={autoHeight}
        pagination
        paginationMode="server"
        rowCount={totalRows}
        components={{
          LoadingOverlay: CustomLoadingOverlay,
          NoRowsOverlay: CustomNoRowsOverlay,
          ErrorOverlay: CustomErrorOverlay
        }}
        componentsProps={{
          loadingOverlay: LOADING_OVERLAY_PROPS,
          errorOverlay: { error }
        }}
        sx={{
          // Additional style overrides for specific cases
          '& .MuiDataGrid-virtualScroller': {
            overflow: autoHeight ? 'hidden' : 'auto'
          }
        }}
        // Accessibility properties
        aria-label="Data grid"
        role="grid"
      />
    </Box>
  );
});

// Display name for debugging
CustomDataGrid.displayName = 'CustomDataGrid';

export default CustomDataGrid;