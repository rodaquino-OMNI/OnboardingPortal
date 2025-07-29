# Migration Strategy: Unified Questionnaire Architecture

## Overview

This document outlines the strategy for migrating from the current 14 separate questionnaire components to a unified, extensible architecture. The migration will be performed incrementally to minimize disruption while maximizing code reuse.

## Current State Analysis

### Existing Components
1. **SmartHealthQuestionnaire** - Original implementation
2. **EnhancedHealthQuestionnaire** - UX-focused with better engagement
3. **SimpleHealthQuestionnaire** - Minimal version for quick assessments
4. **UnifiedHealthAssessment** - Attempted unification
5. **ProgressiveHealthScreening** - Layer-based approach
6. **ClinicalExcellenceQuestionnaire** - Medical-grade rigor
7. **ConversationalSessionComponent** - Chat-like interface
8. **DualPathwayHealthAssessment** - Dual-mode system
9. **HealthSessionDashboard** - Session management
10. **IntelligentPathwayRouter** - Smart routing between modes
11. **ImmersivePathwayExperience** - Rich user experience
12. **MobileHealthQuestionnaire** - Mobile-optimized
13. **MobilePWAWrapper** - PWA wrapper
14. **ErrorBoundary** - Error handling

### Key Features to Preserve
- Progressive disclosure logic
- Clinical validation instruments (PHQ-9, GAD-7, etc.)
- Fraud detection mechanisms
- Conversational UI patterns
- Mobile optimization
- Session persistence
- Intelligent routing
- Gamification elements
- Accessibility features
- Multi-language support

## Migration Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Establish core infrastructure without breaking existing functionality

1. **Create Core Engine**
   ```typescript
   // Step 1: Implement base QuestionnaireEngine
   export class StandardQuestionnaireEngine implements QuestionnaireEngine {
     // Core implementation
   }
   
   // Step 2: Register built-in features
   QuestionnaireFactory.registerFeature(new ProgressiveDisclosureFeature());
   QuestionnaireFactory.registerFeature(new ClinicalValidationFeature());
   // ... other features
   
   // Step 3: Register rendering strategies
   QuestionnaireFactory.registerStrategy(new ConversationalStrategy());
   QuestionnaireFactory.registerStrategy(new ClinicalStrategy());
   // ... other strategies
   ```

2. **Create Adapter Layer**
   - Build `LegacyQuestionnaireAdapter` for existing components
   - Ensure backward compatibility
   - Map legacy props to unified config

3. **Setup Feature Registry**
   - Extract features from existing components
   - Create feature implementations
   - Test feature isolation

### Phase 2: Component Migration (Week 3-4)
**Goal**: Migrate components one by one using adapter pattern

1. **Priority Order** (based on complexity and usage):
   - SimpleHealthQuestionnaire → StandardStrategy
   - SmartHealthQuestionnaire → StandardStrategy + Features
   - ConversationalSessionComponent → ConversationalStrategy
   - ClinicalExcellenceQuestionnaire → ClinicalStrategy
   - MobileHealthQuestionnaire → MobileOptimizedStrategy

2. **Migration Template**
   ```typescript
   // Old component
   export function OldQuestionnaire(props: OldProps) {
     // Existing implementation
   }
   
   // New wrapper during migration
   export function OldQuestionnaire(props: OldProps) {
     const config = mapPropsToConfig(props);
     const engine = QuestionnaireFactory.createEngine(config);
     
     return <UnifiedQuestionnaire engine={engine} />;
   }
   ```

3. **Feature Extraction Pattern**
   ```typescript
   // Extract feature from existing component
   class ExtractedFeature extends BaseFeature {
     constructor() {
       super('extracted_feature', 'Extracted Feature', 'Description');
     }
     
     async beforeQuestion(question: Question, context: QuestionnaireContext) {
       // Logic extracted from original component
       return question;
     }
   }
   ```

### Phase 3: Unification (Week 5-6)
**Goal**: Replace all legacy components with unified implementation

