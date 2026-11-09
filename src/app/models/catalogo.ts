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
