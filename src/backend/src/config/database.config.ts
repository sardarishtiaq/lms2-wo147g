/**
 * @fileoverview Database configuration module for multi-tenant CRM system
 * @version 1.0.0
 * @requires dotenv ^16.0.0
 */

import { config } from 'dotenv'; // ^16.0.0

// Initialize environment variables
config();

/**
 * Interface for MongoDB WriteConcern configuration
 */
interface WriteConcern {
    w: string | number;
    j: boolean;
    wtimeout: number;
}

/**
 * Interface for MongoDB connection options with enhanced settings
 */
interface MongoDBOptions {
    useNewUrlParser: boolean;
    useUnifiedTopology: boolean;
    maxPoolSize: number;
    minPoolSize: number;
    serverSelectionTimeoutMS: number;
    socketTimeoutMS: number;
    heartbeatFrequencyMS: number;
    ssl: boolean;
    replicaSet?: string;
    readPreference: string;
    retryWrites: boolean;
    writeConcern: WriteConcern;
}

/**
 * Interface for complete database configuration including tenant isolation
 */
interface DatabaseConfig {
    uri: string;
    tenantIsolation: boolean;
    options: MongoDBOptions;
}

// Environment variables with type safety
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI;
const MAX_POOL_SIZE = parseInt(process.env.MONGODB_MAX_POOL_SIZE || '100', 10);
const MIN_POOL_SIZE = parseInt(process.env.MONGODB_MIN_POOL_SIZE || '10', 10);
const REPLICA_SET = process.env.MONGODB_REPLICA_SET;

/**
 * Default MongoDB connection options optimized for production use
 */
const DEFAULT_CONNECTION_OPTIONS: MongoDBOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: MAX_POOL_SIZE,
    minPoolSize: MIN_POOL_SIZE,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    heartbeatFrequencyMS: 10000,
    ssl: NODE_ENV === 'production',
    replicaSet: REPLICA_SET,
    readPreference: 'primaryPreferred',
    retryWrites: true,
    writeConcern: {
        w: 'majority',
        j: true,
        wtimeout: 2500
    }
};

/**
 * Validates the database configuration settings
 * @throws {Error} If configuration is invalid
 */
const validateDatabaseConfig = (): void => {
    if (!MONGODB_URI) {
        throw new Error('MongoDB URI is required but not provided');
    }

    if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
        throw new Error('Invalid MongoDB URI format');
    }

    if (NODE_ENV === 'production') {
        if (!DEFAULT_CONNECTION_OPTIONS.ssl) {
            throw new Error('SSL must be enabled in production environment');
        }

        if (!REPLICA_SET) {
            throw new Error('Replica set configuration is required in production');
        }
    }

    if (MAX_POOL_SIZE < MIN_POOL_SIZE) {
        throw new Error('Maximum pool size must be greater than minimum pool size');
    }

    if (DEFAULT_CONNECTION_OPTIONS.socketTimeoutMS < DEFAULT_CONNECTION_OPTIONS.serverSelectionTimeoutMS) {
        throw new Error('Socket timeout must be greater than server selection timeout');
    }
};

// Validate configuration on module load
validateDatabaseConfig();

/**
 * Complete database configuration object with tenant isolation enabled
 */
export const databaseConfig: DatabaseConfig = {
    uri: MONGODB_URI!,
    tenantIsolation: true,
    options: {
        ...DEFAULT_CONNECTION_OPTIONS,
        // Additional production safeguards
        ...(NODE_ENV === 'production' && {
            ssl: true,
            retryWrites: true,
            writeConcern: {
                w: 'majority',
                j: true,
                wtimeout: 2500
            }
        })
    }
};

/**
 * Export individual configuration properties for granular access
 */
export const { uri, options, tenantIsolation } = databaseConfig;

/**
 * Export configuration validation function for external use
 */
export { validateDatabaseConfig };