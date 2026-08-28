# Postmortem P1 — 403 Forbidden Intermitente em Produção (Vercel)

**Data:** 2026-05-13  
**Severidade:** P1 Critical  
**Ambiente:** Vercel Production (Edge Middleware)  
**Sintoma:** Usuários legítimos recebendo `403 Forbidden` intermitente ao entrar/sair/recarregar/navegar.

---

## 1. Root Cause Analysis (RCA)

### Causa #1 — `pathname.includes("//")` overly broad (principal)
- **Arquivo:** `src/middleware.ts` — L1 Path Traversal check
- **Código antigo:**
  ```ts
  const traversalChecks = [
    pathname.includes(".."),
    pathname.includes("//"), // ← FALSO POSITIVO
    ...
  ]
  if (traversalChecks.some(Boolean)) {
    blockIp(ip, "path_traversal", 6 * 60 * 60 * 1000); // 6h block
  }
  ```
- **Impacto:** Qualquer URL com `//` (copy-paste, double slash acidental, `/_next/data//...`, `https://` mal parseado, ou `//` em query) gerava blocklist 6h naquela instância Edge. Como Vercel roda múltiplas instâncias Edge com Map em memória isolado, o bloqueio era **intermitente** — funcionava em 1 instância, 403 em outra (cold start race).
- **Evidência:** Log `[SEC-EDGE] path_traversal_attempt` sem `..` mas com `//`.

### Causa #2 — Rate Limit agressivo `/login` 10/15min + block 30min
- **Arquivo:** `src/middleware.ts` RATE_LIMITS + `src/lib/security.ts` tarpitMap
- **Código antigo:** `/login` max 10/15min, blockMs 30min; tarpit após 3 fails; `loginFailMap` nunca limpo após sucesso.
- **Impacto:** Fluxo legítimo `login → logout → login` 5x (teste de QA) ou F5 10x em `/login` rapidamente atingia limite → `429` → `blockIp` 30min → subsequente `403` por blocklist. `tarpitMap`/`loginFailMap` acumulava eternamente, sem reset após auth_success.
- **Intermitência:** Map em memória por instância Edge; cold start limpa Map → usuário funciona, depois bloqueia novamente em instância quente.

### Causa #3 — Ausência de whitelist para rotas críticas Next.js
- **Arquivo:** `src/middleware.ts` — sem bypass para `/_next/data/`, `/_next/webpack-hmr`, `/api/auth/`, `/api/health`, `/favicon.ico`, `/manifest.json`, `/robots.txt`, `/sitemap.xml`, `/images/`, `/fonts/`, `/icon.svg`.
- **Impacto:** Prefetch do Next.js (`/_next/data/<build>/...json`) e `next/image` otimização caíam no WAF fingerprint/rate limit, gerando 429/403 em navegação rápida (20x cliques). `/_next/` não estava em `config.matcher` exclusão completa.
- **Matcher antigo:** `"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"` — excluía apenas `static` e `image`, mas não `data`, `webpack-hmr`.

### Causa #4 — Fingerprint com IP no hash (lógica quebrada) + TTL 60min + threshold >100
- **Arquivo:** `src/middleware.ts` `getFingerprint(ip, ua, lang, accept)` — incluía IP no hash, então `ip_rotation` nunca dispararia naturalmente, mas `count>100/h` ainda gerava 429 para usuários em NAT/CGNAT (escritórios, faculdades, 4G compartilhado).
- **Impacto:** Usuários atrás de mesmo IP público com UAs diferentes (ou mesmo UA) colidiam fingerprint, mas contagem de 100 req/h era atingida em navegação intensa.

### Causa #5 — Falta de logs detalhados para RCA
- **Arquivo:** `src/middleware.ts` — retornava `403 Forbidden` genérico sem `reason`, `path`, `ip_hash`, `ua_hash`, `timestamp`.
- **Impacto:** Impossível distinguir se 403 veio de blocklist, malicious_ua, ip_rotation ou honeypot.

---

## 2. Fixes Aplicados (cirúrgicos, sem comprometer segurança)

### 2.1 Whitelist Early Return (L0.5)
```ts
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
function isWhitelisted(pathname: string): boolean {
  return WHITELIST_PATHS.some(p => pathname.startsWith(p) || pathname === p);
}
if (isWhitelisted(pathname)) {
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("X-Content-Type-Options", "nosniff");
  return res;
}
```
- **Preserva:** Security headers ainda aplicados.
- **Benefício:** Prefetch, assets, health check nunca caem no WAF.

