import type { Config } from '@jest/types';

// Jest configuration for the frontend application
const config: Config.InitialOptions = {
  // Use jsdom environment for DOM manipulation testing
  testEnvironment: 'jsdom',

  // Setup files to run after environment is setup but before tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Module name mapping for path aliases and static assets
  moduleNameMapper: {
    // Map @ alias to src directory for consistent imports
    '^@/(.*)$': '<rootDir>/src/$1',
    
    // Handle style imports with identity-obj-proxy
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    
    // Handle static asset imports with mock file
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/tests/mocks/fileMock.ts'
  },

  // Transform configuration for TypeScript and JavaScript files
  transform: {
    // TypeScript files transformation
    '^.+\\.tsx?$': 'ts-jest',
    // JavaScript files transformation
    '^.+\\.jsx?$': 'babel-jest'
  },

  // Test file pattern matching
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',

  // File extensions to consider for module resolution
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js', 
    'jsx',
    'json',
    'node'
  ],

  // Enable coverage collection
  collectCoverage: true,

  // Files to include in coverage report
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/vite-env.d.ts',
    '!src/main.tsx'
  ],

  // Coverage thresholds to enforce
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test timeout in milliseconds
  testTimeout: 10000,

  // Global configuration for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    }
  },

  // Additional test environment settings
  testEnvironmentOptions: {
    // Custom DOM environment options
    url: 'http://localhost',
    customExportConditions: ['node', 'node-addons'],
  },

  // Watch plugin configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Ignore patterns for test running
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],

  // Clear mocks between each test
  clearMocks: true,

  // Reset mocks between each test
  resetMocks: true,

  // Restore mocks between each test
  restoreMocks: true,

  // Enable verbose test output
  verbose: true,

  // Error handling configuration
  bail: 1,
  
  // Maximum number of concurrent workers
  maxWorkers: '50%'
};

export default config;