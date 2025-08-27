// Mock for @radix-ui components
const React = require('react');

// Generic mock component factory
const createMockComponent = (displayName) => {
  const MockComponent = React.forwardRef((props, ref) => {
    const { children, asChild, ...otherProps } = props;
    
    if (asChild && React.Children.count(children) === 1) {
      const child = React.Children.only(children);
      return React.cloneElement(child, { ...otherProps, ref });
    }
    
    return React.createElement('div', { ...otherProps, ref }, children);
  });
  
  MockComponent.displayName = displayName;
  // Add static displayName property for cases where it's accessed directly
  Object.defineProperty(MockComponent, 'displayName', {
    value: displayName,
    writable: false,
    enumerable: true,
    configurable: false
  });
  
  return MockComponent;
};

// Mock dropdown menu components
const DropdownMenuTrigger = createMockComponent('DropdownMenuTrigger');
const DropdownMenuContent = createMockComponent('DropdownMenuContent');
const DropdownMenuItem = createMockComponent('DropdownMenuItem');
const DropdownMenuSeparator = createMockComponent('DropdownMenuSeparator');
const DropdownMenuLabel = createMockComponent('DropdownMenuLabel');
const DropdownMenuGroup = createMockComponent('DropdownMenuGroup');
const DropdownMenuSub = createMockComponent('DropdownMenuSub');
const DropdownMenuSubContent = createMockComponent('DropdownMenuSubContent');
const DropdownMenuSubTrigger = createMockComponent('DropdownMenuSubTrigger');

// Root component with provider-like behavior
const DropdownMenu = ({ children, ...props }) => {
  return React.createElement('div', props, children);
};

// Mock dialog components
const DialogTrigger = createMockComponent('DialogTrigger');
const DialogContent = createMockComponent('DialogContent');
const DialogHeader = createMockComponent('DialogHeader');
const DialogTitle = createMockComponent('DialogTitle');
const DialogDescription = createMockComponent('DialogDescription');
const DialogFooter = createMockComponent('DialogFooter');
const DialogClose = createMockComponent('DialogClose');

const Dialog = ({ children, ...props }) => {
  return React.createElement('div', props, children);
};

// Mock select components with proper structure
const SelectTrigger = createMockComponent('SelectTrigger');
const SelectContent = createMockComponent('SelectContent');
const SelectItem = createMockComponent('SelectItem');
const SelectValue = createMockComponent('SelectValue');
const SelectGroup = createMockComponent('SelectGroup');
const SelectLabel = createMockComponent('SelectLabel');
const SelectSeparator = createMockComponent('SelectSeparator');
const SelectScrollUpButton = createMockComponent('SelectScrollUpButton');
const SelectScrollDownButton = createMockComponent('SelectScrollDownButton');
const SelectViewport = createMockComponent('SelectViewport');
const SelectIcon = createMockComponent('SelectIcon');
const SelectItemText = createMockComponent('SelectItemText');
const SelectItemIndicator = createMockComponent('SelectItemIndicator');
const SelectPortal = createMockComponent('SelectPortal');

// Mock Select Root with proper structure
const Select = ({ children, value, onValueChange, ...props }) => {
  return React.createElement('div', { ...props, 'data-value': value }, children);
};

// Add displayName to Select root
Select.displayName = 'Select';

// Mock the primitives structure
const SelectPrimitive = {
  Root: Select,
  Trigger: SelectTrigger,
  Content: SelectContent,
  Item: SelectItem,
  Value: SelectValue,
  Group: SelectGroup,
  Label: SelectLabel,
  Separator: SelectSeparator,
  ScrollUpButton: SelectScrollUpButton,
  ScrollDownButton: SelectScrollDownButton,
  Viewport: SelectViewport,
  Icon: SelectIcon,
  ItemText: SelectItemText,
  ItemIndicator: SelectItemIndicator,
  Portal: SelectPortal,
};

// Ensure all components have displayName
Object.keys(SelectPrimitive).forEach(key => {
  if (SelectPrimitive[key] && typeof SelectPrimitive[key] === 'function') {
    SelectPrimitive[key].displayName = `Select${key}`;
  }
});

// Mock checkbox
const Checkbox = React.forwardRef((props, ref) => {
  const { checked, onCheckedChange, ...otherProps } = props;
  return React.createElement('input', {
    type: 'checkbox',
    checked: checked === true,
    onChange: (e) => onCheckedChange && onCheckedChange(e.target.checked),
    ref,
    ...otherProps
  });
});

Checkbox.displayName = 'Checkbox';

// Mock switch
const Switch = React.forwardRef((props, ref) => {
  const { checked, onCheckedChange, ...otherProps } = props;
  return React.createElement('input', {
    type: 'checkbox',
    role: 'switch',
    checked: checked === true,
    onChange: (e) => onCheckedChange && onCheckedChange(e.target.checked),
    ref,
    ...otherProps
  });
});

Switch.displayName = 'Switch';

// Mock toast components
const ToastProvider = ({ children }) => React.createElement('div', null, children);
const ToastViewport = createMockComponent('ToastViewport');
const Toast = createMockComponent('Toast');
const ToastTitle = createMockComponent('ToastTitle');
const ToastDescription = createMockComponent('ToastDescription');
const ToastAction = createMockComponent('ToastAction');
const ToastClose = createMockComponent('ToastClose');

module.exports = {
  // Dropdown Menu
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  
  // Dialog
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  
  // Select - individual components
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
  SelectViewport,
  SelectIcon,
  SelectItemText,
  SelectItemIndicator,
  SelectPortal,
  
  // Select Primitive structure for direct imports
  SelectPrimitive,
  
  // Form controls
  Checkbox,
  Switch,
  
  // Toast
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
  
  __esModule: true,
};

// Also export as specific module patterns
module.exports['@radix-ui/react-select'] = SelectPrimitive;
module.exports['@radix-ui/react-dropdown-menu'] = {
  Root: DropdownMenu,
  Trigger: DropdownMenuTrigger,
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Label: DropdownMenuLabel,
  Group: DropdownMenuGroup,
  Sub: DropdownMenuSub,
  SubContent: DropdownMenuSubContent,
  SubTrigger: DropdownMenuSubTrigger,
};
module.exports['@radix-ui/react-dialog'] = {
  Root: Dialog,
  Trigger: DialogTrigger,
  Content: DialogContent,
  Header: DialogHeader,
  Title: DialogTitle,
  Description: DialogDescription,
  Footer: DialogFooter,
  Close: DialogClose,
};