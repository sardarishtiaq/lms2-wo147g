## Pull Request Title
<!-- Format: [<type>] <scope>: <description> -->
<!-- Example: [feat] tenant-isolation: Add tenant context middleware -->

## Description

### Changes Made
<!-- Provide a detailed description of the changes implemented -->
<!-- Include specific details about tenant-related changes -->

### Tenant Impact
<!-- Describe how these changes affect tenant isolation and data security -->
- [ ] No impact on tenant isolation
- [ ] Changes to tenant isolation mechanisms
- [ ] New tenant-specific feature
- [ ] Tenant data model changes

### Related Issues
<!-- Link related issues using #<issue_number> -->
Fixes #

## Type of Change
<!-- Check all that apply -->
- [ ] New feature (tenant-aware)
- [ ] Bug fix (tenant-specific)
- [ ] Performance improvement (multi-tenant)
- [ ] Security enhancement (tenant isolation)
- [ ] Documentation update
- [ ] Code refactoring
- [ ] Configuration change
- [ ] CI/CD improvement

## Testing

### Tenant Isolation Testing
<!-- Describe how tenant isolation was verified -->
- [ ] Verified data isolation between tenants
- [ ] Tested tenant context propagation
- [ ] Validated tenant-specific configurations
- [ ] Checked cross-tenant access controls

### Security Testing
<!-- Describe security validation performed -->
- [ ] Performed security static analysis
- [ ] Validated authentication/authorization
- [ ] Checked for potential data leaks
- [ ] Reviewed API security controls

### Performance Testing
<!-- Describe multi-tenant performance impact -->
- [ ] Load tested with multiple tenants
- [ ] Measured response times under load
- [ ] Verified resource isolation
- [ ] Checked memory/CPU usage

### Test Coverage
<!-- Check all completed test types -->
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Tenant isolation tests
- [ ] Security tests
- [ ] Performance tests

## Checklist
- [ ] PR title follows conventional commit format
- [ ] Code follows project style guidelines
- [ ] Documentation has been updated
- [ ] All tests are passing
- [ ] Security review completed
- [ ] Performance impact assessed
- [ ] Breaking changes documented
- [ ] Required CI checks passed

## Security Considerations
<!-- List security implications and mitigations -->
- [ ] Changes reviewed for security impact
- [ ] Tenant data access patterns validated
- [ ] Security best practices followed
- [ ] No sensitive data exposed

## Performance Considerations
<!-- Describe performance impact on multi-tenant system -->
- [ ] Database query optimization
- [ ] Caching strategy review
- [ ] Resource utilization analysis
- [ ] Scalability assessment

## Additional Notes
<!-- Any additional information that reviewers should know -->

## Reviewer Guidelines
Please verify:
1. Tenant isolation is maintained
2. Security controls are properly implemented
3. Performance impact is acceptable
4. Code quality meets standards
5. Test coverage is sufficient

<!-- 
Note: PRs affecting tenant isolation or security require approval from:
- Security team member
- Senior backend engineer
- System architect
-->