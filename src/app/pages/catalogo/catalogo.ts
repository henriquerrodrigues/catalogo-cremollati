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
