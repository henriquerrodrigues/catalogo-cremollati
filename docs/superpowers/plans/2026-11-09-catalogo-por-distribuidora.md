# Catálogo por distribuidora com link de token e reserva — Implementation Plan (catalogo-cremollati)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O catálogo abre por `/c/:token`, mostra o mix da distribuidora do revendedor com o saldo do depósito dela, permite pedir acima do saldo (reserva), envia o carrinho ao IntegBlind e manda o cliente de volta ao WhatsApp para confirmar.

**Architecture:** `CatalogoService` passa a falar com o IntegBlind (`GET/POST /integracao/catalogo/{token}`); a URL vem de `environment`. Modelo novo `ItemCatalogo` (camelCase do Go) substitui o espelho `PRO_*` de `tb_produto`. A divisão "agora / sob reserva" é uma função pura (`utils/reserva.ts`). Duas páginas novas simples: enviado e link inválido.

**Tech Stack:** Angular 21 (standalone, `inject`), RxJS, Tailwind, Vitest (`ng test`).

**Spec:** `docs/superpowers/specs/2026-11-09-catalogo-por-distribuidora-design.md`. Contrato: spec do IntegBlind §6.1. **Pré-requisito para o teste manual:** IntegBlind com `/integracao/catalogo/*` no ar e `CORS_ORIGINS` incluindo a origem do catálogo.

Comandos: `npm test` (= `ng test`), `npx ng build`, `npx ng serve`.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/environments/environment.ts`, `environment.development.ts` + `angular.json` | `apiUrl`, `whatsappBot` |
| `src/app/models/catalogo.ts` (substitui `models/produto.ts`) | tipos da API e do carrinho |
| `src/app/utils/reserva.ts` (+ spec) | `dividirReserva(qtd, saldo)` |
| `src/app/services/catalogo.service.ts` (+ spec) | `carregar`, `enviarPedido`, erros tipados |
| `src/app/pages/catalogo/catalogo.ts/html/spec` | token da rota, selo, reserva, envio |
| `src/app/pages/enviado/enviado.ts` | "volte ao WhatsApp" |
| `src/app/pages/link-invalido/link-invalido.ts` | link expirado/usado |
| `src/app/app.routes.ts` | rotas novas |

---

### Task 1: Environments

**Files:**
- Create: `src/environments/environment.ts`, `src/environments/environment.development.ts`
- Modify: `angular.json`

- [ ] **Step 1: Arquivos**

`src/environments/environment.ts` (produção):

```ts
export const environment = {
  apiUrl: 'https://integblind.kremollati.com.br',
  whatsappBot: '5555996005352'
};
```

`src/environments/environment.development.ts`:

```ts
export const environment = {
  apiUrl: 'http://localhost:8080',
  whatsappBot: '5555996005352'
};
```

(Trocar `apiUrl` de produção pelo domínio público real do IntegBlind e `whatsappBot` pelo número do bot, só dígitos, com DDI.)

- [ ] **Step 2: `angular.json`** — em `projects.<nome>.architect.build.configurations.development`, acrescentar:

```json
"fileReplacements": [
  { "replace": "src/environments/environment.ts", "with": "src/environments/environment.development.ts" }
]
```

- [ ] **Step 3:** `npx ng build --configuration development` → OK. **Commit** `git add -A && git commit -m "chore: environments com URL do IntegBlind e número do bot"`

---

### Task 2: Modelo e divisão de reserva

**Files:**
- Create: `src/app/models/catalogo.ts`, `src/app/utils/reserva.ts`
- Test: `src/app/utils/reserva.spec.ts`
- Delete: `src/app/models/produto.ts` (na Task 4, quando o componente parar de usar)

- [ ] **Step 1: Teste que falha** — `reserva.spec.ts`

```ts
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
```

- [ ] **Step 2:** `npm test -- --watch=false` → FAIL.

- [ ] **Step 3: `models/catalogo.ts`**

```ts
export interface ItemCatalogo {
  id: number;
  sku: string;
  nome: string;
  preco: number;
  unidade: string;
  categoria: string;
  imagem: string;
  saldo: number;
  disponivel: boolean;
}

