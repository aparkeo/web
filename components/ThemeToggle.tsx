'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/components/i18n/I18nProvider';

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useT();

  useEffect(() => setMounted(true), []);

  // Placeholder del mismo tamaño hasta montar: evita mismatch de hidratación y saltos de layout
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" disabled aria-hidden="true" tabIndex={-1}>
        <Sun className="h-5 w-5 opacity-0" />
      </Button>
    );
  }

  const OPTIONS = [
    { value: 'light', label: t.theme.light, icon: Sun },
    { value: 'dark', label: t.theme.dark, icon: Moon },
    { value: 'system', label: t.theme.system, icon: Monitor },
  ] as const;

  const isDark = resolvedTheme === 'dark';
  const CurrentIcon = isDark ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11"
          aria-label={isDark ? t.theme.toLight : t.theme.toDark}
        >
          <CurrentIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
            aria-checked={theme === option.value}
            role="menuitemradio"
          >
            <option.icon className="mr-2 h-4 w-4" />
            {option.label}
            {theme === option.value ? <Check className="ml-auto h-4 w-4" aria-hidden="true" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
