import React, { useCallback, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FixedSizeList as VirtualList } from 'react-window';

// Internal imports
import { Lead } from '../../types/lead';
import LeadCard from './LeadCard';
import { useLeads } from '../../hooks/useLeads';
import { useWebSocket } from '../../hooks/useWebSocket';
import ErrorBoundary from '../common/ErrorBoundary';
import { CATEGORY_DETAILS, LeadCategory } from '../../constants/leadCategories';

// Styled components
const BoardContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  overflowX: 'auto',
  padding: theme.spacing(2),
  gap: theme.spacing(2),
  minHeight: 'calc(100vh - 200px)',
  position: 'relative',
  '&::-webkit-scrollbar': {
    height: 8,
  },
  '&::-webkit-scrollbar-track': {
    background: theme.palette.background.default,
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.primary.main,
    borderRadius: 4,
  },
}));

const CategoryColumn = styled(Box)(({ theme }) => ({
  minWidth: 300,
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  boxShadow: theme.shadows[1],
  '&:hover': {
    boxShadow: theme.shadows[2],
  },
}));

const ColumnHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(2),
  padding: theme.spacing(1),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

// Interfaces
interface LeadBoardProps {
  leads: Lead[];
  onCategoryChange: (id: string, category: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

interface CategoryColumn {
  id: LeadCategory;
  title: string;
  icon: string;
  leads: Lead[];
  isDropDisabled: boolean;
}

// Constants
const VIRTUAL_LIST_ITEM_HEIGHT = 200;
const COLUMN_MIN_HEIGHT = 400;

/**
 * LeadBoard Component - Implements a Kanban-style board for lead management
 */
const LeadBoard: React.FC<LeadBoardProps> = React.memo(({
  leads,
  onCategoryChange,
  isLoading,
  error
}) => {
  // WebSocket setup for real-time updates
  const { subscribe, unsubscribe } = useWebSocket();
  const { updateCategory } = useLeads();

  // Group leads by category
  const columns = useMemo((): CategoryColumn[] => {
    return CATEGORY_DETAILS.map(category => ({
      id: category.id,
      title: category.name,
      icon: category.icon,
      leads: leads.filter(lead => lead.category === category.id),
      isDropDisabled: category.id === LeadCategory.NOT_INTERESTED
    }));
  }, [leads]);

  // Handle real-time lead updates
  useEffect(() => {
    const handleLeadUpdate = (updatedLead: Lead) => {
      if (updatedLead.category) {
        updateCategory(updatedLead.id, updatedLead.category);
      }
    };

    subscribe('lead:updated', handleLeadUpdate);
    return () => unsubscribe('lead:updated', handleLeadUpdate);
  }, [subscribe, unsubscribe, updateCategory]);

  // Handle drag end event
  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Return if dropped outside or in same position
    if (!destination || 
        (destination.droppableId === source.droppableId && 
         destination.index === source.index)) {
      return;
    }

    try {
      await onCategoryChange(draggableId, destination.droppableId);
    } catch (error) {
      console.error('Failed to update lead category:', error);
    }
  }, [onCategoryChange]);

  // Render loading state
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Alert severity="error" sx={{ margin: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <ErrorBoundary>
      <DragDropContext onDragEnd={handleDragEnd}>
        <BoardContainer role="region" aria-label="Lead Management Board">
          {columns.map(column => (
            <Droppable
              key={column.id}
              droppableId={column.id}
              isDropDisabled={column.isDropDisabled}
            >
              {(provided, snapshot) => (
                <CategoryColumn
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  sx={{
                    backgroundColor: snapshot.isDraggingOver
                      ? 'action.hover'
                      : 'background.paper',
                    minHeight: COLUMN_MIN_HEIGHT
                  }}
                >
                  <ColumnHeader>
                    <Typography variant="h6" component="h2">
                      {column.title} ({column.leads.length})
                    </Typography>
                  </ColumnHeader>

                  <VirtualList
                    height={Math.max(
                      COLUMN_MIN_HEIGHT,
                      column.leads.length * VIRTUAL_LIST_ITEM_HEIGHT
                    )}
                    width="100%"
                    itemCount={column.leads.length}
                    itemSize={VIRTUAL_LIST_ITEM_HEIGHT}
                  >
                    {({ index, style }) => {
                      const lead = column.leads[index];
                      return (
                        <Draggable
                          key={lead.id}
                          draggableId={lead.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...style,
                                ...provided.draggableProps.style
                              }}
                            >
                              <LeadCard
                                lead={lead}
                                isDragging={snapshot.isDragging}
                                onEdit={() => {}} // Implement edit handler
                                onDelete={() => {}} // Implement delete handler
                                onAssign={() => {}} // Implement assign handler
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    }}
                  </VirtualList>
                  {provided.placeholder}
                </CategoryColumn>
              )}
            </Droppable>
          ))}
        </BoardContainer>
      </DragDropContext>
    </ErrorBoundary>
  );
});

LeadBoard.displayName = 'LeadBoard';

export default LeadBoard;