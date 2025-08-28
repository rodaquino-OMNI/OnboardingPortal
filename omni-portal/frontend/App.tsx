// Test App component for integration tests
// This is a simplified App component used by test templates
import React from 'react';

interface AppProps {
  children?: React.ReactNode;
}

export const App: React.FC<AppProps> = ({ children }) => {
  return (
    <div className="app">
      <div id="root">
        {children || (
          <div className="min-h-screen bg-gray-50">
            <h1>Test Application</h1>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;