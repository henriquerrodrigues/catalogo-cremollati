import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Produto, ProdutoCatalogo } from '../models/produto';

interface ProdutoApiResponse {
  prO_CODIGO: number;
  prO_SKU: string;
  prO_NOME: string;
  prO_PRECO: number;
  prO_ESTOQUE_ATUAL: number;
  prO_SALDO_VIRTUAL: number;
  prO_ESTOQUE_MINIMO: number;
  prO_CRIADO_EM: string;
  prO_ATUALIZADO_EM: string;
  prO_SITUACAO: string;
  prO_TIPO: string;
  prO_PRODUTO_PAI: number;
  prO_CATEGORIA_CODIGO: number;
  prO_CATEGORIA_NOME: string;
  prO_DESCRICAO_CURTA: string;
  prO_UNIDADE: string;
  prO_VISIVEL_CARDAPIO: number;
  prO_ESTOQUE_SINCRONIZADO_EM: string;
  prO_MIDIA_SINCRONIZADA_EM: string;
}

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5017/api/Catalogo';

  listarProdutos(): Observable<ProdutoCatalogo[]> {
    return this.http.get<ProdutoApiResponse[]>(this.apiUrl).pipe(
      map(produtos =>
        produtos.map(
          (produto): ProdutoCatalogo => ({
            PRO_CODIGO: produto.prO_CODIGO,
            PRO_SKU: produto.prO_SKU,
            PRO_NOME: produto.prO_NOME,
            PRO_PRECO: produto.prO_PRECO,
            PRO_ESTOQUE_ATUAL: produto.prO_ESTOQUE_ATUAL,
            PRO_SALDO_VIRTUAL: produto.prO_SALDO_VIRTUAL,
            PRO_ESTOQUE_MINIMO: produto.prO_ESTOQUE_MINIMO,
            PRO_CRIADO_EM: produto.prO_CRIADO_EM,
            PRO_ATUALIZADO_EM: produto.prO_ATUALIZADO_EM,
            PRO_SITUACAO: produto.prO_SITUACAO,
            PRO_TIPO: produto.prO_TIPO,
            PRO_PRODUTO_PAI: produto.prO_PRODUTO_PAI,
            PRO_CATEGORIA_CODIGO: produto.prO_CATEGORIA_CODIGO,
            PRO_CATEGORIA_NOME: produto.prO_CATEGORIA_NOME,
            PRO_DESCRICAO_CURTA: produto.prO_DESCRICAO_CURTA,
            PRO_UNIDADE: produto.prO_UNIDADE,
            PRO_VISIVEL_CARDAPIO: produto.prO_VISIVEL_CARDAPIO,
            PRO_ESTOQUE_SINCRONIZADO_EM: produto.prO_ESTOQUE_SINCRONIZADO_EM,
            PRO_MIDIA_SINCRONIZADA_EM: produto.prO_MIDIA_SINCRONIZADA_EM,
            quantidade: 0
          })
        )
      )
    );
  }
}
