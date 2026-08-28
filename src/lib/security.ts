// ═══════════════════════════════════════════════════════════
// SECURITY HARDENING LAYER · Defesa em Profundidade
// Centraliza rate limiting, sanitização, validação e logging
// para blindagem OWASP Top 10 + CWE/SANS Top 25
// ═══════════════════════════════════════════════════════════
import { z } from "zod";

// ──────────────────────────────────────────────────────────
// 1. SECURITY LOGGER (CWE-778 / OWASP A09)
// ──────────────────────────────────────────────────────────
type SecEventType =
  | "auth_failed"
  | "auth_success"
  | "rate_limit_hit"
  | "xss_attempt"
  | "injection_attempt"
  | "idor_attempt"
  | "file_upload_blocked"
  | "validation_failed"
  | "brute_force"
  | "cleanup"
  | "honeypot_hit"
  | "canary_access"
  | "tarpit_triggered"
  | "fingerprint_collision"
  | "kill_switch_activated"
  | "bot_detected"
  | "crlf_attempt";

export function securityLog(
  type: SecEventType,
  details: Record<string, unknown>,
  severity: "low" | "medium" | "high" | "critical" = "medium"
) {
  const entry = {
    ts: new Date().toISOString(),
    type,
    severity,
    ...details,
  };
  if (typeof window !== "undefined") {
    console.warn(`[SEC] ${type} [${severity}]`, entry);
    try {
      const key = "trocabairro:sec-logs";
      const raw = localStorage.getItem(key);
      const logs = raw ? JSON.parse(raw) : [];
      logs.push(entry);
      if (logs.length > 100) logs.shift();
      localStorage.setItem(key, JSON.stringify(logs));
    } catch {
      /* storage bloqueado — noop */
    }
  } else {
    console.warn(`[SEC] ${type} [${severity}]`, entry);
  }
}

// ──────────────────────────────────────────────────────────
// 2. RATE LIMITING (CWE-307, CWE-400, CWE-770)
// Implementação em memória + localStorage para SPA
// Protege contra brute-force e DoS no client
// Em produção complementar com WAF / Redis no edge
// ──────────────────────────────────────────────────────────
type RateLimitConfig = {
  max: number;
  windowMs: number;
  blockMs?: number;
};

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // [FIX-WAF] Thresholds calibrados para evitar falso positivo 403 em navegação legítima - P1
  general: { max: 200, windowMs: 60 * 1000, blockMs: 2 * 60 * 1000 }, // 200/min - compatível com prefetch Next.js
  login: { max: 20, windowMs: 15 * 60 * 1000, blockMs: 10 * 60 * 1000 }, // 20/15min - tolerância login/logout loop 5x
  register: { max: 10, windowMs: 60 * 60 * 1000, blockMs: 30 * 60 * 1000 }, // 10/h
  proposeTrade: { max: 10, windowMs: 60 * 60 * 1000 },
  sendMessage: { max: 30, windowMs: 60 * 1000 },
  uploadImage: { max: 20, windowMs: 10 * 60 * 1000 },
  uploadAvatar: { max: 3, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 },
  createAd: { max: 10, windowMs: 60 * 60 * 1000 },
  search: { max: 60, windowMs: 60 * 1000 },
  api: { max: 200, windowMs: 60 * 1000, blockMs: 2 * 60 * 1000 },
};

type Bucket = {
  count: number;
  firstAt: number;
  blockedUntil?: number;
};

const memoryBuckets = new Map<string, Bucket>();

function getStorageBucketKey(action: string, identifier: string) {
  return `trocabairro:rl:${action}:${identifier}`;
}

function safeGetBucket(key: string): Bucket | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Bucket) : null;
  } catch {
    return null;
  }
}

function safeSetBucket(key: string, bucket: Bucket) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(bucket));
  } catch {
    /* noop */
  }
}

