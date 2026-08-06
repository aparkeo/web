import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InstitucionesPage from '@/app/instituciones/page';
import { SUPPORT_CONTACT_EMAIL } from '@/lib/support';

// La página es async y lee la cookie de idioma en servidor; sin cookie → español.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

/**
 * La landing /instituciones es presentacional: basta un test de
 * render que verifique el contenido clave, el mailto de contacto y la
 * ausencia de cifras de tracción inventadas.
 */
describe('Página /instituciones', () => {
  it('muestra el hero, las capacidades y el modelo de colaboración', async () => {
    render(await InstitucionesPage());

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /datos de movilidad pmr en tiempo real/i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Qué ofrece la plataforma' })).toBeInTheDocument();
    expect(screen.getByText('Mapa en tiempo real de plazas PMR')).toBeInTheDocument();
    expect(screen.getByText('Datos agregados de ocupación y demanda')).toBeInTheDocument();
    expect(screen.getByText('Canal ciudadano verificado')).toBeInTheDocument();
    expect(screen.getByText('Tecnología transparente y auditable')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Por qué ahora' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Modelo de colaboración' })).toBeInTheDocument();
    expect(screen.getByText('Piloto gratuito de 6 meses')).toBeInTheDocument();
    expect(screen.getByText('Evaluación con datos reales')).toBeInTheDocument();
    expect(screen.getByText('Acuerdo de mantenimiento y extensión')).toBeInTheDocument();
  });

  it('los CTAs de contacto son mailto con el asunto institucional pre-rellenado', async () => {
    render(await InstitucionesPage());

    const ctas = screen.getAllByRole('link', { name: /contactar para colaborar/i });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    for (const cta of ctas) {
      const href = cta.getAttribute('href') ?? '';
      expect(href.startsWith(`mailto:${SUPPORT_CONTACT_EMAIL}`)).toBe(true);
      expect(href).toContain(encodeURIComponent('Colaboración institucional — Aparkeo'));
    }
  });

  it('enlaza a /apoyo para particulares y no inventa cifras de tracción', async () => {
    const { container } = render(await InstitucionesPage());

    expect(screen.getByRole('link', { name: /apoyar el proyecto/i })).toHaveAttribute(
      'href',
      '/apoyo',
    );

    // La página habla de capacidades, no de estadísticas de uso: ningún
    // patrón tipo "843 usuarios" / "120 reportes" debe aparecer en el texto.
    expect(container.textContent).not.toMatch(/\d+\s+(usuarios|reportes|plazas reportadas)/i);
  });
});
