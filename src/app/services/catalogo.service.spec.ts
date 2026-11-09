import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { CatalogoService } from './catalogo.service';
import { environment } from '../../environments/environment';

describe('CatalogoService', () => {
  let service: CatalogoService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/integracao/catalogo/tok`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CatalogoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carrega o catálogo do token', async () => {
    const p = firstValueFrom(service.carregar('tok'));
    http.expectOne(base).flush({ cliente: { nome: 'X' }, distribuidora: { nome: 'D' }, pedidoMinimo: 300, itens: [], carrinho: [] });
    expect((await p).distribuidora.nome).toBe('D');
  });

  it.each([404, 410])('%s vira link-invalido', async status => {
    const p = firstValueFrom(service.carregar('tok')).catch(e => e);
    http.expectOne(base).flush({ erro: 'x' }, { status, statusText: 'x' });
    expect(await p).toEqual({ tipo: 'link-invalido' });
  });

  it('409 vira indisponivel com a mensagem da API', async () => {
    const p = firstValueFrom(service.carregar('tok')).catch(e => e);
    http.expectOne(base).flush({ erro: 'distribuidora indisponível' }, { status: 409, statusText: 'x' });
    expect(await p).toEqual({ tipo: 'indisponivel', mensagem: 'distribuidora indisponível' });
  });

  it('envia o pedido e trata 422 por item', async () => {
    const ok = firstValueFrom(service.enviarPedido('tok', [{ id: 1, quantidade: 2 }]));
    const req = http.expectOne(`${base}/pedido`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ itens: [{ id: 1, quantidade: 2 }] });
    req.flush({ pedido: 42, total: 10 });
    expect((await ok).pedido).toBe(42);

    const falha = firstValueFrom(service.enviarPedido('tok', [])).catch(e => e);
    http.expectOne(`${base}/pedido`).flush({ erro: 'pedido sem itens', itens: [{ id: 0, erro: 'pedido sem itens' }] }, { status: 422, statusText: 'x' });
    expect(await falha).toEqual({ tipo: 'itens', mensagem: 'pedido sem itens', itens: [{ id: 0, erro: 'pedido sem itens' }] });
  });

  it('413 vira itens', async () => {
    const p = firstValueFrom(service.enviarPedido('tok', [{ id: 1, quantidade: 1 }])).catch(e => e);
    http.expectOne(`${base}/pedido`).flush({ erro: 'corpo grande' }, { status: 413, statusText: 'x' });
    expect(await p).toEqual({ tipo: 'itens', mensagem: 'corpo grande', itens: [] });
  });

  it('status 0 vira rede', async () => {
    const p = firstValueFrom(service.carregar('tok')).catch(e => e);
    http.expectOne(base).error(new ProgressEvent('error'));
    expect(await p).toEqual({ tipo: 'rede' });
  });
});
