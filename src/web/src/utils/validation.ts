import * as yup from 'yup'; // v1.3.2
import i18next from 'i18next'; // v23.0.0
import { Lead } from '../types/lead';
import { Quote } from '../types/quote';
import { User, UserStatus } from '../types/user';
import { LeadCategory } from '../constants/leadCategories';
import { ROLES } from '../../../backend/src/constants/roles';

/**
 * RFC 5322 compliant email regex pattern for strict email validation
 */
const EMAIL_REGEX = /^(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f!#-[]-\x7f]|\\[\x01-\t\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f!-ZS-\x7f]|\\[\x01-\t\x0b\x0c\x0e-\x7f])+)\])$/;

/**
 * International phone number validation regex with country code support
 */
const PHONE_REGEX = /^\+?([0-9]{1,3})?[-. ]?\(?([0-9]{1,4})\)?[-. ]?([0-9]{1,4})[-. ]?([0-9]{1,9})$/;

/**
 * List of known disposable email domains for validation
 */
const DISPOSABLE_EMAIL_DOMAINS = ['tempmail.com', 'throwawaymail.com'];

/**
 * Validates an email address with RFC 5322 compliance and additional security checks
 * @param email - Email address to validate
 * @param tenantId - Tenant ID for tenant-specific validation rules
 * @returns Promise resolving to validation result
 */
export const validateEmail = async (
  email: string,
  tenantId: string
): Promise<boolean> => {
  try {
    // Basic format validation
    if (!EMAIL_REGEX.test(email)) {
      return false;
    }

    // Extract domain for additional checks
    const domain = email.split('@')[1].toLowerCase();

    // Check against disposable email domains
    if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
      return false;
    }

    // Validate domain has valid MX record
    try {
      const hasMx = await validateDomainMX(domain);
      if (!hasMx) {
        return false;
      }
    } catch {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * Validates a phone number with international format support
 * @param phone - Phone number to validate
 * @param countryCode - Optional country code for region-specific validation
 * @returns Validation result
 */
export const validatePhone = (phone: string, countryCode?: string): boolean => {
  try {
    // Remove all non-numeric characters for consistent validation
    const normalizedPhone = phone.replace(/[^\d+]/g, '');

    // Basic format validation
    if (!PHONE_REGEX.test(normalizedPhone)) {
      return false;
    }

    // Country-specific validation if country code provided
    if (countryCode) {
      const countryPrefix = `+${countryCode}`;
      if (!normalizedPhone.startsWith(countryPrefix)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * Comprehensive lead validation schema with tenant isolation
 */
export const leadValidationSchema = yup.object().shape({
  tenantId: yup.string().required(i18next.t('validation.tenant.required')),
  category: yup
    .string()
    .oneOf(Object.values(LeadCategory))
    .required(i18next.t('validation.lead.category.required')),
  assignedTo: yup.string().nullable(),
  status: yup.string().required(i18next.t('validation.lead.status.required')),
  priority: yup
    .number()
    .min(1)
    .max(5)
    .required(i18next.t('validation.lead.priority.required')),
  company: yup
    .string()
    .min(2)
    .max(200)
    .required(i18next.t('validation.lead.company.required')),
  contactName: yup
    .string()
    .min(2)
    .max(100)
    .required(i18next.t('validation.lead.contactName.required')),
  email: yup
    .string()
    .test('email', i18next.t('validation.lead.email.invalid'), 
      (value, context) => validateEmail(value, context.parent.tenantId))
    .required(i18next.t('validation.lead.email.required')),
  phone: yup
    .string()
    .test('phone', i18next.t('validation.lead.phone.invalid'), validatePhone)
    .required(i18next.t('validation.lead.phone.required')),
  metadata: yup.object()
});

/**
 * Quote validation schema with nested item validation
 */
export const quoteValidationSchema = yup.object().shape({
  tenantId: yup.string().required(i18next.t('validation.tenant.required')),
  leadId: yup.string().required(i18next.t('validation.quote.lead.required')),
  items: yup.array().of(
    yup.object().shape({
      productId: yup.string().required(),
      description: yup.string().required(),
      quantity: yup.number().min(1).required(),
      unitPrice: yup.number().min(0).required(),
      discountPercent: yup.number().min(0).max(100),
      taxRate: yup.number().min(0).max(100)
    })
  ).min(1).required(),
  validUntil: yup.date().min(new Date()).required(),
  notes: yup.string(),
  terms: yup.string().required()
});

/**
 * User validation schema with role-based validation
 */
export const userValidationSchema = yup.object().shape({
  tenantId: yup.string().required(i18next.t('validation.tenant.required')),
  email: yup
    .string()
    .test('email', i18next.t('validation.user.email.invalid'),
      (value, context) => validateEmail(value, context.parent.tenantId))
    .required(i18next.t('validation.user.email.required')),
  firstName: yup
    .string()
    .min(2)
    .max(50)
    .required(i18next.t('validation.user.firstName.required')),
  lastName: yup
    .string()
    .min(2)
    .max(50)
    .required(i18next.t('validation.user.lastName.required')),
  role: yup
    .string()
    .oneOf(Object.values(ROLES))
    .required(i18next.t('validation.user.role.required')),
  status: yup
    .string()
    .oneOf(Object.values(UserStatus))
    .required(i18next.t('validation.user.status.required')),
  preferences: yup.object().shape({
    theme: yup.string().oneOf(['light', 'dark', 'system']),
    language: yup.string(),
    notifications: yup.object(),
    timezone: yup.string()
  })
});

/**
 * Helper function to validate domain MX records
 * @param domain - Domain to validate
 * @returns Promise resolving to boolean indicating MX record existence
 */
async function validateDomainMX(domain: string): Promise<boolean> {
  try {
    // Implementation would use DNS lookup
    // Mocked for frontend implementation
    return true;
  } catch {
    return false;
  }
}