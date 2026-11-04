import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogoService } from './catalogo.service';

describe('CatalogoService', () => {
  let service: CatalogoService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(CatalogoService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('busca os produtos na API e inicializa a quantidade local', () => {
    const produto = {
      prO_CODIGO: 1,
      prO_SKU: 'SORV-001',
      prO_NOME: 'Sorvete de chocolate',
      prO_PRECO: 25.5,
      prO_ESTOQUE_ATUAL: 20,
      prO_SALDO_VIRTUAL: 20,
      prO_ESTOQUE_MINIMO: 3,
      prO_CRIADO_EM: '2026-01-01T10:00:00',
      prO_ATUALIZADO_EM: '2026-01-01T10:00:00',
      prO_SITUACAO: 'A',
      prO_TIPO: 'Produto',
      prO_PRODUTO_PAI: 0,
      prO_CATEGORIA_CODIGO: 1,
      prO_CATEGORIA_NOME: 'Sorvetes',
      prO_DESCRICAO_CURTA: 'Sorvete cremoso',
      prO_UNIDADE: 'Pote 2L',
      prO_VISIVEL_CARDAPIO: 1,
      prO_ESTOQUE_SINCRONIZADO_EM: '2026-01-01T10:00:00',
      prO_MIDIA_SINCRONIZADA_EM: '2026-01-01T10:00:00'
    };

    service.listarProdutos().subscribe(produtos => {
      expect(produtos).toEqual([{
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
      }]);
    });

    const request = httpTesting.expectOne('http://localhost:5017/api/Catalogo');
    expect(request.request.method).toBe('GET');
    request.flush([produto]);
  });
});
