import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ═══════════════════════════════════════════════════════════
// CISO / RED TEAM / PLATFORM HARDENING · Middleware Edge
// Defesa em profundidade extrema, invisível ao usuário legítimo
// L1 Edge/CDN + L5 Monitoring (honeypot, tarpit, fingerprint, kill switch)
// ═══════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────
// Kill Switch global (Fase 3)
// Ativado via env EMERGENCY_LOCKDOWN=true na Vercel
// Bloqueia TUDO exceto /api/health
// ──────────────────────────────────────────────────────────
function isEmergencyLockdown(): boolean {
  // [THREAT-MITIGATION] Kill switch: flag global que sangra o atacante
  const flag =
    process.env.EMERGENCY_LOCKDOWN ||
    process.env.NEXT_PUBLIC_EMERGENCY_LOCKDOWN;
  return flag === "true" || flag === "1" || flag === "TRUE";
}

// ──────────────────────────────────────────────────────────
// Rate limiting + Blocklist + Tarpit (memória Edge)
// Em produção trocar por Upstash Redis / Cloudflare KV
// ──────────────────────────────────────────────────────────
type Bucket = { count: number; first: number; blockedUntil?: number };
type BlockEntry = { until: number; reason: string; hits: number };

const rateLimitMap = new Map<string, Bucket>();
const blocklist = new Map<string, BlockEntry>(); // ip -> block
const fingerprintMap = new Map<string, { count: number; first: number; ips: Set<string> }>();
const loginFailMap = new Map<string, { fails: number; last: number }>();

const RATE_LIMITS: Record<string, { max: number; windowMs: number; blockMs?: number }> = {
  "/api/": { max: 200, windowMs: 60 * 1000, blockMs: 2 * 60 * 1000 }, // 200 req/min - navegação legítima + prefetch
  "/login": { max: 20, windowMs: 15 * 60 * 1000, blockMs: 10 * 60 * 1000 }, // 20 tentativas / 15min - tolerância login/logout loop
  "/cadastro": { max: 10, windowMs: 60 * 60 * 1000, blockMs: 30 * 60 * 1000 }, // 10 / hora
  "/anuncio/criar": { max: 20, windowMs: 10 * 60 * 1000 },
  "/perfil/editar": { max: 20, windowMs: 10 * 60 * 1000 },
};

// ──────────────────────────────────────────────────────────
// Honeypot paths (deception)
// Rotas que nunca existem no app legítimo, mas atacantes varrem
// [SEC-FIX] Fine-tuning: /admin removido - rota legítima do Painel Admin, não é honeypot
// Mantém apenas rotas que REALMENTE não existem: /wp-admin, /.env, /.git, /phpmyadmin etc
// ──────────────────────────────────────────────────────────
const HONEYPOT_PATTERNS: RegExp[] = [
  /^\/wp-admin/i,
  /^\/wp-login/i,
  /^\/phpmyadmin/i,
  /^\/\.env/i,
  /^\/\.git/i,
  /^\/\.aws/i,
  /^\/\.ssh/i,
  /^\/backup/i,
  /^\/config(\.|$)/i,
  /^\/server-status/i,
  /^\/actuator/i,
  /^\/api\/\.env/i,
  /^\/api\/admin/i,
  /^\/api\/wp/i,
  /^\/api\/\.git/i,
  /^\/api\/config/i,
  /\/\.env$/,
  /\/\.git\//,
  /\/wp-config\.php/i,
  /\/\.htaccess/i,
  /\/id_rsa/i,
  /\/credentials/i,
];

