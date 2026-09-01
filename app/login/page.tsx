'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/I18nProvider';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);

    if (res?.status === 429) {
      setError(t.auth.tooManyAttempts);
      toast.error(t.auth.tooManyAttempts);
      return;
    }
    if (res?.error) {
      setError(t.auth.invalidCredentials);
      toast.error(t.auth.invalidCredentials);
      return;
    }
    toast.success(t.auth.sessionStarted);
    router.push('/');
    router.refresh();
  };

  return (
    <div className="home-hero">
      <div className="container flex min-h-[80vh] max-w-md items-center py-8">
        <Card className="home-fade-up w-full rounded-2xl shadow-elevated">
          <CardHeader className="gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t.auth.brand}</p>
            <CardTitle className="text-2xl font-extrabold tracking-tight">{t.auth.loginTitle}</CardTitle>
            <CardDescription>{t.auth.loginSubtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t.auth.email}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="h-12 rounded-xl text-base shadow-sm transition-[box-shadow,border-color] duration-200 focus-visible:shadow-md"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t.auth.password}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="h-12 rounded-xl text-base shadow-sm transition-[box-shadow,border-color] duration-200 focus-visible:shadow-md"
                />
              </div>
              {error ? (
                <p id="login-error" role="alert" className="text-sm font-semibold text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="btn-cta min-h-12 w-full rounded-xl text-base font-bold" disabled={loading}>
                {loading ? t.auth.loggingIn : t.auth.loginTitle}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t.auth.noAccount}{' '}
              <Link
                href="/register"
                className="rounded font-semibold text-primary transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t.auth.createAccount}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
