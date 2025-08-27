import { NextRequest, NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';

/**
 * Telemedicine Eligibility Check API
 * Checks if user is eligible for telemedicine services
 */

interface EligibilityRequirements {
  registration: {
    completed: boolean;
    health_questionnaire: boolean;
    documents_uploaded: boolean;
    profile_complete: boolean;
  };
  health: {
    questionnaire_completed: boolean;
    no_high_risk_conditions: boolean;
    age_appropriate: boolean;
  };
  technical: {
    device_compatible: boolean;
    internet_stable: boolean;
    platform_supported: boolean;
  };
  legal: {
    consent_given: boolean;
    terms_accepted: boolean;
    privacy_acknowledged: boolean;
  };
}

interface EligibilityResponse {
  eligible: boolean;
  requirements: EligibilityRequirements;
  missing_requirements: string[];
  next_steps: string[];
  estimated_time_to_eligible: number; // in minutes
}

export async function GET(request: NextRequest) {
  try {
    // Get authentication info from cookies
    const cookieStore = cookies();
    const headersList = headers();
    
    // Check if user is authenticated
    const authToken = cookieStore.get('auth_token')?.value;
    const authenticated = cookieStore.get('authenticated')?.value === 'true';
    
    if (!authenticated && !authToken) {
      return NextResponse.json({
        error: 'Authentication required',
        message: 'You must be logged in to check eligibility'
      }, { status: 401 });
    }

    // Get user agent for device compatibility check
    const userAgent = headersList.get('user-agent') || '';
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
    const isModernBrowser = !/MSIE|Trident/i.test(userAgent);

    // For now, simulate eligibility check based on authentication status
    // In a real implementation, this would check database records
    const requirements: EligibilityRequirements = {
      registration: {
        completed: true, // Assume completed since user is logged in
        health_questionnaire: true, // Would check database
        documents_uploaded: true, // Would check document upload status
        profile_complete: true // Would check profile completion
      },
      health: {
        questionnaire_completed: true, // Would check health questionnaire completion
        no_high_risk_conditions: true, // Would analyze health data
        age_appropriate: true // Would check age from profile
      },
      technical: {
        device_compatible: isModernBrowser,
        internet_stable: true, // Assume stable (could add speed test)
        platform_supported: true // Support all modern platforms
      },
      legal: {
        consent_given: true, // Would check LGPD consent
        terms_accepted: true, // Would check terms acceptance
        privacy_acknowledged: true // Would check privacy policy acceptance
      }
    };

    // Determine eligibility
    const missingRequirements: string[] = [];
    const nextSteps: string[] = [];
    
    // Check each requirement category
    Object.entries(requirements).forEach(([category, checks]) => {
      Object.entries(checks).forEach(([requirement, met]) => {
        if (!met) {
          missingRequirements.push(`${category}.${requirement}`);
          
          // Add appropriate next steps
          switch (`${category}.${requirement}`) {
            case 'registration.health_questionnaire':
              nextSteps.push('Complete health questionnaire');
              break;
            case 'registration.documents_uploaded':
              nextSteps.push('Upload required documents');
              break;
            case 'registration.profile_complete':
              nextSteps.push('Complete profile information');
              break;
            case 'health.questionnaire_completed':
              nextSteps.push('Finish health assessment');
              break;
            case 'technical.device_compatible':
              nextSteps.push('Use a compatible device/browser');
              break;
            case 'legal.consent_given':
              nextSteps.push('Provide LGPD consent');
              break;
            case 'legal.terms_accepted':
              nextSteps.push('Accept terms of service');
              break;
            case 'legal.privacy_acknowledged':
              nextSteps.push('Acknowledge privacy policy');
              break;
          }
        }
      });
    });

    const eligible = missingRequirements.length === 0;
    const estimatedTimeToEligible = missingRequirements.length * 5; // 5 minutes per requirement

    const response: EligibilityResponse = {
      eligible,
      requirements,
      missing_requirements: missingRequirements,
      next_steps: nextSteps,
      estimated_time_to_eligible: estimatedTimeToEligible
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Eligibility check error:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to check eligibility',
      eligible: false,
      requirements: {} as EligibilityRequirements,
      missing_requirements: ['system.error'],
      next_steps: ['Try again later'],
      estimated_time_to_eligible: 0
    }, { status: 500 });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}