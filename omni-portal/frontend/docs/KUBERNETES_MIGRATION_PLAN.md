# Kubernetes Migration Plan - AUSTA OnboardingPortal

## Executive Summary
Migration plan to deploy the AUSTA OnboardingPortal on Kubernetes for improved scalability, reliability, and operational excellence.

## Current State
- Docker Compose deployment
- Single-node architecture
- Manual scaling and monitoring
- Basic health checks

## Target State
- Kubernetes orchestration
- Multi-node high availability
- Auto-scaling based on metrics
- Comprehensive observability

## Migration Phases

### Phase 1: Infrastructure Preparation (Week 1-2)

#### 1.1 Kubernetes Cluster Setup
```yaml
# Cluster Requirements
- Nodes: 3 master, 5 worker minimum
- CPU: 16 vCPU per worker node
- Memory: 32GB per worker node
- Storage: 500GB SSD per node
- Network: 10Gbps interconnect
```

#### 1.2 Essential Services
- **Ingress Controller**: NGINX Ingress
- **Service Mesh**: Istio for traffic management
- **Storage**: Persistent Volume provisioning
- **DNS**: External-DNS for route management
- **Certificate Manager**: cert-manager for TLS

### Phase 2: Application Containerization (Week 2-3)

#### 2.1 Frontend Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: omni-portal
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: omni-portal/frontend:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

#### 2.2 Backend Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: omni-portal
spec:
  replicas: 5
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: omni-portal/backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DB_CONNECTION
          value: mysql
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: host
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

### Phase 3: Database Migration (Week 3-4)

#### 3.1 MySQL StatefulSet
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
  namespace: omni-portal
spec:
  serviceName: mysql
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
      - name: mysql
        image: mysql:8.0
        env:
        - name: MYSQL_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mysql-secret
              key: root-password
        volumeMounts:
        - name: mysql-data
          mountPath: /var/lib/mysql
  volumeClaimTemplates:
  - metadata:
      name: mysql-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 100Gi
```

#### 3.2 Redis Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: omni-portal
spec:
  replicas: 3
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command: ["redis-server", "--appendonly", "yes"]
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-data
          mountPath: /data
```

### Phase 4: Networking & Security (Week 4-5)

#### 4.1 Service Configuration
```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: omni-portal
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: omni-portal
spec:
  selector:
    app: backend
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP
```

#### 4.2 Ingress Configuration
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: omni-portal-ingress
  namespace: omni-portal
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - portal.austa.com.br
    secretName: omni-portal-tls
  rules:
  - host: portal.austa.com.br
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
```

### Phase 5: Observability Stack (Week 5-6)

#### 5.1 Prometheus Monitoring
```yaml
apiVersion: v1
kind: ServiceMonitor
metadata:
  name: omni-portal-metrics
  namespace: omni-portal
spec:
  selector:
    matchLabels:
      app: omni-portal
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

#### 5.2 Grafana Dashboards
- Application metrics dashboard
- Business metrics dashboard
- Infrastructure dashboard
- SLA compliance dashboard

#### 5.3 Logging with Loki
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: omni-portal
data:
  fluent-bit.conf: |
    [OUTPUT]
        Name loki
        Match *
        Host loki.monitoring.svc.cluster.local
        Port 3100
        Labels job=omni-portal
```

### Phase 6: Auto-scaling Configuration (Week 6)

#### 6.1 Horizontal Pod Autoscaler
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: frontend-hpa
  namespace: omni-portal
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: frontend
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### 6.2 Vertical Pod Autoscaler
```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: backend-vpa
  namespace: omni-portal
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  updatePolicy:
    updateMode: "Auto"
```

### Phase 7: CI/CD Integration (Week 7)

#### 7.1 GitOps with ArgoCD
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: omni-portal
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/austa/omni-portal
    targetRevision: HEAD
    path: k8s/
  destination:
    server: https://kubernetes.default.svc
    namespace: omni-portal
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

#### 7.2 GitHub Actions Deployment
```yaml
name: Deploy to Kubernetes
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Build and Push Docker Images
      run: |
        docker build -t omni-portal/frontend:${{ github.sha }} ./frontend
        docker build -t omni-portal/backend:${{ github.sha }} ./backend
        docker push omni-portal/frontend:${{ github.sha }}
        docker push omni-portal/backend:${{ github.sha }}
    - name: Update Kubernetes Manifests
      run: |
        kubectl set image deployment/frontend frontend=omni-portal/frontend:${{ github.sha }}
        kubectl set image deployment/backend backend=omni-portal/backend:${{ github.sha }}
