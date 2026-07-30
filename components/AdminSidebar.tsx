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
      <nav className="sticky top-16 flex flex-col gap-1 p-4">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:bg-secondary',
                active && 'bg-secondary text-primary',
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
