/**
 * @fileoverview MongoDB schema definition for user documents in the multi-tenant CRM system
 * Implements user management with tenant isolation, role-based access, and security features
 * @version 1.0.0
 */

import { Schema, model, Types } from 'mongoose'; // v7.x
import { IUser, UserStatus } from '../../interfaces/IUser';
import { ROLES } from '../../constants/roles';

/**
 * User preferences sub-schema defining customization options
 */
const userPreferencesSchema = new Schema({
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'light'
  },
  language: {
    type: String,
    default: 'en'
  },
  notifications: {
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    desktop: { type: Boolean, default: false },
    leadUpdates: { type: Boolean, default: true },
    quoteUpdates: { type: Boolean, default: true },
    systemAlerts: { type: Boolean, default: true }
  },
  dashboardLayout: {
    widgets: [{ type: String }],
    layout: {
      type: String,
      enum: ['grid', 'list'],
      default: 'grid'
    },
    defaultView: {
      type: String,
      enum: ['leads', 'quotes', 'reports'],
      default: 'leads'
    }
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  dateFormat: {
    type: String,
    default: 'YYYY-MM-DD'
  }
}, { _id: false });

/**
 * Main user schema definition with comprehensive validation and security features
 */
export const userSchema = new Schema<IUser>({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please provide a valid email'],
    index: true
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters'],
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters'],
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required']
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: Object.values(ROLES),
    default: ROLES.AGENT
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: Object.values(UserStatus),
    default: UserStatus.PENDING_ACTIVATION
  },
  failedLoginAttempts: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  passwordLastChangedAt: {
    type: Date,
    default: Date.now
  },
  lastLoginAt: {
    type: Date
  },
  lastActivityAt: {
    type: Date
  },
  preferences: {
    type: userPreferencesSchema,
    default: () => ({})
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Compound indexes for optimized queries and data integrity
 */
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, role: 1 }, { background: true });
userSchema.index({ tenantId: 1, status: 1 }, { background: true });
userSchema.index({ lastActivityAt: 1 }, { background: true, expireAfterSeconds: 2592000 }); // 30 days

/**
 * Virtual for full name
 */
userSchema.virtual('fullName').get(function(this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

/**
 * Static methods for tenant-aware queries
 */
userSchema.statics.findByTenantId = async function(tenantId: string): Promise<IUser[]> {
  if (!Types.ObjectId.isValid(tenantId)) {
    throw new Error('Invalid tenant ID');
  }
  return this.find({
    tenantId,
    status: { $ne: UserStatus.INACTIVE }
  }).select('-passwordHash');
};

userSchema.statics.findByEmail = async function(email: string, tenantId: string): Promise<IUser | null> {
  if (!Types.ObjectId.isValid(tenantId)) {
    throw new Error('Invalid tenant ID');
  }
  return this.findOne({
    email: email.toLowerCase(),
    tenantId,
    status: { $ne: UserStatus.INACTIVE }
  }).select('-passwordHash');
};

userSchema.statics.findActiveByTenant = async function(
  tenantId: string,
  role?: ROLES
): Promise<IUser[]> {
  if (!Types.ObjectId.isValid(tenantId)) {
    throw new Error('Invalid tenant ID');
  }
  
  const query: any = {
    tenantId,
    status: UserStatus.ACTIVE
  };
  
  if (role) {
    query.role = role;
  }
  
  return this.find(query).select('-passwordHash');
};

/**
 * Instance methods for security checks
 */
userSchema.methods.isLocked = function(this: IUser): boolean {
  return this.failedLoginAttempts >= 5;
};

userSchema.methods.isPasswordChangeRequired = function(this: IUser): boolean {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  return this.passwordLastChangedAt < ninetyDaysAgo;
};

/**
 * Pre-save middleware for data sanitization
 */
userSchema.pre('save', function(next) {
  this.email = this.email.toLowerCase();
  this.firstName = this.firstName.trim();
  this.lastName = this.lastName.trim();
  next();
});

/**
 * Export the User model with proper typing
 */
export const User = model<IUser>('User', userSchema);