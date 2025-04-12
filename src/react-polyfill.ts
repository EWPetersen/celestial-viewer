// React polyfill to ensure compatibility between React 18 and React 19
// This file provides stub implementations of new React 19 features
import * as React from 'react';

// Add 'use' function if it doesn't exist
if (!(React as any).use) {
  (React as any).use = function(promise: any) {
    // Basic implementation
    if (promise && typeof promise.then === 'function') {
      throw promise;
    }
    return promise;
  };
}

export default React; 