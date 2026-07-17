import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

export interface Branch {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export function useBranches() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await api.get<Branch[]>('/branches');
      return response.data;
    },
    enabled: hasPermission('system.branches.view'),
  });
}
