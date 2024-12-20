import { format, formatDistance, parseISO } from 'date-fns'; // date-fns v2.30.0

/**
 * Default format strings for date and datetime formatting
 */
export const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd';
export const DEFAULT_DATETIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';
export const DISPLAY_DATE_FORMAT = 'MMM dd, yyyy';
export const DISPLAY_DATETIME_FORMAT = 'MMM dd, yyyy HH:mm';

/**
 * ISO date string regex pattern for validation
 * Matches strings like: 2023-10-25 or 2023-10-25T14:30:00.000Z
 */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/;

/**
 * Safely parses a date string into a Date object with validation.
 * Returns null if the date string is invalid.
 * 
 * @param dateString - The ISO format date string to parse
 * @returns Parsed Date object or null for invalid dates
 */
export const parseDateString = (dateString: string): Date | null => {
  try {
    // Validate string format
    if (!dateString || !ISO_DATE_REGEX.test(dateString)) {
      return null;
    }

    // Parse the date string
    const parsedDate = parseISO(dateString);

    // Validate the resulting date object
    if (isNaN(parsedDate.getTime())) {
      return null;
    }

    return parsedDate;
  } catch (error) {
    console.error('Error parsing date string:', error);
    return null;
  }
};

/**
 * Formats a date consistently across the application with support for custom formats.
 * Handles both Date objects and ISO date strings.
 * 
 * @param date - Date to format (Date object or ISO string)
 * @param formatString - Optional custom format string (defaults to DEFAULT_DATE_FORMAT)
 * @returns Formatted date string or empty string for invalid dates
 * 
 * @example
 * formatDate('2023-10-25') // Returns "Oct 25, 2023"
 * formatDate(new Date(), 'yyyy-MM-dd HH:mm') // Returns "2023-10-25 14:30"
 */
export const formatDate = (
  date: Date | string,
  formatString: string = DISPLAY_DATE_FORMAT
): string => {
  try {
    // Handle string dates
    const dateObj = typeof date === 'string' ? parseDateString(date) : date;

    // Validate date object
    if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return '';
    }

    // Format the date using the specified format string
    return format(dateObj, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Calculates the relative time between a date and current time with natural language formatting.
 * Useful for activity timelines and real-time updates.
 * 
 * @param date - The date to calculate relative time from (Date object or ISO string)
 * @returns Human-readable relative time string (e.g., "2 hours ago")
 * 
 * @example
 * getRelativeTime('2023-10-25T10:00:00Z') // Returns "2 hours ago"
 * getRelativeTime(futureDate) // Returns "in 3 days"
 */
export const getRelativeTime = (date: Date | string): string => {
  try {
    // Handle string dates
    const dateObj = typeof date === 'string' ? parseDateString(date) : date;

    // Validate date object
    if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return '';
    }

    const now = new Date();
    const isFuture = dateObj > now;

    // Calculate the relative time
    const distance = formatDistance(dateObj, now, { addSuffix: true });

    // Return formatted relative time
    return distance;
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return '';
  }
};

/**
 * Type guard to check if a value is a valid Date object
 * 
 * @param value - Value to check
 * @returns Boolean indicating if the value is a valid Date
 */
export const isValidDate = (value: any): value is Date => {
  return value instanceof Date && !isNaN(value.getTime());
};

/**
 * Formats a date for display in the activity timeline
 * Combines both absolute and relative times for better context
 * 
 * @param date - The date to format (Date object or ISO string)
 * @returns Formatted string with both absolute and relative times
 * 
 * @example
 * formatActivityDate('2023-10-25T10:00:00Z')
 * // Returns "Oct 25, 2023 10:00 (2 hours ago)"
 */
export const formatActivityDate = (date: Date | string): string => {
  try {
    const absoluteTime = formatDate(date, DISPLAY_DATETIME_FORMAT);
    const relativeTime = getRelativeTime(date);

    if (!absoluteTime || !relativeTime) {
      return '';
    }

    return `${absoluteTime} (${relativeTime})`;
  } catch (error) {
    console.error('Error formatting activity date:', error);
    return '';
  }
};