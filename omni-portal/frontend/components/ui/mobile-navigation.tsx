'use client';

import { useState, useEffect } from 'react';
import { Menu, X, Home, User, FileText, Calendar, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { a11y } from '@/lib/utils/accessibility';
import { useViewport } from '@/lib/hooks/useViewport';
import { useTouchGestures } from '@/lib/hooks/useTouchGestures';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigationItems = [
  { href: '/home', label: 'Dashboard', icon: Home },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/interview', label: 'Interview', icon: Calendar },
  { href: '/health', label: 'Health', icon: Heart },
];

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { isMobile } = useViewport();
  
  const gestureRef = useTouchGestures<HTMLDivElement>({
    onSwipeLeft: () => setIsOpen(false),
    onSwipeRight: () => setIsOpen(true),
  });

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isMobile) return null;

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-4 right-4 z-50 p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg',
          a11y.focusVisible,
          'transition-all duration-300 hover:shadow-xl hover:scale-105 active:scale-95'
        )}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Navigation drawer */}
      <nav
        ref={gestureRef}
        className={cn(
          'fixed right-0 top-0 h-full w-72 bg-gradient-to-br from-gray-50 to-gray-100 shadow-xl z-40',
          'transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-label="Mobile navigation"
        role="navigation"
        data-testid="mobile-header"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-6">Menu</h2>
          
          <ul className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                      'hover:bg-white hover:shadow-md hover:translate-x-1',
                      a11y.focusVisible,
                      isActive && 'bg-white shadow-md text-blue-600 font-medium'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}

// Bottom tab navigation for mobile
export function MobileTabBar() {
  const pathname = usePathname();
  const { isMobile } = useViewport();

  if (!isMobile) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30"
      aria-label="Tab navigation"
    >
      <ul className="flex justify-around">
        {navigationItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 px-3',
                  'transition-all duration-200',
                  a11y.focusVisible,
                  isActive ? 'text-blue-600' : 'text-gray-600',
                  'hover:text-blue-600'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}