/**
 * Unified Questionnaire Architecture
 * 
 * Core Design Principles:
 * 1. Composition over inheritance
 * 2. Strategy pattern for different modes
 * 3. Plugin/feature system for extensibility
 * 4. Clear separation of concerns
 * 5. Type-safe contracts
 * 
 * This architecture consolidates all questionnaire functionality into a single,
 * extensible system that supports all existing features without workarounds.
 */

// ==================== Core Types ====================

export interface QuestionnaireConfig {
  id: string;
  version: string;
  metadata: QuestionnaireMetadata;
  features: FeatureConfig[];
  rendering: RenderingConfig;
  validation: ValidationConfig;
  persistence: PersistenceConfig;
  analytics: AnalyticsConfig;
}

export interface QuestionnaireMetadata {
  title: string;
  description?: string;
  purpose: 'onboarding' | 'periodic' | 'diagnostic' | 'research' | 'emergency';
  domain: string | string[];
  estimatedDuration: number; // minutes
  requiredPermissions?: string[];
  compliance?: ComplianceRequirements;
}

export interface ComplianceRequirements {
  lgpd?: boolean;
  hipaa?: boolean;
  gdpr?: boolean;
  certifications?: string[];
}

// ==================== Feature System ====================

export interface FeatureConfig {
  id: string;
  enabled: boolean;
  priority: number;
  dependencies?: string[];
  configuration?: Record<string, any>;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  
  // Lifecycle hooks
  initialize(context: QuestionnaireContext): Promise<void>;
  beforeQuestion?(question: Question, context: QuestionnaireContext): Promise<Question>;
  afterResponse?(response: Response, context: QuestionnaireContext): Promise<void>;
  beforeSubmit?(data: QuestionnaireData, context: QuestionnaireContext): Promise<QuestionnaireData>;
  cleanup?(context: QuestionnaireContext): Promise<void>;
  
  // Feature-specific methods
  [key: string]: any;
}

// Built-in features
export enum BuiltInFeatures {
  PROGRESSIVE_DISCLOSURE = 'progressive_disclosure',
  ADAPTIVE_ROUTING = 'adaptive_routing',
  CLINICAL_VALIDATION = 'clinical_validation',
  FRAUD_DETECTION = 'fraud_detection',
  GAMIFICATION = 'gamification',
  ACCESSIBILITY = 'accessibility',
  MULTI_LANGUAGE = 'multi_language',
  OFFLINE_MODE = 'offline_mode',
  SESSION_RECOVERY = 'session_recovery',
  AI_ASSISTANCE = 'ai_assistance',
  EMOTIONAL_SUPPORT = 'emotional_support',
  PERFORMANCE_MONITORING = 'performance_monitoring'
}

// ==================== Question Model ====================

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  category?: string;
  required: boolean;
  
  // Rendering hints
  display?: DisplayConfig;
  
  // Validation
  validation?: ValidationRule[];
  
  // Conditional logic
  conditions?: ConditionalRule[];
  
  // Feature-specific extensions
  extensions?: QuestionExtensions;
  
  // Metadata
  metadata?: QuestionMetadata;
}

export type QuestionType = 
  | 'text' 
  | 'number' 
  | 'select' 
  | 'multiselect' 
  | 'boolean' 
  | 'scale' 
  | 'date' 
  | 'time' 
  | 'location' 
  | 'file' 
  | 'matrix' 
  | 'ranking'
  | 'custom';

export interface DisplayConfig {
  layout?: 'vertical' | 'horizontal' | 'grid';
  size?: 'compact' | 'normal' | 'large';
  theme?: 'default' | 'conversational' | 'clinical' | 'gamified';
  animations?: boolean;
  customComponent?: string;
}

export interface QuestionExtensions {
  clinical?: ClinicalExtension;
  fraud?: FraudExtension;
  gamification?: GamificationExtension;
  ai?: AIExtension;
  [key: string]: any;
}

export interface QuestionMetadata {
  instrumentId?: string; // PHQ-9, GAD-7, etc.
  clinicalCode?: string; // ICD-10, SNOMED
  sensitivityLevel?: 'low' | 'medium' | 'high' | 'critical';
  validationPair?: string; // For fraud detection
  analyticsKey?: string;
}

// ==================== Response Handling ====================

export interface Response {
  questionId: string;
  value: any;
  timestamp: Date;
  duration: number; // milliseconds
  metadata?: ResponseMetadata;
}

