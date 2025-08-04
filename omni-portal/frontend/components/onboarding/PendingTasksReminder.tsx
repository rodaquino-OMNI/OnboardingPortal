'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, FileText, Clock, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PendingTasksReminderProps {
  className?: string;
}

interface PartialProgress {
  documentUploads: Record<string, any>;
  completionStats: {
    total: number;
    completed: number;
    pending: number;
    pendingDocs: Array<{ id: string; name: string; }>;
    isComplete: boolean;
  };
  timestamp: number;
  step: string;
}

export function PendingTasksReminder({ className = '' }: PendingTasksReminderProps) {
  const router = useRouter();
  const [partialProgress, setPartialProgress] = useState<PartialProgress | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check for partial progress in localStorage
    const savedProgress = localStorage.getItem('onboarding_partial_progress');
    if (savedProgress) {
      try {
        const progress: PartialProgress = JSON.parse(savedProgress);
        
        // Only show if there are pending documents and it's recent (within 7 days)
        const isRecent = Date.now() - progress.timestamp < 7 * 24 * 60 * 60 * 1000;
        const hasPendingTasks = !progress.completionStats.isComplete;
        
        if (isRecent && hasPendingTasks) {
          setPartialProgress(progress);
        }
      } catch (error) {
        // Invalid progress data, remove it
        localStorage.removeItem('onboarding_partial_progress');
      }
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    // Store dismissal with timestamp
    localStorage.setItem('pending_tasks_dismissed', Date.now().toString());
  };

  const handleGoToDocuments = () => {
    router.push('/document-upload');
  };

  // Don't show if dismissed or no pending tasks
  if (isDismissed || !partialProgress) {
    return null;
  }

  const daysSince = Math.floor((Date.now() - partialProgress.timestamp) / (24 * 60 * 60 * 1000));

  return (
    <Alert className={`border-amber-200 bg-amber-50 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <FileText className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <AlertDescription className="text-amber-800">
              <div className="font-medium mb-1">
                📋 Documentos pendentes no onboarding
              </div>
              <div className="text-sm mb-2">
                Você tem <span className="font-semibold">{partialProgress.completionStats.pending} documento(s)</span> pendente(s) de upload:
              </div>
              <ul className="text-xs space-y-1 mb-3">
                {partialProgress.completionStats.pendingDocs.slice(0, 2).map((doc) => (
                  <li key={doc.id} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                    {doc.name}
                  </li>
                ))}
                {partialProgress.completionStats.pendingDocs.length > 2 && (
                  <li className="text-amber-600 font-medium">
                    +{partialProgress.completionStats.pendingDocs.length - 2} mais...
                  </li>
                )}
              </ul>
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <Clock className="w-3 h-3" />
                {daysSince === 0 ? 'Hoje' : `${daysSince} dia(s) atrás`}
              </div>
            </AlertDescription>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            onClick={handleGoToDocuments}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 h-auto"
          >
            Completar
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-100 p-1 h-auto"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Alert>
  );
}