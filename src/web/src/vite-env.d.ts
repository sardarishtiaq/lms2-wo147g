/// <reference types="vite/client" />

/**
 * Extended environment variables interface for Vite
 * Provides type-safe access to environment variables throughout the application
 * @version 4.4.0
 */
interface ImportMetaEnv {
  /**
   * Backend API base URL for all HTTP requests
   * Format: https://api.example.com/v1
   */
  readonly VITE_API_URL: string;

  /**
   * WebSocket server URL for real-time updates
   * Format: wss://ws.example.com
   */
  readonly VITE_WS_URL: string;

  /**
   * Application title for consistent branding
   */
  readonly VITE_APP_TITLE: string;

  /**
   * Current environment mode
   * @example 'development' | 'production' | 'staging'
   */
  readonly MODE: string;

  /**
   * Flag indicating development environment
   */
  readonly DEV: boolean;

  /**
   * Flag indicating production environment
   */
  readonly PROD: boolean;

  /**
   * Flag indicating server-side rendering mode
   */
  readonly SSR: boolean;
}

/**
 * Extends ImportMeta interface to include env property
 * Provides IntelliSense support for environment variables
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Global application version constant
 * Injected by Vite during build process
 */
declare const __APP_VERSION__: string;

/**
 * Ensures type safety for static asset imports
 */
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

/**
 * Type definitions for style modules
 */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.sass' {
  const classes: { readonly [key: string]: string };
  export default classes;
}