export interface ResponseMetadata {
  confidence?: number; // 0-1
  source?: 'user' | 'ai_suggested' | 'prefilled' | 'imported';
  corrections?: number;
  hesitation?: number; // milliseconds of pause
  device?: DeviceInfo;
}

// ==================== Rendering Strategies ====================

export interface RenderingConfig {
  strategy: RenderingStrategy;
  options?: RenderingOptions;
}

export interface RenderingStrategy {
  id: string;
  name: string;
  
  // Core rendering methods
  renderQuestion(question: Question, context: RenderingContext): React.ReactElement;
  renderProgress(progress: Progress, context: RenderingContext): React.ReactElement;
  renderNavigation(navigation: Navigation, context: RenderingContext): React.ReactElement;
  renderResults?(results: QuestionnaireResults, context: RenderingContext): React.ReactElement;
}

// Built-in rendering strategies
export enum BuiltInStrategies {
  STANDARD = 'standard',
  CONVERSATIONAL = 'conversational',
  CLINICAL = 'clinical',
  GAMIFIED = 'gamified',
  MOBILE_OPTIMIZED = 'mobile_optimized',
  ACCESSIBILITY_FIRST = 'accessibility_first'
}

export interface RenderingContext {
  questionnaire: QuestionnaireConfig;
  currentQuestion: Question;
  responses: Response[];
  features: Feature[];
  device: DeviceInfo;
  preferences: UserPreferences;
}

// ==================== State Management ====================

export interface QuestionnaireState {
  id: string;
  status: QuestionnaireStatus;
  currentSection?: string;
  currentQuestion?: string;
  responses: Response[];
  progress: Progress;
  validationErrors: ValidationError[];
  features: FeatureState[];
  metadata: StateMetadata;
}

export type QuestionnaireStatus = 
  | 'not_started'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'abandoned'
  | 'error';

export interface Progress {
  questionsAnswered: number;
  totalQuestions: number;
  sectionsCompleted: number;
  totalSections: number;
  estimatedTimeRemaining: number; // minutes
  completionPercentage: number;
}

export interface FeatureState {
  featureId: string;
  state: Record<string, any>;
  lastUpdated: Date;
}

export interface StateMetadata {
  startedAt?: Date;
  lastActiveAt?: Date;
  completedAt?: Date;
  sessionCount: number;
  totalDuration: number; // milliseconds
  device?: DeviceInfo;
  location?: LocationInfo;
}

// ==================== Core Engine ====================

export interface QuestionnaireEngine {
  // Configuration
  configure(config: QuestionnaireConfig): Promise<void>;
  
  // Feature management
  registerFeature(feature: Feature): void;
  enableFeature(featureId: string, config?: any): void;
  disableFeature(featureId: string): void;
  
  // Rendering strategy
  setRenderingStrategy(strategy: RenderingStrategy): void;
  
  // Lifecycle
  initialize(context: QuestionnaireContext): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  complete(): Promise<QuestionnaireResults>;
  abandon(reason?: string): Promise<void>;
  
  // Navigation
  getCurrentQuestion(): Question | null;
  getNextQuestion(): Question | null;
  getPreviousQuestion(): Question | null;
  jumpToQuestion(questionId: string): Promise<void>;
  jumpToSection(sectionId: string): Promise<void>;
  
  // Response handling
  submitResponse(response: Response): Promise<ValidationResult>;
  updateResponse(questionId: string, value: any): Promise<ValidationResult>;
  clearResponse(questionId: string): Promise<void>;
  
  // State management
  getState(): QuestionnaireState;
  setState(state: Partial<QuestionnaireState>): void;
  saveState(): Promise<void>;
  restoreState(stateId: string): Promise<void>;
  
  // Events
  on(event: QuestionnaireEvent, handler: EventHandler): void;
  off(event: QuestionnaireEvent, handler: EventHandler): void;
  emit(event: QuestionnaireEvent, data?: any): void;
}

// ==================== Event System ====================

export type QuestionnaireEvent = 
  | 'initialized'
  | 'started'
  | 'question_displayed'
  | 'response_submitted'
  | 'response_validated'
  | 'progress_updated'
  | 'section_completed'
  | 'paused'
  | 'resumed'
  | 'completed'
  | 'abandoned'
  | 'error'
  | 'feature_activated'
  | 'feature_deactivated';

export type EventHandler = (data?: any) => void | Promise<void>;

