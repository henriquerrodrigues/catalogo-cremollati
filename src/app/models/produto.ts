export interface Produto {
  PRO_CODIGO: number;
  PRO_SKU: string;
  PRO_NOME: string;
  PRO_PRECO: number;
  PRO_ESTOQUE_ATUAL: number;
  PRO_SALDO_VIRTUAL: number;
  PRO_ESTOQUE_MINIMO: number;
  PRO_CRIADO_EM: string;
  PRO_ATUALIZADO_EM: string;
  PRO_SITUACAO: string;
  PRO_TIPO: string;
  PRO_PRODUTO_PAI: number;
  PRO_CATEGORIA_CODIGO: number;
  PRO_CATEGORIA_NOME: string;
  PRO_DESCRICAO_CURTA: string;
  PRO_UNIDADE: string;
  PRO_VISIVEL_CARDAPIO: number;
  PRO_ESTOQUE_SINCRONIZADO_EM: string;
  PRO_MIDIA_SINCRONIZADA_EM: string;
}

export interface ProdutoCatalogo extends Produto {
  quantidade: number;
}
