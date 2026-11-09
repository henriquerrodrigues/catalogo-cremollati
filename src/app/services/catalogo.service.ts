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
      case 413:
      case 422:
        return { tipo: 'itens', mensagem, itens: e.error?.itens ?? [] };
      default:
        return { tipo: 'rede' };
    }
  }
}