// ==================== Context ====================

export interface QuestionnaireContext {
  engine: QuestionnaireEngine;
  config: QuestionnaireConfig;
  state: QuestionnaireState;
  user: UserContext;
  session: SessionContext;
  features: Map<string, Feature>;
  services: ServiceRegistry;
}

export interface UserContext {
  id: string;
  profile?: UserProfile;
  preferences?: UserPreferences;
  history?: UserHistory;
}

export interface SessionContext {
  id: string;
  startedAt: Date;
  device: DeviceInfo;
  location?: LocationInfo;
  referrer?: string;
}

export interface ServiceRegistry {
  get<T>(serviceName: string): T;
  register<T>(serviceName: string, service: T): void;
}

// ==================== Builder Pattern ====================

export class QuestionnaireBuilder {
  private config: Partial<QuestionnaireConfig> = {};
  
  constructor(id: string) {
    this.config.id = id;
    this.config.version = '1.0.0';
    this.config.features = [];
  }
  
  withMetadata(metadata: QuestionnaireMetadata): QuestionnaireBuilder {
    this.config.metadata = metadata;
    return this;
  }
  
  withFeature(featureId: string, config?: any): QuestionnaireBuilder {
    this.config.features!.push({
      id: featureId,
      enabled: true,
      priority: this.config.features!.length,
      configuration: config
    });
    return this;
  }
  
  withRenderingStrategy(strategy: string, options?: any): QuestionnaireBuilder {
    this.config.rendering = { strategy: { id: strategy } as RenderingStrategy, options };
    return this;
  }
  
  withValidation(config: ValidationConfig): QuestionnaireBuilder {
    this.config.validation = config;
    return this;
  }
  
  withPersistence(config: PersistenceConfig): QuestionnaireBuilder {
    this.config.persistence = config;
    return this;
  }
  
  withAnalytics(config: AnalyticsConfig): QuestionnaireBuilder {
    this.config.analytics = config;
    return this;
  }
  
  build(): QuestionnaireConfig {
    // Validate required fields
    if (!this.config.metadata) {
      throw new Error('Metadata is required');
    }
    
    // Set defaults
    this.config.rendering = this.config.rendering || { 
      strategy: { id: BuiltInStrategies.STANDARD } as RenderingStrategy 
    };
    
    this.config.validation = this.config.validation || { 
      validateOnChange: true,
      validateOnBlur: true,
      showErrors: true 
    };
    
    this.config.persistence = this.config.persistence || {
      autoSave: true,
      interval: 30000, // 30 seconds
      storage: 'local'
    };
    
    this.config.analytics = this.config.analytics || {
      trackResponses: true,
      trackTiming: true,
      trackErrors: true
    };
    
    return this.config as QuestionnaireConfig;
  }
}

// ==================== Supporting Types ====================

export interface ValidationConfig {
  validateOnChange: boolean;
  validateOnBlur: boolean;
  showErrors: boolean;
  customValidators?: CustomValidator[];
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message?: string;
  validator?: (value: any, context: ValidationContext) => boolean | string;
}

export interface ValidationContext {
  question: Question;
  responses: Response[];
  features: Feature[];
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  questionId: string;
  rule: string;
  message: string;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  questionId: string;
  message: string;
  type: string;
}

export interface PersistenceConfig {
  autoSave: boolean;
  interval: number; // milliseconds
  storage: 'local' | 'session' | 'cloud' | 'custom';
  encryption?: boolean;
  compression?: boolean;
  customAdapter?: PersistenceAdapter;
}

