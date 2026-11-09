# Catálogo por distribuidora com link de token e reserva — design (catalogo-cremollati)

- **Data:** 2026-11-09
- **Status:** aprovado em brainstorming
- **Dono do contrato de dados/API:** IntegBlind — `IntegBlind_automatizacaoWhatsapp/docs/superpowers/specs/2026-11-09-distribuidora-aprovacao-reserva-design.md` §6.1.
- **Specs irmãs:** seller (`superpowers/2026-11-09-aprovacao-catalogo-confirmacao-design.md`), central (`2026-11-09-aprovacao-revendedor-distribuidoras-design.md`).

## 1. Contexto

O revendedor recebe do bot um link `https://<catalogo>/c/<token>`. O token
identifica o cliente e, por ele, a **distribuidora** e o **depósito** cujo
saldo deve aparecer. O catálogo mostra só o **mix daquela distribuidora**;
item com saldo insuficiente **pode ser pedido** (o excedente vira reserva).
Ao finalizar, o carrinho vai para o IntegBlind e o cliente **confirma no
WhatsApp**.

Hoje o app chama `http://localhost:5017/api/Catalogo` (endpoint .NET que lê
`tb_produto` inteiro, sem filtro) e `finalizarPedidoB2B()` só faz `console.log`
com `clienteId` fixo. Isso é substituído.

## 2. Rotas

| Rota | Tela |
|---|---|
| `/c/:token` | catálogo |
| `/c/:token/enviado` | "Pedido enviado! Volte ao WhatsApp para confirmar." (botão "Abrir WhatsApp" → `https://wa.me/<numero-do-bot>`) |
| `/link-invalido` | "Este link expirou ou já foi usado. Peça um novo no WhatsApp escolhendo *1 - Fazer um novo pedido*." |
| `''`, `/catalogo`, `**` | → `/link-invalido` (sem token não há catálogo) |

## 3. Configuração

`src/environments/environment*.ts` (criar): `apiUrl` (IntegBlind),
`whatsappBot` (número para o `wa.me`). Sem URL fixa no service.

## 4. Service e modelos

`CatalogoService` reescrito:

```ts
interface CatalogoResposta {
  cliente: { nome: string };
  distribuidora: { nome: string };
  pedidoMinimo: number;
  itens: ItemCatalogo[];
  carrinho: { id: number; quantidade: number }[];
}
interface ItemCatalogo {
  id: number; sku: string | null; nome: string; preco: number;
  unidade: string | null; categoria: string | null; imagem: string | null;
  saldo: number; disponivel: boolean;
}

carregar(token): Observable<CatalogoResposta>           // GET  {apiUrl}/integracao/catalogo/{token}
enviarPedido(token, itens): Observable<{pedido, total}> // POST {apiUrl}/integracao/catalogo/{token}/pedido
```

- O mapeamento `prO_*` e o modelo `Produto` (espelho de `tb_produto`) saem.
- 410/404 → navega para `/link-invalido`; 409 (distribuidora indisponível) → mensagem fixa com orientação de falar no WhatsApp; 422 → erros por item no carrinho.

## 5. Tela do catálogo

Mantém o layout atual (busca, ordenação, categorias, rodapé com total e
mínimo, painel do carrinho). Mudanças:

- **Cabeçalho:** "Olá, *{cliente}* · Atendido por *{distribuidora}*".
- **Imagem real** do item (`imagem`), placeholder atual como fallback.
- **Selo por item:**
  - `saldo >= 1`: "Disponível: {saldo} {unidade}" (verde).
  - `saldo < 1`: "Sob reserva" (âmbar) — item continua clicável.
- **Quantidade acima do saldo:** permitido; abaixo do controle aparece
  "{saldo} agora · {qtd − saldo} sob reserva". Limite técnico por item: 9999.
- **Carrinho:** cada linha mostra a mesma divisão; bloco no rodapé do painel
  quando houver reserva: "Itens sob reserva viram um pedido separado e são
  entregues quando o estoque da distribuidora chegar."
- **Pedido mínimo:** vem da API (`pedidoMinimo`; `0` desativa), não mais fixo em 300.
- **Finalizar:** botão vira "Enviar para confirmação"; desabilita durante o
  POST (evita duplo envio); sucesso → limpa o carrinho salvo e vai para
  `/c/:token/enviado`; erro de rede → aviso e mantém o carrinho.
- **Carrinho pré-carregado (Alterar):** se `carrinho` vier preenchido, ele
  vence o `localStorage`; itens que não estão mais no mix são descartados com
  aviso.
- **localStorage:** chave por token (`catalogo:pedido:<sha-curto-do-token>`)
  para não misturar carrinhos de links diferentes; limpar ao enviar.
- Divisão mostrada é **prévia**: o saldo final é conferido no envio ao Bling
  (texto pequeno no carrinho: "disponibilidade conferida na confirmação").

## 6. Testes (Vitest)

- `CatalogoService`: URLs, mapeamento, 410/404/409/422.
- Componente: selo disponível/reserva; divisão saldo/reserva ao incrementar além do saldo; mínimo vindo da API; carrinho pré-carregado vence storage; duplo clique em enviar faz 1 POST; navegação para `/enviado` e `/link-invalido`.

## 7. Fora de escopo

- Login/conta do revendedor.
- Histórico de pedidos no catálogo (fica no WhatsApp).
- Preço diferenciado por distribuidora/cliente.
