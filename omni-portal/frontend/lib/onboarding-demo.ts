/**
 * Demo utility to simulate onboarding progress for testing the unlock system
 * This allows testing different unlock states without going through the full flow
 */

export interface DemoSettings {
  profileComplete: boolean;
  documentsUploaded: boolean;
  healthQuestionnaireCompleted: boolean;
  totalPoints: number;
}

export const setDemoOnboardingProgress = (settings: Partial<DemoSettings>) => {
  // Warn if using demo in production
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ WARNING: Demo functions should not be used in production!');
    return;
  }

  const defaults: DemoSettings = {
    profileComplete: false,
    documentsUploaded: false,
    healthQuestionnaireCompleted: false,
    totalPoints: 0
  };

  const finalSettings = { ...defaults, ...settings };

  // Set localStorage flags
  if (finalSettings.profileComplete) {
    localStorage.setItem('profile_completed', 'true');
  } else {
    localStorage.removeItem('profile_completed');
  }

  if (finalSettings.documentsUploaded) {
    localStorage.setItem('documents_uploaded', 'true');
  } else {
    localStorage.removeItem('documents_uploaded');
  }

  if (finalSettings.healthQuestionnaireCompleted) {
    localStorage.setItem('health_questionnaire_completed', 'true');
  } else {
    localStorage.removeItem('health_questionnaire_completed');
  }

  if (finalSettings.totalPoints > 0) {
    localStorage.setItem('demo_points', finalSettings.totalPoints.toString());
  } else {
    localStorage.removeItem('demo_points');
  }

  console.log('🎮 Demo onboarding progress set:', finalSettings);
};

export const getDemoOnboardingProgress = (): DemoSettings => {
  return {
    profileComplete: localStorage.getItem('profile_completed') === 'true',
    documentsUploaded: localStorage.getItem('documents_uploaded') === 'true',
    healthQuestionnaireCompleted: localStorage.getItem('health_questionnaire_completed') === 'true',
    totalPoints: parseInt(localStorage.getItem('demo_points') || '0', 10)
  };
};

// Quick demo presets
export const demoPresets = {
  // No progress - locked state
  locked: () => setDemoOnboardingProgress({
    profileComplete: false,
    documentsUploaded: false,
    healthQuestionnaireCompleted: false,
    totalPoints: 0
  }),

  // Partial progress - 50% complete
  partial: () => setDemoOnboardingProgress({
    profileComplete: true,
    documentsUploaded: false,
    healthQuestionnaireCompleted: false,
    totalPoints: 100
  }),

  // Almost complete - need just a bit more
  almostComplete: () => setDemoOnboardingProgress({
    profileComplete: true,
    documentsUploaded: true,
    healthQuestionnaireCompleted: false,
    totalPoints: 200
  }),

  // Fully unlocked
  unlocked: () => setDemoOnboardingProgress({
    profileComplete: true,
    documentsUploaded: true,
    healthQuestionnaireCompleted: true,
    totalPoints: 300
  }),

  // Reset all progress
  reset: () => {
    localStorage.removeItem('profile_completed');
    localStorage.removeItem('documents_uploaded');
    localStorage.removeItem('health_questionnaire_completed');
    localStorage.removeItem('demo_points');
    console.log('🔄 Demo progress reset');
  }
};

// Make available in browser console for testing
if (typeof window !== 'undefined') {
  (window as any).interviewDemo = demoPresets;
  console.log('🎮 Interview unlock demo controls available:');
  console.log('  interviewDemo.locked() - Lock the interview');
  console.log('  interviewDemo.partial() - Set partial progress');
  console.log('  interviewDemo.almostComplete() - Almost ready to unlock');
  console.log('  interviewDemo.unlocked() - Fully unlock interview');
  console.log('  interviewDemo.reset() - Reset all progress');
}