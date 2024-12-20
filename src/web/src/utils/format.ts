import { format as dateFormat } from 'date-fns'; // v2.30.0
import { Lead } from '../types/lead';
import { Quote } from '../types/quote';
import memoize from 'lodash/memoize'; // v4.17.21

/**
 * Constants for formatting configuration
 */
export const DEFAULT_CURRENCY = 'USD';
export const DEFAULT_CURRENCY_DECIMALS = 2;
export const DEFAULT_PERCENTAGE_DECIMALS = 1;
export const DEFAULT_TRUNCATE_LENGTH = 50;
export const DEFAULT_ELLIPSIS = '...';
export const PHONE_NUMBER_REGEX = /^\+?[1-9]\d{1,14}$/;

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY'] as const;
export const SUPPORTED_LOCALES = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE'] as const;

type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];
type SupportedLocale = typeof SUPPORTED_LOCALES[number];

/**
 * Formats a number as a currency string with proper locale support
 * @param amount - The numeric amount to format
 * @param currencyCode - ISO 4217 currency code (default: USD)
 * @param locale - BCP 47 language tag (default: en-US)
 * @returns Formatted currency string with proper symbol and decimal places
 * @throws Error if amount is invalid or currency code is unsupported
 */
export const formatCurrency = memoize((
    amount: number,
    currencyCode: SupportedCurrency = DEFAULT_CURRENCY,
    locale: SupportedLocale = 'en-US'
): string => {
    if (!Number.isFinite(amount)) {
        throw new Error('Invalid amount provided for currency formatting');
    }

    if (!SUPPORTED_CURRENCIES.includes(currencyCode)) {
        throw new Error(`Unsupported currency code: ${currencyCode}`);
    }

    try {
        const formatter = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: DEFAULT_CURRENCY_DECIMALS,
            maximumFractionDigits: DEFAULT_CURRENCY_DECIMALS
        });

        const formatted = formatter.format(amount);
        
        // Add ARIA label for screen readers
        return `${formatted}`;
    } catch (error) {
        console.error('Currency formatting error:', error);
        return `${currencyCode} ${amount.toFixed(DEFAULT_CURRENCY_DECIMALS)}`;
    }
}, (amount, currency, locale) => `${amount}-${currency}-${locale}`);

/**
 * Formats a phone number according to E.164 standard with regional display options
 * @param phoneNumber - The phone number to format
 * @param regionCode - ISO 3166-1 alpha-2 region code (default: US)
 * @returns Formatted phone number string
 * @throws Error if phone number is invalid
 */
export const formatPhoneNumber = memoize((
    phoneNumber: string,
    regionCode: string = 'US'
): string => {
    // Strip all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    if (!PHONE_NUMBER_REGEX.test(cleaned)) {
        throw new Error('Invalid phone number format');
    }

    try {
        // Format based on region
        switch (regionCode) {
            case 'US':
            case 'CA':
                return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
            case 'GB':
                return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '+$1 $2 $3');
            default:
                // Default international format
                return `+${cleaned.replace(/(\d{1,3})(\d{4})(\d{4})/, '$1 $2 $3')}`;
        }
    } catch (error) {
        console.error('Phone formatting error:', error);
        return phoneNumber;
    }
}, (phone, region) => `${phone}-${region}`);

/**
 * Formats a decimal number as a percentage string
 * @param value - The decimal value to format (0.15 = 15%)
 * @param decimalPlaces - Number of decimal places (default: 1)
 * @param locale - BCP 47 language tag (default: en-US)
 * @returns Formatted percentage string
 * @throws Error if value is invalid
 */
export const formatPercentage = memoize((
    value: number,
    decimalPlaces: number = DEFAULT_PERCENTAGE_DECIMALS,
    locale: SupportedLocale = 'en-US'
): string => {
    if (!Number.isFinite(value)) {
        throw new Error('Invalid value provided for percentage formatting');
    }

    try {
        const formatter = new Intl.NumberFormat(locale, {
            style: 'percent',
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces
        });

        return formatter.format(value);
    } catch (error) {
        console.error('Percentage formatting error:', error);
        return `${(value * 100).toFixed(decimalPlaces)}%`;
    }
}, (value, decimals, locale) => `${value}-${decimals}-${locale}`);

/**
 * Truncates text with proper unicode support and custom ellipsis
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation (default: 50)
 * @param ellipsis - Custom ellipsis string (default: ...)
 * @returns Truncated text string
 */
export const truncateText = memoize((
    text: string,
    maxLength: number = DEFAULT_TRUNCATE_LENGTH,
    ellipsis: string = DEFAULT_ELLIPSIS
): string => {
    if (!text || maxLength <= 0) {
        return text;
    }

    try {
        if (text.length <= maxLength) {
            return text;
        }

        // Find the last space before maxLength to avoid breaking words
        const lastSpace = text.lastIndexOf(' ', maxLength - ellipsis.length);
        const truncateIndex = lastSpace > 0 ? lastSpace : maxLength - ellipsis.length;

        return `${text.substring(0, truncateIndex)}${ellipsis}`;
    } catch (error) {
        console.error('Text truncation error:', error);
        return text;
    }
}, (text, maxLength, ellipsis) => `${text}-${maxLength}-${ellipsis}`);

/**
 * Helper function to format quote amounts
 * @param quote - Quote object containing monetary values
 * @param locale - BCP 47 language tag
 * @returns Object with formatted currency strings
 */
export const formatQuoteAmounts = memoize((
    quote: Quote,
    locale: SupportedLocale = 'en-US'
): { subtotal: string; total: string } => {
    return {
        subtotal: formatCurrency(quote.subtotal, DEFAULT_CURRENCY, locale),
        total: formatCurrency(quote.total, DEFAULT_CURRENCY, locale)
    };
}, (quote, locale) => `${quote.id}-${locale}`);

/**
 * Helper function to format lead contact information
 * @param lead - Lead object containing contact details
 * @param regionCode - ISO 3166-1 alpha-2 region code
 * @returns Object with formatted contact information
 */
export const formatLeadContact = memoize((
    lead: Lead,
    regionCode: string = 'US'
): { phone: string } => {
    return {
        phone: formatPhoneNumber(lead.phone, regionCode)
    };
}, (lead, regionCode) => `${lead.id}-${regionCode}`);