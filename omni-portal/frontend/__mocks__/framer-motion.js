// Mock for framer-motion
const React = require('react');

// Mock AnimatePresence
const AnimatePresence = ({ children }) => React.createElement(React.Fragment, null, children);

// Mock motion components
const mockMotionComponent = (component) => {
  const MotionComponent = React.forwardRef((props, ref) => {
    const { animate, initial, exit, transition, layout, layoutId, ...restProps } = props;
    return React.createElement(component, { ...restProps, ref });
  });
  
  MotionComponent.displayName = `Motion${component.charAt(0).toUpperCase() + component.slice(1)}`;
  return MotionComponent;
};

// Create motion object with common HTML elements
const motion = {
  div: mockMotionComponent('div'),
  span: mockMotionComponent('span'),
  p: mockMotionComponent('p'),
  h1: mockMotionComponent('h1'),
  h2: mockMotionComponent('h2'),
  h3: mockMotionComponent('h3'),
  button: mockMotionComponent('button'),
  form: mockMotionComponent('form'),
  input: mockMotionComponent('input'),
  section: mockMotionComponent('section'),
  article: mockMotionComponent('article'),
  nav: mockMotionComponent('nav'),
  header: mockMotionComponent('header'),
  footer: mockMotionComponent('footer'),
  main: mockMotionComponent('main'),
  aside: mockMotionComponent('aside'),
  ul: mockMotionComponent('ul'),
  li: mockMotionComponent('li'),
  a: mockMotionComponent('a'),
};

// Mock useAnimation hook
const useAnimation = () => ({
  start: jest.fn(),
  stop: jest.fn(),
  set: jest.fn(),
});

// Mock useMotionValue hook
const useMotionValue = (initialValue) => ({
  get: () => initialValue,
  set: jest.fn(),
  on: jest.fn(),
  destroy: jest.fn(),
});

// Mock useTransform hook
const useTransform = (value, inputRange, outputRange) => useMotionValue(outputRange[0]);

// Mock useSpring hook
const useSpring = (value, config) => useMotionValue(value);

// Mock useCycle hook
const useCycle = (...values) => {
  const [current, setCurrent] = React.useState(values[0]);
  const cycle = React.useCallback(() => {
    setCurrent(prev => {
      const currentIndex = values.indexOf(prev);
      const nextIndex = (currentIndex + 1) % values.length;
      return values[nextIndex];
    });
  }, [values]);
  
  return [current, cycle];
};

module.exports = {
  motion,
  AnimatePresence,
  useAnimation,
  useMotionValue,
  useTransform,
  useSpring,
  useCycle,
  // Export as default too
  default: {
    motion,
    AnimatePresence,
    useAnimation,
    useMotionValue,
    useTransform,
    useSpring,
    useCycle,
  },
  __esModule: true,
};