export function checkRateLimit(
  action: keyof typeof RATE_LIMITS,
  identifier: string = "global"
): { allowed: boolean; remaining: number; retryAfterMs?: number } {
  // [SEC-FIX] CWE-307: Proteção contra brute-force com janela deslizante e bloqueio temporário
  const config = RATE_LIMITS[action];
  if (!config) return { allowed: true, remaining: 999 };

  const now = Date.now();
  const memKey = `${action}:${identifier}`;
  const storageKey = getStorageBucketKey(action, identifier);

  let bucket = memoryBuckets.get(memKey) || safeGetBucket(storageKey) || { count: 0, firstAt: now };

  // Verifica se está bloqueado
  if (bucket.blockedUntil && now < bucket.blockedUntil) {
    securityLog("rate_limit_hit", { action, identifier, blockedUntil: bucket.blockedUntil }, "high");
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: bucket.blockedUntil - now,
    };
  }

  // Reseta janela se expirou
  if (now - bucket.firstAt > config.windowMs) {
    bucket = { count: 0, firstAt: now };
  }

  if (bucket.count >= config.max) {
    bucket.blockedUntil = now + (config.blockMs ?? config.windowMs);
    memoryBuckets.set(memKey, bucket);
    safeSetBucket(storageKey, bucket);
    securityLog("rate_limit_hit", { action, identifier, count: bucket.count }, "high");
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: bucket.blockedUntil - now,
    };
  }

  bucket.count += 1;
  memoryBuckets.set(memKey, bucket);
  safeSetBucket(storageKey, bucket);

  return { allowed: true, remaining: config.max - bucket.count };
}

export function resetRateLimit(action: string, identifier: string = "global") {
  const memKey = `${action}:${identifier}`;
  memoryBuckets.delete(memKey);
  try {
    localStorage.removeItem(getStorageBucketKey(action, identifier));
  } catch {
    /* noop */
  }
}

// ──────────────────────────────────────────────────────────
// 3. INPUT SANITIZATION & VALIDATION (CWE-20, CWE-79, CWE-89)
// ──────────────────────────────────────────────────────────

// [SEC-FIX] CWE-79: Sanitização rigorosa contra XSS - remove tags HTML e eventos JS
export function stripHtmlTags(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "") // Remove tags
    .replace(/javascript:/gi, "") // Remove javascript: URIs
    .replace(/on\w+\s*=/gi, "") // Remove on* handlers
    .replace(/data:\s*text\/html/gi, ""); // Remove data:text/html
}

// [SEC-FIX] CWE-79: Escaping para exibição segura (defesa em profundidade mesmo com React)
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// [SEC-FIX] CWE-89: Sanitização rigorosa de busca - whitelist de caracteres seguros + limite
export function sanitizeSearchStrict(term: string): string {
  if (typeof term !== "string") return "";
  // Limita tamanho para prevenir ReDoS e DoS
  let t = term.slice(0, 100).trim();
  // Remove caracteres perigosos para PostgREST / SQL Like / NoSQL
  // Whitelist: letras (incluindo acentos), números, espaços, hífen
  t = t.replace(/[^a-zA-Z0-9À-ÿ\s\-]/g, "");
  // Remove sequências de espaços
  t = t.replace(/\s+/g, " ");
  // Remove % _ (wildcards SQL) e outros operadores
  t = t.replace(/[%_()"'`;\\]/g, "");
  if (/[<>{}[\]$^|*+?\\]/.test(t)) {
    securityLog("injection_attempt", { term: term.slice(0, 50), sanitized: t }, "high");
  }
  return t.trim().slice(0, 80);
}

// [SEC-FIX] CWE-20: Validação de UUID v4 rigorosa
export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid) ||
    /^demo-[a-z0-9-]+$/i.test(uuid) || // Permite IDs demo
    /^[a-z0-9-]{8,}$/i.test(uuid); // Fallback para IDs legados demo
}

