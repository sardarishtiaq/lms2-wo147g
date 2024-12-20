/**
 * Authentication Configuration
 * Version: 1.0.0
 * 
 * This file defines the authentication and security settings for the multi-tenant CRM system.
 * It includes configurations for JWT tokens, session management, password policies, and security measures.
 */

import { config } from 'dotenv'; // ^16.0.3

// Initialize environment variables
config();

// Token duration constants (in seconds)
const ACCESS_TOKEN_DURATION = 900; // 15 minutes
const REFRESH_TOKEN_DURATION = 604800; // 7 days
const API_TOKEN_DURATION = 2592000; // 30 days
const MAX_LOGIN_ATTEMPTS = 5;

// Supported JWT algorithms
const JWT_ALGORITHMS = ['HS256', 'RS256'] as const;
type JWTAlgorithm = typeof JWT_ALGORITHMS[number];

/**
 * JWT Configuration Interface
 * Defines settings for JSON Web Token management
 */
interface IJWTConfig {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    apiTokenSecret: string;
    accessTokenDuration: number;
    refreshTokenDuration: number;
    apiTokenDuration: number;
    issuer: string;
    algorithm: JWTAlgorithm;
    enableTokenRevocation: boolean;
    tokenRenewalThreshold: number;
}

/**
 * Session Management Configuration Interface
 * Defines settings for user session handling
 */
interface ISessionConfig {
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    domain: string;
    maxAge: number;
    httpOnly: boolean;
    path: string;
    maxActiveSessions: number;
    enableSessionRevocation: boolean;
}

/**
 * Password Policy Configuration Interface
 * Defines requirements and constraints for user passwords
 */
interface IPasswordPolicy {
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxRepeatingChars: number;
    passwordHistorySize: number;
    minPasswordAge: number;
    maxPasswordAge: number;
}

/**
 * Security Configuration Interface
 * Defines general security settings and protections
 */
interface ISecurityConfig {
    maxLoginAttempts: number;
    lockoutDuration: number;
    enableRateLimiting: boolean;
    rateLimitWindow: number;
    rateLimitRequests: number;
    enableBruteForceProtection: boolean;
}

/**
 * Main authentication configuration object
 * Contains all authentication and security settings
 */
export const authConfig = {
    jwt: {
        accessTokenSecret: process.env.JWT_ACCESS_SECRET!,
        refreshTokenSecret: process.env.JWT_REFRESH_SECRET!,
        apiTokenSecret: process.env.JWT_API_SECRET!,
        accessTokenDuration: ACCESS_TOKEN_DURATION,
        refreshTokenDuration: REFRESH_TOKEN_DURATION,
        apiTokenDuration: API_TOKEN_DURATION,
        issuer: 'multi-tenant-crm',
        algorithm: 'HS256' as JWTAlgorithm,
        enableTokenRevocation: true,
        tokenRenewalThreshold: 300 // 5 minutes before expiration
    } as IJWTConfig,

    session: {
        secure: true,
        sameSite: 'strict' as const,
        domain: process.env.COOKIE_DOMAIN!,
        maxAge: REFRESH_TOKEN_DURATION,
        httpOnly: true,
        path: '/',
        maxActiveSessions: 5,
        enableSessionRevocation: true
    } as ISessionConfig,

    passwordPolicy: {
        minLength: 8,
        maxLength: 32,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxRepeatingChars: 3,
        passwordHistorySize: 5,
        minPasswordAge: 86400, // 1 day in seconds
        maxPasswordAge: 7776000 // 90 days in seconds
    } as IPasswordPolicy,

    security: {
        maxLoginAttempts: MAX_LOGIN_ATTEMPTS,
        lockoutDuration: 1800, // 30 minutes in seconds
        enableRateLimiting: true,
        rateLimitWindow: 900, // 15 minutes in seconds
        rateLimitRequests: 100,
        enableBruteForceProtection: true
    } as ISecurityConfig
};

// Named exports for individual configurations
export const { jwt, session, passwordPolicy, security } = authConfig;