/**
 * Clear all demo data from localStorage
 * This ensures the system uses only real backend data
 */
export function clearAllDemoData() {
  const demoKeys = [
    'profile_completed',
    'documents_uploaded', 
    'health_questionnaire_completed',
    'demo_points',
    'premium_consultation_unlocked'
  ];
  
  demoKeys.forEach(key => {
    localStorage.removeItem(key);
  });
  
  console.log('✅ All demo data cleared from localStorage');
}

// Auto-clear demo data on production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  clearAllDemoData();
}