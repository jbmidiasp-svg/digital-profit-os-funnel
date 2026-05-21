const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "autonomous-funnel", "config.json");
const DEFAULT_CONFIG = {
  product: {
    id: "pack_30_posts_salao_v1",
    name: "Pack 30 Posts + Mensagens Prontas para Salao e Barbearia",
    promise: "Posts, legendas, chamadas de WhatsApp e calendario de 7 dias para divulgar agenda e promocoes sem criar texto do zero.",
    price_brl: 19,
    currency: "BRL",
    cta: "Comprar e receber agora",
  },
};

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function hasValue(value) {
  return Boolean(String(value || "").trim());
}

function usableSecret(value, minLength = 32) {
  return String(value || "").trim().length >= minLength;
}

function isPublicHttpsUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
  } catch (error) {
    return false;
  }
}

function envBool(name) {
  return String(process.env[name] || "").toLowerCase() === "true";
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length) return false;
  return require("crypto").timingSafeEqual(a, b);
}

function send(res, status, body, type = "text/html; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function getConfig() {
  return readJson(CONFIG_PATH, DEFAULT_CONFIG);
}

function maskValue(value) {
  const raw = String(value || "");
  if (!raw) return "";
  if (raw.length <= 4) return "****";
  return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
}

function envDiagnostic(name, minLength = 32) {
  const raw = process.env[name];
  const text = String(raw || "");
  const trimmed = text.trim();
  return {
    name,
    exists: raw !== undefined,
    raw_length: text.length,
    trimmed_length: trimmed.length,
    valid: trimmed.length >= minLength,
    min_length: minLength,
    has_surrounding_whitespace: text.length !== trimmed.length,
    masked: maskValue(trimmed),
  };
}

function matchingEnvKeys() {
  return Object.keys(process.env)
    .filter((key) => /DELIVERY|REPORT|SECRET/i.test(key))
    .sort()
    .map((key) => ({ key, length: String(process.env[key] || "").length }));
}

function readiness() {
  const config = getConfig();
  const missing = [];
  const blocked = [];
  const warnings = [];
  const ready = [];

  const deployPlatform = process.env.DEPLOY_PLATFORM || "";
  const freeConfirmed = envBool("FREE_DEPLOY_CONFIRMED");
  const productionEnv = process.env.FUNNEL_ENV === "production";
  const testModeOff = process.env.FUNNEL_TEST_MODE !== "true";
  const publicHttps = isPublicHttpsUrl(process.env.PUBLIC_BASE_URL);
  const deliverySecret = usableSecret(process.env.DELIVERY_SECRET, 32);
  const reportSecret = usableSecret(process.env.REPORT_SECRET, 32);
  const mpToken = hasValue(process.env.MP_ACCESS_TOKEN);
  const mpWebhookSecret = String(process.env.MP_WEBHOOK_SECRET || "").trim().length >= 24;
  const realSalesApproved = envBool("REAL_SALES_APPROVED");
  const adsApproved = envBool("ADS_APPROVED");
  const persistenceTrusted = envBool("PERSISTENCE_TRUSTED_FOR_REAL_SALES");

  if (config.product?.id) ready.push({ id: "product", label: "Oferta configurada" });
  else missing.push({ id: "product", label: "Oferta ausente" });

  if (deployPlatform === "render") ready.push({ id: "render", label: "DEPLOY_PLATFORM=render" });
  else missing.push({ id: "deploy_platform", label: "DEPLOY_PLATFORM=render ausente" });

  if (freeConfirmed) ready.push({ id: "free", label: "FREE_DEPLOY_CONFIRMED=true" });
  else missing.push({ id: "free", label: "FREE_DEPLOY_CONFIRMED=true ausente" });

  if (productionEnv && testModeOff) ready.push({ id: "production", label: "Ambiente production bloqueado" });
  else missing.push({ id: "production", label: "FUNNEL_ENV=production e FUNNEL_TEST_MODE=false" });

  if (publicHttps) ready.push({ id: "https", label: "PUBLIC_BASE_URL HTTPS" });
  else missing.push({ id: "https", label: "PUBLIC_BASE_URL HTTPS ausente" });

  if (deliverySecret) ready.push({ id: "delivery_secret", label: "DELIVERY_SECRET presente" });
  else missing.push({ id: "delivery_secret", label: "DELIVERY_SECRET ausente ou curto" });

  if (reportSecret) ready.push({ id: "report_secret", label: "REPORT_SECRET presente" });
  else missing.push({ id: "report_secret", label: "REPORT_SECRET ausente ou curto" });

  if (!mpToken) blocked.push({ id: "checkout_without_token", label: "Checkout real bloqueado", detail: "Sem MP_ACCESS_TOKEN nao vende." });
  if (!mpWebhookSecret) blocked.push({ id: "webhook_without_secret", label: "Webhook real bloqueado", detail: "Sem MP_WEBHOOK_SECRET nao libera entrega." });
  if (!realSalesApproved) blocked.push({ id: "real_sales_without_approval", label: "Venda real bloqueada", detail: "REAL_SALES_APPROVED precisa ser true." });
  if (!persistenceTrusted) blocked.push({ id: "persistence_not_trusted_for_real_sales", label: "Venda real bloqueada por persistencia", detail: "Render Free filesystem e temporario." });
  if (!adsApproved) blocked.push({ id: "ads_without_approval", label: "Ads bloqueado", detail: "ADS_APPROVED precisa ser true para trafego pago." });
  warnings.push({ id: "render_free_ephemeral", label: "Render Free nao e persistencia confiavel" });

  const freeDeployReady = deployPlatform === "render" && freeConfirmed && productionEnv && testModeOff && publicHttps && deliverySecret && reportSecret;
  const productionReadyForSale = freeDeployReady && mpToken && mpWebhookSecret && realSalesApproved && persistenceTrusted;

  return {
    localReady: true,
    renderFreePreflightReady: true,
    freeDeployReady,
    productionReadyForSale,
    adsReady: adsApproved,
    financialReady: true,
    financial: {
      approvedSpend: 0,
      paidSpend: 0,
      availableCapital: 300,
      extraCapitalUnlocked: false,
      experimentDead: false,
    },
    ready,
    missing,
    blocked,
    warnings,
    dependsOnUser: [
      { id: "render", label: "Confirmar Render Free/R$0" },
      { id: "persistence", label: "Resolver persistencia confiavel antes de Mercado Pago real" },
      { id: "mercado_pago", label: "Mercado Pago fica para etapa posterior" },
    ],
  };
}

