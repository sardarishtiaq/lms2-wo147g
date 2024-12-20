# Multi-tenant CRM Backend Service

Enterprise-grade backend service for the Multi-tenant CRM system built with Node.js, Express, and TypeScript.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development](#development)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [Performance](#performance)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

## Overview

The Multi-tenant CRM backend service provides comprehensive lead management capabilities through a microservices architecture. Built with Node.js 18.x LTS and Express 4.18.x, it supports sophisticated lead tracking, qualification, and conversion through a 12-stage pipeline process.

### Key Features
- Multi-tenant architecture with complete data isolation
- Comprehensive lead management system with 12 categories
- Real-time collaboration using Socket.IO
- Secure authentication and authorization
- Scalable microservices architecture
- Integrated monitoring and logging

## Prerequisites

Required software and tools:

- Node.js >= 18.0.0 LTS
- Docker >= 20.10.x
- MongoDB >= 6.0
- Redis >= 7.0
- Git >= 2.x

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/organization/crm-system.git
cd crm-system/backend
```

2. Install dependencies:
```bash
npm ci
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start development environment:
```bash
docker-compose up -d
npm run dev
```

## Project Structure

```
src/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── middleware/     # Custom middleware
├── models/         # Database models
├── services/       # Business logic
├── utils/         # Utility functions
├── routes/        # API routes
├── types/         # TypeScript type definitions
└── index.ts       # Application entry point
```

## Development

### TypeScript Configuration

Using TypeScript 4.9.x with strict type checking. Configuration details in `tsconfig.json`:

- Target: ES2022
- Module: CommonJS
- Strict type checking enabled
- Path aliases configured
- Source maps enabled

### Docker Development Environment

Development environment configured using Docker Compose with:

- Node.js 18 Alpine-based container
- MongoDB 6.0 with authentication
- Redis 7.0 for caching
- Automatic service health checks
- Volume mounting for hot reloading

### Available Scripts

```bash
npm run dev         # Start development server
npm run build      # Build production bundle
npm run test       # Run test suite
npm run lint       # Run ESLint
npm run format     # Format code with Prettier
```

## Security

### Authentication

- JWT-based authentication using jsonwebtoken@9.0.0
- Refresh token rotation
- Rate limiting with express-rate-limit@6.x
- CSRF protection with csurf@1.11.0

### Authorization

Role-based access control (RBAC) with four levels:
- Admin: Full system access
- Manager: Lead and quote management
- Agent: Assigned leads only
- Viewer: Read-only access

### Data Protection

- Field-level encryption for sensitive data
- TLS 1.3 for transport security
- Helmet@7.0.0 for HTTP security headers
- MongoDB authentication and encryption at rest
- Redis password protection

## Testing

Comprehensive testing setup using Jest@29.0.0:

```bash
npm run test           # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Generate coverage report
```

### Test Types
- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical flows
- Security testing with npm audit

## Deployment

### Production Build

```bash
npm run build        # Build TypeScript
npm run docker:build # Build Docker image
```

### Container Configuration

Production Docker image features:
- Multi-stage build process
- Non-root user execution
- Resource constraints
- Health checks
- Security scanning

### CI/CD Pipeline

Automated pipeline using GitHub Actions:
1. Code quality checks
2. Security scanning
3. Test execution
4. Docker image building
5. Deployment to staging/production

## Performance

### Optimization Strategies

- Redis caching with ioredis@5.x
- MongoDB query optimization
- Rate limiting and request throttling
- Compression middleware
- Static asset caching

### Monitoring

- Prometheus metrics with prom-client@14.2.0
- Winston logging with daily rotation
- DataDog integration for metrics
- Health check endpoints

## API Documentation

### Authentication Endpoints

```typescript
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

### Lead Management Endpoints

```typescript
GET    /api/v1/leads
POST   /api/v1/leads
GET    /api/v1/leads/:id
PUT    /api/v1/leads/:id
DELETE /api/v1/leads/:id
```

### Quote Management Endpoints

```typescript
GET    /api/v1/quotes
POST   /api/v1/quotes
GET    /api/v1/quotes/:id
PUT    /api/v1/quotes/:id
DELETE /api/v1/quotes/:id
```

## Troubleshooting

### Common Issues

1. Connection Issues
```bash
# Check service health
docker-compose ps
# View logs
docker-compose logs -f api
```

2. Performance Issues
```bash
# Monitor resource usage
docker stats
# Check MongoDB indexes
npm run db:analyze
```

3. Authentication Issues
```bash
# Clear Redis sessions
npm run cache:clear
# Verify JWT secret
npm run verify:env
```

### Support

For additional support:
- Check issue tracker
- Review documentation
- Contact development team

## License

MIT License - see LICENSE file for details