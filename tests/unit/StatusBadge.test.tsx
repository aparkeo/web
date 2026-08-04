import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/StatusBadge';

// Patrón base para tests de componentes con Testing Library + jsdom.
describe('StatusBadge', () => {
  it('muestra "Libre" con estilo success para FREE', () => {
    render(<StatusBadge status="FREE" />);
    const badge = screen.getByText('Libre');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-free/15');
  });

  it('muestra "Ocupada" con estilo destructive para OCCUPIED', () => {
    render(<StatusBadge status="OCCUPIED" />);
    const badge = screen.getByText('Ocupada');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-destructive/15');
  });

  it('muestra "Sin datos" con estilo muted para UNKNOWN', () => {
    render(<StatusBadge status="UNKNOWN" />);
    const badge = screen.getByText('Sin datos');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-unknown/15');
  });
});
