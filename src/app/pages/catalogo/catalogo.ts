import { Component, HostListener, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogoService } from '../../services/catalogo.service';
import { ProdutoCatalogo } from '../../models/produto';

type Ordem = 'nome' | 'menor' | 'maior' | 'selecionados';

const IMG_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#E8EEF3"/><text x="50%" y="58%" font-size="64" text-anchor="middle">🍦</text></svg>'
  );

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogo.html'
})
export class CatalogoComponent implements OnInit {

  produtos: ProdutoCatalogo[] = [];
  carregando = false;
  erroCarregamento = '';
  readonly imagemProduto = IMG_PLACEHOLDER;

  // Busca, ordenação e filtro por categoria
  termoBusca: string = '';
  ordem: Ordem = 'nome';
  categoriaAtiva: string = 'Todos';

  // Estado da interface
  carrinhoAberto = false;
  aviso = '';

  /** Valor mínimo do pedido em R$. Use 0 para desativar a regra. */
  pedidoMinimo = 300;

  private readonly STORAGE_KEY = 'catalogo-sorvetes-atacado:pedido';
  private avisoTimer?: ReturnType<typeof setTimeout>;

  private readonly catalogoService = inject(CatalogoService);

  ngOnInit(): void {
    this.carregarProdutos();
  }

  carregarProdutos(): void {
    this.carregando = true;
    this.erroCarregamento = '';

    this.catalogoService.listarProdutos().subscribe({
      next: produtos => {
        this.produtos = produtos;
        this.restaurarPedido();
        this.carregando = false;
      },
      error: erro => {
        console.error('Erro ao carregar produtos do catálogo.', erro);
        this.erroCarregamento = 'Não foi possível carregar o catálogo. Tente novamente.';
        this.carregando = false;
      }
    });
  }

  // ---------- Controle de quantidade ----------
  incrementar(produto: ProdutoCatalogo): void {
    produto.quantidade = (produto.quantidade || 0) + 1;
    this.salvarPedido();
  }

  decrementar(produto: ProdutoCatalogo): void {
    if (produto.quantidade > 0) {
      produto.quantidade--;
    }
    this.salvarPedido();
    if (this.carrinhoAberto && this.totalItensCarrinho === 0) {
      this.fecharCarrinho();
    }
  }

  /** Chamado pelo campo numérico: aceita só inteiros >= 0 */
  definirQuantidade(produto: ProdutoCatalogo, valor: unknown): void {
    const n = Math.floor(Number(valor));
    produto.quantidade = Number.isFinite(n) && n > 0 ? n : 0;
    this.salvarPedido();
  }

  remover(produto: ProdutoCatalogo): void {
    produto.quantidade = 0;
    this.salvarPedido();
    if (this.totalItensCarrinho === 0) {
      this.fecharCarrinho();
    }
  }

  limparCarrinho(): void {
    this.produtos.forEach(p => (p.quantidade = 0));
    this.salvarPedido();
    this.fecharCarrinho();
    this.mostrarAviso('Pedido esvaziado');
  }

