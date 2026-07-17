import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

/**
 * Generic CRUD hook factory for a branch-scoped REST resource at
 * `/branches/:branchId/<path>`. Used across Configuration screens so each
 * screen only wires up its own columns/form, not its own fetching logic.
 */
export function useBranchResource<T = unknown>(branchId: string | undefined, path: string) {
  const queryClient = useQueryClient();
  const basePath = `/branches/${branchId}/${path}`;
  const queryKey = [path, branchId];

  const list = useQuery({
    queryKey,
    queryFn: async () => (await api.get<T[]>(basePath)).data,
    enabled: Boolean(branchId),
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<T>) => (await api.post<T>(basePath, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<T> }) =>
      (await api.patch<T>(`${basePath}/${id}`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { list, create, update, basePath, queryKey };
}

/** Same as useBranchResource but for global (non-branch-scoped) resources like Surahs. */
export function useGlobalResource<T = unknown>(path: string) {
  const queryClient = useQueryClient();
  const queryKey = [path];

  const list = useQuery({
    queryKey,
    queryFn: async () => (await api.get<T[]>(`/${path}`)).data,
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<T>) => (await api.post<T>(`/${path}`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<T> }) =>
      (await api.patch<T>(`/${path}/${id}`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { list, create, update, queryKey };
}