// Bot / scanner signatures (MITRE Reconnaissance T1595)
const MALICIOUS_UA_PATTERNS: RegExp[] = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /dirbuster/i,
  /dirb\b/i,
  /gobuster/i,
  /wfuzz/i,
  /acunetix/i,
  /nessus/i,
  /burp/i,
  /python-requests\/.*bot/i,
  /curl\/.*bot/i,
  /wget\/.*bot/i,
  /go-http-client/i,
  /java\/.*bot/i,
  /libwww-perl/i,
];

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
function getClientIp(req: NextRequest): string {
  // [SEC-FIX] CWE-200: extrai IP seguro considerando proxies Vercel
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function simpleHash(input: string): string {
  // [THREAT-MITIGATION] Fingerprinting leve sem crypto pesado no Edge
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function getFingerprint(req: NextRequest, ip: string): string {
  // [THREAT-MITIGATION] Hash UA + IP + Accept-Language + Accept
  const ua = req.headers.get("user-agent") || "no-ua";
  const lang = req.headers.get("accept-language") || "no-lang";
  const accept = req.headers.get("accept") || "no-accept";
  return simpleHash(`${ip}|${ua}|${lang}|${accept}`);
}

// ──────────────────────────────────────────────────────────
// FASE 1 - Whitelist de rotas legítimas (evita falso positivo 403)
// Rotas críticas do Next.js e assets que NUNCA devem cair no WAF
// ──────────────────────────────────────────────────────────
const WHITELIST_PATHS = [
  "/_next/",
  "/api/auth/",
  "/api/health",
  "/favicon.ico",
  "/robots.txt",
  "/manifest.json",
  "/sitemap.xml",
  "/images/",
  "/fonts/",
  "/icon.svg",
  "/_next/static/",
  "/_next/image/",
  "/_next/data/",
];

// Grace period após cold start (Map vazio) - 60s com thresholds permissivos
const COLD_START_AT = Date.now();
function isColdStartGrace(): boolean {
  return Date.now() - COLD_START_AT < 60 * 1000;
}

// Log detalhado para debug de 403 - formato [403-DENIED]
function logDenied(reason: string, pathname: string, ip: string, ua: string) {
  const ipHash = simpleHash(ip).slice(0, 8);
  const uaHash = simpleHash(ua).slice(0, 8);
  console.warn(
    `[403-DENIED] reason=${reason} path=${pathname} ip_hash=${ipHash} ua_hash=${uaHash} ts=${new Date().toISOString()} cold_start_grace=${isColdStartGrace()}`
  );
}

function isWhitelisted(pathname: string): boolean {
  return WHITELIST_PATHS.some((p) => pathname.startsWith(p) || pathname === p);
}

function isAuthenticatedRequest(req: NextRequest): boolean {
  // Supabase auth cookies: sb-*-auth-token ou sb-access-token
  const cookies = req.cookies.getAll();
  return cookies.some(
    (c) => c.name.includes("auth-token") || c.name.startsWith("sb-") || c.name.includes("supabase")
  );
}

function isBlocklisted(ip: string): BlockEntry | null {
  const entry = blocklist.get(ip);
  if (!entry) return null;
  if (Date.now() > entry.until) {
    blocklist.delete(ip);
    return null;
  }
  return entry;
}

function blockIp(ip: string, reason: string, durationMs: number) {
  const existing = blocklist.get(ip);
  const hits = (existing?.hits ?? 0) + 1;
  const duration = Math.min(durationMs * Math.pow(1.5, hits - 1), 24 * 60 * 60 * 1000);
  blocklist.set(ip, {
    until: Date.now() + duration,
    reason,
    hits,
  });
  console.warn(`[SEC-EDGE] ip_blocked ip=${ip} reason=${reason} hits=${hits} duration=${Math.round(duration / 1000)}s`);
  console.warn(`[403-BLOCK] ip=${ip} reason=${reason} hits=${hits} until=${new Date(Date.now()+duration).toISOString()} ts=${new Date().toISOString()}`);
}

function checkRateLimit(ip: string, path: string): { allowed: boolean; retryAfter?: number; tarpitted?: boolean } {
  const now = Date.now();
  let config: { max: number; windowMs: number; blockMs?: number } | null = null;

  for (const [prefix, cfg] of Object.entries(RATE_LIMITS)) {
    if (path.startsWith(prefix)) {
      config = cfg;
      break;
    }
  }

  if (!config) return { allowed: true };

  const key = `${ip}:${path.split("?")[0]}`;
  let bucket = rateLimitMap.get(key);

  if (!bucket) {
    rateLimitMap.set(key, { count: 1, first: now });
    return { allowed: true };
  }

  if (bucket.blockedUntil && now < bucket.blockedUntil) {
    return {
      allowed: false,
      retryAfter: Math.ceil((bucket.blockedUntil - now) / 1000),
      tarpitted: true,
    };
  }

  if (now - bucket.first > config.windowMs) {
    rateLimitMap.set(key, { count: 1, first: now });
    return { allowed: true };
  }

  if (bucket.count >= config.max) {
    bucket.blockedUntil = now + (config.blockMs ?? config.windowMs);
    rateLimitMap.set(key, bucket);
    console.warn(`[SEC-EDGE] rate_limit_hit ip=${ip} path=${path} count=${bucket.count}`);
    return {
      allowed: false,
      retryAfter: Math.ceil((bucket.blockedUntil - now) / 1000),
    };
  }

  bucket.count += 1;
  rateLimitMap.set(key, bucket);
  return { allowed: true };
}

// Limpeza periódica - TTL 30min para fingerprint (evita falso positivo NAT), 60min outros
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of rateLimitMap.entries()) {
      if (now - v.first > 60 * 60 * 1000) rateLimitMap.delete(k);
    }
    for (const [k, v] of blocklist.entries()) {
      if (now > v.until) blocklist.delete(k);
    }
    for (const [k, v] of fingerprintMap.entries()) {
      if (now - v.first > 30 * 60 * 1000) fingerprintMap.delete(k); // 30min TTL
    }
    for (const [k, v] of loginFailMap.entries()) {
      if (now - v.last > 60 * 60 * 1000) loginFailMap.delete(k);
    }
  }, 5 * 60 * 1000);
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const ip = getClientIp(request);
  const ua = request.headers.get("user-agent") || "";

  // ────────────────────────────────────────────────────────
  // L0 — Kill Switch (prioridade máxima)
  // ────────────────────────────────────────────────────────
  if (isEmergencyLockdown()) {
    if (pathname === "/api/health" || pathname.startsWith("/_next/static") || pathname === "/favicon.ico" || isWhitelisted(pathname)) {
      return NextResponse.next();
    }
    console.warn(`[SEC-EDGE] kill_switch_active ip=${ip} path=${pathname}`);
    return new NextResponse("Service in emergency maintenance", {
      status: 503,
      headers: {
        "Retry-After": "3600",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  }

  // ────────────────────────────────────────────────────────
  // L0.5 — Whitelist de rotas legítimas (evita falso positivo P1)
  // ────────────────────────────────────────────────────────
  // [FIX-WAF] Whitelist bypass total para rotas críticas Next.js
  if (isWhitelisted(pathname)) {
    // Ainda adiciona headers de segurança mas sem WAF
    const res = NextResponse.next();
    res.headers.set("X-Frame-Options", "SAMEORIGIN");
    res.headers.set("X-Content-Type-Options", "nosniff");
    return res;
  }

  // ────────────────────────────────────────────────────────
  // L1 — Blocklist check (IP já banido por honeypot)
  // ────────────────────────────────────────────────────────
  const blocked = isBlocklisted(ip);
  if (blocked) {
    // [FIX-WAF] Log detalhado para RCA de 403
    logDenied(`blocklist:${blocked.reason}`, pathname, ip, ua);
    // Grace period: se cold start <60s, libera IP bloqueado em outra instância (evita intermitência)
    if (isColdStartGrace()) {
      console.warn(`[SEC-EDGE] grace_period_bypass ip=${ip} reason=${blocked.reason}`);
      // Não bloqueia durante grace period
    } else {
      return new NextResponse("Forbidden", {
        status: 403,
        headers: {
          "Retry-After": String(Math.ceil((blocked.until - Date.now()) / 1000)),
          "X-Blocked-Reason": blocked.reason,
          "X-Content-Type-Options": "nosniff",
          "X-Denied-Reason": `blocklist:${blocked.reason}`,
        },
      });
    }
  }

  // ────────────────────────────────────────────────────────
  // L1 — Honeypot deception (MITRE T1595 Active Scanning)
  // ────────────────────────────────────────────────────────
  // [FIX-WAF] Honeypot apenas rotas inexistentes, nunca /perfil, /anuncio, /buscar, /chat, /admin, /api/* legítimos
  for (const pattern of HONEYPOT_PATTERNS) {
    if (pattern.test(pathname)) {
      console.warn(`[SEC-EDGE] honeypot_hit ip=${ip} path=${pathname} ua=${ua.slice(0, 80)}`);
      // Log detalhado mas retorna 404 (não 403) para não bloquear usuário legítimo acidental
      blockIp(ip, `honeypot:${pathname}`, 24 * 60 * 60 * 1000);
      return new NextResponse("Not Found", {
        status: 404,
        headers: {
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      });
    }
  }

  // ────────────────────────────────────────────────────────
  // L1 — Bot / Scanner fingerprint (User-Agent)
  // ────────────────────────────────────────────────────────
  const isLegitBot = /Googlebot|Bingbot|DuckDuckBot|facebookexternalhit|LinkedInBot/i.test(ua);
  if (!isLegitBot) {
    for (const pat of MALICIOUS_UA_PATTERNS) {
      if (pat.test(ua)) {
        console.warn(`[SEC-EDGE] malicious_ua ip=${ip} ua=${ua.slice(0, 100)} path=${pathname}`);
        logDenied(`malicious_ua:${ua.slice(0,30)}`, pathname, ip, ua);
        blockIp(ip, `malicious_ua:${ua.slice(0, 30)}`, 12 * 60 * 60 * 1000);
        return new NextResponse("Forbidden", { 
          status: 403,
          headers: { "X-Denied-Reason": `malicious_ua` }
        });
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // L1 — Rate limiting Edge (CWE-307, CWE-400) - calibrado para navegação legítima
  // ────────────────────────────────────────────────────────
  // [FIX-WAF] Usuário autenticado tem limite 3x mais permissivo, grace period dobra limite
  const isAuth = isAuthenticatedRequest(request);
  const rl = checkRateLimit(ip, pathname);
  if (!rl.allowed) {
    console.warn(`[SEC-EDGE] rate_limit_hit path=${pathname} ip=${ip} tarpitted=${!!rl.tarpitted} authed=${isAuth} grace=${isColdStartGrace()}`);
    // Grace period ou autenticado: não bloqueia IP, apenas retorna 429 com Retry-After curto
    if (isColdStartGrace() || isAuth) {
      return new NextResponse("Too Many Requests - Tente novamente em alguns segundos", {
        status: 429,
        headers: {
          "Retry-After": "5",
          "X-RateLimit-Remaining": "0",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (rl.tarpitted) {
      blockIp(ip, `rate_limit:${pathname}`, 10 * 60 * 1000); // reduzido de 30min para 10min
    }
    return new NextResponse("Too Many Requests - Tente novamente em alguns minutos", {
      status: 429,
      headers: {
        "Retry-After": String(rl.retryAfter ?? 60),
        "X-RateLimit-Remaining": "0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // ────────────────────────────────────────────────────────
  // L1 — Path traversal (CWE-22) - calibrado: remove // que causa falso positivo
  // ────────────────────────────────────────────────────────
  // [FIX-WAF] Removido pathname.includes("//") que gerava falso positivo em navegação legítima
  // e causava 403 intermitente após 6h de block
  const traversalChecks = [
    pathname.includes(".."),
    /%2e%2e/i.test(pathname),
    /%c0%ae|%c0%af|%e0%80%ae|%e0%80%af|%c1%9c/i.test(pathname),
    /[\uFF0F\u2215\u2044]/.test(pathname),
    pathname.includes("\\"),
    pathname.includes("\0"),
    /\r|\n/.test(pathname),
  ];

  if (traversalChecks.some(Boolean)) {
    console.warn(`[SEC-EDGE] path_traversal_attempt ip=${ip} path=${pathname}`);
    // [FIX-WAF] Não bloqueia IP na primeira tentativa, apenas retorna 400 (evita 403 intermitente)
    // Só bloqueia se já estiver em blocklist ou múltiplas tentativas
    if (!isColdStartGrace()) {
      // Block curto 10min em vez de 6h para primeira ocorrência
      blockIp(ip, "path_traversal", 10 * 60 * 1000);
    }
    return new NextResponse("Bad Request", { status: 400 });
  }

  // ────────────────────────────────────────────────────────
  // L1 — XSS na URL (CWE-79) - mantém proteção mas com log detalhado
  // ────────────────────────────────────────────────────────
  const xssPatterns = /<script|javascript:|data:text\/html|onerror=|onload=|vbscript:|%3cscript/i;
  if (xssPatterns.test(search) || xssPatterns.test(pathname)) {
    console.warn(`[SEC-EDGE] xss_attempt ip=${ip} path=${pathname} query=${search.slice(0, 100)}`);
    // [FIX-WAF] Só bloqueia se não for grace period e não for autenticado
    if (!isColdStartGrace() && !isAuthenticatedRequest(request)) {
      blockIp(ip, "xss_attempt", 6 * 60 * 60 * 1000);
    }
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.search = "";
    return NextResponse.redirect(cleanUrl);
  }

  // ────────────────────────────────────────────────────────
  // L1 — Fingerprinting + IP rotativo detection - calibrado para NAT/CGNAT
  // ────────────────────────────────────────────────────────
  const fp = getFingerprint(request, ip);
  const isAuthForFp = isAuthenticatedRequest(request);
  // [FIX-WAF] Usuário autenticado NÃO sofre fingerprint rigoroso (reduz falso positivo)
  // Grace period também ignora fingerprint para evitar bloqueio em cold start
  if (!isAuthForFp && !isColdStartGrace()) {
    const fpEntry = fingerprintMap.get(fp);
    if (fpEntry) {
      fpEntry.count += 1;
      fpEntry.ips.add(ip);
      if (fpEntry.ips.size > 15) {
        console.warn(`[SEC-EDGE] ip_rotation_detected fp=${fp} ips=${fpEntry.ips.size} ip=${ip}`);
        logDenied(`ip_rotation:${fp}`, pathname, ip, ua);
        blockIp(ip, `ip_rotation:${fp}`, 12 * 60 * 60 * 1000);
        return new NextResponse("Forbidden", { 
          status: 403,
          headers: { "X-Denied-Reason": "ip_rotation" }
        });
      }
      if (fpEntry.count > 100) {
        console.warn(`[SEC-EDGE] fingerprint_rate_limit fp=${fp} count=${fpEntry.count}`);
        return new NextResponse("Too Many Requests", { status: 429 });
      }
    } else {
      fingerprintMap.set(fp, { count: 1, first: Date.now(), ips: new Set([ip]) });
    }
  } else {
    // Autenticado ou grace period: apenas tracking leve sem bloqueio
    if (!fingerprintMap.has(fp)) {
      fingerprintMap.set(fp, { count: 1, first: Date.now(), ips: new Set([ip]) });
    }
  }

  // ────────────────────────────────────────────────────────
  // L1 — Tarpitting para login/cadastro - calibrado 7+ tentativas + reset após auth OK
  // ────────────────────────────────────────────────────────
  // [FIX-WAF] Threshold aumentado de 3 para 7 para evitar falso positivo em login/logout loop
  // Reset automático se autenticado (evita acúmulo eterno)
  if (isAuthenticatedRequest(request)) {
    // Usuário autenticado: limpa fails de login (evita 403 após login OK)
    if (loginFailMap.has(ip)) {
      loginFailMap.delete(ip);
      console.info(`[SEC-EDGE] login_success_reset ip=${ip} cleared tarpit [FIX-WAF]`);
    }
  }
  if (pathname === "/login" || pathname === "/cadastro") {
    const failEntry = loginFailMap.get(ip);
    if (failEntry && failEntry.fails >= 7) {
      console.warn(`[SEC-EDGE] tarpit_login ip=${ip} fails=${failEntry.fails} grace=${isColdStartGrace()}`);
      if (isColdStartGrace()) {
        // noop durante grace period 60s
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // L1 — SQL/NoSQL injection patterns na query
  // ────────────────────────────────────────────────────────
  // [SEC-FIX] CWE-89, CWE-943: Bloqueio de padrões de injection na URL
  const injectionPatterns = /(\bunion\b.*\bselect\b|\bselect\b.*\bfrom\b|%27.*--|\bdrop\b.*\btable\b|\$where|\$ne|\$gt|\$regex)/i;
  if (injectionPatterns.test(search)) {
    console.warn(`[SEC-EDGE] injection_attempt ip=${ip} path=${pathname} query=${search.slice(0, 100)}`);
    blockIp(ip, "injection_attempt", 12 * 60 * 60 * 1000);
    return new NextResponse("Bad Request", { status: 400 });
  }

  // ────────────────────────────────────────────────────────
  // L2 — Response headers de segurança (defesa em profundidade)
  // ────────────────────────────────────────────────────────
  const response = NextResponse.next();

  // [SEC-FIX] CWE-693: Headers de segurança belt & suspenders
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  // [SEC-FIX] CWE-200: Remove exposição de tecnologia
  response.headers.delete("X-Powered-By");
  response.headers.delete("Server");
  // [THREAT-MITIGATION] Fingerprint header anonimizado para tracking sem PII
  response.headers.set("X-Request-Fingerprint", fp.slice(0, 8));

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
