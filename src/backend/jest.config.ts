import type { Config } from '@jest/types';

// Jest configuration object
const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set Node.js as the test environment
  testEnvironment: 'node',

  // Define root directories for test discovery
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],

  // Pattern matching for test files
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx)',
    '**/?(*.)+(spec|test).+(ts|tsx)'
  ],

  // TypeScript transformation configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },

  // Path alias mapping for imports
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1'
  },

  // Setup files to run before tests
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts'
  ],

  // Code coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'json',
    'html'
  ],

  // Paths to exclude from coverage
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/dist/'
  ],

  // Coverage thresholds enforcement
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // TypeScript configuration for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],

  // Test timeout in milliseconds
  testTimeout: 10000,

  // Verbose output for detailed test results
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true
};

export default config;