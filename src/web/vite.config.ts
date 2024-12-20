import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.0

export default defineConfig({
  // React plugin configuration with Fast Refresh enabled
  plugins: [
    react({
      fastRefresh: true,
      // Enable runtime JSX transform
      jsxRuntime: 'automatic',
      // Include development-only features in dev mode
      include: '**/*.{jsx,tsx}',
    }),
    // Enable TypeScript path aliases
    tsconfigPaths(),
  ],

  // Development server configuration
  server: {
    port: 3000,
    host: true, // Listen on all local IPs
    proxy: {
      // Proxy API requests to backend server
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      // WebSocket proxy for real-time features
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
    hmr: {
      overlay: true, // Show errors as overlay
    },
  },

  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true, // Generate source maps for debugging
    minify: 'terser', // Use Terser for minification
    target: 'es2022', // Target modern browsers
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal loading
        manualChunks: {
          // Core React dependencies
          vendor: [
            'react',
            'react-dom',
            'react-router-dom',
          ],
          // Material-UI components
          mui: [
            '@mui/material',
            '@mui/icons-material',
          ],
          // State management
          redux: [
            '@reduxjs/toolkit',
            'react-redux',
          ],
          // Data fetching
          query: [
            '@tanstack/react-query',
          ],
        },
      },
    },
    reportCompressedSize: true, // Report gzipped bundle size
    chunkSizeWarningLimit: 1000, // Set warning limit to 1MB
  },

  // Path resolution configuration
  resolve: {
    alias: {
      '@': '/src', // Enable @ imports from src directory
    },
  },

  // Global constants definition
  define: {
    __APP_VERSION__: 'JSON.stringify(process.env.npm_package_version)',
    __DEV__: "process.env.NODE_ENV === 'development'",
  },

  // ESBuild configuration
  esbuild: {
    jsxInject: "import React from 'react'", // Automatic React import
    target: 'es2022', // Target modern JavaScript features
  },

  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mui/material',
      '@reduxjs/toolkit',
      '@tanstack/react-query',
    ],
  },

  // CSS configuration
  css: {
    modules: {
      localsConvention: 'camelCase', // Use camelCase for CSS modules
    },
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@/styles/variables.scss";',
      },
    },
  },

  // Preview server configuration
  preview: {
    port: 3000,
    host: true,
  },

  // Environment variables configuration
  envPrefix: 'VITE_', // Only expose env vars with VITE_ prefix
});