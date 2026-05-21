const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "autonomous-funnel", "config.json");
const DEFAULT_CONFIG = {
  product: {
    id: "pack_30_posts_salao_v1",
    name: "Agenda Cheia Pack",
    headline: "30 posts e mensagens prontas para preencher horarios vagos esta semana",
    subheadline: "Um kit direto para saloes, barbearias, manicures e estetica local copiarem, adaptarem e publicarem no Instagram, Status e WhatsApp em menos de 10 minutos.",
    promise: "Posts, legendas, chamadas de WhatsApp e calendario de 7 dias para divulgar agenda, servicos e promocoes sem criar texto do zero.",
    price_brl: 19,
    currency: "BRL",
    cta: "Comprar e receber agora",
    support_scope: "Inclui arquivo editavel, instrucoes curtas e FAQ. Nao inclui gestao de perfil, design personalizado ou atendimento individual prolongado.",
    audience: "Para profissionais de beleza que ja atendem pelo WhatsApp e precisam publicar com mais constancia sem contratar social media.",
    outcome: "Transformar fotos simples do proprio servico em chamadas claras para agendamento.",
    not_for: "Nao e para quem busca gestao completa de Instagram, artes personalizadas ou promessa de agenda cheia garantida.",
    includes: [
      "30 ideias de posts com legenda pronta",
      "15 mensagens curtas para WhatsApp",
      "7 dias de calendario de publicacao",
      "Promocoes simples para horarios vagos",
      "FAQ e instrucoes de uso em menos de 10 minutos",
    ],
    preview: [
      "Agenda da semana aberta para [servico]. Quer garantir seu horario? Chama no WhatsApp.",
      "Ainda temos poucos horarios para [dia]. Se voce quer sair pronto(a) para a semana, chama agora.",
      "Oi, [nome]. Temos horario para [servico] em [dia] as [hora]. Quer reservar?",
    ],
    trust_points: ["Entrega digital simples", "Preco de validacao: R$19", "Sem assinatura", "Uso imediato com fotos do proprio negocio"],
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
  return crypto.timingSafeEqual(a, b);
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
      { id: "persistence", label: "Resolver persistencia confiavel antes de Mercado Pago real" },
      { id: "mercado_pago", label: "Mercado Pago fica para etapa posterior" },
    ],
  };
}

