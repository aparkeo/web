'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { MapPin, Menu, LayoutDashboard, BarChart3, LineChart, User, LogOut, ShieldCheck, Flag, Download } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useInstallMenu } from '@/components/InstallPrompt';

const NAV_LINKS = [
  { href: '/map', label: 'Mapa', icon: MapPin },
  { href: '/stats', label: 'Estadísticas', icon: BarChart3 },
  { href: '/analytics', label: 'Analítica', icon: LineChart },
  { href: '/report', label: 'Reportar', icon: Flag },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { canInstall, openInstall } = useInstallMenu();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            M
          </span>
          MinusVigo
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors duration-150',
                pathname?.startsWith(link.href)
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
              )}
              aria-current={pathname?.startsWith(link.href) ? 'page' : undefined}
            >
              <link.icon className="h-4 w-4" /> {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {session?.user ? (
            <>
              <NotificationBell />
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>{session.user.name?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
                  </Avatar>
                  {session.user.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" /> Mi perfil
                  </Link>
                </DropdownMenuItem>
                {session.user.role === 'ADMIN' ? (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <ShieldCheck className="mr-2 h-4 w-4" /> Panel admin
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {canInstall ? (
                  <DropdownMenuItem onClick={openInstall}>
                    <Download className="mr-2 h-4 w-4" /> Instalar app
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild className="rounded-full">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild className="btn-cta rounded-full px-5">
                <Link href="/register">Crear cuenta</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          {session?.user ? <NotificationBell /> : null}
          <Button
            ref={toggleRef}
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-border md:hidden"
          onKeyDown={(e) => {
            // Escape cierra el menú y devuelve el foco al botón que lo abrió
            if (e.key === 'Escape') {
              setOpen(false);
              toggleRef.current?.focus();
            }
          }}
        >
          <nav className="container flex flex-col gap-1 py-3" aria-label="Navegación móvil">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors duration-150',
                  pathname?.startsWith(link.href)
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
                )}
                aria-current={pathname?.startsWith(link.href) ? 'page' : undefined}
              >
                <link.icon className="h-4 w-4" /> {link.label}
              </Link>
            ))}
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors duration-150',
                pathname?.startsWith('/profile')
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
              )}
              aria-current={pathname?.startsWith('/profile') ? 'page' : undefined}
            >
              <User className="h-4 w-4" /> {session?.user ? 'Mi perfil' : 'Entrar'}
            </Link>
            {session?.user?.role === 'ADMIN' ? (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors duration-150',
                  pathname?.startsWith('/admin')
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
                )}
                aria-current={pathname?.startsWith('/admin') ? 'page' : undefined}
              >
                <LayoutDashboard className="h-4 w-4" /> Panel admin
              </Link>
            ) : null}
            {canInstall ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openInstall();
                }}
                className="flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-left text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:bg-secondary/70 hover:text-foreground"
              >
                <Download className="h-4 w-4" /> Instalar app
              </button>
            ) : null}
            {session?.user ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-left text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:bg-secondary/70 hover:text-foreground"
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
