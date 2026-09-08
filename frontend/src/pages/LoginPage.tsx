import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const {
        token,
        refresh_token,
        id,
        username,
        email: userEmail,
        name,
        image,
        position,
        branchId,
        isGlobal,
        roles,
        permissionKeys,
      } = response.data;
      setSession(token, refresh_token, {
        id,
        username,
        email: userEmail,
        name,
        image,
        position,
        branchId,
        isGlobal,
        roles,
        permissionKeys,
      });
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-page">
      <div className="w-full max-w-[380px] rounded-card border border-border bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-xl font-bold text-text-primary">
          AQA Management Portal
        </h1>
        {error && (
          <div className="mb-4 rounded-card border border-red/30 bg-red/10 px-3 py-2 text-sm text-red">
            {error}
          </div>
        )}
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Username or email" required>
            <Input
              type="text"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password" required>
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            Log in
          </Button>
        </form>
      </div>
    </div>
  );
}