export interface CatalogoResposta {
  cliente: { nome: string };
  distribuidora: { nome: string };
  pedidoMinimo: number;
  itens: ItemCatalogo[];
  carrinho: { id: number; quantidade: number }[];
}

export interface ProdutoCarrinho extends ItemCatalogo {
  quantidade: number;
}

export interface PedidoEnviado {
  pedido: number;
  total: number;
}

export interface ErroItem {
  id: number;
  erro: string;
}

/** Erros da API já classificados para a tela. */
export type ErroCatalogo =
  | { tipo: 'link-invalido' }
  | { tipo: 'indisponivel'; mensagem: string }
  | { tipo: 'itens'; mensagem: string; itens: ErroItem[] }
  | { tipo: 'rede' };
```

- [ ] **Step 4: `utils/reserva.ts`**

```ts
/** Prévia de quanto sai agora e quanto fica sob reserva (o split final é feito no envio ao Bling). */
export function dividirReserva(quantidade: number, saldo: number): { agora: number; reserva: number } {
  const agora = Math.min(quantidade, Math.max(0, Math.floor(saldo)));
  return { agora, reserva: quantidade - agora };
}
```

- [ ] **Step 5:** `npm test -- --watch=false` → PASS. **Commit** `git add -A && git commit -m "feat: modelo do catálogo por token e divisão de reserva"`

---

### Task 3: Service

**Files:**
- Modify: `src/app/services/catalogo.service.ts`
- Test: `src/app/services/catalogo.service.spec.ts` (reescrever)

- [ ] **Step 1: Testes que falham**

```ts
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

  it('status 0 vira rede', async () => {
    const p = firstValueFrom(service.carregar('tok')).catch(e => e);
    http.expectOne(base).error(new ProgressEvent('error'));
    expect(await p).toEqual({ tipo: 'rede' });
  });
});
```

Se o projeto usa os globais do Vitest (`globals: true`), os imports de `vitest` são opcionais; mantê-los não quebra.

- [ ] **Step 2:** `npm test -- --watch=false` → FAIL.

- [ ] **Step 3: Implementar**

```ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { CatalogoResposta, ErroCatalogo, PedidoEnviado } from '../models/catalogo';

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/integracao/catalogo`;

  carregar(token: string): Observable<CatalogoResposta> {
    return this.http
      .get<CatalogoResposta>(`${this.base}/${encodeURIComponent(token)}`)
      .pipe(catchError(e => throwError(() => this.classificar(e))));
  }

  enviarPedido(token: string, itens: { id: number; quantidade: number }[]): Observable<PedidoEnviado> {
    return this.http
      .post<PedidoEnviado>(`${this.base}/${encodeURIComponent(token)}/pedido`, { itens })
      .pipe(catchError(e => throwError(() => this.classificar(e))));
  }

  private classificar(e: HttpErrorResponse): ErroCatalogo {
    const mensagem: string = e.error?.erro ?? 'Não foi possível concluir.';
    switch (e.status) {
      case 404:
      case 410:
        return { tipo: 'link-invalido' };
      case 409:
        return { tipo: 'indisponivel', mensagem };
      case 400:
      case 422:
        return { tipo: 'itens', mensagem, itens: e.error?.itens ?? [] };
      default:
        return { tipo: 'rede' };
    }
  }
}
```

- [ ] **Step 4:** `npm test -- --watch=false` → PASS (o spec do componente vai quebrar até a Task 4 — rodar só este arquivo: `npx ng test --watch=false --include src/app/services/catalogo.service.spec.ts`).
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: service do catálogo fala com o IntegBlind pelo token"`

---

### Task 4: Componente do catálogo

**Files:**
- Modify: `src/app/pages/catalogo/catalogo.ts`, `catalogo.html`, `catalogo.spec.ts`
- Delete: `src/app/models/produto.ts`

- [ ] **Step 1: Testes que falham** — `catalogo.spec.ts` (reescrever)

```ts
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
```

- [ ] **Step 2:** `npm test -- --watch=false` → FAIL.

- [ ] **Step 3: `catalogo.ts`** — reescrever a parte de dados e envio; manter a lógica de UI existente (busca, ordenação, categorias, painel, aviso, Esc). Código completo da classe:

