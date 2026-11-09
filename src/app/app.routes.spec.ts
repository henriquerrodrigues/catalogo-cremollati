import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('rotas', () => {
  it('sem token não há catálogo', () => {
    const caminhos = routes.map(r => [r.path, r.redirectTo]);
    expect(caminhos).toContainEqual(['', '/link-invalido']);
    expect(caminhos).toContainEqual(['**', '/link-invalido']);
    expect(routes.some(r => r.path === 'c/:token')).toBe(true);
    expect(routes.some(r => r.path === 'c/:token/enviado')).toBe(true);
  });
});