1. **Create Unified Component**
   ```typescript
   export function UnifiedQuestionnaire({ config }: { config: QuestionnaireConfig }) {
     const [engine] = useState(() => QuestionnaireFactory.createEngine(config));
     const [state, setState] = useState<QuestionnaireState>();
     
     // Unified implementation using engine
     return <QuestionnaireRenderer engine={engine} state={state} />;
   }
   ```

2. **Route Consolidation**
   - Replace `IntelligentPathwayRouter` with configuration-based routing
   - Use feature flags for pathway selection
   - Implement pathway selection as a feature

3. **Session Management**
   - Consolidate session handling into persistence feature
   - Migrate dashboard functionality to monitoring feature

### Phase 4: Optimization (Week 7-8)
**Goal**: Optimize performance and remove redundancy

1. **Code Cleanup**
   - Remove deprecated components
   - Consolidate duplicate logic
   - Optimize bundle size

2. **Performance Optimization**
   - Implement lazy loading for features
   - Optimize re-renders with memoization
   - Add performance monitoring

3. **Testing Suite**
   - Comprehensive unit tests for engine
   - Integration tests for features
   - E2E tests for user journeys

## Implementation Examples

### Example 1: Migrating Simple Questionnaire
```typescript
// Before
export function SimpleHealthQuestionnaire({ onComplete }: Props) {
  const [responses, setResponses] = useState({});
  // Simple implementation
}

// After
export function SimpleHealthQuestionnaire({ onComplete }: Props) {
  const config = new QuestionnaireBuilder('simple-health')
    .withMetadata({
      title: 'Quick Health Check',
      purpose: 'onboarding',
      estimatedDuration: 5
    })
    .withRenderingStrategy(BuiltInStrategies.STANDARD)
    .build();
    
  return <UnifiedQuestionnaire config={config} onComplete={onComplete} />;
}
```

### Example 2: Migrating Clinical Questionnaire
```typescript
// Before
export function ClinicalExcellenceQuestionnaire({ userId, onComplete }: Props) {
  // Complex clinical logic
}

// After
export function ClinicalExcellenceQuestionnaire({ userId, onComplete }: Props) {
  const config = new QuestionnaireBuilder('clinical-excellence')
    .withMetadata({
      title: 'Clinical Assessment',
      purpose: 'diagnostic',
      estimatedDuration: 30,
      compliance: { hipaa: true }
    })
    .withFeature(BuiltInFeatures.CLINICAL_VALIDATION, {
      instruments: ['PHQ-9', 'GAD-7'],
      strictMode: true
    })
    .withFeature(BuiltInFeatures.FRAUD_DETECTION, {
      level: 'enhanced'
    })
    .withRenderingStrategy(BuiltInStrategies.CLINICAL)
    .build();
    
  return <UnifiedQuestionnaire config={config} onComplete={onComplete} />;
}
```

### Example 3: Creating Custom Feature
```typescript
// Extract gamification from existing component
export class GamificationFeature extends BaseFeature {
  private pointsSystem: PointsSystem;
  private achievements: AchievementSystem;
  
  constructor() {
    super(
      'gamification',
      'Gamification System',
      'Adds points, badges, and achievements'
    );
  }
  
  protected async loadConfiguration(context: QuestionnaireContext): Promise<void> {
    const config = context.config.features.find(f => f.id === this.id);
    this.pointsSystem = new PointsSystem(config?.configuration?.points);
    this.achievements = new AchievementSystem(config?.configuration?.achievements);
  }
  
  async afterResponse(response: Response, context: QuestionnaireContext): Promise<void> {
    // Award points
    const points = this.calculatePoints(response);
    await this.pointsSystem.award(context.user.id, points);
    
    // Check achievements
    const newAchievements = await this.achievements.check(context.user.id, context.state);
    if (newAchievements.length > 0) {
      context.engine.emit('achievement_unlocked', { achievements: newAchievements });
    }
  }
}
```

## Configuration Mapping