```

### Phase 8: Disaster Recovery (Week 8)

#### 8.1 Backup Strategy
- **Database**: Daily automated backups to S3
- **Persistent Volumes**: Snapshot every 6 hours
- **Configuration**: GitOps ensures configuration recovery
- **Secrets**: Sealed Secrets with backup to secure vault

#### 8.2 Multi-Region Setup
```yaml
apiVersion: v1
kind: Service
metadata:
  name: global-load-balancer
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
spec:
  type: LoadBalancer
  selector:
    app: omni-portal
  ports:
  - port: 443
    targetPort: 443
```

## Migration Checklist

### Pre-Migration
- [ ] Kubernetes cluster provisioned
- [ ] Container registry setup
- [ ] Secrets management configured
- [ ] Network policies defined
- [ ] RBAC policies created
- [ ] Backup procedures tested

### During Migration
- [ ] Database migration completed
- [ ] Application deployments verified
- [ ] Service discovery working
- [ ] Ingress routing functional
- [ ] SSL certificates valid
- [ ] Monitoring collecting metrics
- [ ] Logs aggregating properly

### Post-Migration
- [ ] Performance benchmarks met
- [ ] Auto-scaling tested
- [ ] Disaster recovery validated
- [ ] Documentation updated
- [ ] Team training completed
- [ ] Runbooks created

## Resource Requirements

### Development Environment
- 1 master node (2 vCPU, 4GB RAM)
- 2 worker nodes (4 vCPU, 8GB RAM each)
- 100GB total storage

### Staging Environment
- 3 master nodes (4 vCPU, 8GB RAM each)
- 3 worker nodes (8 vCPU, 16GB RAM each)
- 500GB total storage

### Production Environment
- 3 master nodes (8 vCPU, 16GB RAM each)
- 5+ worker nodes (16 vCPU, 32GB RAM each)
- 2TB+ total storage
- Multi-AZ deployment
- Auto-scaling enabled

## Cost Estimation

### AWS EKS (Monthly)
- Control Plane: $73
- Worker Nodes (5x m5.2xlarge): $960
- Load Balancer: $25
- Storage (2TB EBS): $200
- Data Transfer: $100
- **Total: ~$1,358/month**

### GKE (Monthly)
- Control Plane: Free (one zonal cluster)
- Worker Nodes (5x n2-standard-8): $970
- Load Balancer: $25
- Storage (2TB PD): $170
- Data Transfer: $100
- **Total: ~$1,265/month**

### On-Premise (One-time + Monthly)
- Hardware: $25,000 (one-time)
- Licensing: $500/month
- Maintenance: $200/month
- Power/Cooling: $300/month
- **Total: $25,000 + $1,000/month**

## Risk Mitigation

### Technical Risks
1. **Data Loss**: Implement automated backups and test recovery procedures
2. **Service Downtime**: Use blue-green deployments and canary releases
3. **Performance Degradation**: Implement comprehensive monitoring and alerting
4. **Security Breaches**: Use network policies, RBAC, and security scanning

### Operational Risks
1. **Knowledge Gap**: Provide team training and documentation
2. **Complexity**: Start with simple deployments, gradually add features
3. **Cost Overrun**: Implement resource quotas and cost monitoring
4. **Vendor Lock-in**: Use standard Kubernetes APIs, avoid proprietary features

## Success Metrics

### Technical Metrics
- 99.95% uptime SLA
- < 200ms p95 latency
- < 5 minute recovery time
- Zero data loss
- 100% automated deployments

### Business Metrics
- 40% reduction in operational costs
- 60% faster deployment cycles
- 80% reduction in manual operations
- 100% compliance with regulations
- 50% improvement in developer productivity

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | 2 weeks | Kubernetes cluster ready |
| Phase 2 | 1 week | Applications containerized |
| Phase 3 | 1 week | Databases migrated |
| Phase 4 | 1 week | Networking configured |
| Phase 5 | 1 week | Monitoring operational |
| Phase 6 | 1 week | Auto-scaling active |
| Phase 7 | 1 week | CI/CD integrated |
| Phase 8 | 1 week | DR procedures tested |

**Total Duration: 8 weeks**

## Conclusion

This migration plan provides a structured approach to moving the AUSTA OnboardingPortal to Kubernetes. The phased approach minimizes risk while ensuring all critical components are properly migrated and tested. The investment in Kubernetes will provide long-term benefits in scalability, reliability, and operational efficiency.