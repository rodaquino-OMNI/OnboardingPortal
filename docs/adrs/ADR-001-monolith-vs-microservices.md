# ADR-001: Monolith vs Microservices Architecture

**Status:** Accepted
**Date:** 2025-09-30
**Decision Makers:** Lead Architect, CTO, Development Team
**Consulted:** DevOps Team, Security Team

---

## Context

The AUSTA OnboardingPortal requires an architectural approach that balances rapid development, maintainability, and future scalability. We need to decide between a monolithic architecture, microservices architecture, or a hybrid approach.

### Requirements
- **Time to Market**: Launch within 24 weeks
- **Team Size**: 6-8 developers (small team)
- **Complexity**: Multiple integrated features (onboarding, health assessment, document processing, telemedicine)
- **Scalability**: Support 100,000+ concurrent users
- **Compliance**: HIPAA and LGPD requirements with comprehensive audit logging

---

## Decision

**We will adopt a Laravel Modular Monolith with API-First Design.**

This means:
1. Single Laravel 10 application with clear module boundaries
2. RESTful API-first approach for all business logic
3. Stateless architecture enabling future microservices migration
4. Shared database with proper schema design and data isolation

---

## Rationale

### Why NOT Pure Microservices?

| Concern | Impact |
|---------|--------|
| **Operational Complexity** | Managing multiple services, databases, and deployment pipelines would require 3-4 dedicated DevOps engineers we don't have |
| **Development Overhead** | Distributed tracing, inter-service communication, and eventual consistency add 40-60% development time |
| **Debugging Difficulty** | Distributed systems make root cause analysis significantly harder, especially for healthcare compliance issues |
| **Team Size** | Our 6-8 person team would spend more time on infrastructure than features |
| **Cost** | Additional infrastructure for service mesh, API gateway, multiple databases would exceed budget by 200% |

### Why Modular Monolith?

| Benefit | Impact |
|---------|--------|
| **Rapid Development** | Single deployment pipeline, shared code, faster feature delivery |
| **Easier Debugging** | Single log stream, single database, simpler transaction management |
| **ACID Guarantees** | Critical for financial and health data integrity |
| **Lower Operational Cost** | Single application to deploy, monitor, and scale |
| **Team Efficiency** | Developers can work across features without service boundaries |
| **Atomic Transactions** | User onboarding requires atomic operations across multiple tables |

### Why API-First Approach?

| Advantage | Future-Proofing |
|-----------|-----------------|
| **Clean Boundaries** | Clear module interfaces make future extraction to microservices easier |
| **Multiple Clients** | RESTful API supports web, mobile, admin dashboards equally |
| **Testability** | API contracts enable comprehensive integration testing |
| **Documentation** | OpenAPI specification serves as living documentation |
| **Gradual Migration** | When needed, modules can be extracted to microservices one at a time |

---

## Alternatives Considered

### Alternative 1: Pure Microservices from Day 1

**Pros:**
- Independent scaling of services
- Technology flexibility per service
- Fault isolation

**Cons:**
- 2-3x development time
- Requires 3-4 dedicated DevOps engineers
- Complex distributed debugging
- Eventual consistency challenges for healthcare data
- Network latency between services
- **Decision:** ❌ Rejected - Too complex for team size and timeline

### Alternative 2: Serverless (AWS Lambda)

**Pros:**
- No server management
- Pay-per-execution pricing
- Automatic scaling

**Cons:**
- Cold start latency (2-5 seconds)
- Stateful operations difficult (onboarding flow)
- Vendor lock-in to AWS
- Limited execution time (15 minutes)
- Difficult local development experience
- **Decision:** ❌ Rejected - Not suitable for complex healthcare workflows

### Alternative 3: Hybrid Approach (Monolith + Selective Microservices)

**Pros:**
- Core business logic in monolith
- Resource-intensive services (OCR, AI) as microservices

**Cons:**
- Added complexity without significant benefit at this scale
- Two deployment pipelines to maintain
- Mixed debugging approaches
- **Decision:** ⚠️ Considered for Phase 2 if OCR/AI becomes bottleneck

---

## Implementation Details

### Module Structure

```
backend/
├── app/
│   ├── Modules/
│   │   ├── Authentication/        # User auth, session management
│   │   ├── Onboarding/            # Multi-step onboarding orchestration
│   │   ├── HealthAssessment/      # Health questionnaire, risk scoring
│   │   ├── DocumentProcessing/    # OCR, document validation
│   │   ├── Scheduling/            # Interview and telemedicine booking
│   │   ├── Gamification/          # Points, badges, rewards
│   │   ├── Telemedicine/          # Video consultation integration
│   │   └── AdminDashboard/        # Analytics and administration
│   │
│   ├── Shared/                    # Cross-module utilities
│   │   ├── Services/
│   │   ├── Repositories/
│   │   └── Traits/
│   │
│   └── Http/
│       ├── Controllers/Api/       # RESTful API endpoints
│       └── Middleware/            # Authentication, rate limiting
```

### Module Communication Rules

