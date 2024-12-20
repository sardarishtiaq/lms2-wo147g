# Multi-tenant CRM Frontend Application

Enterprise-grade React application for the Multi-tenant CRM system providing comprehensive lead management capabilities across diverse organizations.

## Project Overview

A sophisticated React-based frontend application built with modern technologies to deliver a robust lead management system with the following key features:

- Multi-tenant architecture with strict data isolation
- Comprehensive 12-stage lead pipeline management
- Real-time collaboration and notifications
- Integrated quote management system
- Advanced analytics and reporting dashboard

### Tech Stack

- React 18.2.0 - Modern UI development
- Material-UI 5.14.0 - Enterprise-grade component library
- Redux Toolkit 1.9.5 - State management
- React Query 4.0.0 - Server state management
- TypeScript 5.0.0 - Type safety and developer productivity
- Vite 4.4.0 - Next generation frontend tooling

## Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0

### Recommended VS Code Extensions

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Material-UI Snippets
- Jest Runner

## Getting Started

1. Clone the repository
```bash
git clone <repository-url>
cd src/web
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
```

Required environment variables:
- `VITE_API_URL`: Backend API endpoint
- `VITE_WS_URL`: WebSocket server URL
- `VITE_AUTH_DOMAIN`: Authentication service domain

Optional:
- `VITE_TENANT_ID`: Default tenant ID for development

4. Start development server
```bash
npm run dev
```

## Project Structure

```
src/web/
├── src/
│   ├── assets/          # Static assets
│   ├── components/      # Reusable UI components
│   ├── features/        # Feature-based modules
│   ├── hooks/          # Custom React hooks
│   ├── layouts/        # Page layouts
│   ├── lib/            # Utility functions
│   ├── pages/          # Route components
│   ├── services/       # API services
│   ├── store/          # Redux store configuration
│   ├── styles/         # Global styles
│   └── types/          # TypeScript declarations
├── public/             # Public assets
├── tests/              # Test files
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite configuration
└── jest.config.js      # Jest configuration
```

## Development Guidelines

### TypeScript Best Practices

- Use strict type checking
- Leverage interface inheritance
- Implement proper error handling
- Use discriminated unions for state management

### Component Patterns

- Implement atomic design principles
- Use functional components with hooks
- Follow container/presenter pattern
- Implement proper prop typing

### State Management

- Use Redux Toolkit for global state
- Implement React Query for server state
- Use local state for UI-specific state
- Implement proper state normalization

## Testing Strategy

### Unit Testing
```bash
npm run test:unit
```
- Test individual components
- Mock external dependencies
- Verify component behavior

### Integration Testing
```bash
npm run test:integration
```
- Test component interactions
- Verify feature workflows
- Test Redux store integration

### E2E Testing
```bash
npm run test:e2e
```
- Test complete user flows
- Verify multi-tenant scenarios
- Test real-time features

## Security Considerations

- Implement proper JWT handling
- Use secure HTTP-only cookies
- Implement proper CORS configuration
- Follow tenant isolation best practices
- Sanitize user inputs
- Implement proper role-based access control

## Performance Optimization

- Implement code splitting
- Use React.lazy for route-based splitting
- Implement proper caching strategies
- Use proper bundle optimization
- Implement proper asset optimization

## Build and Deployment

### Production Build
```bash
npm run build
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Environment-specific Builds
```bash
npm run build:staging
npm run build:production
```

## Browser Support

### Production
- \>0.2%
- not dead
- not op_mini all

### Development
- last 1 chrome version
- last 1 firefox version
- last 1 safari version

## Troubleshooting

### Common Issues

1. Environment Variables
- Verify .env file configuration
- Check variable naming convention
- Verify API endpoint accessibility

2. Build Issues
- Clear node_modules and reinstall
- Verify TypeScript configuration
- Check for circular dependencies

3. Runtime Issues
- Check browser console errors
- Verify API responses
- Check WebSocket connectivity

### Debugging

1. Development Tools
- Use React Developer Tools
- Use Redux DevTools
- Use Network tab for API issues

2. Logging
- Check application logs
- Verify error boundaries
- Check API response logs

## Contributing

1. Follow Git workflow
2. Implement proper testing
3. Follow code style guidelines
4. Submit detailed PR descriptions

## License

Proprietary - All rights reserved