'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { MapPin, Menu, LayoutDashboard, BarChart3, User, LogOut, ShieldCheck, Flag } from 'lucide-react';
import { useState } from 'react';
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

const NAV_LINKS = [
  { href: '/map', label: 'Mapa', icon: MapPin },
  { href: '/stats', label: 'Estadísticas', icon: BarChart3 },
  { href: '/report', label: 'Reportar', icon: Flag },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-extrabold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
                'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:bg-secondary',
                pathname?.startsWith(link.href) && 'bg-secondary',
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
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Crear cuenta</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          {session?.user ? <NotificationBell /> : null}
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-border md:hidden">
          <nav className="container flex flex-col gap-1 py-3" aria-label="Navegación móvil">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold hover:bg-secondary',
                  pathname?.startsWith(link.href) && 'bg-secondary',
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
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold hover:bg-secondary',
                pathname?.startsWith('/profile') && 'bg-secondary',
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
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold hover:bg-secondary',
                  pathname?.startsWith('/admin') && 'bg-secondary',
                )}
                aria-current={pathname?.startsWith('/admin') ? 'page' : undefined}
              >
                <LayoutDashboard className="h-4 w-4" /> Panel admin
              </Link>
            ) : null}
            {session?.user ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-secondary"
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