```ts
import { Component, HostListener, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CatalogoService } from '../../services/catalogo.service';
import { ErroCatalogo, ProdutoCarrinho } from '../../models/catalogo';
import { dividirReserva } from '../../utils/reserva';

type Ordem = 'nome' | 'menor' | 'maior' | 'selecionados';

const IMG_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#E8EEF3"/><text x="50%" y="58%" font-size="64" text-anchor="middle">🍦</text></svg>'
  );

const QUANTIDADE_MAXIMA = 9999;

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogo.html'
})
export class CatalogoComponent implements OnInit {
  private readonly service = inject(CatalogoService);
  private readonly router = inject(Router);
  private readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

  produtos: ProdutoCarrinho[] = [];
  clienteNome = '';
  distribuidoraNome = '';
  pedidoMinimo = 0;
  carregando = false;
  enviando = false;
  erroCarregamento = '';
  errosItens: Record<number, string> = {};
  readonly placeholder = IMG_PLACEHOLDER;

  termoBusca = '';
  ordem: Ordem = 'nome';
  categoriaAtiva = 'Todos';
  carrinhoAberto = false;
  aviso = '';
  private avisoTimer?: ReturnType<typeof setTimeout>;

  private get storageKey(): string {
    return `catalogo:pedido:${this.token.slice(0, 12)}`;
  }

  ngOnInit(): void {
    if (!this.token) {
      this.router.navigate(['/link-invalido']);
      return;
    }
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erroCarregamento = '';
    this.service.carregar(this.token).subscribe({
      next: r => {
        this.clienteNome = r.cliente.nome;
        this.distribuidoraNome = r.distribuidora.nome;
        this.pedidoMinimo = r.pedidoMinimo;
        this.produtos = r.itens.map(i => ({ ...i, quantidade: 0 }));
        if (r.carrinho.length > 0) {
          this.aplicarCarrinho(r.carrinho.map(i => ({ id: i.id, q: i.quantidade })), true);
          this.salvarPedido();
        } else {
          this.restaurarPedido();
        }
        this.carregando = false;
      },
      error: (e: ErroCatalogo) => {
        this.carregando = false;
        this.tratarErro(e, true);
      }
    });
  }

  // ---------- Quantidade ----------
  incrementar(p: ProdutoCarrinho): void {
    this.definirQuantidade(p, (p.quantidade || 0) + 1);
  }

  decrementar(p: ProdutoCarrinho): void {
    this.definirQuantidade(p, Math.max(0, p.quantidade - 1));
    if (this.carrinhoAberto && this.totalItensCarrinho === 0) this.fecharCarrinho();
  }

  definirQuantidade(p: ProdutoCarrinho, valor: unknown): void {
    const n = Math.floor(Number(valor));
    p.quantidade = Number.isFinite(n) && n > 0 ? Math.min(n, QUANTIDADE_MAXIMA) : 0;
    delete this.errosItens[p.id];
    this.salvarPedido();
  }

  remover(p: ProdutoCarrinho): void {
    this.definirQuantidade(p, 0);
    if (this.totalItensCarrinho === 0) this.fecharCarrinho();
  }

  limparCarrinho(): void {
    this.produtos.forEach(p => (p.quantidade = 0));
    this.salvarPedido();
    this.fecharCarrinho();
    this.mostrarAviso('Pedido esvaziado');
  }

  divisao(p: ProdutoCarrinho): { agora: number; reserva: number } {
    return dividirReserva(p.quantidade, p.saldo);
  }

  get temReserva(): boolean {
    return this.itensCarrinho.some(p => this.divisao(p).reserva > 0);
  }

  // ---------- Listagem ----------
  get categorias(): string[] {
    const unicas = new Set(this.produtos.map(p => p.categoria).filter(c => !!c));
    return ['Todos', ...Array.from(unicas).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }

  get produtosFiltrados(): ProdutoCarrinho[] {
    const termo = this.normalizar(this.termoBusca);
    const lista = this.produtos.filter(p => {
      const bateCategoria = this.categoriaAtiva === 'Todos' || p.categoria === this.categoriaAtiva;
      const texto = this.normalizar(`${p.nome} ${p.sku} ${p.unidade} ${p.categoria}`);
      return bateCategoria && (!termo || texto.includes(termo));
    });
    switch (this.ordem) {
      case 'menor':
        return [...lista].sort((a, b) => a.preco - b.preco);
      case 'maior':
        return [...lista].sort((a, b) => b.preco - a.preco);
      case 'selecionados':
        return [...lista].sort(
          (a, b) => (b.quantidade > 0 ? 1 : 0) - (a.quantidade > 0 ? 1 : 0) || a.nome.localeCompare(b.nome, 'pt-BR')
        );
      default:
        return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }
  }

  trackById = (_: number, p: ProdutoCarrinho) => p.id;

  limparFiltros(): void {
    this.termoBusca = '';
    this.categoriaAtiva = 'Todos';
  }

  imagem(p: ProdutoCarrinho): string {
    return p.imagem || this.placeholder;
  }

  aoErrarImagem(ev: Event): void {
    (ev.target as HTMLImageElement).src = IMG_PLACEHOLDER;
  }

  // ---------- Carrinho ----------
  get itensCarrinho(): ProdutoCarrinho[] {
    return this.produtos.filter(p => p.quantidade > 0);
  }

  get totalItensCarrinho(): number {
    return this.produtos.reduce((acc, p) => acc + p.quantidade, 0);
  }

  get valorTotalCarrinho(): number {
    return this.produtos.reduce((acc, p) => acc + p.quantidade * p.preco, 0);
  }

  get faltaParaMinimo(): number {
    return Math.max(0, +(this.pedidoMinimo - this.valorTotalCarrinho).toFixed(2));
  }

  get progressoMinimo(): number {
    return this.pedidoMinimo ? Math.min(100, (this.valorTotalCarrinho / this.pedidoMinimo) * 100) : 100;
  }

  get podeFinalizar(): boolean {
    return this.totalItensCarrinho > 0 && this.faltaParaMinimo === 0 && !this.enviando;
  }

  abrirCarrinho(): void {
    if (this.totalItensCarrinho > 0) this.carrinhoAberto = true;
  }

  fecharCarrinho(): void {
    this.carrinhoAberto = false;
  }

  @HostListener('document:keydown.escape')
  aoPressionarEsc(): void {
    this.fecharCarrinho();
  }

  enviar(): void {
    if (!this.podeFinalizar) return;
    this.enviando = true;
    this.errosItens = {};
    const itens = this.itensCarrinho.map(p => ({ id: p.id, quantidade: p.quantidade }));
    this.service.enviarPedido(this.token, itens).subscribe({
      next: () => {
        try {
          localStorage.removeItem(this.storageKey);
        } catch {
          /* storage indisponível */
        }
        this.router.navigate(['/c', this.token, 'enviado']);
      },
      error: (e: ErroCatalogo) => {
        this.enviando = false;
        this.tratarErro(e, false);
      }
    });
  }

  // ---------- Erros ----------
  private tratarErro(e: ErroCatalogo, aoCarregar: boolean): void {
    switch (e.tipo) {
      case 'link-invalido':
        this.router.navigate(['/link-invalido']);
        return;
      case 'indisponivel':
        this.erroCarregamento = `${e.mensagem} Fale com a gente pelo WhatsApp.`;
        return;
      case 'itens':
        e.itens.filter(i => i.id).forEach(i => (this.errosItens[i.id] = i.erro));
        this.mostrarAviso(e.mensagem);
        return;
      default:
        if (aoCarregar) this.erroCarregamento = 'Não foi possível carregar o catálogo. Tente novamente.';
        else this.mostrarAviso('Sem conexão. Seu carrinho foi mantido; tente enviar de novo.');
    }
  }

  // ---------- Persistência ----------
  private salvarPedido(): void {
    try {
      const dados = this.itensCarrinho.map(p => ({ id: p.id, q: p.quantidade }));
      localStorage.setItem(this.storageKey, JSON.stringify(dados));
    } catch {
      /* storage indisponível: o pedido só não persiste */
    }
  }

  private restaurarPedido(): void {
    try {
      const bruto = localStorage.getItem(this.storageKey);
      if (bruto) this.aplicarCarrinho(JSON.parse(bruto), false);
    } catch {
      /* dado inválido: ignora */
    }
  }

  private aplicarCarrinho(itens: { id: number; q: number }[], avisarFaltantes: boolean): void {
    let faltaram = 0;
    itens.forEach(s => {
      const p = this.produtos.find(x => x.id === s.id);
      if (p) p.quantidade = Math.min(Math.max(0, Math.floor(s.q)), QUANTIDADE_MAXIMA);
      else faltaram++;
    });
    if (avisarFaltantes && faltaram > 0) {
      this.mostrarAviso(`${faltaram} item(ns) do pedido anterior não estão mais disponíveis.`);
    }
  }

  private mostrarAviso(msg: string): void {
    this.aviso = msg;
    clearTimeout(this.avisoTimer);
    this.avisoTimer = setTimeout(() => (this.aviso = ''), 4000);
  }

  private normalizar(texto: string): string {
    return (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
}
```

