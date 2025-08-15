/**
 * UnifiedStateAdapter - Single source of truth for all state management
 * Consolidates 8 competing state systems into a unified interface
 */

import { create, StoreApi } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

// Domain definitions
export type StateDomain = 'auth' | 'user' | 'session' | 'ui' | 'health' | 'gamification';
export type StorageStrategy = 'memory' | 'local' | 'session' | 'cookie' | 'none';

interface DomainConfig {
  storage: StorageStrategy;
  syncAcrossTabs?: boolean;
  ttl?: number; // Time to live in milliseconds
  encryptSensitive?: boolean;
}

interface StateMetadata {
  domain: StateDomain;
  lastUpdated: number;
  version: number;
  checksum?: string;
}

/**
 * Unified State Manager - Coordinates all state domains
 */
export class UnifiedStateAdapter {
  private stores: Map<StateDomain, StoreApi<any>> = new Map();
  private metadata: Map<StateDomain, StateMetadata> = new Map();
  private subscribers: Map<string, Set<(value: any) => void>> = new Map();
  
  // Domain configurations
  private domainConfigs: Record<StateDomain, DomainConfig> = {
    auth: {
      storage: 'cookie',
      syncAcrossTabs: true,
      encryptSensitive: true
    },
    user: {
      storage: 'local',
      syncAcrossTabs: true,
      ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
    },
    session: {
      storage: 'session',
      syncAcrossTabs: false,
      ttl: 30 * 60 * 1000 // 30 minutes
    },
    ui: {
      storage: 'memory',
      syncAcrossTabs: false
    },
    health: {
      storage: 'local',
      syncAcrossTabs: true,
      ttl: 24 * 60 * 60 * 1000 // 24 hours
    },
    gamification: {
      storage: 'local',
      syncAcrossTabs: true
    }
  };

  constructor() {
    this.initializeDomains();
    this.setupCrossTabSync();
    this.setupStorageQuotaManagement();
  }

  /**
   * Initialize all state domains
   */
  private initializeDomains(): void {
    Object.entries(this.domainConfigs).forEach(([domain, config]) => {
      this.createDomainStore(domain as StateDomain, config);
    });
  }

  /**
   * Create a domain-specific store
   */
  private createDomainStore(domain: StateDomain, config: DomainConfig): void {
    const storageOptions = this.getStorageOptions(domain, config);
    
    const storeCreator = (set: any, get: any) => ({
      // Initial state
      data: {},
      
      // Actions
      set: (key: string, value: any) => {
        set((state: any) => ({
          data: { ...state.data, [key]: value }
        }));
        this.notifySubscribers(`${domain}.${key}`, value);
        this.updateMetadata(domain);
      },
      
      get: (key: string) => {
        const state = get();
        return state.data[key];
      },
      
      remove: (key: string) => {
        set((state: any) => {
          const newData = { ...state.data };
          delete newData[key];
          return { data: newData };
        });
        this.notifySubscribers(`${domain}.${key}`, undefined);
        this.updateMetadata(domain);
      },
      
      clear: () => {
        set({ data: {} });
        this.notifyAllSubscribers(domain);
        this.updateMetadata(domain);
      }
    });

    // Create store with or without persistence based on storage options
    const store = storageOptions 
      ? create(
          devtools(
            persist(storeCreator, storageOptions),
            { name: `unified-state-${domain}` }
          )
        )
      : create(
          devtools(
            storeCreator,
            { name: `unified-state-${domain}` }
          )
        );

    this.stores.set(domain, store);
    this.metadata.set(domain, {
      domain,
      lastUpdated: Date.now(),
      version: 1
    });
  }

  /**
   * Get storage options based on strategy
   */
  private getStorageOptions(domain: StateDomain, config: DomainConfig): any {
    const baseOptions = {
      name: `unified-${domain}`,
      version: 1
    };

    switch (config.storage) {
      case 'local':
        return {
          ...baseOptions,
          storage: this.createLocalStorage(config.ttl)
        };
      
      case 'session':
        return {
          ...baseOptions,
          storage: this.createSessionStorage(config.ttl)
        };
      
      case 'cookie':
        return {
          ...baseOptions,
          storage: this.createCookieStorage(config.encryptSensitive)
        };
      
      case 'memory':
      case 'none':
      default:
        // No persistence for memory-only storage
        return undefined;
    }
  }

  /**
   * Create localStorage adapter with TTL support
   */
  private createLocalStorage(ttl?: number) {
    return {
      getItem: (name: string) => {
        const item = localStorage.getItem(name);
        if (!item) return null;

        try {
          const parsed = JSON.parse(item);
          
          // Check TTL if configured
          if (ttl && parsed.timestamp) {
            const age = Date.now() - parsed.timestamp;
            if (age > ttl) {
              localStorage.removeItem(name);
              return null;
            }
          }
          
          return JSON.stringify(parsed.state);
        } catch {
          return item;
        }
      },
      
      setItem: (name: string, value: string) => {
        try {
          const data = {
            state: JSON.parse(value),
            timestamp: Date.now()
          };
          
          // Handle quota errors
          try {
            localStorage.setItem(name, JSON.stringify(data));
          } catch (e) {
            // Clear old data if quota exceeded
            this.clearOldStorageData();
            localStorage.setItem(name, JSON.stringify(data));
          }
        } catch (error) {
          console.error('Failed to save to localStorage:', error);
        }
      },
      
      removeItem: (name: string) => {
        localStorage.removeItem(name);
      }
    };
  }

