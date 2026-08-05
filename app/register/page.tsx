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

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; form?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación cliente antes de llamar a la API
    const nextErrors: typeof errors = {};
    if (password.length < 8) nextErrors.password = 'La contraseña debe tener al menos 8 caracteres';
    if (confirmPassword !== password) nextErrors.confirmPassword = 'Las contraseñas no coinciden';
    setErrors(nextErrors);
    if (nextErrors.password || nextErrors.confirmPassword) return;

    setLoading(true);

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Error al crear la cuenta' }));
      const message = body.error ?? 'Error al crear la cuenta';
      setErrors({ form: message });
      toast.error(message);
      setLoading(false);
      return;
    }

    await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    toast.success('Cuenta creada');
    router.push('/');
    router.refresh();
  };

  return (
    <div className="home-hero">
      <div className="container flex min-h-[80vh] max-w-md items-center py-8">
        <Card className="home-fade-up w-full rounded-2xl shadow-elevated">
          <CardHeader className="gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Aparkeo</p>
            <CardTitle className="text-2xl font-extrabold tracking-tight">Crear cuenta</CardTitle>
            <CardDescription>Únete a la comunidad Aparkeo</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-xl text-base shadow-sm transition-[box-shadow,border-color] duration-200 focus-visible:shadow-md"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl text-base shadow-sm transition-[box-shadow,border-color] duration-200 focus-visible:shadow-md"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={errors.password ? 'password-hint password-error' : 'password-hint'}
                  aria-invalid={errors.password ? true : undefined}
                  className="h-12 rounded-xl text-base shadow-sm transition-[box-shadow,border-color] duration-200 focus-visible:shadow-md"
                />
                <p id="password-hint" className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres
                </p>
                {errors.password ? (
                  <p id="password-error" role="alert" className="text-sm font-semibold text-destructive">
                    {errors.password}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={errors.confirmPassword ? true : undefined}
                  aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                  className="h-12 rounded-xl text-base shadow-sm transition-[box-shadow,border-color] duration-200 focus-visible:shadow-md"
                />
                {errors.confirmPassword ? (
                  <p id="confirm-password-error" role="alert" className="text-sm font-semibold text-destructive">
                    {errors.confirmPassword}
                  </p>
                ) : null}
              </div>
              {errors.form ? (
                <p role="alert" className="text-sm font-semibold text-destructive">
                  {errors.form}
                </p>
              ) : null}
              <Button type="submit" className="btn-cta min-h-12 w-full rounded-xl text-base font-bold" disabled={loading}>
                {loading ? 'Creando cuenta…' : 'Crear cuenta'}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{' '}
              <Link
                href="/login"
                className="rounded font-semibold text-primary transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
