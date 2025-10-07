import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useFeatureFlag(flagKey: string) {
  return useQuery({
    queryKey: ['feature-flag', flagKey],
    queryFn: async () => {
      const response = await api.get(`/api/feature-flags/${flagKey}`);
      return response.data.enabled;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
