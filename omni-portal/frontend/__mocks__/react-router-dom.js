// Mock for react-router-dom
const React = require('react');

// Mock useNavigate hook
const useNavigate = () => {
  return jest.fn((path) => {
    console.log(`Mock navigation to: ${path}`);
  });
};

// Mock useLocation hook
const useLocation = () => ({
  pathname: '/test',
  search: '',
  hash: '',
  state: null,
  key: 'test-key',
});

// Mock useParams hook
const useParams = () => ({});

// Mock useSearchParams hook
const useSearchParams = () => [
  new URLSearchParams(),
  jest.fn()
];

// Mock Link component
const Link = React.forwardRef(({ to, children, replace, state, ...props }, ref) => {
  return React.createElement('a', {
    href: to,
    onClick: (e) => {
      e.preventDefault();
      console.log(`Mock link click to: ${to}`);
    },
    ref,
    ...props
  }, children);
});

Link.displayName = 'Link';

// Mock NavLink component
const NavLink = React.forwardRef(({ to, children, className, activeClassName, ...props }, ref) => {
  const computedClassName = typeof className === 'function' 
    ? className({ isActive: false, isPending: false })
    : className;
    
  return React.createElement('a', {
    href: to,
    className: computedClassName,
    onClick: (e) => {
      e.preventDefault();
      console.log(`Mock NavLink click to: ${to}`);
    },
    ref,
    ...props
  }, children);
});

NavLink.displayName = 'NavLink';

// Mock BrowserRouter
const BrowserRouter = ({ children }) => {
  return React.createElement('div', { 'data-testid': 'mock-browser-router' }, children);
};

// Mock Route component
const Route = ({ element, path, ...props }) => {
  return React.createElement('div', { 'data-testid': 'mock-route', 'data-path': path }, element);
};

// Mock Routes component
const Routes = ({ children }) => {
  return React.createElement('div', { 'data-testid': 'mock-routes' }, children);
};

// Mock Navigate component
const Navigate = ({ to, replace, state, ...props }) => {
  React.useEffect(() => {
    console.log(`Mock Navigate to: ${to}`);
  }, [to]);
  
  return React.createElement('div', { 'data-testid': 'mock-navigate', 'data-to': to });
};

// Mock Outlet component
const Outlet = ({ context, ...props }) => {
  return React.createElement('div', { 'data-testid': 'mock-outlet' });
};

// Mock useRouteError hook
const useRouteError = () => ({
  status: 404,
  statusText: 'Not Found',
  message: 'Mock route error'
});

// Mock createBrowserRouter function
const createBrowserRouter = (routes) => ({
  routes,
  navigate: jest.fn(),
  subscribe: jest.fn(),
  dispose: jest.fn(),
});

// Mock RouterProvider component
const RouterProvider = ({ router, children }) => {
  return React.createElement('div', { 'data-testid': 'mock-router-provider' }, children);
};

module.exports = {
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
  useRouteError,
  Link,
  NavLink,
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  Outlet,
  createBrowserRouter,
  RouterProvider,
  __esModule: true,
};