  // ---------- Listagem: busca, categoria e ordenação ----------
  get categorias(): string[] {
    const unicas = new Set(
      this.produtos.map(p => p.PRO_CATEGORIA_NOME).filter(c => !!c)
    );
    return ['Todos', ...Array.from(unicas).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }

  get produtosFiltrados(): ProdutoCatalogo[] {
    const termo = this.normalizar(this.termoBusca);

    const lista = this.produtos.filter(p => {
      const bateCategoria = this.categoriaAtiva === 'Todos' || p.PRO_CATEGORIA_NOME === this.categoriaAtiva;
      const texto = this.normalizar(
        `${p.PRO_NOME} ${p.PRO_DESCRICAO_CURTA} ${p.PRO_UNIDADE} ${p.PRO_CATEGORIA_NOME}`
      );
      return bateCategoria && (!termo || texto.includes(termo));
    });

    switch (this.ordem) {
      case 'menor':
        return [...lista].sort((a, b) => a.PRO_PRECO - b.PRO_PRECO);
      case 'maior':
        return [...lista].sort((a, b) => b.PRO_PRECO - a.PRO_PRECO);
      case 'selecionados':
        return [...lista].sort(
          (a, b) =>
            (b.quantidade > 0 ? 1 : 0) - (a.quantidade > 0 ? 1 : 0) ||
            a.PRO_NOME.localeCompare(b.PRO_NOME, 'pt-BR')
        );
      default:
        return [...lista].sort((a, b) => a.PRO_NOME.localeCompare(b.PRO_NOME, 'pt-BR'));
    }
  }

  trackById = (_: number, p: ProdutoCatalogo) => p.PRO_CODIGO;

  limparFiltros(): void {
    this.termoBusca = '';
    this.categoriaAtiva = 'Todos';
  }

  aoErrarImagem(ev: Event): void {
    (ev.target as HTMLImageElement).src = IMG_PLACEHOLDER;
  }

  // ---------- Cálculos do Carrinho B2B ----------
  get itensCarrinho(): ProdutoCatalogo[] {
    return this.produtos.filter(p => p.quantidade > 0);
  }

  get totalItensCarrinho(): number {
    return this.produtos.reduce((acc, curr) => acc + curr.quantidade, 0);
  }

  get valorTotalCarrinho(): number {
    return this.produtos.reduce((acc, curr) => acc + (curr.quantidade * curr.PRO_PRECO), 0);
  }

  get faltaParaMinimo(): number {
    return Math.max(0, +(this.pedidoMinimo - this.valorTotalCarrinho).toFixed(2));
  }

  get progressoMinimo(): number {
    return this.pedidoMinimo
      ? Math.min(100, (this.valorTotalCarrinho / this.pedidoMinimo) * 100)
      : 100;
  }

  get podeFinalizar(): boolean {
    return this.totalItensCarrinho > 0 && this.faltaParaMinimo === 0;
  }

  // ---------- Painel do pedido ----------
  abrirCarrinho(): void {
    if (this.totalItensCarrinho > 0) {
      this.carrinhoAberto = true;
    }
  }

  fecharCarrinho(): void {
    this.carrinhoAberto = false;
  }

  @HostListener('document:keydown.escape')
  aoPressionarEsc(): void {
    this.fecharCarrinho();
  }

  finalizarPedidoB2B(): void {
    const itensSelecionados = this.itensCarrinho;

    if (itensSelecionados.length === 0) {
      this.mostrarAviso('Adicione pelo menos um produto para continuar.');
      return;
    }

    if (!this.podeFinalizar) {
      this.mostrarAviso('O pedido ainda não atingiu o valor mínimo.');
      return;
    }

    const payloadPedido = {
      clienteId: 'CLIENTE_B2B_EXEMPLO',
      dataPedido: new Date(),
      itens: itensSelecionados.map(p => ({
        produtoId: p.PRO_CODIGO,
        nome: p.PRO_NOME,
        quantidade: p.quantidade,
        precoUnitario: p.PRO_PRECO
      })),
      valorTotal: this.valorTotalCarrinho
    };

    console.log('📦 Payload do Pedido B2B gerado:', payloadPedido);

    const totalEnviado = this.totalItensCarrinho;
    this.produtos.forEach(p => (p.quantidade = 0));
    this.salvarPedido();
    this.fecharCarrinho();
    this.mostrarAviso(`Pedido de ${totalEnviado} itens enviado para processamento.`);
  }

  // ---------- Persistência do pedido em andamento ----------
  private salvarPedido(): void {
    try {
      const dados = this.itensCarrinho.map(p => ({ id: p.PRO_CODIGO, q: p.quantidade }));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dados));
    } catch {
      /* storage indisponível: o pedido só não persiste */
    }
  }

  private restaurarPedido(): void {
    try {
      const bruto = localStorage.getItem(this.STORAGE_KEY);
      if (!bruto) return;
      const salvos: { id: number; q: number }[] = JSON.parse(bruto);
      salvos.forEach(s => {
        const produto = this.produtos.find(p => p.PRO_CODIGO === s.id);
        if (produto) produto.quantidade = s.q;
      });
    } catch {
      /* dado inválido: ignora */
    }
  }

  // ---------- Utilitários ----------
  private mostrarAviso(msg: string): void {
    this.aviso = msg;
    clearTimeout(this.avisoTimer);
    this.avisoTimer = setTimeout(() => (this.aviso = ''), 3000);
  }

  private normalizar(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}