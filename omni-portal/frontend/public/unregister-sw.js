if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister().then(function(success) {
        console.log('SW unregistered:', success);
      });
    }
  });
  
  // Clear all caches
  caches.keys().then(function(names) {
    for (let name of names) {
      caches.delete(name);
    }
  });
}