1. **Inter-Module Communication:**
   - Use service classes, NOT direct model access
   - Events for asynchronous communication
   - NO circular dependencies

2. **Data Access:**
   - Repository pattern for database abstraction
   - Each module owns its database tables
   - Shared tables (users) accessed via service layer

3. **API Design:**
   - RESTful conventions
   - Versioned endpoints (/api/v1/)
   - OpenAPI documentation

---

## Consequences

### Positive

- ✅ **Faster Time to Market**: Single deployment pipeline accelerates development
- ✅ **Lower Operational Complexity**: One application to deploy and monitor
- ✅ **ACID Transactions**: Healthcare data consistency guaranteed
- ✅ **Easier Debugging**: Single log stream, single database
- ✅ **Cost Efficiency**: Lower infrastructure costs in Phase 1
- ✅ **Team Productivity**: Developers can work across features without service boundaries

### Negative

- ⚠️ **Scaling Limitations**: Cannot scale modules independently (mitigated by horizontal scaling)
- ⚠️ **Technology Lock-in**: Harder to use different languages per module
- ⚠️ **Deployment Coupling**: All modules deploy together (mitigated by feature flags)
- ⚠️ **Database Bottleneck**: Shared database could become bottleneck at scale (mitigated by read replicas)

### Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Database becomes bottleneck** | Medium | High | - Implement read replicas<br>- Use Redis caching aggressively<br>- Database query optimization |
| **Module boundaries blur** | Medium | Medium | - Enforce architectural reviews<br>- Automated dependency checks<br>- Clear module ownership |
| **Difficult to extract microservices later** | Low | Medium | - Maintain clear API boundaries<br>- Use service layer abstraction<br>- Document module dependencies |

---

## Migration Path to Microservices (Future)

If needed in Phase 2/3, extraction strategy:

```
Phase 1 (Current):
┌─────────────────────────────────┐
│  Laravel Monolith Application    │
│  - All modules in single app     │
│  - Shared database               │
└─────────────────────────────────┘

Phase 2 (If OCR becomes bottleneck):
┌─────────────────────────┐     ┌──────────────────┐
│  Laravel Core           │────▶│  OCR Service     │
│  - Onboarding           │     │  (Go/Python)     │
│  - Health               │     │  - AWS Textract  │
│  - Scheduling           │     │  - Tesseract     │
└─────────────────────────┘     └──────────────────┘

Phase 3 (If AI becomes bottleneck):
┌─────────────────┐  ┌─────────┐  ┌──────────┐
│  Laravel Core   │─▶│  OCR    │  │  AI      │
│  - Core logic   │  │ Service │  │ Service  │
└─────────────────┘  └─────────┘  └──────────┘
```

**Extraction Criteria:**
1. Service handles >50% of total processing time
2. Service needs independent scaling (10x+ of rest)
3. Clear team ownership for extracted service
4. Business justification for added complexity

---

## Compliance Considerations

### HIPAA Requirements

✅ **Administrative Safeguards**: Monolith simplifies access control auditing
✅ **Physical Safeguards**: Single application reduces attack surface
✅ **Technical Safeguards**: Centralized encryption, audit logging, authentication
✅ **Audit Controls**: Single database for comprehensive audit trail

### LGPD Requirements

✅ **Data Minimization**: Clear module boundaries enforce collection limits
✅ **Consent Management**: Centralized consent tracking across modules
✅ **Right to Erasure**: Single database simplifies data deletion
✅ **Data Portability**: API-first design enables easy data export

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Deployment Frequency** | Daily to staging, weekly to production | CI/CD pipeline metrics |
| **Mean Time to Recovery** | < 1 hour | Incident response metrics |
| **Developer Productivity** | 2+ features per sprint per developer | Sprint velocity |
| **API Response Time** | < 500ms p95 | CloudWatch metrics |
| **Cost per User** | < $0.10/month | AWS cost explorer |

---

## References

- [The Majestic Monolith by DHH](https://signalvnoise.com/svn3/the-majestic-monolith/)
- [Monolith First by Martin Fowler](https://martinfowler.com/bliki/MonolithFirst.html)
- [When to Use Microservices (And When Not To!)](https://content.pivotal.io/blog/when-to-use-microservices-and-when-not-to)
- [Laravel Beyond CRUD](https://laravel-beyond-crud.com/)

---

## Approval

| Role | Name | Decision | Date | Signature |
|------|------|----------|------|-----------|
| **CTO** | [Name] | Approved | 2025-09-30 | ✓ |
| **Lead Architect** | [Name] | Approved | 2025-09-30 | ✓ |
| **DevOps Lead** | [Name] | Approved | 2025-09-30 | ✓ |
| **Security Officer** | [Name] | Approved with conditions* | 2025-09-30 | ✓ |

*Condition: Security audit required before Phase 2 microservices extraction

---

**Next Steps:**
1. Set up Laravel project structure with module directories
2. Define API contracts with OpenAPI specification
3. Implement repository pattern for data access
4. Configure CI/CD pipeline for monolith deployment
5. Schedule quarterly architecture review to assess microservices need