export interface PersistenceAdapter {
  save(key: string, data: any): Promise<void>;
  load(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}

export interface AnalyticsConfig {
  trackResponses: boolean;
  trackTiming: boolean;
  trackErrors: boolean;
  trackFeatures?: boolean;
  customEvents?: string[];
  adapter?: AnalyticsAdapter;
}

export interface AnalyticsAdapter {
  track(event: string, data: any): Promise<void>;
  identify(userId: string, traits?: any): Promise<void>;
  page(name: string, properties?: any): Promise<void>;
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet';
  os: string;
  browser: string;
  screen: { width: number; height: number };
  touch: boolean;
}

export interface LocationInfo {
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
}

export interface UserPreferences {
  language: string;
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'normal' | 'large';
  animations: boolean;
  soundEffects: boolean;
  accessibility?: AccessibilityPreferences;
}

export interface AccessibilityPreferences {
  screenReader: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  keyboardNavigation: boolean;
}

export interface UserProfile {
  demographics?: any;
  healthLiteracy?: 'low' | 'medium' | 'high';
  anxietyLevel?: number;
  preferredPathway?: string;
}

export interface UserHistory {
  previousAssessments: PreviousAssessment[];
  completionRate: number;
  averageDuration: number;
  preferredFeatures: string[];
}

export interface PreviousAssessment {
  id: string;
  date: Date;
  completionRate: number;
  duration: number;
  pathway: string;
}

export interface QuestionnaireResults {
  id: string;
  questionnaireId: string;
  userId: string;
  responses: Response[];
  score?: any;
  risk?: RiskAssessment;
  recommendations?: Recommendation[];
  metadata: ResultMetadata;
}

export interface RiskAssessment {
  overall: 'low' | 'moderate' | 'high' | 'critical';
  domains: DomainRisk[];
  flags: string[];
}

export interface DomainRisk {
  domain: string;
  level: 'low' | 'moderate' | 'high' | 'critical';
  score: number;
  factors: string[];
}

export interface Recommendation {
  id: string;
  type: 'action' | 'resource' | 'referral';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  metadata?: any;
}

export interface ResultMetadata {
  completedAt: Date;
  duration: number;
  device: DeviceInfo;
  featuresUsed: string[];
  validationIssues: number;
  fraudScore?: number;
}

// ==================== Factory Pattern ====================

export class QuestionnaireFactory {
  private static strategies = new Map<string, RenderingStrategy>();
  private static features = new Map<string, Feature>();
  
  static registerStrategy(strategy: RenderingStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }
  
  static registerFeature(feature: Feature): void {
    this.features.set(feature.id, feature);
  }
  
  static createEngine(config: QuestionnaireConfig): QuestionnaireEngine {
    // Implementation would create the appropriate engine instance
    // based on configuration
    throw new Error('Implementation required');
  }
  
  static getStrategy(id: string): RenderingStrategy | undefined {
    return this.strategies.get(id);
  }
  
  static getFeature(id: string): Feature | undefined {
    return this.features.get(id);
  }
}

// ==================== Decorator Pattern for Features ====================

export abstract class FeatureDecorator implements Feature {
  constructor(protected feature: Feature) {}
  
  get id(): string { return this.feature.id; }
  get name(): string { return this.feature.name; }
  get description(): string { return this.feature.description; }
  
  async initialize(context: QuestionnaireContext): Promise<void> {
    return this.feature.initialize(context);
  }
  
  async beforeQuestion(question: Question, context: QuestionnaireContext): Promise<Question> {
    return this.feature.beforeQuestion?.(question, context) || question;
  }
  
  async afterResponse(response: Response, context: QuestionnaireContext): Promise<void> {
    return this.feature.afterResponse?.(response, context);
  }
  
  async beforeSubmit(data: QuestionnaireData, context: QuestionnaireContext): Promise<QuestionnaireData> {
    return this.feature.beforeSubmit?.(data, context) || data;
  }
  
  async cleanup(context: QuestionnaireContext): Promise<void> {
    return this.feature.cleanup?.(context);
  }
}

// ==================== Observer Pattern for Events ====================

export class EventEmitter {
  private listeners = new Map<QuestionnaireEvent, Set<EventHandler>>();
  
  on(event: QuestionnaireEvent, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }
  
  off(event: QuestionnaireEvent, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }
  
  async emit(event: QuestionnaireEvent, data?: any): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    
    for (const handler of handlers) {
      await handler(data);
    }
  }
}

// ==================== Type Guards ====================

export function isValidationError(error: any): error is ValidationError {
  return error && 'questionId' in error && 'rule' in error && 'message' in error;
}

export function isHighRiskResponse(response: Response): boolean {
  // Implementation would check response metadata and value
  return false;
}

export function requiresEscalation(state: QuestionnaireState): boolean {
  // Implementation would check state for escalation triggers
  return false;
}

// Type aliases for better readability
export type QuestionnaireData = Record<string, any>;
export type ConditionalRule = any; // Would be fully defined
export type CustomValidator = any; // Would be fully defined
export type Navigation = any; // Would be fully defined
export type ClinicalExtension = any; // Would be fully defined
export type FraudExtension = any; // Would be fully defined
export type GamificationExtension = any; // Would be fully defined
export type AIExtension = any; // Would be fully defined