A chave do storage usa os 12 primeiros caracteres do token (aleatório de 43 chars) — suficiente para separar carrinhos de links diferentes sem guardar o token inteiro. No teste "carrinho de alteração", a chave é `catalogo:pedido:tok`.

- [ ] **Step 4: `catalogo.html`** — trocar campos (todas as ocorrências):

| Antes | Depois |
|---|---|
| `produto.PRO_NOME` / `item.PRO_NOME` | `produto.nome` / `item.nome` |
| `produto.PRO_PRECO` / `item.PRO_PRECO` | `produto.preco` / `item.preco` |
| `produto.PRO_UNIDADE` | `produto.unidade` |
| `produto.PRO_DESCRICAO_CURTA` | `produto.categoria` |
| `[src]="imagemProduto"` | `[src]="imagem(produto)"` (no carrinho: `imagem(item)`) e acrescentar `(error)="aoErrarImagem($event)"` onde faltar |
| `finalizarPedidoB2B()` | `enviar()` |
| texto do botão `Finalizar pedido` | `{{ enviando ? 'Enviando...' : 'Enviar para confirmação' }}` |

Acrescentar:

No topo da página (antes da busca):

```html
<div *ngIf="clienteNome" class="mb-3 text-sm text-slate-600">
  Olá, <b>{{ clienteNome }}</b> · Atendido por <b>{{ distribuidoraNome }}</b>
</div>
```

