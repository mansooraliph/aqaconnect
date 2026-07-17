import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api',
});

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { refreshToken, setAccessToken, clear } = useAuthStore.getState();
  if (!refreshToken) {
    clear();
    throw new Error('No refresh token available');
  }

  try {
    const response = await axios.post(
      `${api.defaults.baseURL}/auth/refresh`,
      { refreshToken },
    );
    const newAccessToken: string = response.data.accessToken;
    // The old refresh token is rotated server-side; persist the new one too.
    useAuthStore.setState({ refreshToken: response.data.refreshToken });
    setAccessToken(newAccessToken);
    return newAccessToken;
  } catch (err) {
    clear();
    throw err;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const newAccessToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch {
        window.location.assign('/login');
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);
