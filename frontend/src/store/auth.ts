import { create } from 'zustand';

export interface RoleGrant {
  id: string;
  name: string;
  scope: 'GLOBAL' | 'BRANCH';
  branchId: string | null;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  name: string;
  image: string | null;
  position: string | null;
  branchId: string | null;
  isGlobal: boolean;
  roles: RoleGrant[];
  permissionKeys: string[];
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  activeBranchId: string | null;
  setSession: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
  setActiveBranchId: (branchId: string | null) => void;
  clear: () => void;
  hasPermission: (key: string) => boolean;
}

const STORAGE_KEY = 'aqa_auth';

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
      activeBranchId: string | null;
    };
  } catch {
    return null;
  }
}

function persist(state: Pick<AuthState, 'accessToken' | 'refreshToken' | 'user' | 'activeBranchId'>) {
  if (!state.accessToken || !state.refreshToken || !state.user) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const persisted = loadPersisted();

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: persisted?.accessToken ?? null,
  refreshToken: persisted?.refreshToken ?? null,
  user: persisted?.user ?? null,
  activeBranchId: persisted?.activeBranchId ?? persisted?.user?.branchId ?? null,

  setSession: (accessToken, refreshToken, user) => {
    const activeBranchId = user.branchId;
    set({ accessToken, refreshToken, user, activeBranchId });
    persist({ accessToken, refreshToken, user, activeBranchId });
  },

  setAccessToken: (accessToken) => {
    set({ accessToken });
    const { refreshToken, user, activeBranchId } = get();
    persist({ accessToken, refreshToken, user, activeBranchId });
  },

  setActiveBranchId: (activeBranchId) => {
    set({ activeBranchId });
    const { accessToken, refreshToken, user } = get();
    persist({ accessToken, refreshToken, user, activeBranchId });
  },

  clear: () => {
    set({ accessToken: null, refreshToken: null, user: null, activeBranchId: null });
    localStorage.removeItem(STORAGE_KEY);
  },

  hasPermission: (key) => get().user?.permissionKeys?.includes(key) ?? false,
}));
