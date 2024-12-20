import React, { useCallback, useEffect, useRef } from 'react';
import { TextField, InputAdornment } from '@mui/material';
import { SearchIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { debounce } from 'lodash';
import { COLORS, SPACING, ELEVATION } from '../../constants/theme';

/**
 * Props interface for the SearchBar component
 */
interface SearchBarProps {
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Callback function triggered on search input change */
  onSearch: (searchTerm: string) => void;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Whether the search bar should take full width */
  fullWidth?: boolean;
  /** Accessibility label for the search input */
  ariaLabel?: string;
}

/**
 * Styled TextField component with Material Design aesthetics
 */
const StyledTextField = styled(TextField, {
  shouldForwardProp: (prop) => prop !== 'fullWidth',
})<{ fullWidth?: boolean }>(({ fullWidth = true }) => ({
  backgroundColor: COLORS.background.primary,
  borderRadius: '4px',
  width: fullWidth ? '100%' : 'auto',
  marginBottom: SPACING.sizes.md,
  boxShadow: ELEVATION.levels[1],
  transition: 'box-shadow 0.3s ease-in-out',

  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: 'rgba(0, 0, 0, 0.12)',
    },
    '&:hover fieldset': {
      borderColor: COLORS.primary,
    },
    '&.Mui-focused fieldset': {
      borderColor: COLORS.primary,
    },
  },

  '&:hover': {
    boxShadow: ELEVATION.levels[2],
  },

  '&:focus-within': {
    boxShadow: ELEVATION.levels[2],
  },
}));

/**
 * SearchBar component providing real-time search functionality with debouncing
 * @component
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search...',
  onSearch,
  debounceMs = 300,
  fullWidth = true,
  ariaLabel = 'search',
}) => {
  // Create a ref to store the debounced function
  const debouncedSearchRef = useRef<ReturnType<typeof debounce>>();

  // Create debounced search handler
  useEffect(() => {
    debouncedSearchRef.current = debounce((value: string) => {
      onSearch(value);
    }, debounceMs);

    // Cleanup debounce on unmount
    return () => {
      debouncedSearchRef.current?.cancel();
    };
  }, [onSearch, debounceMs]);

  // Memoized change handler
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      debouncedSearchRef.current?.(value);
    },
    []
  );

  return (
    <StyledTextField
      fullWidth={fullWidth}
      placeholder={placeholder}
      onChange={handleSearchChange}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon color="action" />
          </InputAdornment>
        ),
        'aria-label': ariaLabel,
      }}
      inputProps={{
        'aria-label': ariaLabel,
        role: 'searchbox',
      }}
      variant="outlined"
      size="medium"
      data-testid="search-bar"
    />
  );
};

// Default export for convenient importing
export default SearchBar;