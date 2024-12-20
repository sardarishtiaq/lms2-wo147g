import React, { useEffect, useCallback, useState } from 'react'; // ^18.0.0
import { Box, List, ListItem, ListItemIcon, ListItemText, Badge, Tooltip, CircularProgress } from '@mui/material'; // ^5.0.0
import { Icon } from '@mui/material/Icon'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import { useLeads } from '../../hooks/useLeads';
import { CATEGORY_DETAILS, LeadCategory } from '../../constants/leadCategories';

// Enhanced styled components with proper tenant theme integration
const StyledListItem = styled(ListItem)(({ theme }) => ({
  borderRadius: '8px',
  marginBottom: '4px',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    transform: 'translateX(4px)',
  },
  '&.Mui-selected': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contralto,
    '& .MuiListItemIcon-root': {
      color: theme.palette.primary.contralto,
    },
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
}));

const CategoryBadge = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    right: -6,
    top: 4,
    padding: '0 4px',
    backgroundColor: theme.palette.secondary.main,
    color: theme.palette.secondary.contralto,
    transition: 'all 0.3s ease-in-out',
    animation: 'pulse 1.5s ease-in-out',
  },
  '@keyframes pulse': {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.2)' },
    '100%': { transform: 'scale(1)' },
  },
}));

interface LeadCategoriesProps {
  selectedCategory: LeadCategory;
  counts: Record<LeadCategory, number>;
  onCategorySelect: (category: LeadCategory) => void;
  isLoading: boolean;
  error: Error | null;
}

/**
 * LeadCategories component that renders the lead category navigation sidebar
 * Implements the 12-stage pipeline process with real-time updates and tenant isolation
 */
const LeadCategories: React.FC<LeadCategoriesProps> = ({
  selectedCategory,
  counts,
  onCategorySelect,
  isLoading,
  error
}) => {
  const [localCounts, setLocalCounts] = useState<Record<LeadCategory, number>>(counts);
  const { updateCategory, setFilters, subscribeToUpdates } = useLeads();

  // Handle real-time count updates
  useEffect(() => {
    const unsubscribe = subscribeToUpdates((update) => {
      if (update.type === 'category_change') {
        setLocalCounts((prev) => ({
          ...prev,
          [update.oldCategory]: prev[update.oldCategory] - 1,
          [update.newCategory]: prev[update.newCategory] + 1,
        }));
      }
    });

    return () => unsubscribe();
  }, [subscribeToUpdates]);

  // Handle category selection with optimistic updates
  const handleCategorySelect = useCallback(async (category: LeadCategory) => {
    try {
      onCategorySelect(category);
      setFilters({ category: [category] });

      // Optimistic update for the UI
      setLocalCounts((prev) => ({
        ...prev,
        [selectedCategory]: prev[selectedCategory] - 1,
        [category]: prev[category] + 1,
      }));

      await updateCategory(category);
    } catch (error) {
      // Revert optimistic update on error
      setLocalCounts(counts);
      console.error('Failed to update category:', error);
    }
  }, [selectedCategory, counts, onCategorySelect, setFilters, updateCategory]);

  if (error) {
    return (
      <Box p={2} color="error.main">
        Error loading categories: {error.message}
      </Box>
    );
  }

  return (
    <Box
      component="nav"
      sx={{
        width: '100%',
        maxWidth: 280,
        bgcolor: 'background.paper',
        borderRadius: 1,
        boxShadow: 1,
      }}
    >
      <List sx={{ p: 2 }}>
        {CATEGORY_DETAILS.map((category) => (
          <Tooltip
            key={category.id}
            title={category.description}
            placement="right"
            arrow
          >
            <StyledListItem
              button
              selected={selectedCategory === category.id}
              onClick={() => handleCategorySelect(category.id)}
              disabled={isLoading}
            >
              <ListItemIcon>
                <Icon>{category.icon}</Icon>
              </ListItemIcon>
              <ListItemText
                primary={category.name}
                primaryTypographyProps={{
                  variant: 'body2',
                  fontWeight: selectedCategory === category.id ? 600 : 400,
                }}
              />
              <CategoryBadge
                badgeContent={localCounts[category.id] || 0}
                max={999}
                showZero
              />
              {isLoading && selectedCategory === category.id && (
                <CircularProgress
                  size={16}
                  sx={{ ml: 1 }}
                />
              )}
            </StyledListItem>
          </Tooltip>
        ))}
      </List>
    </Box>
  );
};

export default LeadCategories;