function renderOffer() {
  const product = getConfig().product || DEFAULT_CONFIG.product;
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(product.name)}</title><body style="font-family:Arial,sans-serif;max-width:760px;margin:48px auto;padding:0 18px;line-height:1.55"><p style="font-size:12px;text-transform:uppercase;font-weight:700;color:#67552c">Entrega digital imediata</p><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.promise)}</p><p style="font-size:30px;font-weight:800">R$ ${Number(product.price_brl || 19).toFixed(2).replace(".", ",")}</p><p><a href="/checkout" style="display:inline-block;background:#111;color:#fff;padding:14px 18px;border-radius:6px;text-decoration:none;font-weight:700">${escapeHtml(product.cta || "Comprar")}</a></p><p style="color:#555;font-size:14px">Preflight Render Free: checkout real bloqueado ate Mercado Pago, persistencia e aprovacao humana.</p></body></html>`;
}

function renderBlocked() {
  return "<!doctype html><html lang=\"pt-BR\"><meta charset=\"utf-8\"><body style=\"font-family:Arial,sans-serif;max-width:720px;margin:48px auto;line-height:1.5\"><h1>Checkout bloqueado com seguranca</h1><p>Venda real ainda nao esta liberada. Faltam Mercado Pago, webhook seguro, persistencia confiavel e aprovacao humana.</p><p>Isso e intencional para preservar custo R$0 e evitar venda acidental.</p><p><a href=\"/readiness\">Ver readiness</a></p></body></html>";
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/offer")) {
    send(res, 200, renderOffer());
    return;
  }

  if (req.method === "GET" && url.pathname === "/checkout") {
    send(res, 428, renderBlocked());
    return;
  }

  if (req.method === "POST" && url.pathname === "/webhooks/mercadopago") {
    send(res, 202, JSON.stringify({ ok: false, reason: "mercado_pago_not_configured" }), "application/json; charset=utf-8");
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    const state = readiness();
    send(res, 200, JSON.stringify({ ok: true, mode: state.productionReadyForSale ? "production_ready_for_sale" : "blocked_until_ready", ads: state.adsReady ? "approved" : "blocked_until_human_approval", financial: "ready" }), "application/json; charset=utf-8");
    return;
  }

  if (req.method === "GET" && url.pathname === "/readiness") {
    send(res, 200, JSON.stringify(readiness(), null, 2), "application/json; charset=utf-8");
    return;
  }

  if (req.method === "GET" && url.pathname === "/debug/env") {
    send(res, 200, JSON.stringify({
      ok: true,
      generated_at: new Date().toISOString(),
      service_expected: "digital-profit-os-funnel",
      render_markers: {
        RENDER: envDiagnostic("RENDER", 1),
        RENDER_SERVICE_NAME: envDiagnostic("RENDER_SERVICE_NAME", 1),
        RENDER_EXTERNAL_URL: envDiagnostic("RENDER_EXTERNAL_URL", 1),
      },
      required_env: {
        DELIVERY_SECRET: envDiagnostic("DELIVERY_SECRET", 32),
        REPORT_SECRET: envDiagnostic("REPORT_SECRET", 32),
        DEPLOY_PLATFORM: envDiagnostic("DEPLOY_PLATFORM", 1),
        FREE_DEPLOY_CONFIRMED: envDiagnostic("FREE_DEPLOY_CONFIRMED", 1),
        FUNNEL_ENV: envDiagnostic("FUNNEL_ENV", 1),
        PUBLIC_BASE_URL: envDiagnostic("PUBLIC_BASE_URL", 1),
        REAL_SALES_APPROVED: envDiagnostic("REAL_SALES_APPROVED", 1),
        ADS_APPROVED: envDiagnostic("ADS_APPROVED", 1),
        PERSISTENCE_TRUSTED_FOR_REAL_SALES: envDiagnostic("PERSISTENCE_TRUSTED_FOR_REAL_SALES", 1),
      },
      similar_secret_keys: matchingEnvKeys(),
      note: "Values are masked and only lengths are exposed. Do not put Mercado Pago secrets in this stage.",
    }, null, 2), "application/json; charset=utf-8");
    return;
  }

  if (req.method === "GET" && url.pathname === "/export") {
    const reportSecret = process.env.REPORT_SECRET || "";
    const supplied = req.headers["x-report-secret"] || "";
    if (!reportSecret || !safeEqual(reportSecret, supplied)) {
      send(res, 401, JSON.stringify({ ok: false, reason: "missing_or_invalid_report_secret" }), "application/json; charset=utf-8");
      return;
    }
    send(res, 200, JSON.stringify({ ok: true, exported_at: new Date().toISOString(), events_jsonl: "", orders: {}, spend_csv: "" }), "application/json; charset=utf-8");
    return;
  }

  send(res, 404, "Not found", "text/plain; charset=utf-8");
});

const port = Number(process.env.PORT || 4321);
server.listen(port, () => {
  console.log(`Digital Profit OS funnel listening on port ${port}`);
});