### Legacy Props → Unified Config
```typescript
function mapLegacyPropsToConfig(props: LegacyProps): QuestionnaireConfig {
  return new QuestionnaireBuilder(props.id || 'legacy')
    .withMetadata({
      title: props.title,
      description: props.description,
      purpose: mapPurpose(props.type),
      estimatedDuration: props.estimatedTime || 15
    })
    .withFeature(BuiltInFeatures.PROGRESSIVE_DISCLOSURE, {
      enabled: props.useProgressive !== false
    })
    .withFeature(BuiltInFeatures.CLINICAL_VALIDATION, {
      enabled: props.clinicalMode === true,
      instruments: props.instruments
    })
    .withRenderingStrategy(
      props.conversational ? BuiltInStrategies.CONVERSATIONAL : BuiltInStrategies.STANDARD
    )
    .build();
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('QuestionnaireEngine', () => {
  it('should initialize with config', async () => {
    const config = new QuestionnaireBuilder('test').build();
    const engine = new StandardQuestionnaireEngine(config);
    await engine.initialize();
    expect(engine.getState().status).toBe('not_started');
  });
  
  it('should process responses through features', async () => {
    const mockFeature = {
      id: 'mock',
      afterResponse: jest.fn()
    };
    engine.registerFeature(mockFeature);
    await engine.submitResponse(response);
    expect(mockFeature.afterResponse).toHaveBeenCalled();
  });
});
```

### Integration Tests
```typescript
describe('Feature Integration', () => {
  it('should work with progressive disclosure', async () => {
    const config = new QuestionnaireBuilder('test')
      .withFeature(BuiltInFeatures.PROGRESSIVE_DISCLOSURE)
      .build();
    const engine = QuestionnaireFactory.createEngine(config);
    
    // Test progressive flow
    const firstQuestion = engine.getCurrentQuestion();
    await engine.submitResponse({ questionId: firstQuestion.id, value: 'high_risk' });
    
    const nextQuestion = engine.getNextQuestion();
    expect(nextQuestion.category).toBe('detailed_assessment');
  });
});
```

## Rollback Plan

1. **Feature Flags**
   ```typescript
   const USE_UNIFIED_ARCHITECTURE = process.env.REACT_APP_UNIFIED_QUESTIONNAIRE === 'true';
   
   export function HealthQuestionnaire(props: Props) {
     if (USE_UNIFIED_ARCHITECTURE) {
       return <UnifiedHealthQuestionnaire {...props} />;
     }
     return <LegacyHealthQuestionnaire {...props} />;
   }
   ```

2. **Gradual Rollout**
   - Start with 10% of users
   - Monitor error rates and performance
   - Increase gradually to 100%

3. **Quick Revert**
   - Keep legacy components for 2 months post-migration
   - Maintain adapter layer for emergency rollback
   - Document rollback procedure

## Success Metrics

1. **Code Metrics**
   - 70% reduction in duplicate code
   - 50% reduction in bundle size
   - 90% test coverage

2. **Performance Metrics**
   - < 100ms question render time
   - < 50ms response processing
   - < 2s initial load

3. **Quality Metrics**
   - 0% increase in error rate
   - Maintain or improve completion rates
   - Positive developer feedback

## Timeline

- **Week 1-2**: Foundation and core engine
- **Week 3-4**: Component migration (50%)
- **Week 5-6**: Complete migration and unification
- **Week 7-8**: Optimization and testing
- **Week 9-10**: Gradual rollout and monitoring
- **Week 11-12**: Full deployment and cleanup

## Risk Mitigation

1. **Technical Risks**
   - Risk: Breaking existing functionality
   - Mitigation: Comprehensive adapter layer and testing

2. **Timeline Risks**
   - Risk: Migration takes longer than expected
   - Mitigation: Prioritize high-value components first

3. **Performance Risks**
   - Risk: Unified architecture is slower
   - Mitigation: Performance benchmarks at each phase

## Next Steps

1. Review and approve architecture design
2. Set up development environment
3. Create foundation classes
4. Begin Phase 1 implementation
5. Establish monitoring and metrics

## Conclusion

This migration strategy provides a clear path from the current fragmented implementation to a unified, maintainable architecture. By using established design patterns and maintaining backward compatibility, we can achieve this transformation with minimal risk and maximum benefit.