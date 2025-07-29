'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Video, Calendar, Clock, User, 
  FileText, Activity, Shield 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VideoConferencing } from '@/components/video/VideoConferencing';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';

interface Interview {
  id: string;
  booking_reference: string;
  status: string;
  scheduled_at: string;
  healthcare_professional: {
    id: string;
    name: string;
  };
  beneficiary: {
    id: string;
    name: string;
  };
}

export default function VideoConsultationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const interviewId = searchParams.get('interview');
  
  const { user, isAuthenticated } = useAuth();
  const { get } = useApi();
  
  const [interview, setInterview] = useState<Interview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [hipaaConsent, setHipaaConsent] = useState(false);

  // Load interview data
  useEffect(() => {
    const loadInterview = async () => {
      if (!interviewId || !isAuthenticated) {
        setError('Interview ID required');
        setIsLoading(false);
        return;
      }

      try {
        const response = await get(`/api/interviews/${interviewId}`);
        if (response.success) {
          setInterview(response.interview);
          
          // Check HIPAA consent
          const consentResponse = await get('/api/lgpd/privacy-settings');
          if (consentResponse.success) {
            setHipaaConsent(consentResponse.settings.hipaa_telehealth || false);
          }
        } else {
          setError(response.message || 'Interview not found');
        }
      } catch (err) {
        setError('Failed to load interview details');
      } finally {
        setIsLoading(false);
      }
    };

    loadInterview();
  }, [interviewId, isAuthenticated, get]);

  // Handle session end
  const handleSessionEnd = (sessionData: any) => {
    setShowVideo(false);
    // Could redirect to session summary or feedback page
    router.push(`/home?session_completed=${sessionData.id}`);
  };

  // Handle video errors
  const handleVideoError = (error: string) => {
    setError(`Video error: ${error}`);
    setShowVideo(false);
  };

  // Start video consultation
  const startConsultation = () => {
    if (!hipaaConsent) {
      setError('HIPAA consent required for telehealth consultations');
      return;
    }
    setShowVideo(true);
  };

  // Accept HIPAA consent
  const acceptHipaaConsent = async () => {
    try {
      const response = await get('/api/lgpd/privacy-settings');
      if (response.success) {
        // Update HIPAA consent - in a real implementation this would be a PUT request
        setHipaaConsent(true);
      }
    } catch (err) {
      setError('Failed to update HIPAA consent');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please log in to access video consultations</p>
          <Button onClick={() => router.push('/auth/login')}>
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading consultation details...</p>
        </div>
      </div>
    );
  }

  if (error && !interview) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-600">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => router.push('/home')}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (showVideo && interview) {
    return (
      <VideoConferencing
        interviewId={interview.id}
        participantInfo={{
          id: user?.id || '',
          name: user?.name || '',
          role: user?.id === interview.healthcare_professional.id ? 'doctor' : 'patient'
        }}
        onSessionEnd={handleSessionEnd}
        onError={handleVideoError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Video Consultation
          </h1>
          <p className="text-gray-600">
            Secure, HIPAA-compliant telehealth consultation
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* HIPAA Consent Alert */}
        {!hipaaConsent && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <Shield className="w-4 h-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <strong>HIPAA Consent Required</strong>
                  <p className="text-sm mt-1">
                    You must consent to HIPAA terms for telehealth services
                  </p>
                </div>
                <Button size="sm" onClick={acceptHipaaConsent}>
                  Accept HIPAA Terms
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main consultation card */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-full">
                    <Video className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Ready to Connect</h2>
                    <p className="text-gray-600">High-quality video consultation</p>
                  </div>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  HIPAA Compliant
                </Badge>
              </div>

              {interview && (
                <div className="space-y-4 mb-6">
                  {/* Interview details */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium">Scheduled</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {new Date(interview.scheduled_at).toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium">Healthcare Provider</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {interview.healthcare_professional.name}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Status:</span>
                      <Badge variant={interview.status === 'confirmed' ? 'default' : 'secondary'}>
                        {interview.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      Reference: {interview.booking_reference}
                    </div>
                  </div>
                </div>
              )}

              {/* Start button */}
              <div className="text-center">
                <Button
                  size="lg"
                  onClick={startConsultation}
                  disabled={!hipaaConsent || (interview?.status !== 'confirmed' && interview?.status !== 'scheduled')}
                  className="px-8 py-3"
                >
                  <Video className="w-5 h-5 mr-2" />
                  Start Video Consultation
                </Button>
                
                {!hipaaConsent && (
                  <p className="text-sm text-gray-500 mt-2">
                    HIPAA consent required to start consultation
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar information */}
          <div className="space-y-6">
            {/* Features */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Video Features</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Video className="w-4 h-4 text-blue-500" />
                  HD Video & Audio
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-green-500" />
                  End-to-End Encryption
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-purple-500" />
                  Session Recording
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="w-4 h-4 text-orange-500" />
                  Screen Sharing
                </div>
              </div>
            </Card>

            {/* Technical requirements */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Requirements</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Stable internet connection</p>
                <p>• Camera and microphone access</p>
                <p>• Modern web browser</p>
                <p>• Quiet, private environment</p>
              </div>
            </Card>

            {/* Support */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Need Help?</h3>
              <p className="text-sm text-gray-600 mb-3">
                If you experience technical issues during your consultation:
              </p>
              <Button variant="outline" size="sm" className="w-full">
                Contact Support
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}