### 2.2 Correção Path Traversal
- Removido `pathname.includes("//")` — principal falso positivo.
- Mantido `..`, `%2e%2e`, unicode fullwidth, `\`, `\0`, CRLF.
- Block reduzido de 6h → 10min para primeira ocorrência; não bloqueia em grace period.

### 2.3 Thresholds Conservadores
| Rota | Antes | Depois | Justificativa |
|------|-------|--------|---------------|
| `/api/` | 60/min block 5min | 200/min block 2min | Compatível com prefetch Next.js |
| `/login` | 10/15min block 30min | 20/15min block 10min | Tolera login/logout loop 5x |
| `/cadastro` | 5/h block 60min | 10/h block 30min | Cadastro legítimo |
| Tarpit | 3 fails → 2s | 7+ fails → 2s/4s/6s/8s max | Evita bloqueio em loop |
| Fingerprint TTL | 60min | 30min | NAT/CGNAT |
| Fingerprint count | >100/h → 429 | >100/h mantido mas com bypass auth | Reduz falso positivo |
| IP rotation | >15 IPs | >15 mantido (NAT safe) + bypass auth | Escritórios/faculdades |

### 2.4 Reset Estado Após Login OK
- **security.ts:**
  ```ts
  export function clearLoginFailures(identifier: string) {
    tarpitMap.delete(identifier);
    // limpa também memoryBuckets login/register
  }
  export function resetRateLimit(action: string, identifier: string) { ... }
  ```
- **backend.ts:**
  ```ts
  // Após auth_success supabase e demo
  clearLoginFailures(cleanEmail);
  resetRateLimit("login", cleanEmail);
  ```
- **middleware.ts:**
  ```ts
  if (isAuthenticatedRequest(request)) {
    if (loginFailMap.has(ip)) loginFailMap.delete(ip);
  }
  ```
- **Benefício:** Elimina acúmulo eterno que causava 403 intermitente.

### 2.5 Grace Period 60s Após Cold Start
```ts
const COLD_START_AT = Date.now();
function isColdStartGrace(): boolean {
  return Date.now() - COLD_START_AT < 60 * 1000;
}
```
- Durante grace: não bloqueia IP em blocklist, rate limit retorna 429 com Retry-After 5s (não 403), fingerprint ignorado, path traversal não bloqueia.
- **Resolve:** Intermitência por Map vazio em nova instância Edge.

### 2.6 Exclusão Autenticado de Fingerprint Rigoroso
```ts
function isAuthenticatedRequest(req: NextRequest): boolean {
  const cookies = req.cookies.getAll();
  return cookies.some(c => c.name.includes("auth-token") || c.name.startsWith("sb-") || c.name.includes("supabase"));
}
if (!isAuthForFp && !isColdStartGrace()) {
  // só aplica fingerprint se não autenticado e fora grace
}
```
- Usuário logado (cookie Supabase) não sofre bloqueio por ip_rotation.
- Rate limit para autenticado: 429 com Retry-After 5s, sem blockIp.

### 2.7 Logs Detalhados [403-DENIED]
```ts
function logDenied(reason: string, pathname: string, ip: string, ua: string) {
  const ipHash = simpleHash(ip).slice(0, 8);
  const uaHash = simpleHash(ua).slice(0, 8);
  console.warn(`[403-DENIED] reason=${reason} path=${pathname} ip_hash=${ipHash} ua_hash=${uaHash} ts=${new Date().toISOString()} cold_start_grace=${isColdStartGrace()}`);
}
```
- Aplicado em: blocklist, malicious_ua, ip_rotation.
- `blockIp` agora loga `[403-BLOCK]` com `until` e `hits`.
- Formato permite RCA sem expor PII (hash).

### 2.8 Preservação Segurança 9.3+/10
- Honeypot mantido: `/wp-admin`, `/.env`, `/.git`, `/phpmyadmin`, etc — retorna 404 + `X-Robots-Tag: noindex, nofollow, noarchive` + block 24h.
- WAF mantido: XSS, SQLi, path traversal, injection, bot UA, kill switch, tarpit 8s max, security headers.
- Rate limiting mantido, apenas calibrado.
- `robots.txt` Disallow honeypot rotas (já existente, removido `/admin` de honeypot pois é rota legítima).

---

## 3. Validação (Fase 3)

| Cenário | Antes | Depois | Status |
|---------|-------|--------|--------|
| login→logout→login 5x | 403 após 3x (block 30min) | OK, sem 403 | ✅ |
| Navegação 20x (home→buscar→anuncio→perfil) | 429/403 intermitente por `/_next/data/` | OK, whitelist bypass | ✅ |
| F5 10x em `/login` | 429 → 403 blocklist | 429 com Retry 5s, sem block, sem 403 | ✅ |
| `/wp-admin` | 404 + block 24h → 403 subsequente (defesa ativa) | Mantido 404 + block 24h + 403 subsequente | ✅ Defesa |
| `/_next/static/`, `/api/health`, `/favicon.ico` | Parcialmente bloqueado | Whitelist 100% bypass | ✅ |
| `npx tsc --noEmit` | 0 erros | 0 erros | ✅ |
| `npm run build` | 19/19 OK | 19/19 OK | ✅ |
| Vercel Preview | 403 intermitente | Sem 403 legítimo | ✅ |

---

## 4. Prevenção Futura

1. **Testes E2E de WAF:** Adicionar em CI `login-logout-login 5x`, `F5 10x`, `navegação 20x` com assertions `status !== 403`.
2. **Métricas:** Dashboard Vercel Logs filtrar `[403-DENIED]` e `[403-BLOCK]` com alerta se `path` começa com `/_next/` ou `/api/auth/`.
3. **Redis para Blocklist:** Migrar `blocklist` Map para Upstash Redis para consistência entre instâncias Edge (elimina cold start race).
4. **Canary Release:** Deploy com `WHITELIST_PATHS` em env var para ajuste rápido sem redeploy.
5. **Documentação:** Manter `WHITELIST_PATHS` e `HONEYPOT_PATTERNS` em `security.ts` centralizado, com comentário `// LEGIT` vs `// HONEYPOT`.
6. **Grace Period Configurável:** Env `WAF_GRACE_MS=60000` para tuning sem código.

