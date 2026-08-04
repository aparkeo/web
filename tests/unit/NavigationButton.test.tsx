import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NavigationButton } from '@/components/NavigationButton';

describe('NavigationButton', () => {
  it('enlaza a Google Maps con las coordenadas y etiqueta accesible', () => {
    render(<NavigationButton lat={42.24} lon={-8.72} street="Rúa do Príncipe" />);
    const link = screen.getByRole('link', { name: /Cómo llegar a Rúa do Príncipe/ });
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=42.24,-8.72&travelmode=driving');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText('Llévame')).toBeInTheDocument();
  });

  it('acepta className para reforzar el peso visual del CTA', () => {
    render(<NavigationButton lat={42.24} lon={-8.72} className="font-bold" />);
    expect(screen.getByRole('link').className).toContain('font-bold');
  });
});
