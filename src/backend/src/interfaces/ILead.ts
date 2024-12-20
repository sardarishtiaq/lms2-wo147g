/**
 * @fileoverview Core lead entity interface definitions for the multi-tenant CRM system.
 * Provides comprehensive type definitions for the 12-stage pipeline process with complete
 * lead tracking and management capabilities.
 * @version 1.0.0
 */

import { Types } from 'mongodb'; // v5.0.0
import { Document } from 'mongoose'; // v7.0.0
import { LeadCategory } from '../constants/leadCategories';

/**
 * Interface defining the structure of the last activity record
 */
interface ILastActivity {
  /** Type of activity performed */
  type: string;
  /** Timestamp of the activity */
  timestamp: Date;
  /** User who performed the activity */
  performedBy: Types.ObjectId;
  /** Additional activity details */
  details: Record<string, any>;
}

/**
 * Core interface defining the structure of a lead entity with comprehensive
 * tracking and categorization capabilities. Supports the 12-stage pipeline
 * process with complete data isolation between tenants.
 */
export interface ILead {
  /** Unique identifier for the lead */
  _id: Types.ObjectId;
  
  /** Associated tenant identifier for multi-tenant isolation */
  tenantId: Types.ObjectId;
  
  /** Current category in the 12-stage pipeline */
  category: LeadCategory;
  
  /** ID of the agent assigned to this lead */
  assignedTo: Types.ObjectId;
  
  /** Current status of the lead */
  status: string;
  
  /** Priority level (1-5, where 1 is highest) */
  priority: number;
  
  /** Company/organization name */
  company: string;
  
  /** Primary contact person name */
  contactName: string;
  
  /** Primary contact email address */
  email: string;
  
  /** Contact phone number */
  phone: string;
  
  /** Lead generation source identifier */
  source: string;
  
  /** Flexible metadata storage for additional lead information */
  metadata: Record<string, any>;
  
  /** Lead creation timestamp */
  createdAt: Date;
  
  /** Last update timestamp */
  updatedAt: Date;
  
  /** Categorization and filtering tags */
  tags: string[];
  
  /** Lead qualification score (0-100) */
  score: number;
  
  /** Flag indicating if the lead is active */
  isActive: boolean;
  
  /** References to related lead records */
  relatedLeads: Types.ObjectId[];
  
  /** Details of the most recent activity */
  lastActivity: ILastActivity;
  
  /** Current stage in the sales pipeline */
  pipelineStage: string;
}

/**
 * Extended interface that combines ILead with Mongoose Document properties
 * for database operations. Provides complete type coverage for MongoDB
 * operations while maintaining the core lead structure.
 */
export interface ILeadDocument extends ILead, Document {
  // Inherits all properties from ILead and Document
}