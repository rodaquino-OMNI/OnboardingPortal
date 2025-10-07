import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { trackAnalyticsEvent } from '@/lib/analytics';

interface PresignResponse {
  upload_url: string;
  path: string;
  expires_at: string;
}

interface SubmitResponse {
  document_id: number;
  status: string;
  submitted_at: string;
}

export function useDocumentUpload() {
  const queryClient = useQueryClient();

  const presignMutation = useMutation({
    mutationFn: async ({ filename, type }: { filename: string; type: string }) => {
      const response = await api.post<PresignResponse>('/api/documents/presign', {
        filename,
        type,
      });
      return response.data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, presignedUrl }: { file: File; presignedUrl: string }) => {
      await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async ({ path, type }: { path: string; type: string }) => {
      const response = await api.post<SubmitResponse>('/api/documents/submit', {
        path,
        type,
      });

      // Track analytics (client-side tracking delegates to backend)
      trackAnalyticsEvent('documents.upload_completed', {
        document_type: type,
      });

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const handleUpload = async (file: File, type: string) => {
    try {
      // Step 1: Get presigned URL
      const presignData = await presignMutation.mutateAsync({
        filename: file.name,
        type,
      });

      // Step 2: Upload to storage
      await uploadMutation.mutateAsync({
        file,
        presignedUrl: presignData.upload_url,
      });

      // Step 3: Submit to backend
      const submitData = await submitMutation.mutateAsync({
        path: presignData.path,
        type,
      });

      return submitData;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  };

  return {
    handleUpload,
    isUploading: presignMutation.isPending || uploadMutation.isPending || submitMutation.isPending,
    error: presignMutation.error || uploadMutation.error || submitMutation.error,
  };
}
