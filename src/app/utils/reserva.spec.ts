import { describe, expect, it } from 'vitest';
import { dividirReserva } from './reserva';

describe('dividirReserva', () => {
  it('quantidade dentro do saldo fica toda disponível', () => {
    expect(dividirReserva(3, 10)).toEqual({ agora: 3, reserva: 0 });
  });
  it('acima do saldo divide', () => {
    expect(dividirReserva(10, 6)).toEqual({ agora: 6, reserva: 4 });
  });
  it('saldo zero ou negativo vira tudo reserva', () => {
    expect(dividirReserva(2, 0)).toEqual({ agora: 0, reserva: 2 });
    expect(dividirReserva(2, -5)).toEqual({ agora: 0, reserva: 2 });
  });
  it('saldo fracionado é arredondado para baixo', () => {
    expect(dividirReserva(5, 2.7)).toEqual({ agora: 2, reserva: 3 });
  });
});
