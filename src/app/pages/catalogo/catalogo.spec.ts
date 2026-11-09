import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogoComponent } from './catalogo';
import { CatalogoService } from '../../services/catalogo.service';
import { CatalogoResposta } from '../../models/catalogo';

const resposta = (extra: Partial<CatalogoResposta> = {}): CatalogoResposta => ({
  cliente: { nome: 'Sorveteria X' },
  distribuidora: { nome: 'Santo Ângelo' },
  pedidoMinimo: 50,
  itens: [
    { id: 1, sku: 'S1', nome: 'Sorvete', preco: 30, unidade: 'UN', categoria: 'Sorvetes', imagem: '', saldo: 2, disponivel: true },
    { id: 2, sku: 'P1', nome: 'Picolé', preco: 5, unidade: 'UN', categoria: 'Picolés', imagem: '', saldo: 0, disponivel: false }
  ],
  carrinho: [],
  ...extra
});

describe('CatalogoComponent', () => {
  let fixture: ComponentFixture<CatalogoComponent>;
  let c: CatalogoComponent;
  const service = { carregar: vi.fn(), enviarPedido: vi.fn() };
  const router = { navigate: vi.fn() };

  async function montar(r: CatalogoResposta | 'erro410' = resposta()) {
    localStorage.clear();
    service.carregar.mockReturnValue(r === 'erro410' ? throwError(() => ({ tipo: 'link-invalido' })) : of(r));
    await TestBed.configureTestingModule({
      imports: [CatalogoComponent],
      providers: [
        { provide: CatalogoService, useValue: service },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token: 'tok' }) } } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(CatalogoComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    // O ambiente de teste (Node + jsdom) pode não expor localStorage: usa um stub em memória.
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, String(v)),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear()
    });
  });

  it('carrega cabeçalho e mínimo da API', async () => {
    await montar();
    expect(service.carregar).toHaveBeenCalledWith('tok');
    expect(c.clienteNome).toBe('Sorveteria X');
    expect(c.distribuidoraNome).toBe('Santo Ângelo');
    expect(c.pedidoMinimo).toBe(50);
  });

  it('item sem saldo continua pedível e vira reserva', async () => {
    await montar();
    const picole = c.produtos.find(p => p.id === 2)!;
    c.incrementar(picole);
    expect(picole.quantidade).toBe(1);
    expect(c.divisao(picole)).toEqual({ agora: 0, reserva: 1 });
    expect(c.temReserva).toBe(true);
  });

  it('carrinho de alteração vence o localStorage', async () => {
    localStorage.setItem('catalogo:pedido:tok', JSON.stringify([{ id: 2, q: 9 }]));
    await montar(resposta({ carrinho: [{ id: 1, quantidade: 3 }] }));
    expect(c.produtos.find(p => p.id === 1)!.quantidade).toBe(3);
    expect(c.produtos.find(p => p.id === 2)!.quantidade).toBe(0);
  });

  it('envia só uma vez e navega para enviado', async () => {
    await montar();
    service.enviarPedido.mockReturnValue(of({ pedido: 42, total: 60 }));
    c.definirQuantidade(c.produtos[0], 2);
    c.enviar();
    c.enviar(); // duplo clique
    expect(service.enviarPedido).toHaveBeenCalledTimes(1);
    expect(service.enviarPedido).toHaveBeenCalledWith('tok', [{ id: 1, quantidade: 2 }]);
    expect(router.navigate).toHaveBeenCalledWith(['/c', 'tok', 'enviado']);
  });

  it('link inválido navega para a página de link inválido', async () => {
    await montar('erro410');
    expect(router.navigate).toHaveBeenCalledWith(['/link-invalido']);
  });
});
