// Fix CSS being loaded as script - run immediately
(function() {
  // Intercept script loading
  const originalAppendChild = Node.prototype.appendChild;
  const originalInsertBefore = Node.prototype.insertBefore;
  
  function checkAndFixElement(element) {
    if (element && element.tagName === 'SCRIPT' && element.src && element.src.includes('.css')) {
      // Don't add script tags for CSS files
      console.warn('Blocked CSS file from being loaded as script:', element.src);
      
      // Check if we already have this CSS as a link
      const cssPath = element.src.split('?')[0];
      const existingLink = document.querySelector(`link[href*="${cssPath}"]`);
      
      if (!existingLink) {
        // Create proper link element instead
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = element.src;
        document.head.appendChild(link);
      }
      
      return null; // Don't add the script element
    }
    return element;
  }
  
  Node.prototype.appendChild = function(element) {
    const fixedElement = checkAndFixElement(element);
    if (fixedElement) {
      return originalAppendChild.call(this, fixedElement);
    }
    return element;
  };
  
  Node.prototype.insertBefore = function(element, referenceNode) {
    const fixedElement = checkAndFixElement(element);
    if (fixedElement) {
      return originalInsertBefore.call(this, fixedElement, referenceNode);
    }
    return element;
  };
  
  // Also clean up any existing CSS scripts
  document.querySelectorAll('script[src*=".css"]').forEach(script => {
    if (script.src && script.src.includes('.css')) {
      script.remove();
    }
  });
})();