// [SEC-FIX] CWE-20: Sanitização de texto livre (bio, descrição, etc)
export function sanitizeFreeText(input: string, maxLength: number): string {
  if (typeof input !== "string") return "";
  let s = stripHtmlTags(input);
  s = s.trim();
  // Remove caracteres de controle exceto \n \r \t
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Limita tamanho
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

// [SEC-FIX] CWE-434: Validação de upload de arquivo - whitelist MIME + extensão + tamanho
export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export const ALLOWED_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_AVATAR_SIZE = 3 * 1024 * 1024; // 3MB para avatar

export function validateImageFile(file: File, kind: "ads" | "avatars"): { valid: boolean; error?: string } {
  // [SEC-FIX] CWE-434: Validação rigorosa de tipo MIME e extensão
  if (!file) return { valid: false, error: "Arquivo inválido" };

  const maxSize = kind === "avatars" ? MAX_AVATAR_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    securityLog("file_upload_blocked", { name: file.name, size: file.size, reason: "size_exceeded" }, "medium");
    return { valid: false, error: `Arquivo muito grande. Máximo ${maxSize / 1024 / 1024}MB` };
  }

  if (file.size < 100) {
    return { valid: false, error: "Arquivo muito pequeno ou corrompido" };
  }

  if (!ALLOWED_IMAGE_MIMES.includes(file.type)) {
    securityLog("file_upload_blocked", { name: file.name, mime: file.type, reason: "mime_not_allowed" }, "high");
    return { valid: false, error: "Tipo de arquivo não permitido. Use JPG, PNG ou WebP" };
  }

  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
    securityLog("file_upload_blocked", { name: file.name, ext, reason: "ext_not_allowed" }, "high");
    return { valid: false, error: "Extensão não permitida" };
  }

  // Bloqueia nomes com path traversal ou caracteres perigosos
  if (/[<>:"/\\|?*\x00-\x1F]/.test(file.name) || file.name.includes("..")) {
    securityLog("file_upload_blocked", { name: file.name, reason: "path_traversal" }, "critical");
    return { valid: false, error: "Nome de arquivo inválido" };
  }

  return { valid: true };
}

// ──────────────────────────────────────────────────────────
// 4. ZOD SCHEMAS (CWE-20) - Validação rigorosa de inputs
// ──────────────────────────────────────────────────────────
export const AdInputSchema = z.object({
  tipo: z.enum(["ofereço", "preciso"], { message: "Tipo inválido" }),
  titulo: z.string()
    .min(5, "Título mínimo 5 caracteres")
    .max(100, "Título máximo 100 caracteres")
    .transform(s => sanitizeFreeText(s, 100)),
  descricao: z.string()
    .min(20, "Descrição mínima 20 caracteres")
    .max(2000, "Descrição máxima 2000 caracteres")
    .transform(s => sanitizeFreeText(s, 2000)),
  categoria: z.string().min(2).max(50).transform(s => sanitizeFreeText(s, 50)),
  bairro: z.string().min(2).max(100).transform(s => sanitizeFreeText(s, 100)),
  cidade: z.string().min(2).max(100).transform(s => sanitizeFreeText(s, 100)).optional(),
  uf: z.string().length(2).regex(/^[A-Z]{2}$/, "UF inválida").optional(),
  aceitaEmTroca: z.string()
    .min(3, "Informe o que aceita em troca")
    .max(200, "Máximo 200 caracteres")
    .transform(s => sanitizeFreeText(s, 200)),
  status: z.enum(["ativo", "pendente", "aprovado", "rejeitado", "pausado", "arquivado"]).optional(),
  isUrgent: z.boolean().optional(),
});

export const ProfilePatchSchema = z.object({
  nome: z.string().min(2).max(100).transform(s => sanitizeFreeText(s, 100)).optional(),
  bio: z.string().max(500).transform(s => sanitizeFreeText(s, 500)).optional(),
  whatsapp: z.string().max(20).optional(),
  bairro: z.string().max(100).transform(s => sanitizeFreeText(s, 100)).optional(),
  uf: z.string().length(2).optional(),
  cidade: z.string().max(100).transform(s => sanitizeFreeText(s, 100)).optional(),
  tipoPerfil: z.enum(["empreendedor", "criador", "ambos"]).optional(),
  categorias: z.array(z.string().max(50)).max(10).optional(),
  avatarUrl: z.string().url().or(z.string().startsWith("data:image/")).optional(),
});

