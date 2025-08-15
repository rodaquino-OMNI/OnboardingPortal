/**
 * BoundaryEnforcer - React component wrapper for boundary validation
 * Wraps components to enforce architectural boundaries
 */

import React, { useEffect, useRef } from 'react';
import { boundaryValidator, BoundaryPhase } from '@/lib/migration-toolkit/boundary-validator';
import { featureFlags } from '@/lib/feature-flags';

interface BoundaryEnforcerProps {
  layer: 'presentation' | 'application' | 'domain' | 'infrastructure';
  component: string;
  children: React.ReactNode;
}

export const BoundaryEnforcer: React.FC<BoundaryEnforcerProps> = ({
  layer,
  component,
  children
}) => {
  const dependenciesRef = useRef<Map<string, Set<string>>>(new Map());
  const violationsLoggedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Set boundary phase based on feature flag
    const enforcementLevel = featureFlags.get('ENFORCE_BOUNDARIES');
    
    switch (enforcementLevel) {
      case 'log':
        boundaryValidator.setPhase(BoundaryPhase.LOG_ONLY);
        break;
      case 'warn':
        boundaryValidator.setPhase(BoundaryPhase.WARN_IN_DEV);
        break;
      case 'strict':
        boundaryValidator.setPhase(BoundaryPhase.STRICT);
        break;
      default:
        // Boundaries off
        return;
    }

    // Monitor component for boundary violations
    if (process.env.NODE_ENV === 'development') {
      console.log(`[BoundaryEnforcer] Monitoring ${component} in ${layer} layer`);
    }
  }, [layer, component]);

  // Wrap children to intercept cross-boundary calls
  const wrappedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    // Clone element with boundary validation props
    return React.cloneElement(child as React.ReactElement<any>, {
      'data-boundary-layer': layer,
      'data-boundary-component': component
    });
  });

  return (
    <div 
      data-boundary-enforcer
      data-layer={layer}
      data-component={component}
      style={{ display: 'contents' }}
    >
      {wrappedChildren}
    </div>
  );
};

/**
 * Higher-order component for boundary enforcement
 */
export function withBoundaryEnforcement<P extends object>(
  Component: React.ComponentType<P>,
  layer: 'presentation' | 'application' | 'domain' | 'infrastructure',
  componentName?: string
) {
  const WrappedComponent = (props: P) => {
    const name = componentName || Component.displayName || Component.name || 'Unknown';
    
    return (
      <BoundaryEnforcer layer={layer} component={name}>
        <Component {...props} />
      </BoundaryEnforcer>
    );
  };

  WrappedComponent.displayName = `BoundaryEnforced(${componentName || Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Hook for validating layer access
 */
export function useBoundaryValidation(
  sourceLayer: 'presentation' | 'application' | 'domain' | 'infrastructure',
  targetLayer: 'presentation' | 'application' | 'domain' | 'infrastructure',
  context: string
): boolean {
  const [isValid, setIsValid] = React.useState(true);

  useEffect(() => {
    const enforcementLevel = featureFlags.get('ENFORCE_BOUNDARIES');
    if (enforcementLevel === 'off') return;

    const valid = boundaryValidator.validateLayerBoundary(sourceLayer, targetLayer, context);
    setIsValid(valid);

    if (!valid && process.env.NODE_ENV === 'development') {
      console.warn(`[Boundary] Invalid access from ${sourceLayer} to ${targetLayer} in ${context}`);
    }
  }, [sourceLayer, targetLayer, context]);

  return isValid;
}

/**
 * Hook for validating state access
 */
export function useStateAccessValidation(
  component: string,
  stateSystem: string,
  operation: 'read' | 'write'
): boolean {
  const [isValid, setIsValid] = React.useState(true);

  useEffect(() => {
    const enforcementLevel = featureFlags.get('ENFORCE_BOUNDARIES');
    if (enforcementLevel === 'off') return;

    const valid = boundaryValidator.validateStateAccess(component, stateSystem, operation);
    setIsValid(valid);

    if (!valid && process.env.NODE_ENV === 'development') {
      console.warn(`[Boundary] Invalid state access: ${component} -> ${stateSystem} (${operation})`);
    }
  }, [component, stateSystem, operation]);

  return isValid;
}

/**
 * Hook for validating API calls
 */
export function useApiCallValidation(
  source: string,
  apiPattern: 'gateway' | 'direct' | 'legacy'
): boolean {
  const [isValid, setIsValid] = React.useState(true);

  useEffect(() => {
    const enforcementLevel = featureFlags.get('ENFORCE_BOUNDARIES');
    if (enforcementLevel === 'off') return;

    const valid = boundaryValidator.validateApiCall(source, apiPattern);
    setIsValid(valid);

    if (!valid && apiPattern !== 'gateway' && process.env.NODE_ENV === 'development') {
      console.warn(`[Boundary] Non-gateway API access from ${source} using ${apiPattern} pattern`);
    }
  }, [source, apiPattern]);

  return isValid;
}

/**
 * Component to display boundary violations in development
 */
export const BoundaryViolationMonitor: React.FC = () => {
  const [violations, setViolations] = React.useState(boundaryValidator.getViolations());
  
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const interval = setInterval(() => {
      setViolations([...boundaryValidator.getViolations()]);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV !== 'development' || violations.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        background: 'rgba(255, 0, 0, 0.9)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        maxWidth: '300px',
        maxHeight: '200px',
        overflow: 'auto',
        fontSize: '12px',
        zIndex: 99999
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
        Boundary Violations ({violations.length})
      </div>
      {violations.slice(-5).map((v, i) => (
        <div key={i} style={{ marginBottom: '3px' }}>
          {v.type}: {v.source} → {v.target}
        </div>
      ))}
    </div>
  );
};