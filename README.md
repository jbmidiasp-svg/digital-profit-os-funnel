# Digital Profit OS Funnel

Repositorio exclusivo do experimento Digital Profit OS.

Estado atual:

- Deploy alvo: Render Free Web Service.
- Custo autorizado: R$0.
- Ads: bloqueado.
- Mercado Pago real: nao configurado.
- Venda real: bloqueada.
- `REAL_SALES_APPROVED=false` obrigatorio.
- `PERSISTENCE_TRUSTED_FOR_REAL_SALES=false` obrigatorio no preflight Render Free.

## Render Free

Build command:

```bash
npm install --omit=dev
```

Start command:

```bash
npm start
```

Health check:

```text
/health
```

Endpoints de validacao:

- `/health`
- `/readiness`
- `/checkout` deve retornar bloqueado enquanto Mercado Pago, persistencia e aprovacao humana estiverem ausentes.

## Guardrails

- Nao configurar `MP_ACCESS_TOKEN` nesta etapa.
- Nao configurar `MP_WEBHOOK_SECRET` nesta etapa.
- Nao ativar Google Ads.
- Nao alterar `REAL_SALES_APPROVED` para `true`.
- Nao marcar persistencia como confiavel no Render Free sem nova decisao.
