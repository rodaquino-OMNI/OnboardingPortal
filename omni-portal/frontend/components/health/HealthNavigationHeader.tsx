'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Home, 
  ChevronLeft, 
  Save, 
  Settings, 
  HelpCircle,
  X,
  AlertTriangle,
  Clock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface HealthNavigationHeaderProps {
  progress: number;
  onSave?: () => Promise<boolean>;
  showHomeButton?: boolean;
  showSaveButton?: boolean;
  title?: string;
  subtitle?: string;
  estimatedTimeRemaining?: number; // in minutes
}

export function HealthNavigationHeader({
  progress,
  onSave,
  showHomeButton = true,
  showSaveButton = true, 
  title = "Questionário de Saúde",
  subtitle,
  estimatedTimeRemaining
}: HealthNavigationHeaderProps) {
  const router = useRouter();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleHomeClick = () => {
    // If progress is significant, show confirmation dialog
    if (progress > 10) {
      setShowExitDialog(true);
    } else {
      router.push('/home');
    }
  };

  const handleSaveAndExit = async () => {
    if (onSave) {
      setIsSaving(true);
      setSaveError(null);
      
      try {
        const success = await onSave();
        if (success) {
          // Show success message briefly then navigate
          setShowSaveDialog(true);
          setTimeout(() => {
            router.push('/home');
          }, 1500);
        } else {
          setSaveError('Não foi possível salvar o progresso. Tente novamente.');
        }
      } catch (error) {
        setSaveError('Erro ao salvar. Verifique sua conexão e tente novamente.');
      } finally {
        setIsSaving(false);
      }
    } else {
      router.push('/home');
    }
  };

  const handleExitWithoutSaving = () => {
    router.push('/home');
  };

  const handleQuickSave = async () => {
    if (onSave) {
      setIsSaving(true);
      setSaveError(null);
      
      try {
        const success = await onSave();
        if (success) {
          // Show brief success indication
          setShowSaveDialog(true);
          setTimeout(() => setShowSaveDialog(false), 2000);
        } else {
          setSaveError('Não foi possível salvar.');
        }
      } catch (error) {
        setSaveError('Erro ao salvar.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <>
      <Card className="mb-6 p-4 border-l-4 border-l-blue-500 shadow-sm">
        <div className="flex items-center justify-between">
          {/* Left: Title and Progress */}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                {subtitle && (
                  <p className="text-sm text-gray-600">{subtitle}</p>
                )}
              </div>
            </div>
            
            {/* Progress Info */}
            <div className="mt-3 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Progresso</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              
              {estimatedTimeRemaining && (
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Clock className="w-3 h-3" />
                  <span>~{estimatedTimeRemaining} min</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 ml-4">
            {showSaveButton && onSave && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickSave}
                disabled={isSaving}
                className="min-w-[80px]"
              >
                <Save className="w-4 h-4 mr-1" />
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            )}
            
            {showHomeButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleHomeClick}
                className="min-w-[100px]"
              >
                <Home className="w-4 h-4 mr-1" />
                Dashboard
              </Button>
            )}
          </div>
        </div>

        {/* Save Error */}
        {saveError && (
          <Alert variant="destructive" className="mt-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}
      </Card>

      {/* Exit Confirmation Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deseja sair do questionário?</DialogTitle>
            <DialogDescription>
              Você já respondeu {Math.round(progress)}% das perguntas. 
              {progress > 25 && " Seu progresso pode ser perdido se você sair sem salvar."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            {progress > 25 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Recomendamos salvar seu progresso antes de sair para continuar mais tarde.
                </AlertDescription>
              </Alert>
            )}
            
            {estimatedTimeRemaining && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>Tempo estimado para finalizar: ~{estimatedTimeRemaining} minutos</span>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Continuar Questionário
            </Button>
            
            {onSave && progress > 10 && (
              <Button 
                onClick={handleSaveAndExit}
                disabled={isSaving}
                className="min-w-[120px]"
              >
                {isSaving ? 'Salvando...' : 'Salvar e Sair'}
              </Button>
            )}
            
            <Button 
              variant="destructive" 
              onClick={handleExitWithoutSaving}
            >
              Sair sem Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Success Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Save className="w-4 h-4 text-green-600" />
              </div>
              Progresso Salvo
            </DialogTitle>
            <DialogDescription>
              Seu progresso foi salvo com sucesso. Você pode continuar de onde parou a qualquer momento.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Session restoration banner component
interface SessionRestorationBannerProps {
  lastSavedAt: Date;
  progress: number;
  onRestore: () => void;
  onStartNew: () => void;
}

export function SessionRestorationBanner({
  lastSavedAt,
  progress,
  onRestore,
  onStartNew
}: SessionRestorationBannerProps) {
  const timeAgo = getTimeAgo(lastSavedAt);

  return (
    <Alert className="mb-6 border-blue-200 bg-blue-50">
      <div className="flex items-start justify-between">
        <div className="flex">
          <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="ml-2">
            <h4 className="text-sm font-medium text-blue-900">
              Sessão Anterior Encontrada
            </h4>
            <div className="text-sm text-blue-800 mt-1">
              Você tem um questionário em andamento salvo {timeAgo} ({Math.round(progress)}% completo).
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 ml-4">
          <Button 
            size="sm" 
            onClick={onRestore}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Continuar
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={onStartNew}
          >
            Começar Novo
          </Button>
        </div>
      </div>
    </Alert>
  );
}

// Utility function to get time ago string
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `há ${Math.max(1, diffMinutes)} minuto${diffMinutes > 1 ? 's' : ''}`;
  }
}