No card do produto, logo abaixo da linha "Embalagem":

```html
<p class="mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
   [ngClass]="produto.saldo >= 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">
  {{ produto.saldo >= 1 ? ('Disponível: ' + produto.saldo + ' ' + produto.unidade) : 'Sob reserva' }}
</p>
```

No card, logo abaixo do "Subtotal":

```html
<p *ngIf="divisao(produto).reserva > 0" class="mt-1 text-xs text-amber-700">
  {{ divisao(produto).agora }} agora · {{ divisao(produto).reserva }} sob reserva
</p>
<p *ngIf="errosItens[produto.id]" class="mt-1 text-xs text-red-700">{{ errosItens[produto.id] }}</p>
```

No item do painel do carrinho, abaixo da linha `quantidade × preço`:

```html
<p *ngIf="divisao(item).reserva > 0" class="text-xs text-amber-700">
  {{ divisao(item).agora }} agora · {{ divisao(item).reserva }} sob reserva
</p>
```

No rodapé do painel, antes do total:

```html
<p *ngIf="temReserva" class="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
  Itens sob reserva viram um pedido separado e são entregues quando o estoque da distribuidora chegar.
</p>
<p class="text-[11px] text-slate-400">Disponibilidade conferida na confirmação.</p>
```

O texto do mínimo usa `pedidoMinimo` (agora vindo da API); quando `pedidoMinimo` for `0`, esconder a barra de progresso com `*ngIf="pedidoMinimo > 0"` no bloco dela.

- [ ] **Step 5:** `git rm src/app/models/produto.ts`; `npm test -- --watch=false` → PASS; `npx ng build` → OK.
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: catálogo por token com mix da distribuidora, selo de reserva e envio real"`

---

### Task 5: Páginas "enviado" e "link inválido" e rotas

**Files:**
- Create: `src/app/pages/enviado/enviado.ts`, `src/app/pages/link-invalido/link-invalido.ts`
- Modify: `src/app/app.routes.ts`
- Test: `src/app/app.routes.spec.ts`

- [ ] **Step 1: Teste que falha**

```ts
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
```

