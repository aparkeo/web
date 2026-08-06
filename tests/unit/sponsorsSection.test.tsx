import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SponsorsSection } from '@/components/SponsorsSection';

describe('SponsorsSection', () => {
  it('sin patrocinadores invita a negocios locales con un mailto de contacto', () => {
    render(<SponsorsSection sponsors={[]} />);

    expect(screen.getByRole('heading', { name: /¿tu negocio\?/i })).toBeInTheDocument();
    expect(screen.getByText(/¿Tienes un negocio y quieres apoyar la movilidad accesible/)).toBeInTheDocument();

    const cta = screen.getByRole('link', { name: /quiero patrocinar/i });
    expect(cta).toHaveAttribute('href', expect.stringMatching(/^mailto:/));
    expect(cta.getAttribute('href')).toContain(encodeURIComponent('Patrocinio de Aparkeo'));
  });

  it('con patrocinadores los muestra en grid con enlaces seguros', () => {
    render(
      <SponsorsSection
        sponsors={[
          { name: 'Cafetería Ejemplo', url: 'https://ejemplo.es' },
          { name: 'Taller Sin Web' },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Con el apoyo de' })).toBeInTheDocument();

    const linked = screen.getByRole('link', { name: 'Cafetería Ejemplo' });
    expect(linked).toHaveAttribute('href', 'https://ejemplo.es');
    expect(linked).toHaveAttribute('target', '_blank');
    expect(linked).toHaveAttribute('rel', expect.stringContaining('noopener'));

    // Sin url no hay enlace: solo el nombre en texto.
    expect(screen.getByText('Taller Sin Web')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Taller Sin Web' })).not.toBeInTheDocument();
  });
});