  /**
   * Create sessionStorage adapter with TTL support
   */
  private createSessionStorage(ttl?: number) {
    return {
      getItem: (name: string) => {
        const item = sessionStorage.getItem(name);
        if (!item) return null;

        try {
          const parsed = JSON.parse(item);
          
          // Check TTL if configured
          if (ttl && parsed.timestamp) {
            const age = Date.now() - parsed.timestamp;
            if (age > ttl) {
              sessionStorage.removeItem(name);
              return null;
            }
          }
          
          return JSON.stringify(parsed.state);
        } catch {
          return item;
        }
      },
      
      setItem: (name: string, value: string) => {
        try {
          const data = {
            state: JSON.parse(value),
            timestamp: Date.now()
          };
          sessionStorage.setItem(name, JSON.stringify(data));
        } catch (error) {
          console.error('Failed to save to sessionStorage:', error);
        }
      },
      
      removeItem: (name: string) => {
        sessionStorage.removeItem(name);
      }
    };
  }

  /**
   * Create cookie storage adapter
   */
  private createCookieStorage(encrypt?: boolean) {
    return {
      getItem: (name: string) => {
        const cookies = document.cookie.split(';');
        const cookie = cookies.find(c => c.trim().startsWith(`${name}=`));
        
        if (!cookie) return null;
        
        const value = cookie.split('=')[1];
        return decrypt ? this.decrypt(value) : decodeURIComponent(value);
      },
      
      setItem: (name: string, value: string) => {
        const processedValue = encrypt ? this.encrypt(value) : encodeURIComponent(value);
        document.cookie = `${name}=${processedValue}; path=/; max-age=86400; SameSite=Lax`;
      },
      
      removeItem: (name: string) => {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    };
  }

  /**
   * Simple encryption for sensitive data (implement proper encryption in production)
   */
  private encrypt(value: string): string {
    // This is a placeholder - use proper encryption in production
    return btoa(value);
  }

  private decrypt(value: string): string {
    // This is a placeholder - use proper decryption in production
    return atob(value);
  }

  /**
   * Set up cross-tab synchronization
   */
  private setupCrossTabSync(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('storage', (e) => {
      if (!e.key?.startsWith('unified-')) return;
      
      // Parse domain from key
      const domain = e.key.replace('unified-', '').split('-')[0] as StateDomain;
      const config = this.domainConfigs[domain];
      
      if (config?.syncAcrossTabs && e.newValue) {
        // Update local store with changes from other tabs
        const store = this.stores.get(domain);
        if (store) {
          try {
            const newState = JSON.parse(e.newValue);
            store.setState(newState);
            this.notifyAllSubscribers(domain);
          } catch (error) {
            console.error('Failed to sync state across tabs:', error);
          }
        }
      }
    });
  }

  /**
   * Set up storage quota management
   */
  private setupStorageQuotaManagement(): void {
    // Monitor storage usage
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(({ usage, quota }) => {
        const percentUsed = (usage! / quota!) * 100;
        
        if (percentUsed > 80) {
          console.warn(`Storage usage at ${percentUsed.toFixed(1)}% - cleaning up old data`);
          this.clearOldStorageData();
        }
      });
    }
  }

  /**
   * Clear old storage data to free up space
   */
  private clearOldStorageData(): void {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    // Clear old localStorage items
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed.timestamp && parsed.timestamp < cutoffTime) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        // Skip non-JSON items
      }
    }
  }

  /**
   * Update metadata for a domain
   */
  private updateMetadata(domain: StateDomain): void {
    const metadata = this.metadata.get(domain);
    if (metadata) {
      metadata.lastUpdated = Date.now();
      metadata.version++;
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(path: string, callback: (value: any) => void): () => void {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
    }
    
    this.subscribers.get(path)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.get(path)?.delete(callback);
    };
  }

  /**
   * Notify subscribers of changes
   */
  private notifySubscribers(path: string, value: any): void {
    this.subscribers.get(path)?.forEach(callback => callback(value));
  }

  /**
   * Notify all subscribers for a domain
   */
  private notifyAllSubscribers(domain: StateDomain): void {
    this.subscribers.forEach((callbacks, path) => {
      if (path.startsWith(`${domain}.`)) {
        const key = path.split('.')[1];
        const store = this.stores.get(domain);
        const value = store?.getState().get(key);
        callbacks.forEach(callback => callback(value));
      }
    });
  }

  // Public API

  /**
   * Get value from a domain
   */
  get<T = any>(domain: StateDomain, key: string): T | undefined {
    const store = this.stores.get(domain);
    return store?.getState().get(key);
  }

  /**
   * Set value in a domain
   */
  set(domain: StateDomain, key: string, value: any): void {
    const store = this.stores.get(domain);
    store?.getState().set(key, value);
  }

  /**
   * Remove value from a domain
   */
  remove(domain: StateDomain, key: string): void {
    const store = this.stores.get(domain);
    store?.getState().remove(key);
  }

  /**
   * Clear all data in a domain
   */
  clear(domain: StateDomain): void {
    const store = this.stores.get(domain);
    store?.getState().clear();
  }

  /**
   * Get all data from a domain
   */
  getAll(domain: StateDomain): Record<string, any> {
    const store = this.stores.get(domain);
    return store?.getState().data || {};
  }

  /**
   * Get metadata for a domain
   */
  getMetadata(domain: StateDomain): StateMetadata | undefined {
    return this.metadata.get(domain);
  }

  /**
   * Debug: Get current state snapshot
   */
  getSnapshot(): Record<StateDomain, any> {
    const snapshot: any = {};
    
    this.stores.forEach((store, domain) => {
      snapshot[domain] = store.getState().data;
    });
    
    return snapshot;
  }
}

// Export singleton instance
export const unifiedState = new UnifiedStateAdapter();