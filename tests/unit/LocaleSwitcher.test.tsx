import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { getDictionary } from '@/lib/i18n';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

function renderSwitcher(locale: 'es' | 'gl' = 'es') {
  return render(
    <I18nProvider locale={locale} dict={getDictionary(locale)}>
      <LocaleSwitcher />
    </I18nProvider>,
  );
}

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    refresh.mockClear();
    // Limpia la cookie entre tests.
    document.cookie = 'lang=; path=/; max-age=0';
  });

  it('marca el idioma activo con aria-pressed y no hace nada al pulsarlo de nuevo', () => {
    renderSwitcher('es');

    const es = screen.getByRole('button', { name: 'ES' });
    const gl = screen.getByRole('button', { name: 'GL' });
    expect(es).toHaveAttribute('aria-pressed', 'true');
    expect(gl).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(es);
    expect(refresh).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain('lang=');
  });

  it('al pulsar GL escribe la cookie lang=gl (1 año) y refresca el App Router', () => {
    renderSwitcher('es');

    fireEvent.click(screen.getByRole('button', { name: 'GL' }));

    expect(document.cookie).toContain('lang=gl');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('con gallego activo, al pulsar ES escribe lang=es y refresca', () => {
    renderSwitcher('gl');

    const gl = screen.getByRole('button', { name: 'GL' });
    expect(gl).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'ES' }));

    expect(document.cookie).toContain('lang=es');
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