- [ ] **Step 2:** `npm test -- --watch=false` → FAIL.

- [ ] **Step 3: `enviado.ts`**

```ts
import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-enviado',
  standalone: true,
  template: `
    <main class="min-h-screen flex items-center justify-center p-6 bg-[#F4F7FA]">
      <div class="max-w-sm text-center bg-white rounded-2xl shadow p-8">
        <div class="text-5xl mb-4">✅</div>
        <h1 class="text-xl font-bold mb-2">Pedido enviado!</h1>
        <p class="text-slate-600 mb-6">Volte ao WhatsApp para <b>confirmar</b> o seu pedido.</p>
        <a [href]="linkWhatsapp" class="inline-block w-full py-3 rounded-xl bg-[#1FA58A] text-white font-bold">Abrir WhatsApp</a>
      </div>
    </main>
  `
})
export class EnviadoComponent {
  readonly linkWhatsapp = `https://wa.me/${environment.whatsappBot}`;
}
```

- [ ] **Step 4: `link-invalido.ts`**

```ts
import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-link-invalido',
  standalone: true,
  template: `
    <main class="min-h-screen flex items-center justify-center p-6 bg-[#F4F7FA]">
      <div class="max-w-sm text-center bg-white rounded-2xl shadow p-8">
        <div class="text-5xl mb-4">⏰</div>
        <h1 class="text-xl font-bold mb-2">Link expirado ou já usado</h1>
        <p class="text-slate-600 mb-6">Peça um novo no WhatsApp escolhendo <b>1 - Fazer um novo pedido</b>.</p>
        <a [href]="linkWhatsapp" class="inline-block w-full py-3 rounded-xl bg-[#1FA58A] text-white font-bold">Abrir WhatsApp</a>
      </div>
    </main>
  `
})
export class LinkInvalidoComponent {
  readonly linkWhatsapp = `https://wa.me/${environment.whatsappBot}`;
}
```

- [ ] **Step 5: `app.routes.ts`**

```ts
import { Routes } from '@angular/router';
import { CatalogoComponent } from './pages/catalogo/catalogo';
import { EnviadoComponent } from './pages/enviado/enviado';
import { LinkInvalidoComponent } from './pages/link-invalido/link-invalido';

export const routes: Routes = [
  { path: 'c/:token', component: CatalogoComponent },
  { path: 'c/:token/enviado', component: EnviadoComponent },
  { path: 'link-invalido', component: LinkInvalidoComponent },
  { path: '', redirectTo: '/link-invalido', pathMatch: 'full' },
  { path: '**', redirectTo: '/link-invalido' }
];
```

- [ ] **Step 6:** `npm test -- --watch=false` → PASS; `npx ng build` → OK.
- [ ] **Step 7: Commit** `git add -A && git commit -m "feat: páginas de pedido enviado e link inválido; rotas por token"`

---

### Task 6: Verificação manual e deploy

- [ ] **Step 1:** IntegBlind local com `cors_origins` contendo `http://localhost:4200`; gerar token: `curl -H 'X-Integ-Secret: …' -X POST localhost:8080/integracao/admin/catalogo/tokens -d '{"cliente":1}'`.
- [ ] **Step 2:** `npx ng serve` → abrir `http://localhost:4200/c/<token>`: cabeçalho com cliente/distribuidora; só produtos do mix; selo verde com saldo / âmbar "Sob reserva"; aumentar acima do saldo mostra "N agora · M sob reserva"; mínimo bloqueia envio abaixo do valor.
- [ ] **Step 3:** Enviar → página "Pedido enviado"; recarregar `/c/<token>` → "Link expirado ou já usado"; abrir `/` → link inválido.
- [ ] **Step 4:** Alterar pelo WhatsApp (opção 2 do resumo) → novo link abre com o carrinho anterior preenchido.
- [ ] **Step 5:** Mobile (375 px): cards, painel do carrinho e páginas novas sem rolagem horizontal.
- [ ] **Step 6:** Deploy com `environment.ts` de produção apontando ao domínio do IntegBlind; incluir o domínio do catálogo em `CORS_ORIGINS` do IntegBlind; `catalogo_url_base` do IntegBlind = domínio do catálogo.
- [ ] **Step 7: Commit** de ajustes, se houver.
