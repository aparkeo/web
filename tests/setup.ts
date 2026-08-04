import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Limpieza del DOM entre tests de componentes.
afterEach(() => {
  cleanup();
});