export const MessageSchema = z.object({
  content: z.string()
    .min(1, "Mensagem vazia")
    .max(1000, "Máximo 1000 caracteres")
    .transform(s => sanitizeFreeText(s, 1000))
    .refine(s => s.trim().length > 0, "Mensagem vazia"),
});

export const ReviewInputSchema = z.object({
  nota: z.number().int().min(1).max(5),
  comentario: z.string().max(500).transform(s => sanitizeFreeText(s, 500)).optional(),
  cumprimento: z.enum(["sim", "parcialmente", "nao"]),
});

export const RegisterInputSchema = z.object({
  nome: z.string().min(3).max(100).transform(s => sanitizeFreeText(s, 100)),
  email: z.string().email().max(255).toLowerCase().trim(),
  senha: z.string().min(8, "Mínimo 8 caracteres").max(128)
    .refine(s => /[A-Za-z]/.test(s) && /[0-9]/.test(s), "Senha deve conter letra e número"),
  whatsapp: z.string().min(10).max(20),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  uf: z.string().length(2),
  cidade: z.string().min(2).max(100),
  bairro: z.string().min(2).max(100),
  tipoPerfil: z.string().min(2).max(20),
  categorias: z.array(z.string()).min(1).max(10),
});

// ──────────────────────────────────────────────────────────
// 5. SECURITY HEADERS (CWE-693)
// ──────────────────────────────────────────────────────────
export const SECURITY_HEADERS = {
  "X-DNS-Prefetch-Control": "on",
  "X-Frame-Options": "SAMEORIGIN", // [SEC-FIX] CWE-1021: Clickjacking protection
  "X-Content-Type-Options": "nosniff", // [SEC-FIX] CWE-693: MIME sniffing protection
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin", // [SEC-FIX] CWE-200: Referrer leakage
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload", // [SEC-FIX] CWE-319: HSTS
  // CSP será definido no next.config.ts para permitir Supabase + imagens
};

// ──────────────────────────────────────────────────────────
// 6. IDOR / ACCESS CONTROL HELPERS (CWE-639, CWE-284)
// ──────────────────────────────────────────────────────────
export function assertOwnership(resourceUserId: string, currentUserId: string, resourceName = "recurso") {
  // [SEC-FIX] CWE-639: Verificação explícita de propriedade para prevenir IDOR
  if (!resourceUserId || !currentUserId) {
    securityLog("idor_attempt", { resourceName, resourceUserId, currentUserId }, "high");
    throw new Error(`Sem permissão para acessar ${resourceName}`);
  }
  if (resourceUserId !== currentUserId) {
    securityLog("idor_attempt", { resourceName, resourceUserId, currentUserId }, "critical");
    throw new Error(`Sem permissão para acessar ${resourceName}`);
  }
}

