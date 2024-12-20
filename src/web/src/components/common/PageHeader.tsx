import React, { memo } from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import theme from '../../styles/theme';
import SearchBar from './SearchBar';

/**
 * Props interface for the PageHeader component
 */
interface PageHeaderProps {
  /** Main header title text */
  title: string;
  /** Optional secondary text below title */
  subtitle?: string;
  /** Toggle search bar visibility */
  showSearch?: boolean;
  /** Callback function for search term updates */
  onSearch?: (searchTerm: string) => void;
  /** Optional action buttons or components */
  actions?: React.ReactNode;
  /** Optional CSS class for custom styling */
  className?: string;
}

/**
 * Styled container for the header with elevation and sticky positioning
 */
const HeaderContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  boxShadow: theme.shadows[1],
  transition: 'box-shadow 0.3s ease-in-out',
  position: 'sticky',
  top: 0,
  zIndex: 1100,

  // Responsive padding adjustments
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },

  '&:hover': {
    boxShadow: theme.shadows[2],
  },
}));

/**
 * Styled container for title and action buttons with responsive layout
 */
const TitleContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(2),
  flexWrap: 'wrap',
  gap: theme.spacing(2),

  // Responsive layout adjustments
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  },
}));

/**
 * Styled container for title and subtitle text
 */
const TextContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0, // Prevents text overflow issues
}));

/**
 * Styled container for action buttons
 */
const ActionsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  alignItems: 'center',
  flexWrap: 'wrap',

  [theme.breakpoints.down('sm')]: {
    width: '100%',
    justifyContent: 'flex-start',
  },
}));

/**
 * PageHeader component providing consistent header styling and layout
 * across the CRM application with enhanced accessibility and responsive design
 * 
 * @component
 * @example
 * ```tsx
 * <PageHeader
 *   title="Lead Management"
 *   subtitle="Active Leads: 150"
 *   showSearch
 *   onSearch={(term) => handleSearch(term)}
 *   actions={<Button variant="contained">Add Lead</Button>}
 * />
 * ```
 */
export const PageHeader: React.FC<PageHeaderProps> = memo(({
  title,
  subtitle,
  showSearch = false,
  onSearch,
  actions,
  className,
}) => {
  return (
    <HeaderContainer 
      className={className}
      component="header"
      role="banner"
    >
      <TitleContainer>
        <TextContainer>
          <Typography
            variant="h1"
            component="h1"
            sx={{
              ...theme.typography.h4, // Use h4 size for better visual hierarchy
              fontWeight: theme.typography.fontWeightMedium,
              color: theme.palette.text.primary,
              marginBottom: subtitle ? 0.5 : 0,
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="subtitle1"
              component="p"
              sx={{
                color: theme.palette.text.secondary,
                marginTop: 0.5,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </TextContainer>
        {actions && (
          <ActionsContainer role="toolbar" aria-label="Page actions">
            {actions}
          </ActionsContainer>
        )}
      </TitleContainer>

      {showSearch && onSearch && (
        <Box sx={{ maxWidth: '600px' }}>
          <SearchBar
            onSearch={onSearch}
            placeholder="Search..."
            debounceMs={300}
            fullWidth
            ariaLabel={`Search ${title.toLowerCase()}`}
          />
        </Box>
      )}
    </HeaderContainer>
  );
});

// Display name for debugging
PageHeader.displayName = 'PageHeader';

// Default export
export default PageHeader;