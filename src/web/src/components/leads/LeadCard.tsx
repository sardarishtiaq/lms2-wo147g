import React, { useState, useCallback, useRef } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  IconButton, 
  Chip,
  Tooltip,
  Box
} from '@mui/material';
import { styled } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import { formatDistanceToNow } from 'date-fns';

import { Lead } from '../../types/lead';
import { LeadCategory, getCategoryById } from '../../constants/leadCategories';
import theme from '../../styles/theme';
import ConfirmDialog from '../common/ConfirmDialog';

// Styled components with enterprise-ready styling
const StyledCard = styled(Card, {
  shouldForwardProp: prop => !['isDragging', 'isFocused'].includes(prop as string)
})<{ isDragging?: boolean; isFocused?: boolean }>(({ isDragging, isFocused }) => ({
  margin: theme.spacing(1),
  cursor: 'grab',
  transition: 'all 0.3s ease',
  opacity: isDragging ? 0.5 : 1,
  boxShadow: isDragging ? theme.shadows[8] : theme.shadows[2],
  outline: isFocused ? `2px solid ${theme.palette.primary.main}` : 'none',
  '&:hover': {
    boxShadow: theme.shadows[4]
  }
}));

const CardHeader = styled('div')({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`
});

const ActionButtons = styled('div')({
  display: 'flex',
  gap: theme.spacing(1),
  marginTop: theme.spacing(2),
  justifyContent: 'flex-end'
});

// Priority color mapping
const getPriorityColor = (priority: number) => {
  const colors = {
    1: theme.palette.success.main,
    2: theme.palette.info.main,
    3: theme.palette.warning.main,
    4: theme.palette.error.light,
    5: theme.palette.error.main
  };
  return colors[priority as keyof typeof colors] || theme.palette.grey[500];
};

// Props interface
interface LeadCardProps {
  lead: Lead;
  isDragging?: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string) => void;
  onError?: (error: Error) => void;
}

/**
 * LeadCard component displays lead information in a card format with actions
 * Implements drag-and-drop, accessibility, and analytics tracking
 */
export const LeadCard: React.FC<LeadCardProps> = React.memo(({
  lead,
  isDragging = false,
  onEdit,
  onDelete,
  onAssign,
  onError
}) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Get category details
  const category = getCategoryById(lead.category);

  // Handlers
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onEdit(lead.id);
    }
  }, [lead.id, onEdit]);

  const handleDelete = useCallback(async () => {
    try {
      await onDelete(lead.id);
      setIsDeleteDialogOpen(false);
      
      // Track successful deletion
      window.analytics?.track('lead_deleted', {
        leadId: lead.id,
        category: lead.category
      });
    } catch (error) {
      onError?.(error as Error);
      
      // Track deletion error
      window.analytics?.track('lead_deletion_error', {
        leadId: lead.id,
        error: (error as Error).message
      });
    }
  }, [lead.id, lead.category, onDelete, onError]);

  return (
    <StyledCard
      ref={cardRef}
      isDragging={isDragging}
      isFocused={isFocused}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Lead card for ${lead.company}`}
    >
      <CardHeader>
        <Typography variant="h6" noWrap sx={{ maxWidth: '70%' }}>
          {lead.company}
        </Typography>
        <Chip
          size="small"
          label={category?.name || lead.category}
          color="primary"
          sx={{ maxWidth: '30%' }}
        />
      </CardHeader>

      <CardContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Contact: {lead.contactName}
          </Typography>
          <Typography 
            variant="body2" 
            color="textSecondary"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Box
              component="span"
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: getPriorityColor(lead.priority),
                display: 'inline-block'
              }}
            />
            Priority {lead.priority}
          </Typography>
        </Box>

        <Typography variant="caption" color="textSecondary" display="block">
          Last Activity: {formatDistanceToNow(new Date(lead.lastActivityAt), { addSuffix: true })}
        </Typography>

        <ActionButtons>
          <Tooltip title="Assign Lead">
            <IconButton
              size="small"
              onClick={() => onAssign(lead.id)}
              aria-label="assign lead"
            >
              <AssignmentIndIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Edit Lead">
            <IconButton
              size="small"
              onClick={() => onEdit(lead.id)}
              aria-label="edit lead"
            >
              <EditIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete Lead">
            <IconButton
              size="small"
              onClick={() => setIsDeleteDialogOpen(true)}
              aria-label="delete lead"
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </ActionButtons>
      </CardContent>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        title="Delete Lead"
        message={`Are you sure you want to delete the lead for ${lead.company}?`}
        severity="error"
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
        analyticsEvent="lead_delete_dialog"
      />
    </StyledCard>
  );
});

LeadCard.displayName = 'LeadCard';

export default LeadCard;