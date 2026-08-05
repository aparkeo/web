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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);

    if (res?.error) {
      setError('Email o contraseña incorrectos');
      toast.error('Email o contraseña incorrectos');
      return;
    }
    toast.success('Sesión iniciada');
    router.push('/');
    router.refresh();
  };

  return (
    <div className="home-hero">
      <div className="container flex min-h-[80vh] max-w-md items-center py-8">
        <Card className="home-fade-up w-full rounded-2xl shadow-elevated">
          <CardHeader className="gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Aparkeo</p>
            <CardTitle className="text-2xl font-extrabold tracking-tight">Entrar</CardTitle>
            <CardDescription>Accede a tu cuenta de Aparkeo</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
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
                <Label htmlFor="password">Contraseña</Label>
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
                {loading ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              ¿No tienes cuenta?{' '}
              <Link
                href="/register"
                className="rounded font-semibold text-primary transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Crear cuenta
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
