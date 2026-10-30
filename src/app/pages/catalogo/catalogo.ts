import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

export interface ProdutoSorvete {
  id: number;
  nome: string;
  descricao: string;
  precoAtacado: number;
  unidadeMedida: string; // Ex: 'Caixa c/ 10 un', 'Pote 2L', 'Fardo c/ 6 un'
  estoqueMinimo: number;
  fotoUrl: string;
  quantidade: number;
  categoria?: string; // Opcional: se vier preenchida, os chips de categoria aparecem
}

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

  // Lista de produtos carregados (mock ou API)
  produtos: ProdutoSorvete[] = [];

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

  // URL da API futura (Deixar configurada para fácil integração)
  private apiUrl = 'https://sua-api.com/api/v1/sorvetes-catalogo';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.carregarProdutos();
  }

  /**
   * Método responsável por buscar os produtos.
   * Atualmente consome dados mockados, mas está estruturado para alternar para a API.
   */
  carregarProdutos(): void {
    // Para usar a API real, basta trocar o bloco abaixo por:
    // this.http.get<ProdutoSorvete[]>(this.apiUrl).subscribe(dados => {
    //   this.produtos = dados;
    //   this.restaurarPedido();
    // });

    this.obterProdutosMock().subscribe(dados => {
      this.produtos = dados;
      this.restaurarPedido();
    });
  }

  /**
   * Mock de dados inicial (JSON) simulando uma resposta de API B2B
   */
  private obterProdutosMock(): Observable<ProdutoSorvete[]> {
    const mockCatalogo: ProdutoSorvete[] = [
      {
        id: 1,
        nome: 'Napolitano Tradicional 10L',
        descricao: 'Clássico sabor tricolor (creme, chocolate e morango) com textura cremosa ideal para sorveterias e buffets.',
        precoAtacado: 74.90,
        unidadeMedida: 'Balde 10L',
        estoqueMinimo: 5,
        fotoUrl: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&q=80&w=500',
        quantidade: 0
      },
      {
        id: 2,
        nome: 'Açaí com Guaraná Premium 5L',
        descricao: 'Polpa de açaí selecionada com extrato de guaraná, alto rendimento e excelente consistência para revenda.',
        precoAtacado: 62.50,
        unidadeMedida: 'Balde 5L',
        estoqueMinimo: 10,
        fotoUrl: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&q=80&w=500',
        quantidade: 0
      },
      {
        id: 3,
        nome: 'Picolé Leite Condensado (Caixa c/ 24un)',
        descricao: 'Picolé cremoso recheado com recheio generoso de leite condensado. Alta margem de lucro para o varejo.',
        precoAtacado: 48.00,
        unidadeMedida: 'Caixa c/ 24 un',
        estoqueMinimo: 8,
        fotoUrl: 'https://images.unsplash.com/photo-1505394033641-40c6ad1178d7?auto=format&fit=crop&q=80&w=500',
        quantidade: 0
      },
      {
        id: 4,
        nome: 'Sorvete de Corte Ninho Trufado 2L',
        descricao: 'Sorvete em barra sabor Leite Ninho com trufa artesanal de chocolate meio amargo.',
        precoAtacado: 29.90,
        unidadeMedida: 'Pote 2L',
        estoqueMinimo: 12,
        fotoUrl: 'https://images.unsplash.com/photo-1560008511-11c63416e52d?auto=format&fit=crop&q=80&w=500',
        quantidade: 0
      },
      {
        id: 5,
        nome: 'Mousse de Maracujá com Recheio 10L',
        descricao: 'Sabor refrescante com calda cítrica intercalada. Um dos favoritos nas praias e lanchonetes.',
        precoAtacado: 79.00,
        unidadeMedida: 'Balde 10L',
        estoqueMinimo: 4,
        fotoUrl: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&q=80&w=500',
        quantidade: 0
      }
    ];

    return of(mockCatalogo);
  }

  // ---------- Controle de quantidade ----------
  incrementar(produto: ProdutoSorvete): void {
    produto.quantidade = (produto.quantidade || 0) + 1;
    this.salvarPedido();
  }

  decrementar(produto: ProdutoSorvete): void {
    if (produto.quantidade > 0) {
      produto.quantidade--;
    }
    this.salvarPedido();
    if (this.carrinhoAberto && this.totalItensCarrinho === 0) {
      this.fecharCarrinho();
    }
  }

  /** Chamado pelo campo numérico: aceita só inteiros >= 0 */
  definirQuantidade(produto: ProdutoSorvete, valor: unknown): void {
    const n = Math.floor(Number(valor));
    produto.quantidade = Number.isFinite(n) && n > 0 ? n : 0;
    this.salvarPedido();
  }

  remover(produto: ProdutoSorvete): void {
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
      this.produtos.map(p => p.categoria).filter((c): c is string => !!c)
    );
    return ['Todos', ...Array.from(unicas).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }

  get produtosFiltrados(): ProdutoSorvete[] {
    const termo = this.normalizar(this.termoBusca);

    const lista = this.produtos.filter(p => {
      const bateCategoria = this.categoriaAtiva === 'Todos' || p.categoria === this.categoriaAtiva;
      const texto = this.normalizar(`${p.nome} ${p.descricao} ${p.unidadeMedida} ${p.categoria ?? ''}`);
      return bateCategoria && (!termo || texto.includes(termo));
    });

    switch (this.ordem) {
      case 'menor':
        return [...lista].sort((a, b) => a.precoAtacado - b.precoAtacado);
      case 'maior':
        return [...lista].sort((a, b) => b.precoAtacado - a.precoAtacado);
      case 'selecionados':
        return [...lista].sort(
          (a, b) =>
            (b.quantidade > 0 ? 1 : 0) - (a.quantidade > 0 ? 1 : 0) ||
            a.nome.localeCompare(b.nome, 'pt-BR')
        );
      default:
        return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }
  }

  trackById = (_: number, p: ProdutoSorvete) => p.id;

  limparFiltros(): void {
    this.termoBusca = '';
    this.categoriaAtiva = 'Todos';
  }

  aoErrarImagem(ev: Event): void {
    (ev.target as HTMLImageElement).src = IMG_PLACEHOLDER;
  }

  // ---------- Cálculos do Carrinho B2B ----------
  get itensCarrinho(): ProdutoSorvete[] {
    return this.produtos.filter(p => p.quantidade > 0);
  }

  get totalItensCarrinho(): number {
    return this.produtos.reduce((acc, curr) => acc + curr.quantidade, 0);
  }

  get valorTotalCarrinho(): number {
    return this.produtos.reduce((acc, curr) => acc + (curr.quantidade * curr.precoAtacado), 0);
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
        produtoId: p.id,
        nome: p.nome,
        quantidade: p.quantidade,
        precoUnitario: p.precoAtacado
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
      const dados = this.itensCarrinho.map(p => ({ id: p.id, q: p.quantidade }));
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
        const produto = this.produtos.find(p => p.id === s.id);
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