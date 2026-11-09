/** Prévia de quanto sai agora e quanto fica sob reserva (o split final é feito no envio ao Bling). */
export function dividirReserva(quantidade: number, saldo: number): { agora: number; reserva: number } {
  const agora = Math.min(quantidade, Math.max(0, Math.floor(saldo)));
  return { agora, reserva: quantidade - agora };
}