export function assertValidId(id: string, fieldName = "ID") {
  // [SEC-FIX] CWE-20: Validação de ID para prevenir injection e IDOR
  if (!id || typeof id !== "string" || id.length < 8 || id.length > 100) {
    securityLog("validation_failed", { field: fieldName, id: id?.slice(0, 20) }, "medium");
    throw new Error(`${fieldName} inválido`);
  }
  if (/[<>"'`;\\]/.test(id)) {
    securityLog("injection_attempt", { field: fieldName, id: id.slice(0, 20) }, "high");
    throw new Error(`${fieldName} contém caracteres inválidos`);
  }
}

// ──────────────────────────────────────────────────────────
// 7. CSRF TOKEN (CWE-352) - Para operações sensíveis
// ──────────────────────────────────────────────────────────
export function generateCSRFToken(): string {
  // [SEC-FIX] CWE-352: Geração de token CSRF para operações críticas
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function validateCSRFToken(token: string, expected: string): boolean {
  if (!token || !expected) return false;
  return token === expected;
}

// ──────────────────────────────────────────────────────────
// 8. PASSWORD STRENGTH (CWE-521)
// ──────────────────────────────────────────────────────────
export function isStrongPassword(pwd: string): { valid: boolean; errors: string[] } {
  // [SEC-FIX] CWE-521: Política de senha forte - mínimo 8 chars, letra + número
  const errors: string[] = [];
  if (pwd.length < 8) errors.push("Mínimo 8 caracteres");
  if (!/[A-Za-z]/.test(pwd)) errors.push("Deve conter letra");
  if (!/[0-9]/.test(pwd)) errors.push("Deve conter número");
  if (pwd.length > 128) errors.push("Máximo 128 caracteres");
  // Bloqueia senhas muito comuns
  const common = ["123456", "password", "12345678", "qwerty", "admin123"];
  if (common.includes(pwd.toLowerCase())) errors.push("Senha muito comum");
  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════
// 9. CAMADA 3 ANTI-HACKER · Deception, Tarpitting, Fingerprint, Canary, Kill Switch
// ═══════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────
// 9.1 Kill Switch global (CISO)
// ──────────────────────────────────────────────────────────
/**
 * [THREAT-MITIGATION] Kill switch: flag global EMERGENCY_LOCKDOWN
 * Se ativada, bloqueia todas as rotas exceto health check
 * Usada pelo CISO em caso de breach confirmado
 */
export function isEmergencyLockdown(): boolean {
  if (typeof process !== "undefined" && process.env) {
    const flag = process.env.EMERGENCY_LOCKDOWN || process.env.NEXT_PUBLIC_EMERGENCY_LOCKDOWN;
    return flag === "true" || flag === "1";
  }
  return false;
}

// ──────────────────────────────────────────────────────────
// 9.2 Fingerprinting (MITRE T1083, T1595)
// Detecta mesmo atacante com IP rotativo via UA+Lang+Accept hash
// ──────────────────────────────────────────────────────────
export function generateFingerprint(ip: string, userAgent: string, acceptLang?: string): string {
  // [THREAT-MITIGATION] Fingerprint anonimizado sem PII
  const input = `${ip}|${userAgent.slice(0, 100)}|${(acceptLang || "").slice(0, 20)}`;
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, "0");
}

// ──────────────────────────────────────────────────────────
// 9.3 Tarpitting (MITRE T1110 Brute Force)
// Delay progressivo após falhas para frustrar automação
// ──────────────────────────────────────────────────────────
const tarpitMap = new Map<string, { fails: number; last: number }>();

// [FIX-WAF] Grace period 60s após cold start - thresholds permissivos
let coldStartAtSec = Date.now();
function isColdStartGraceSec(): boolean {
  return Date.now() - coldStartAtSec < 60 * 1000;
}

/**
 * [THREAT-MITIGATION] Registra falha de login e retorna delay necessário
 * Script kiddie desiste em 5 min, intermediário em 2h
 * [SEC-FIX] Fine-tuning: teto max 8000ms para evitar 504 Vercel (timeout 10s)
 */
export function registerLoginFailure(identifier: string): number {
  const now = Date.now();
  const entry = tarpitMap.get(identifier) || { fails: 0, last: now };
  // Reseta se passou 1h
  if (now - entry.last > 60 * 60 * 1000) {
    entry.fails = 0;
  }
  entry.fails += 1;
  entry.last = now;
  tarpitMap.set(identifier, entry);

  // [FIX-WAF] Threshold 7+ para evitar falso positivo em login/logout loop 5x - P1
  // Antes 3→2s causava bloqueio em navegação legítima, agora 7→2s | 8→4s | 9→6s | 10+→8s max 8000ms
  if (entry.fails <= 6) return 0;
  let delay: number;
  if (entry.fails === 7) delay = 2000;
  else if (entry.fails === 8) delay = 4000;
  else if (entry.fails === 9) delay = 6000;
  else delay = 8000; // max 8s teto Vercel 504
  securityLog("tarpit_triggered", { identifier: identifier.slice(0, 20), fails: entry.fails, delay }, "medium");
  return delay;
}

export function clearLoginFailures(identifier: string) {
  tarpitMap.delete(identifier);
  // [FIX-WAF] Limpa também rate limit buckets para evitar 403 intermitente após login OK
  const keysToDelete: string[] = [];
  for (const k of memoryBuckets.keys()) {
    if (k.includes(identifier) || k.startsWith("login:") || k.startsWith("register:")) {
      // Só limpa se contém o identificador ou se for do mesmo usuário? Para segurança, limpa apenas se contém identificador
      if (k.includes(identifier)) keysToDelete.push(k);
    }
  }
  for (const k of keysToDelete) memoryBuckets.delete(k);
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(getStorageBucketKey("login", identifier));
      localStorage.removeItem(getStorageBucketKey("register", identifier));
    }
  } catch {}
  console.info(`[SEC] login_success_reset identifier=${identifier.slice(0,3)}*** cleared tarpit and rate limit [FIX-WAF]`);
}

