'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MapPin, Flag, Users, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/admin', label: 'Resumen', icon: LayoutDashboard },
  { href: '/admin/spots', label: 'Plazas', icon: MapPin },
  { href: '/admin/reports', label: 'Reportes', icon: Flag },
  { href: '/admin/users', label: 'Usuarios', icon: Users },
  { href: '/admin/export', label: 'Exportar datos', icon: Download },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border md:block">
      <nav className="sidebar-scroll sticky top-16 flex max-h-[calc(100vh-4rem)] flex-col gap-1 overflow-y-auto p-4" aria-label="Navegación de administración">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors duration-150',
                active
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
              )}
            >
              <link.icon className="h-4 w-4" /> {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