function renderOffer() {
  const product = getConfig().product || DEFAULT_CONFIG.product;
  const includes = Array.isArray(product.includes) ? product.includes : DEFAULT_CONFIG.product.includes;
  const preview = Array.isArray(product.preview) ? product.preview : DEFAULT_CONFIG.product.preview;
  const trustPoints = Array.isArray(product.trust_points) ? product.trust_points : DEFAULT_CONFIG.product.trust_points;
  const headline = product.headline || product.name;
  const subheadline = product.subheadline || product.promise;
  const price = Number(product.price_brl || 19).toFixed(2).replace(".", ",");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(product.name)}</title>
  <style>
    :root { --ink:#18211d; --muted:#56615b; --line:#dfe5dd; --paper:#fbfaf6; --accent:#0f6b4d; --accent-dark:#0a4937; --soft:#e8f4ee; --warm:#f6e7c8; }
    * { box-sizing:border-box; }
    body { font-family:Arial,sans-serif; margin:0; color:var(--ink); background:linear-gradient(180deg,#f7fbf6 0%,var(--paper) 45%,#fff 100%); }
    main { width:min(1120px,calc(100% - 36px)); margin:0 auto; }
    .topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:18px 0; border-bottom:1px solid rgba(24,33,29,.08); font-size:14px; }
    .brand { font-weight:800; }
    .topbar span:last-child { color:var(--muted); text-align:right; }
    .hero { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(320px,.9fr); gap:44px; align-items:center; padding:58px 0 34px; }
    .tag { display:inline-flex; width:fit-content; color:var(--accent-dark); background:var(--soft); border:1px solid #c8e4d6; font-weight:800; text-transform:uppercase; font-size:12px; padding:7px 10px; border-radius:999px; letter-spacing:.08em; }
    h1 { font-size:clamp(34px,6vw,64px); line-height:1.02; margin:18px 0 16px; letter-spacing:0; max-width:780px; }
    h2 { font-size:28px; line-height:1.12; margin:0 0 12px; letter-spacing:0; }
    p { font-size:18px; line-height:1.55; color:var(--muted); margin:0 0 18px; }
    .lead { font-size:20px; max-width:700px; }
    .hero-actions { display:flex; flex-wrap:wrap; gap:14px; align-items:center; margin:28px 0 14px; }
    .price { display:inline-flex; align-items:baseline; gap:6px; color:var(--ink); font-size:38px; font-weight:900; line-height:1; }
    .price small { color:var(--muted); font-size:14px; font-weight:700; }
    .button { display:inline-flex; align-items:center; justify-content:center; min-height:48px; background:var(--accent); color:#fff; padding:14px 18px; border-radius:8px; text-decoration:none; font-weight:800; box-shadow:0 12px 24px rgba(15,107,77,.18); }
    .button:hover { background:var(--accent-dark); }
    .hero-card,.section,.sample { background:rgba(255,255,255,.88); border:1px solid var(--line); border-radius:8px; box-shadow:0 18px 50px rgba(32,48,38,.08); }
    .hero-card { padding:22px; }
    .mini-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:16px 0 18px; }
    .metric { background:#f7faf6; border:1px solid var(--line); border-radius:8px; padding:14px 12px; }
    .metric strong { display:block; font-size:24px; line-height:1; }
    .metric span { display:block; color:var(--muted); font-size:13px; margin-top:6px; }
    .section-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; padding:28px 0; }
    .section { padding:22px; box-shadow:none; }
    ul { list-style:none; padding:0; margin:16px 0 0; font-size:16px; line-height:1.5; }
    li { display:flex; gap:10px; margin:10px 0; color:var(--ink); }
    li::before { content:""; flex:0 0 7px; width:7px; height:7px; margin-top:9px; border-radius:50%; background:var(--accent); }
    .sample { padding:18px; background:#10241c; color:#eef8f1; }
    .sample p { color:#c9ddd2; font-size:15px; margin-bottom:12px; }
    .sample blockquote { margin:10px 0 0; padding:12px 14px; border-left:3px solid var(--warm); background:rgba(255,255,255,.06); border-radius:6px; line-height:1.45; }
    .trust-row { display:flex; flex-wrap:wrap; gap:10px; margin:18px 0 0; }
    .pill { border:1px solid #cdd8d1; background:#fff; border-radius:999px; color:var(--muted); padding:8px 10px; font-size:14px; }
    .closing { padding:34px 0 54px; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:24px; align-items:center; border-top:1px solid var(--line); margin-top:18px; }
    .note { color:var(--muted); font-size:14px; margin-top:10px; }
    @media (max-width:820px) { main { width:min(100% - 28px,1120px); } .hero,.section-grid,.closing { grid-template-columns:1fr; } .hero { padding-top:34px; gap:26px; } .mini-grid { grid-template-columns:1fr; } .topbar { align-items:flex-start; } .hero-actions { align-items:flex-start; flex-direction:column; } .button { width:100%; } }
  </style>
</head>
<body>
  <main>
    <div class="topbar"><span class="brand">${escapeHtml(product.name)}</span><span>Produto digital para beleza local</span></div>
    <section class="hero" aria-labelledby="headline">
      <div>
        <div class="tag">Entrega digital imediata</div>
        <h1 id="headline">${escapeHtml(headline)}</h1>
        <p class="lead">${escapeHtml(subheadline)}</p>
        <div class="hero-actions"><a class="button" href="/checkout">${escapeHtml(product.cta || "Comprar")}</a><div class="price">R$ ${price} <small>pagamento unico</small></div></div>
        <div class="trust-row">${trustPoints.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("\n")}</div>
      </div>
      <aside class="hero-card" aria-label="Resumo do produto">
        <h2>O que voce recebe</h2>
        <p>${escapeHtml(product.outcome || product.promise)}</p>
        <div class="mini-grid"><div class="metric"><strong>30</strong><span>ideias com legenda</span></div><div class="metric"><strong>15</strong><span>mensagens WhatsApp</span></div><div class="metric"><strong>7</strong><span>dias de calendario</span></div></div>
        <ul>${includes.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n")}</ul>
      </aside>
    </section>
    <section class="section-grid" aria-label="Detalhes da oferta">
      <article class="section"><h2>Feito para agenda real</h2><p>${escapeHtml(product.audience || "Para negocios locais que precisam publicar com constancia.")}</p></article>
      <article class="section"><h2>Sem promessa falsa</h2><p>${escapeHtml(product.not_for || product.support_scope || "Oferta digital simples, sem gestao personalizada.")}</p></article>
      <article class="sample"><h2>Amostra do conteudo</h2><p>Trechos que ja vem prontos para adaptar.</p>${preview.map((item) => `<blockquote>${escapeHtml(item)}</blockquote>`).join("\n")}</article>
    </section>
    <section class="closing" aria-label="Comprar"><div><h2>Pronto para copiar, adaptar e publicar</h2><p>Use com foto do proprio atendimento, modelo simples do Canva ou status do WhatsApp. O objetivo e tirar o bloqueio de "o que postar hoje" e chamar clientes para horario.</p><p class="note">${escapeHtml(product.support_scope || "Suporte simples para acesso ao arquivo.")}</p></div><div><a class="button" href="/checkout">${escapeHtml(product.cta || "Comprar")}</a><p class="note">Acesso liberado automaticamente apos pagamento aprovado.</p></div></section>
  </main>
</body>
</html>`;
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