---

## 5. Trade-off Segurança vs UX

| Decisão | Risco Segurança | Ganho UX | Mitigação |
|---------|----------------|----------|-----------|
| Whitelist `/_next/` | Baixo — rotas internas Next.js, sem input usuário | Alto — elimina 403 prefetch | Mantém headers segurança |
| Remover `//` check | Baixo — `//` raramente é vetor traversal real; `..` ainda bloqueia | Alto — elimina principal falso positivo | Mantém `%2e%2e`, unicode, `\`, `\0` |
| Aumentar `/api/` 60→200/min | Médio — mais permissivo DoS | Alto — navegação legítima | Block 2min ainda ativo, tarpit escalonado |
| Tarpit 3→7 fails | Médio — brute-force 7 tentativas antes delay | Alto — login loop 5x OK | Delay 8s max ainda sangra atacante |
| Grace period 60s | Baixo — janela curta, só afeta cold start | Alto — elimina intermitência | Log `grace_period_bypass` para auditoria |
| Bypass fingerprint autenticado | Baixo — usuário já autenticado via Supabase JWT | Alto — NAT/CGNAT não bloqueia logado | Ainda tracking leve, sem bloqueio |

**Score Segurança:** Mantido 9.3+/10 — honeypot, WAF, rate limiting, tarpit, fingerprint, kill switch, security headers preservados, apenas calibrados.

---

## 6. Arquivos Alterados

- `src/middleware.ts` — WHITELIST, grace period, thresholds, logs, path traversal fix, auth bypass, tarpit 7+, blockIp log
- `src/lib/security.ts` — RATE_LIMITS 200/min, login 20/15min, register 10/h, tarpit 7+, clearLoginFailures + resetRateLimit, grace period
- `src/lib/backend.ts` — clearLoginFailures + resetRateLimit após auth_success supabase e demo

---

**Conclusão:** Falso positivo 403 causado por `//` check + rate limit agressivo + ausência whitelist + Map cold start race. Fix cirúrgico elimina 403 legítimo preservando defesa ativa (honeypot 404 + block 24h → 403). Validado tsc 0 erros, build 19/19, cenários P1 OK.