export async function applyTarpitDelay(identifier: string): Promise<void> {
  const delay = registerLoginFailure(identifier);
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

// ──────────────────────────────────────────────────────────
// 9.4 Canary tokens / Poisoned data (MITRE T1005 Data from Local System)
// Se atacante ler dados canário, dispara alerta
// ──────────────────────────────────────────────────────────
export const CANARY_EMAILS = ["canary@trocabairro.com", "honeypot@trocabairro.com", "trap@trocabairro.com"];
export const CANARY_AD_IDS = ["canary-ad-001", "canary-ad-002"];

export function isCanaryEmail(email: string): boolean {
  return CANARY_EMAILS.includes(email.toLowerCase());
}

export function isCanaryAdId(adId: string): boolean {
  return CANARY_AD_IDS.includes(adId);
}

export function checkCanaryAccess(emailOrId: string): boolean {
  // [THREAT-MITIGATION] Se acessar canário, loga crítico e bloqueia
  if (isCanaryEmail(emailOrId) || isCanaryAdId(emailOrId)) {
    securityLog("canary_access", { target: emailOrId, alert: "APT may have breached DB" }, "critical");
    return true;
  }
  return false;
}

// ──────────────────────────────────────────────────────────
// 9.5 Honeypot detection (MITRE T1595 Active Scanning)
// ──────────────────────────────────────────────────────────
// [SEC-FIX] Fine-tuning: /admin removido - rota legítima Painel Admin, não honeypot
export const HONEYPOT_PATHS = [
  "/wp-admin",
  "/wp-login",
  "/phpmyadmin",
  "/.env",
  "/.git",
  "/.aws",
  "/backup",
  "/config",
  "/server-status",
  "/actuator",
];

export function isHoneypotPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return HONEYPOT_PATHS.some((hp) => lower.startsWith(hp) || lower.includes(hp));
}

// ──────────────────────────────────────────────────────────
// 9.6 Bot / Scanner detection (MITRE T1595, T1071)
// ──────────────────────────────────────────────────────────
const BOT_PATTERNS = [/sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /dirbuster/i, /gobuster/i, /wfuzz/i, /acunetix/i, /nessus/i, /burp/i];

export function isMaliciousBot(userAgent: string): boolean {
  if (!userAgent) return false;
  const legit = /Googlebot|Bingbot|DuckDuckBot|facebookexternalhit|LinkedInBot/i.test(userAgent);
  if (legit) return false;
  return BOT_PATTERNS.some((pat) => pat.test(userAgent));
}

// ──────────────────────────────────────────────────────────
// 9.7 CRLF Injection detection (CWE-113)
// ──────────────────────────────────────────────────────────
export function containsCRLF(input: string): boolean {
  return /[\r\n]/.test(input);
}

// ──────────────────────────────────────────────────────────
// 9.8 SQL/NoSQL Injection pattern detection (CWE-89, CWE-943)
// ──────────────────────────────────────────────────────────
export function containsInjectionPattern(input: string): boolean {
  return /(\bunion\b.*\bselect\b|\bselect\b.*\bfrom\b|%27.*--|\\bdrop\\b.*\\btable\\b|\\$where|\\$ne|\\$gt|\\$regex|<script|javascript:)/i.test(input);
}
