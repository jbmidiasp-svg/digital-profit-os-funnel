# Mercado Pago Production Runbook

Objetivo: deixar o funil tecnicamente pronto para a primeira venda real verificavel, mantendo `REAL_SALES_APPROVED=false`, Ads bloqueado e checkout bloqueado ate o GO final.

## Credenciais Que O Operador Precisa Gerar

Gerar no painel oficial do Mercado Pago Developers, na aplicacao criada para este experimento:

1. `MP_ACCESS_TOKEN`
   - Tipo: credencial de producao da aplicacao.
   - Uso: criar preferencia Checkout Pro e consultar pagamento aprovado em `/v1/payments/{id}`.
   - Nunca salvar em arquivo. Colar somente em Render > Environment.

2. `MP_WEBHOOK_SECRET`
   - Tipo: chave secreta de Webhook da aplicacao.
   - Uso: validar `x-signature` com HMAC SHA256.
   - Nunca salvar em arquivo. Colar somente em Render > Environment.

3. URL de webhook
   - Valor: `https://digital-profit-os-funnel.onrender.com/webhooks/mercadopago`
   - Evento minimo: `payment`.
   - Uso: receber criacao/atualizacao de pagamento.

4. `PUBLIC_BASE_URL`
   - Valor atual: `https://digital-profit-os-funnel.onrender.com`
   - Uso: `notification_url`, `back_urls` e readiness.

## Como Gerar Com Seguranca

1. Entrar em Mercado Pago Developers.
2. Abrir "Suas integracoes".
3. Criar ou selecionar a aplicacao exclusiva deste experimento.
4. Confirmar que esta usando credenciais de producao apenas quando estiver pronto para pre-producao real.
5. Copiar `Access Token` de producao.
6. Em Webhooks, configurar notificacao para o evento `payment`.
7. Revelar/copiar a chave secreta do Webhook.
8. Colar as credenciais no Render, nao no repositorio:
   - `MP_ACCESS_TOKEN`
   - `MP_WEBHOOK_SECRET`
9. Manter:
   - `REAL_SALES_APPROVED=false`
   - `ADS_APPROVED=false`
   - `PERSISTENCE_TRUSTED_FOR_REAL_SALES=false`

## Validacao Oficial Implementada

O webhook usa a assinatura oficial `x-signature`:

```text
id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];
```

O sistema:

- extrai `ts` e `v1` do header `x-signature`;
- usa `x-request-id`;
- usa `data.id` dos query params quando presente;
- calcula HMAC SHA256 com `MP_WEBHOOK_SECRET`;
- compara em tempo constante;
- rejeita assinatura invalida com HTTP 401;
- busca o pagamento real na API Mercado Pago somente apos assinatura valida.

## Protecao Contra Pagamento Falso

Mesmo com webhook assinado e pagamento aprovado, a entrega so deve ser liberada se tudo abaixo for verdadeiro:

- pagamento `status=approved`;
- pagamento `live_mode=true`;
- pagamento pertence a `order_id` criado pelo checkout deste funil;
- pedido existente possui `preference_id`;
- valor bate com o preco configurado;
- `product_id` bate quando presente no metadata;
- `REAL_SALES_APPROVED=true`;
- `PERSISTENCE_TRUSTED_FOR_REAL_SALES=true`;
- `DELIVERY_SECRET` valido;
- HTTPS publico valido.

Enquanto qualquer item falhar, o evento pode ser registrado, mas `delivery_ready` nao deve ser gerado.

## Variaveis Render Para Pre-Producao

Configurar apenas em Render:

```text
MP_ACCESS_TOKEN=APP_USR_...
MP_WEBHOOK_SECRET=...
REAL_SALES_APPROVED=false
ADS_APPROVED=false
PERSISTENCE_TRUSTED_FOR_REAL_SALES=false
PUBLIC_BASE_URL=https://digital-profit-os-funnel.onrender.com
```

Nao configurar Ads. Nao mudar `REAL_SALES_APPROVED` ainda.
