# GO/NO-GO - Primeira Venda Real

Status atual esperado: pre-producao real tecnicamente preparada, mas venda real bloqueada.

## GO De Infra

- [ ] URL publica HTTPS responde `/health`.
- [ ] URL publica HTTPS responde `/readiness`.
- [ ] `freeDeployReady=true` no Render publico.
- [ ] `productionReadyForSale=false` ate decisao final.
- [ ] `PROJECT_SCOPE_LOCK=PASS`.
- [ ] Repo operado e somente `jbmidiasp-svg/digital-profit-os-funnel`.

## GO De Mercado Pago

- [ ] Aplicacao Mercado Pago exclusiva deste experimento.
- [ ] `MP_ACCESS_TOKEN` de producao colado somente no Render.
- [ ] `MP_WEBHOOK_SECRET` colado somente no Render.
- [ ] Webhook cadastrado para evento `payment`.
- [ ] URL do webhook: `https://digital-profit-os-funnel.onrender.com/webhooks/mercadopago`.
- [ ] Assinatura `x-signature` validada no preflight.
- [ ] Webhook invalido retorna HTTP 401.
- [ ] Pagamento desconhecido nao libera entrega.

## GO De Entrega

- [ ] `DELIVERY_SECRET` valido no Render.
- [ ] `REPORT_SECRET` valido no Render.
- [ ] `PERSISTENCE_TRUSTED_FOR_REAL_SALES=true` somente depois de resolver storage confiavel.
- [ ] Pedido real precisa existir antes do pagamento liberar entrega.
- [ ] Valor do pagamento precisa bater com R$19.
- [ ] `live_mode=true` obrigatorio para entrega real.
- [ ] `delivery_ready` so pode ocorrer apos pagamento aprovado e validado.

## GO Financeiro

- [ ] Gasto atual R$0.
- [ ] Ads continuam bloqueados.
- [ ] Nenhum dominio pago.
- [ ] Nenhuma hospedagem paga.
- [ ] Capital extra R$200 continua bloqueado.
- [ ] Qualquer custo novo tem alternativa gratuita documentada.

## NO-GO Automatico

- [ ] `REAL_SALES_APPROVED=false`.
- [ ] `ADS_APPROVED=false`.
- [ ] `PERSISTENCE_TRUSTED_FOR_REAL_SALES=false`.
- [ ] Webhook sem assinatura valida.
- [ ] Pagamento sem pedido conhecido.
- [ ] Pagamento com valor divergente.
- [ ] Pagamento `live_mode=false`.
- [ ] Qualquer risco de repo fora da allowlist.

## Chave Final

So mudar `REAL_SALES_APPROVED=true` depois que todos os itens GO estiverem marcados e o operador humano disser explicitamente:

```text
GO para primeira venda real sem Ads pagos.
```

Mesmo com GO, Ads continuam bloqueados ate aprovacao separada.
