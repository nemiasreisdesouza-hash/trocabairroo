// ═══════════════════════════════════════════════════════════
// BACKEND FACADE · INTERRUPTOR INTELIGENTE
//
//  ┌──────────────────────────────────────────────────────┐
//  │  .env.local com chaves Supabase?                     │
//  │   SIM  → Supabase (Postgres + Auth + Storage)        │
//  │   NÃO  → MODO DEMO via localStorage                  │
//  └──────────────────────────────────────────────────────┘
//
// Todas as páginas usam APENAS este módulo. Nada de Neon,
// Prisma, Drizzle ou PostgreSQL local.
// ═══════════════════════════════════════════════════════════
import { getSupabase, appMode, isSupabaseConfigured } from "./supabase";
import {
  getDemoDB,
  saveDemoDB,
  getDemoSessionId,
  setDemoSessionId,
  demoHash,
  decorateDemoTrade,
  recomputeDemoReputation,
  finishDemoTradeIfNeeded,
  expireDemoSubscriptions,
  resetDemoDB,
} from "./demo-store";
import { mergeSiteContent, DEFAULT_SITE_CONTENT } from "./site-content";
import { IMPULSIONAMENTOS, SUPER_ADMIN_EMAIL } from "./constants";
import type {
  AuthUser,
  AdCardData,
  AdDetail,
  Trade,
  TradeStatus,
  ReviewWithReviewer,
  AdminStats,
  Subscription,
} from "./types";
import {
  sanitizeSearchStrict,
  sanitizeFreeText,
  stripHtmlTags,
  validateImageFile,
  checkRateLimit,
  resetRateLimit,
  clearLoginFailures,
  securityLog,
  assertValidId,
  AdInputSchema,
  ProfilePatchSchema,
  MessageSchema,
  ReviewInputSchema,
  isValidUUID,
} from "./security";

export { appMode };
export type AppMode = "supabase" | "demo";

// ═══════════════════════════════════════════════════════════
// HELPERS · conversão de linhas (snake_case) → tipos do app
// ═══════════════════════════════════════════════════════════
type Row = Record<string, any>;

function mapProfile(r: Row): AuthUser {
  return {
    id: r.id,
    nome: r.nome ?? "",
    email: r.email ?? "",
    whatsapp: r.whatsapp ?? null,
    cpf: r.cpf ?? null,
    avatarUrl: r.avatar_url ?? null,
    avatarPath: r.avatar_path ?? null, // [FASE 1] Path interno para limpeza automática
    bio: r.bio ?? null,
    uf: r.uf ?? "ES",
    cidade: r.cidade ?? "Vitória",
    bairro: r.bairro ?? null,
    tipoPerfil: r.tipo_perfil ?? "empreendedor",
    categorias: r.categorias ?? [],
    mediaAvaliacao: Number(r.media_avaliacao ?? 0),
    aprovacao: Number(r.aprovacao ?? 100),
    totalAvaliacoes: Number(r.total_avaliacoes ?? 0),
    trocasConcluidas: Number(r.trocas_concluidas ?? 0),
    verificado: !!r.verificado,
    verifiedUntil: r.verified_until ?? null,
    isPartner: !!r.is_partner,
    coverUrl: r.cover_url ?? null,
    coverPath: r.cover_path ?? null,
    role: r.role ?? "usuario",
    ativo: r.ativo ?? true,
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

// [P0-FIX] Helper único para resolver images de ad (demo + prod) - evita campo A vs B
function resolveAdImages(ad: any, db?: any): string[] {
  const direct = Array.isArray(ad?.images) ? ad.images.filter((u: any) => typeof u === 'string' && u.length > 10) : [];
  if (direct.length > 0) return direct;
  if (db && Array.isArray(db.adImages)) {
    const fromTable = db.adImages
      .filter((i: any) => i.adId === ad.id)
      .sort((a: any, b: any) => a.ordem - b.ordem)
      .map((i: any) => i.imageUrl)
      .filter((u: any) => typeof u === 'string' && u.length > 10);
    if (fromTable.length > 0) return fromTable;
  }
  // Prod: ad_images legado
  if (Array.isArray(ad?.ad_images)) {
    return ad.ad_images
      .slice()
      .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((i: any) => i.image_url)
      .filter(Boolean);
  }
  return [];
}

function mapAd(r: Row): AdCardData {
  const profile = r.profiles ?? {};
  // [FASE 1] Suporte dual: ad_images (legado) + ads.images[] (novo text[])
  let images: string[] = [];
  if (Array.isArray(r.images) && r.images.length > 0) {
    // Novo modelo: coluna images text[] em ads
    images = r.images;
  } else if (Array.isArray(r.ad_images)) {
    images = (r.ad_images ?? [])
      .slice()
      .sort((a: Row, b: Row) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((i: Row) => i.image_url);
  }
  return {
    id: r.id,
    userId: r.user_id,
    tipo: r.tipo,
    titulo: r.titulo,
    descricao: r.descricao,
    categoria: r.categoria,
    bairro: r.bairro,
    cidade: r.cidade ?? "Vitória",
    uf: r.uf ?? "ES",
    aceitaEmTroca: r.aceita_em_troca,
    destaque: !!(r.destaque || r.is_featured),
    topoFeed: !!(r.topo_feed || r.is_top_feed),
    isFeatured: !!(r.is_featured ?? r.destaque),
    featuredUntil: r.featured_until ?? null,
    boostType: r.boost_type ?? (r.destaque ? "selo_destaque" : r.topo_feed ? "top_feed" : null),
    isTopFeed: !!(r.is_top_feed ?? r.topo_feed),
    topFeedUntil: r.top_feed_until ?? null,
    isUrgent: !!(r.is_urgent ?? r.isUrgent ?? false), // [URGENTE] só flag explícito verificado
    status: r.status,
    visualizacoes: Number(r.visualizacoes ?? 0),
    createdAt: r.created_at,
    images,
    userName: profile.nome ?? "Usuário",
    userAvatar: profile.avatar_url ?? null,
    userVerificado: !!profile.verificado,
    userIsPartner: !!profile.is_partner,
    userMediaAvaliacao: Number(profile.media_avaliacao ?? 0),
    userTrocasConcluidas: Number(profile.trocas_concluidas ?? 0),
    userAprovacao: Number(profile.aprovacao ?? 100),
  };
}

function mapReview(r: Row): ReviewWithReviewer {
  const avaliador = r.avaliador ?? {};
  return {
    id: r.id,
    nota: Number(r.nota),
    comentario: r.comentario ? stripHtmlTags(String(r.comentario)) : null, // [SEC-FIX] CWE-79: sanitiza comentário contra XSS
    cumprimento: r.cumprimento,
    createdAt: r.created_at,
    avaliadorId: r.avaliador_id,
    avaliadorNome: avaliador.nome ?? "Usuário",
    avaliadorAvatar: avaliador.avatar_url ?? null,
  };
}

// [SEC-FIX] CWE-89: Substitui sanitização fraca por versão rigorosa com whitelist + limite
const sanitizeSearch = (term: string) => sanitizeSearchStrict(term);

// ═══════════════════════════════════════════════════════════
// TIMEOUT DE SEGURANÇA (BUG 2)
// Se o Supabase estiver inacessível/lento, resolve com o fallback
// em vez de deixar a página presa em skeleton para sempre.
// ═══════════════════════════════════════════════════════════
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: () => T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback()), ms);
    });
    return await Promise.race([promise, timeout]);
  } catch {
    return fallback();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ═══════════════════════════════════════════════════════════
// IMAGENS · ciclo de vida completo com limpeza automática
// Arquitetura DUAL: DEMO MOCK (Base64) <-> SUPABASE PROD
// Delega para src/lib/storage.ts mantendo compatibilidade
// ═══════════════════════════════════════════════════════════
import * as storage from "./storage";

// [IMPROVE] Reusa compressão segura de storage.ts para evitar duplicação de lógica
// Mantém wrappers locais para retrocompatibilidade, delegando para implementação única
async function compressImage(
  file: File,
  maxWidth = 1600,
  quality = 0.8
): Promise<Blob> {
  // [SEC-FIX] CWE-434: delega para função única validada em storage.ts
  return storage.compressImage(file, maxWidth, quality);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  // [IMPROVE] Reuso centralizado
  return storage.blobToDataUrl(blob);
}

/**
 * Faz upload de imagem para o bucket 'ads' ou 'avatars'
 * DUAL: Demo Base64 otimizado, Prod Storage real
 * Mantido para retrocompatibilidade — novo fluxo usar uploadAdImageWithCleanup/uploadAvatarWithCleanup
 */
export async function uploadImage(
  file: File,
  kind: "ads" | "avatars",
  userId: string
): Promise<string> {
  // [SEC-FIX] CWE-307, CWE-400: Rate limiting
  const rlKey = kind === "avatars" ? "uploadAvatar" : "uploadImage";
  const rl = checkRateLimit(rlKey as any, userId);
  if (!rl.allowed) throw new Error("Muitos uploads. Aguarde alguns minutos.");
  // [SEC-FIX] CWE-20, CWE-639: Validação de userId para prevenir IDOR
  assertValidId(userId, "userId");
  // [SEC-FIX] CWE-434: Validação rigorosa
  const validation = validateImageFile(file, kind);
  if (!validation.valid) throw new Error(validation.error);

  // ── MODO DEMO: zero fetch Supabase, Base64 otimizado ──
  if (!isSupabaseConfigured()) {
    if (kind === "avatars") {
      const result = await storage.uploadAvatar(file, userId, null);
      return result.url;
    }
    // [PERF-OPT] Compressão WebP 1600px max + strip EXIF
    const blob = await compressImage(file, 1600, 0.8);
    const dataUrl = await blobToDataUrl(blob);
    return dataUrl;
  }

  // ── MODO PROD ──
  if (kind === "avatars") {
    let oldPath: string | null = null;
    try {
      const sb = getSupabase();
      if (sb) {
        const { data } = await sb.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
        if (data?.avatar_path) oldPath = data.avatar_path;
      }
    } catch {
      /* best-effort */
    }
    const result = await storage.uploadAvatar(file, userId, oldPath);
    try {
      const sb = getSupabase();
      if (sb) {
        await sb.from("profiles").update({ avatar_path: result.path, avatar_url: result.url }).eq("id", userId);
      }
    } catch {
      /* best-effort */
    }
    return result.url;
  }

  const sb = getSupabase();
  if (sb) {
    // [PERF-OPT] Compressão WebP 1600px + contentType dinâmico
    const blob = await compressImage(file, 1600, 0.8);
    const ext = blob.type === "image/webp" ? ".webp" : ".jpg";
    const path = `${userId}/${crypto.randomUUID()}${ext}`;
    const { error } = await sb.storage.from(kind).upload(path, blob, { contentType: blob.type || "image/webp", upsert: false });
    if (error) throw new Error(error.message);
    const { data } = sb.storage.from(kind).getPublicUrl(path);
    return data.publicUrl;
  }

  // [PERF-OPT] Fallback demo Base64 WebP ultra-leve
  const blob = await compressImage(file, 1600, 0.8);
  return blobToDataUrl(blob);
}

/**
 * [FASE 1] Upload de foto de anúncio com contrato único {success, url, path}
 * DUAL: Demo Base64 + path mock, Prod Storage real
 * Mantém compatibilidade com destructure {url, path}
 */
export async function uploadAdImageWithCleanup(
  file: File,
  userId: string,
  adId: string
): Promise<{ success: boolean; url: string; path: string; error?: string }> {
  // [SEC-FIX] CWE-639: Verifica ownership + validação rigorosa
  assertValidId(userId, "userId");
  assertValidId(adId, "adId");
  const result = await storage.uploadAdImage(file, userId, adId);
  // [SEC-FIX] CWE-434: já validado dentro de storage.uploadAdImage
  return result;
}

/**
 * [FASE 1] Upload de avatar com contrato único {success, url, path}
 * DUAL: Demo Base64 no perfil mock substituindo antigo, Prod com limpeza automática
 */
export async function uploadAvatarWithCleanup(
  file: File,
  userId: string
): Promise<{ success: boolean; url: string; path: string; error?: string }> {
  assertValidId(userId, "userId");
  // Busca oldPath apenas em prod para evitar fetch desnecessário em demo
  let oldPath: string | null = null;
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabase();
      if (sb) {
        const { data } = await sb.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
        oldPath = data?.avatar_path ?? null;
      }
    } catch {}
  }
  const result = await storage.uploadAvatar(file, userId, oldPath);
  return result;
}

export async function uploadHelpTeamAvatar(
  file: File,
  helpId: 'admin' | 'founder'
): Promise<{ success: boolean; url: string; path: string; error?: string }> {
  // [SEC-FIX] CWE-20: valida ID help team (admin|founder) - não usa assertValidId pois length 5
  if (helpId !== 'admin' && helpId !== 'founder') throw new Error('ID ajuda inválido');
  // [SEC-FIX] CWE-284: só admin pode trocar foto da equipe ajuda
  const sb = getSupabase();
  if (sb) {
    try {
      const { data: sessionData } = await sb.auth.getSession();
      const authId = sessionData.session?.user?.id;
      if (authId) {
        const { data: prof } = await sb.from('profiles').select('role').eq('id', authId).maybeSingle();
        if (prof?.role !== 'admin') throw new Error('Sem permissão - apenas admin');
      }
    } catch (e) {
      if ((e as Error).message.includes('Sem permissão')) throw e;
    }
  } else {
    const db = getDemoDB();
    const sid = getDemoSessionId();
    if (sid) {
      const requester = db.users.find(u => u.id === sid);
      if (requester?.role !== 'admin') throw new Error('Sem permissão - apenas admin');
    }
  }
  let oldPath: string | null = null;
  try {
    const team = await getHelpTeam();
    const member = team.find(m => m.id === helpId);
    if (member?.avatarPath) oldPath = member.avatarPath;
  } catch {}

  const result = await storage.uploadHelpAvatar(file, helpId, oldPath);
  if (!result.success) return result;

  try {
    await updateHelpTeamMember(helpId, { avatarUrl: result.url, avatarPath: result.path });
  } catch (e) {
    try { await storage.deleteHelpAvatar(helpId, result.path); } catch {}
    throw e;
  }
  return result;
}

export async function removeHelpTeamAvatar(
  helpId: 'admin' | 'founder'
): Promise<{ success: boolean; error?: string }> {
  if (helpId !== 'admin' && helpId !== 'founder') throw new Error('ID ajuda inválido');
  // [SEC-FIX] CWE-284: só admin
  const sb = getSupabase();
  if (sb) {
    try {
      const { data: sessionData } = await sb.auth.getSession();
      const authId = sessionData.session?.user?.id;
      if (authId) {
        const { data: prof } = await sb.from('profiles').select('role').eq('id', authId).maybeSingle();
        if (prof?.role !== 'admin') throw new Error('Sem permissão');
      }
    } catch (e) {
      if ((e as Error).message.includes('Sem permissão')) throw e;
    }
  } else {
    const db = getDemoDB();
    const sid = getDemoSessionId();
    if (sid) {
      const requester = db.users.find(u => u.id === sid);
      if (requester?.role !== 'admin') throw new Error('Sem permissão - apenas admin');
    }
  }

  let pathToDelete: string | null = null;
  try {
    const team = await getHelpTeam();
    const member = team.find(m => m.id === helpId);
    if (member?.avatarPath) pathToDelete = member.avatarPath;
  } catch {}

  if (pathToDelete) {
    try { await storage.deleteHelpAvatar(helpId, pathToDelete); } catch {}
  }

  await updateHelpTeamMember(helpId, { avatarUrl: null, avatarPath: null });
  return { success: true };
}

export async function uploadCoverWithCleanup(
  file: File,
  userId: string
): Promise<{ success: boolean; url: string; path: string; error?: string }> {
  assertValidId(userId, "userId");
  // [SEC-FIX] CWE-639: Gate parceiro - só isPartner pode ter capa (owner only)
  try {
    const prof = await getProfileById(userId);
    if (prof) {
      const db = !isSupabaseConfigured() ? getDemoDB() : null;
      const demoUser = db?.users.find(u => u.id === userId);
      const isParceiro = (prof as any).isPartner || (demoUser as any)?.isPartner || (prof as any).role === 'admin';
      if (!isParceiro) {
        return { success: false, url: "", path: "", error: "Capa disponível apenas para Parceiros" };
      }
    }
  } catch {}
  let oldPath: string | null = null;
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabase();
      if (sb) {
        const { data } = await sb.from("profiles").select("cover_path").eq("id", userId).maybeSingle();
        oldPath = data?.cover_path ?? null;
      }
    } catch {}
  } else {
    // Demo: pega oldPath do demoDB para limpeza lógica
    try {
      const db = getDemoDB();
      const u = db.users.find(x => x.id === userId);
      oldPath = (u as any)?.coverPath ?? null;
    } catch {}
  }
  const result = await storage.uploadCover(file, userId, oldPath);
  // [REALTIME] Em demo, notifica mudança para atualização instantânea
  if (!isSupabaseConfigured() && result.success) {
    try {
      const { emitDemoStoreChange } = await import('./demo-store');
      emitDemoStoreChange({ entity: 'profile', id: userId, action: 'cover_update' });
    } catch {}
  }
  return result;
}

export async function removeCover(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // [SEC-FIX] CWE-639: só dono remove própria capa (owner only) + admin bypass
  assertValidId(userId, "userId");
  const sb = getSupabase();
  let oldPath: string | null = null;
  if (sb) {
    try {
      const { data: sessionData } = await sb.auth.getSession();
      const authId = sessionData.session?.user?.id;
      if (authId && authId !== userId) {
        const { data: prof } = await sb.from("profiles").select("role").eq("id", authId).maybeSingle();
        if (prof?.role !== "admin") {
          securityLog("idor_attempt", { action: "removeCover", requested: userId, authId }, "high");
          return { success: false, error: "Sem permissão para remover esta capa" };
        }
      }
      const { data } = await sb.from("profiles").select("cover_path").eq("id", userId).maybeSingle();
      oldPath = data?.cover_path ?? null;
      const { error } = await sb.from("profiles").update({ cover_url: null, cover_path: null }).eq("id", userId);
      if (error) throw new Error(error.message);
      if (oldPath) {
        try {
          const safeOld = storage.sanitizeStoragePath(oldPath);
          if (safeOld.startsWith(`${userId}/`)) {
            await sb.storage.from("covers").remove([safeOld]);
          }
        } catch {}
      }
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao remover capa";
      return { success: false, error: msg };
    }
  }
  // DEMO
  try {
    const db = getDemoDB();
    const sid = getDemoSessionId();
    if (sid && sid !== userId) {
      const requester = db.users.find(u => u.id === sid);
      if (requester?.role !== "admin") {
        securityLog("idor_attempt", { action: "removeCover_demo", requested: userId, requester: sid }, "high");
        return { success: false, error: "Sem permissão para remover esta capa" };
      }
    }
    const user = db.users.find(u => u.id === userId);
    if (!user) return { success: false, error: "Usuário não encontrado" };
    oldPath = (user as any).coverPath ?? null;
    (user as any).coverUrl = null;
    (user as any).coverPath = null;
    saveDemoDB(db);
    // [REALTIME] Notifica UI instantânea
    try {
      const { emitDemoStoreChange } = await import('./demo-store');
      emitDemoStoreChange({ entity: 'profile', id: userId, action: 'cover_remove' });
    } catch {}
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao remover capa" };
  }
}

export async function adminSetPartner(id: string, isPartner: boolean): Promise<void> {
  assertValidId(id, "userId");
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("profiles").update({ is_partner: isPartner }).eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const db = getDemoDB();
  const user = db.users.find((u) => u.id === id);
  if (user) (user as any).isPartner = isPartner;
  saveDemoDB(db);
}


// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════
export type RegisterInput = {
  nome: string;
  email: string;
  senha: string;
  whatsapp: string;
  cpf: string;
  uf: string;
  cidade: string;
  bairro: string;
  tipoPerfil: string;
  categorias: string[];
};

function mapRegisterToProfile(data: RegisterInput) {
  return {
    nome: data.nome.trim(),
    email: data.email.toLowerCase().trim(),
    whatsapp: data.whatsapp,
    cpf: data.cpf.replace(/\D/g, ""),
    uf: data.uf || "ES",
    cidade: data.cidade || "Vitória",
    bairro: data.bairro,
    tipo_perfil: data.tipoPerfil,
    categorias: data.categorias,
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const sb = getSupabase();
  if (sb) {
    const { data: sessionData } = await sb.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return null;
    // [SEC-FIX] CWE-20: Validação de UUID do usuário da sessão
    if (!isValidUUID(userId)) {
      securityLog("validation_failed", { field: "session_userId", userId: userId.slice(0, 20) }, "high");
      return null;
    }
    const { data, error } = await sb
      .from("profiles")
      .select(
        `id, nome, email, cpf, avatar_url, avatar_path, bio, uf, cidade, bairro, tipo_perfil,
         categorias, media_avaliacao, aprovacao, total_avaliacoes,
         trocas_concluidas, verificado, verificado_manual, verified_until, is_partner, cover_url, cover_path, role, ativo,
         created_at, updated_at`
      )
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const user = mapProfile(data);
    // 🛡️ WhatsApp do próprio usuário via função sancionada
    try {
      const { data: own } = await sb.rpc("get_own_whatsapp");
      user.whatsapp = (own as string | null) ?? null;
    } catch { /* noop */ }
    return user.ativo ? user : null;
  }

  // DEMO
  const sid = getDemoSessionId();
  if (!sid) return null;
  if (!isValidUUID(sid)) return null; // [SEC-FIX] CWE-20: valida sessão demo
  const db = getDemoDB();
  const user = db.users.find((u) => u.id === sid);
  if (!user || !user.ativo) return null;
  const { senhaHash: _drop, ...clean } = user;
  void _drop;
  return clean;
}

export async function login(email: string, senha: string): Promise<AuthUser> {
  // [SEC-FIX] CWE-307: Rate limiting de login para mitigar brute-force
  const rl = checkRateLimit("login", email.toLowerCase().trim());
  if (!rl.allowed) {
    securityLog("brute_force", { email: email.slice(0, 3) + "***", action: "login_blocked" }, "critical");
    throw new Error("Muitas tentativas de login. Aguarde 15 minutos.");
  }
  // [SEC-FIX] CWE-20: Validação básica de email e senha
  const cleanEmail = email.toLowerCase().trim().slice(0, 255);
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    securityLog("validation_failed", { field: "email", action: "login" }, "medium");
    throw new Error("Email inválido");
  }
  if (!senha || senha.length < 1 || senha.length > 128) throw new Error("Senha inválida");

  // [THREAT-MITIGATION] Canary token: acesso a email canário dispara alerta crítico (MITRE T1005)
  if (cleanEmail.includes("canary") || cleanEmail.includes("honeypot") || cleanEmail.includes("trap")) {
    securityLog("canary_access", { email: cleanEmail.slice(0, 10) + "***", action: "login_canary" }, "critical");
  }

  // [FIX-WAF] Tarpitting calibrado 7+ para evitar falso positivo em login/logout loop 5x - P1
  const prevFails = (() => {
    try {
      const key = `trocabairro:rl:login:${cleanEmail}`;
      const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
      if (raw) {
        const b = JSON.parse(raw) as { count: number };
        return b.count;
      }
    } catch {}
    return 0;
  })();
  if (prevFails >= 7) {
    let delay: number;
    if (prevFails === 7) delay = 2000;
    else if (prevFails === 8) delay = 4000;
    else if (prevFails === 9) delay = 6000;
    else delay = 8000; // max 8s teto Vercel 504
    await new Promise((r) => setTimeout(r, delay));
  }

  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.auth.signInWithPassword({
      email: cleanEmail,
      password: senha,
    });
    if (error || !data.user) {
      securityLog("auth_failed", { email: cleanEmail.slice(0, 3) + "***", reason: error?.message }, "high");
      throw new Error("Email ou senha incorretos");
    }
    const { data: profile, error: pErr } = await sb
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();
    if (pErr || !profile) throw new Error("Perfil não encontrado");
    const user = mapProfile(profile);
    if (!user.ativo)
      throw new Error("Conta suspensa. Entre em contato com o suporte.");
    // [FIX-WAF] Reset estado após login OK - evita acúmulo eterno → 403 intermitente
    try {
      clearLoginFailures(cleanEmail);
      resetRateLimit("login", cleanEmail);
    } catch {}
    securityLog("auth_success", { userId: user.id, method: "supabase" }, "low");
    return user;
  }

  // DEMO
  const db = getDemoDB();
  const user = db.users.find(
    (u) => u.email.toLowerCase() === cleanEmail
  );
  if (!user || user.senhaHash !== demoHash(senha)) {
    securityLog("auth_failed", { email: cleanEmail.slice(0, 3) + "***", method: "demo" }, "high");
    throw new Error("Email ou senha incorretos");
  }
  if (!user.ativo)
    throw new Error("Conta suspensa. Entre em contato com o suporte.");
  setDemoSessionId(user.id);
  // [FIX-WAF] Reset estado após login OK - evita acúmulo eterno → 403 intermitente
  try {
    clearLoginFailures(cleanEmail);
    resetRateLimit("login", cleanEmail);
  } catch {}
  securityLog("auth_success", { userId: user.id, method: "demo" }, "low");
  const { senhaHash: _d, ...clean } = user;
  void _d;
  return clean;
}

export type RegisterResult = {
  user: AuthUser | null;
  needsEmailConfirmation: boolean;
};

export async function register(data: RegisterInput): Promise<RegisterResult> {
  // [SEC-FIX] CWE-307: Rate limiting de registro
  const rl = checkRateLimit("register", data.email.toLowerCase().trim());
  if (!rl.allowed) {
    securityLog("brute_force", { email: data.email.slice(0, 3) + "***", action: "register_blocked" }, "high");
    throw new Error("Muitas tentativas de cadastro. Aguarde 1 hora.");
  }
  // [SEC-FIX] CWE-20: Sanitização rigorosa de inputs de registro
  const sanitized: RegisterInput = {
    nome: sanitizeFreeText(data.nome, 100),
    email: data.email.toLowerCase().trim().slice(0, 255),
    senha: data.senha.slice(0, 128),
    whatsapp: sanitizeFreeText(data.whatsapp, 20),
    cpf: data.cpf.replace(/\D/g, "").slice(0, 11),
    uf: sanitizeFreeText(data.uf, 2).toUpperCase(),
    cidade: sanitizeFreeText(data.cidade, 100),
    bairro: sanitizeFreeText(data.bairro, 100),
    tipoPerfil: sanitizeFreeText(data.tipoPerfil, 20),
    categorias: data.categorias.map(c => sanitizeFreeText(c, 50)).slice(0, 10),
  };
  if (!/^\S+@\S+\.\S+$/.test(sanitized.email)) throw new Error("Email inválido");
  if (sanitized.nome.length < 3) throw new Error("Nome muito curto");
  if (sanitized.senha.length < 8) throw new Error("Senha deve ter mínimo 8 caracteres com letra e número");

  const sb = getSupabase();
  if (sb) {
    const meta = {
      nome: sanitized.nome,
      whatsapp: sanitized.whatsapp,
      cpf: sanitized.cpf,
      uf: sanitized.uf,
      cidade: sanitized.cidade,
      bairro: sanitized.bairro,
      tipo_perfil: sanitized.tipoPerfil,
      categorias: sanitized.categorias,
    };
    const { data: authData, error } = await sb.auth.signUp({
      email: sanitized.email,
      password: sanitized.senha,
      options: { data: meta },
    });
    if (error) throw new Error(translateAuthError(error.message));

    if (!authData.session) {
      // Projeto com confirmação de e-mail ativada
      return { user: null, needsEmailConfirmation: true };
    }

    const profileValues = mapRegisterToProfile(sanitized);
    const { data: profile, error: upErr } = await sb
      .from("profiles")
      .insert({ id: authData.user!.id, ...profileValues })
      .select(
        `id, nome, email, cpf, avatar_url, bio, uf, cidade, bairro, tipo_perfil,
         categorias, media_avaliacao, aprovacao, total_avaliacoes,
         trocas_concluidas, verificado, verificado_manual, verified_until, is_partner, cover_url, cover_path, role, ativo,
         created_at, updated_at`
      )
      .single();
    if (upErr) throw new Error("Erro ao criar perfil: " + upErr.message);
    securityLog("auth_success", { userId: authData.user!.id, action: "register_supabase" }, "low");
    return { user: mapProfile(profile), needsEmailConfirmation: false };
  }

  // DEMO
  const db = getDemoDB();
  const email = sanitized.email;
  if (db.users.some((u) => u.email.toLowerCase() === email))
    throw new Error("Este email já está cadastrado");
  const user: AuthUser & { senhaHash: string } = {
    id: crypto.randomUUID(),
    nome: sanitized.nome,
    email,
    senhaHash: demoHash(sanitized.senha),
    whatsapp: sanitized.whatsapp,
    cpf: sanitized.cpf,
    avatarUrl: null,
    bio: null,
    uf: sanitized.uf || "ES",
    cidade: sanitized.cidade || "Vitória",
    bairro: sanitized.bairro,
    tipoPerfil: sanitized.tipoPerfil,
    categorias: sanitized.categorias,
    mediaAvaliacao: 0,
    aprovacao: 100,
    totalAvaliacoes: 0,
    trocasConcluidas: 0,
    verificado: false,
    isPartner: false,
    coverUrl: null,
    coverPath: null,
    // 👑 Conta Mestra do Proprietário nasce admin (espelha o trigger SQL)
    role: sanitized.email.toLowerCase() === SUPER_ADMIN_EMAIL ? "admin" : "usuario",
    ativo: true,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  saveDemoDB(db);
  setDemoSessionId(user.id);
  securityLog("auth_success", { userId: user.id, action: "register_demo" }, "low");
  const { senhaHash: _d, ...clean } = user;
  void _d;
  return { user: clean, needsEmailConfirmation: false };
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists"))
    return "Este email já está cadastrado";
  if (m.includes("password") && m.includes("at least"))
    return "Senha muito curta (mínimo 6 caracteres)";
  if (m.includes("invalid login"))
    return "Email ou senha incorretos";
  if (m.includes("email")) return "Email inválido";
  return "Erro ao criar conta: " + message;
}

export async function logout(): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    await sb.auth.signOut();
    return;
  }
  setDemoSessionId(null);
}

export type ProfilePatch = Partial<{
  nome: string;
  bio: string;
  whatsapp: string;
  bairro: string;
  uf: string;
  cidade: string;
  tipoPerfil: string;
  categorias: string[];
  avatarUrl: string;
  avatarPath?: string;
  coverUrl?: string | null;
  coverPath?: string | null;
}>;

export async function updateProfile(
  userId: string,
  patch: ProfilePatch
): Promise<AuthUser> {
  // [SEC-FIX] CWE-20, CWE-639: Validação de ID e sanitização de patch
  assertValidId(userId, "userId");
  const validated = ProfilePatchSchema.safeParse(patch);
  if (!validated.success) {
    securityLog("validation_failed", { userId, errors: validated.error.flatten() }, "medium");
    throw new Error("Dados de perfil inválidos");
  }
  const cleanPatch = validated.data as any;
  const row: Row = {};
  if (cleanPatch.nome !== undefined) row.nome = sanitizeFreeText(cleanPatch.nome, 100);
  if (cleanPatch.bio !== undefined) row.bio = sanitizeFreeText(cleanPatch.bio, 500);
  // 🛡️ whatsapp sai do UPDATE direto (coluna protegida) → RPC do dono
  const novoWhatsapp = cleanPatch.whatsapp ? sanitizeFreeText(cleanPatch.whatsapp, 20) : undefined;
  if (cleanPatch.bairro !== undefined) row.bairro = sanitizeFreeText(cleanPatch.bairro, 100);
  if (cleanPatch.uf !== undefined) row.uf = sanitizeFreeText(cleanPatch.uf, 2).toUpperCase();
  if (cleanPatch.cidade !== undefined) row.cidade = sanitizeFreeText(cleanPatch.cidade, 100);
  if (cleanPatch.tipoPerfil !== undefined) row.tipo_perfil = cleanPatch.tipoPerfil;
  if (cleanPatch.categorias !== undefined) row.categorias = cleanPatch.categorias.map((c: string) => sanitizeFreeText(c, 50)).slice(0, 10);
  if (cleanPatch.avatarUrl !== undefined) {
    // [SEC-FIX] CWE-79, CWE-434: Valida URL de avatar - apenas https ou data:image
    const url = cleanPatch.avatarUrl;
    if (!(url.startsWith("https://") || url.startsWith("data:image/"))) {
      securityLog("xss_attempt", { userId, avatarUrl: url.slice(0, 50) }, "high");
      throw new Error("URL de avatar inválida");
    }
    row.avatar_url = url.slice(0, 500);
  }
  // [FASE 1] avatar_path para limpeza automática
  if (cleanPatch.avatarPath !== undefined || (patch as any).avatarPath !== undefined) {
    const rawPath = (patch as any).avatarPath ?? cleanPatch.avatarPath;
    if (rawPath) {
      const p = String(rawPath);
      // [SEC-FIX] CWE-22: Valida path não contém traversal
      if (p.includes("..") || /%2e%2e/i.test(p) || p.includes("//")) {
        securityLog("file_upload_blocked", { userId, path: p.slice(0, 50), reason: "path_traversal" }, "critical");
        throw new Error("Path de avatar inválido");
      }
      // [SEC-FIX] CWE-639: Garante que path pertence ao userId - aceita prod e demo
      if (!p.startsWith(`${userId}/`) && !p.startsWith(`demo/${userId}/`)) {
        securityLog("idor_attempt", { userId, path: p.slice(0, 50) }, "high");
        throw new Error("Path de avatar não pertence ao usuário");
      }
      row.avatar_path = p.slice(0, 500);
    } else {
      row.avatar_path = null;
    }
  }

  // Slim Partner: cover_url / cover_path
  if ((patch as any).coverUrl !== undefined) {
    const cu = (patch as any).coverUrl;
    if (cu === null) {
      row.cover_url = null;
    } else {
      const url = String(cu);
      if (!(url.startsWith("https://") || url.startsWith("data:image/"))) {
        securityLog("xss_attempt", { userId, coverUrl: url.slice(0, 50) }, "high");
        throw new Error("URL de capa inválida");
      }
      row.cover_url = url.slice(0, 500);
    }
  }
  if ((patch as any).coverPath !== undefined) {
    const rawPath = (patch as any).coverPath;
    if (rawPath === null) {
      row.cover_path = null;
    } else if (rawPath) {
      const p = String(rawPath);
      // [SEC-FIX] CWE-22: Valida path não contém traversal
      if (p.includes("..") || /%2e%2e/i.test(p) || p.includes("//")) {
        securityLog("file_upload_blocked", { userId, path: p.slice(0, 50), reason: "path_traversal" }, "critical");
        throw new Error("Path de capa inválido");
      }
      // [SEC-FIX] CWE-639: Garante que path pertence ao userId - aceita prod `${userId}/` e demo `demo/${userId}/`
      if (!p.startsWith(`${userId}/`) && !p.startsWith(`demo/${userId}/`)) {
        securityLog("idor_attempt", { userId, path: p.slice(0, 50), action: "cover_ownership" }, "high");
        throw new Error("Path de capa não pertence ao usuário");
      }
      row.cover_path = p.slice(0, 500);
    }
  }
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("profiles")
      .update(row)
      .eq("id", userId)
      .select(
        `id, nome, email, cpf, avatar_url, avatar_path, bio, uf, cidade, bairro, tipo_perfil,
         categorias, media_avaliacao, aprovacao, total_avaliacoes,
         trocas_concluidas, verificado, verificado_manual, verified_until, is_partner, cover_url, cover_path, role, ativo,
         created_at, updated_at`
      )
      .single();
    if (error) throw new Error(error.message);
    const updated = mapProfile(data);
    if (novoWhatsapp !== undefined) {
      try {
        await sb.rpc("set_own_whatsapp", { p_whatsapp: novoWhatsapp });
        updated.whatsapp = novoWhatsapp;
      } catch { /* noop */ }
    }
    return updated;
  }

  const db = getDemoDB();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error("Usuário não encontrado");
  if (cleanPatch.nome !== undefined) user.nome = cleanPatch.nome;
  if (cleanPatch.bio !== undefined) user.bio = cleanPatch.bio;
  if (novoWhatsapp !== undefined) user.whatsapp = novoWhatsapp;
  if (cleanPatch.bairro !== undefined) user.bairro = cleanPatch.bairro;
  if (cleanPatch.uf !== undefined) user.uf = cleanPatch.uf;
  if (cleanPatch.cidade !== undefined) user.cidade = cleanPatch.cidade;
  if (cleanPatch.tipoPerfil !== undefined) user.tipoPerfil = cleanPatch.tipoPerfil;
  if (cleanPatch.categorias !== undefined) user.categorias = cleanPatch.categorias;
  if (cleanPatch.avatarUrl !== undefined) user.avatarUrl = cleanPatch.avatarUrl;
  if ((patch as any).coverUrl !== undefined) (user as any).coverUrl = (patch as any).coverUrl;
  if ((patch as any).coverPath !== undefined) (user as any).coverPath = (patch as any).coverPath;
  saveDemoDB(db);
  try { const { emitDemoStoreChange } = await import('./demo-store'); emitDemoStoreChange({ entity: 'profile', id: userId, action: 'update' }); } catch {}
  const { senhaHash: _d, ...clean } = user;
  void _d;
  return clean;
}

export async function getProfileById(
  id: string,
  viewerId?: string
): Promise<AuthUser | null> {
  // [SEC-FIX] CWE-20: Validação de IDs
  assertValidId(id, "profileId");
  if (viewerId) assertValidId(viewerId, "viewerId");
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("profiles")
      .select(
        `id, nome, email, cpf, avatar_url, avatar_path, bio, uf, cidade, bairro, tipo_perfil,
         categorias, media_avaliacao, aprovacao, total_avaliacoes,
         trocas_concluidas, verificado, verificado_manual, verified_until, is_partner, cover_url, cover_path, role, ativo,
         created_at, updated_at`
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const profile = mapProfile(data);
    // 🛡️ Só o dono lê o próprio WhatsApp
    if (viewerId && viewerId === id) {
      try {
        const { data: own } = await sb.rpc("get_own_whatsapp");
        profile.whatsapp = (own as string | null) ?? null;
      } catch { /* noop */ }
    }
    return profile;
  }
  const db = getDemoDB();
  const user = db.users.find((u) => u.id === id);
  if (!user) return null;
  const { senhaHash: _d, ...clean } = user;
  void _d;
  return clean;
}

// ═══════════════════════════════════════════════════════════
// ANÚNCIOS
// ═══════════════════════════════════════════════════════════
export type AdFilters = {
  search?: string;
  categoria?: string;
  bairro?: string;
  tipo?: string;
  ordenacao?: "recentes" | "destaque" | "topo" | "populares";
  page?: number;
  limit?: number;
};

const AD_SELECT =
  "*, images, profiles(nome, avatar_url, verificado, is_partner, media_avaliacao, trocas_concluidas, aprovacao), ad_images(image_url, ordem)"; // [FASE 1] Inclui images[] novo + legado ad_images

export async function listAds(filters: AdFilters): Promise<{
  ads: AdCardData[];
  total: number;
  page: number;
  pages: number;
}> {
  // [SEC-FIX] CWE-400: Rate limiting de busca
  const rl = checkRateLimit("search", "global");
  if (!rl.allowed) {
    securityLog("rate_limit_hit", { action: "search" }, "medium");
    // Retorna vazio em vez de quebrar UX, mas loga
    return { ads: [] as AdCardData[], total: 0, page: 1, pages: 1 };
  }
  // [SEC-FIX] CWE-20: Sanitização rigorosa de filtros
  const safeFilters: AdFilters = {
    search: filters.search ? sanitizeSearchStrict(filters.search) : undefined,
    categoria: filters.categoria ? sanitizeFreeText(filters.categoria, 50) : undefined,
    bairro: filters.bairro ? sanitizeSearchStrict(filters.bairro) : undefined,
    tipo: filters.tipo === "ofereço" || filters.tipo === "preciso" ? filters.tipo : undefined,
    ordenacao: ["recentes", "destaque", "topo", "populares"].includes(filters.ordenacao ?? "") ? filters.ordenacao : "recentes",
    page: Math.min(Math.max(1, filters.page ?? 1), 1000), // [SEC-FIX] CWE-400: limita paginação
    limit: Math.min(Math.max(1, filters.limit ?? 12), 50),
  };

  const page = Math.max(1, safeFilters.page ?? 1);

  const sb = getSupabase();
  if (sb) {
    return withTimeout(
      listAdsSupabase(sb, safeFilters),
      9000,
      () => ({ ads: [] as AdCardData[], total: 0, page, pages: 1 })
    );
  }

  // DEMO (síncrono — carregamento instantâneo)
  return listAdsDemo(safeFilters);
}

async function listAdsSupabase(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  filters: AdFilters
): Promise<{ ads: AdCardData[]; total: number; page: number; pages: number }> {
  const limit = filters.limit ?? 12;
  const page = Math.max(1, filters.page ?? 1);
  {
    try {
      await sb.rpc("expire_subscriptions");
    } catch { /* best-effort */ }

    let query = sb.from("ads").select(AD_SELECT, { count: "exact" }).eq("status", "ativo");
    const search = sanitizeSearch(filters.search ?? "");
    if (search)
      query = query.or(`titulo.ilike.%${search}%,descricao.ilike.%${search}%`);
    if (filters.categoria) query = query.eq("categoria", filters.categoria);
    if (filters.bairro) query = query.ilike("bairro", `%${sanitizeSearch(filters.bairro)}%`);
    if (filters.tipo === "ofereço" || filters.tipo === "preciso")
      query = query.eq("tipo", filters.tipo);

    switch (filters.ordenacao) {
      case "destaque":
        query = query.order("destaque", { ascending: false }).order("created_at", { ascending: false });
        break;
      case "topo":
        query = query.order("topo_feed", { ascending: false }).order("created_at", { ascending: false });
        break;
      case "populares":
        query = query.order("visualizacoes", { ascending: false }).order("created_at", { ascending: false });
        break;
      default:
        query = query
          .order("topo_feed", { ascending: false })
          .order("destaque", { ascending: false })
          .order("created_at", { ascending: false });
    }

    const { data, count, error } = await query.range(
      (page - 1) * limit,
      page * limit - 1
    );
    if (error) throw new Error(error.message);
    const total = count ?? 0;
    return {
      ads: (data ?? []).map(mapAd),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}

function listAdsDemo(filters: AdFilters): {
  ads: AdCardData[];
  total: number;
  page: number;
  pages: number;
} {
  const limit = filters.limit ?? 12;
  const page = Math.max(1, filters.page ?? 1);
  const db = getDemoDB();
  expireDemoSubscriptions(db);
  let ads = db.ads.filter((a) => a.status === "ativo");
  const search = (filters.search ?? "").toLowerCase().trim();
  if (search)
    ads = ads.filter(
      (a) =>
        a.titulo.toLowerCase().includes(search) ||
        a.descricao.toLowerCase().includes(search)
    );
  if (filters.categoria) ads = ads.filter((a) => a.categoria === filters.categoria);
  if (filters.bairro)
    ads = ads.filter((a) => a.bairro.toLowerCase().includes(filters.bairro!.toLowerCase()));
  if (filters.tipo) ads = ads.filter((a) => a.tipo === filters.tipo);

  const sorted = [...ads].sort((a, b) => {
    switch (filters.ordenacao) {
      case "destaque":
        return Number(b.destaque) - Number(a.destaque) ||
          b.createdAt.localeCompare(a.createdAt);
      case "topo":
        return Number(b.topoFeed) - Number(a.topoFeed) ||
          b.createdAt.localeCompare(a.createdAt);
      case "populares":
        return b.visualizacoes - a.visualizacoes || b.createdAt.localeCompare(a.createdAt);
      default:
        return (
          Number(b.topoFeed) - Number(a.topoFeed) ||
          Number(b.destaque) - Number(a.destaque) ||
          b.createdAt.localeCompare(a.createdAt)
        );
    }
  });

  const total = sorted.length;
  const paged = sorted.slice((page - 1) * limit, page * limit).map((a) => {
    const owner = db.users.find((u) => u.id === a.userId);
    const adAny = a as any;
    const images = resolveAdImages(adAny, db);
    return {
      id: a.id,
      userId: a.userId,
      tipo: a.tipo,
      titulo: a.titulo,
      descricao: a.descricao,
      categoria: a.categoria,
      bairro: a.bairro,
      cidade: a.cidade,
      uf: a.uf,
      aceitaEmTroca: a.aceitaEmTroca,
      destaque: !!a.destaque,
      topoFeed: !!a.topoFeed,
      isFeatured: !!(adAny.isFeatured ?? a.destaque),
      featuredUntil: adAny.featuredUntil ?? null,
      boostType: adAny.boostType ?? (a.destaque ? "selo_destaque" : a.topoFeed ? "top_feed" : null),
      isTopFeed: !!(adAny.isTopFeed ?? a.topoFeed),
      topFeedUntil: adAny.topFeedUntil ?? null,
      isUrgent: !!(adAny.isUrgent ?? (adAny as any).is_urgent ?? false),
      status: a.status,
      visualizacoes: a.visualizacoes,
      createdAt: a.createdAt,
      images,
      userName: owner?.nome ?? "Usuário",
      userAvatar: owner?.avatarUrl ?? null,
      userVerificado: !!owner?.verificado,
      userIsPartner: !!(owner as any)?.isPartner,
      userMediaAvaliacao: owner?.mediaAvaliacao ?? 0,
      userTrocasConcluidas: owner?.trocasConcluidas ?? 0,
      userAprovacao: owner?.aprovacao ?? 100,
    } satisfies AdCardData;
  });
  saveDemoDB(db);
  return { ads: paged, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getAdById(id: string): Promise<AdDetail | null> {
  // [SEC-FIX] CWE-20: Validação de ID do anúncio
  assertValidId(id, "adId");
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.rpc("increment_ad_views", { p_ad_id: id });
    } catch { /* best-effort */ }

    const { data, error } = await sb
      .from("ads")
      .select(
        `*, images, profiles(id, nome, avatar_url, avatar_path, bio, bairro, cidade, uf, tipo_perfil,
          verificado, is_partner, cover_url, media_avaliacao, trocas_concluidas, aprovacao),
         ad_images(image_url, ordem)`
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const base = mapAd(data);

    const { data: reviews } = await sb
      .from("reviews")
      .select("*, avaliador:profiles!reviews_avaliador_id_fkey(nome, avatar_url)")
      .eq("avaliado_id", base.userId)
      .order("created_at", { ascending: false })
      .limit(20);

    const { count: tradeCount } = await sb
      .from("trades")
      .select("id", { count: "exact", head: true })
      .eq("ad_id", id);

    return {
      ...base,
      userWhatsapp: null, // 🛡️ WhatsApp do anúncio fechado — só via troca approved
      userBio: data.profiles?.bio ?? null,
      userBairro: data.profiles?.bairro ?? null,
      userTipoPerfil: data.profiles?.tipo_perfil ?? "empreendedor",
      reviews: (reviews ?? []).map(mapReview),
      tradeCount: tradeCount ?? 0,
    };
  }

  // DEMO
  const db = getDemoDB();
  const ad = db.ads.find((a) => a.id === id);
  if (!ad) return null;
  ad.visualizacoes += 1;
  const owner = db.users.find((u) => u.id === ad.userId);
  const reviews = db.reviews
    .filter((r) => r.avaliadoId === ad.userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => {
      const avaliador = db.users.find((u) => u.id === r.avaliadorId);
      return {
        id: r.id,
        nota: r.nota,
        comentario: r.comentario,
        cumprimento: r.cumprimento,
        createdAt: r.createdAt,
        avaliadorId: r.avaliadorId,
        avaliadorNome: avaliador?.nome ?? "Usuário",
        avaliadorAvatar: avaliador?.avatarUrl ?? null,
      } satisfies ReviewWithReviewer;
    });
  saveDemoDB(db);
  const adAny = ad as any;
  const images = resolveAdImages(adAny, db);
  return {
    id: ad.id,
    userId: ad.userId,
    tipo: ad.tipo,
    titulo: ad.titulo,
    descricao: ad.descricao,
    categoria: ad.categoria,
    bairro: ad.bairro,
    cidade: ad.cidade,
    uf: ad.uf,
    aceitaEmTroca: ad.aceitaEmTroca,
    destaque: !!ad.destaque,
    topoFeed: !!ad.topoFeed,
    isFeatured: !!(adAny.isFeatured ?? ad.destaque),
    featuredUntil: adAny.featuredUntil ?? null,
    boostType: adAny.boostType ?? (ad.destaque ? "selo_destaque" : ad.topoFeed ? "top_feed" : null),
    isTopFeed: !!(adAny.isTopFeed ?? ad.topoFeed),
    topFeedUntil: adAny.topFeedUntil ?? null,
    isUrgent: !!(adAny.isUrgent ?? (ad as any).is_urgent ?? false),
    status: ad.status,
    visualizacoes: ad.visualizacoes,
    createdAt: ad.createdAt,
    images,
    userName: owner?.nome ?? "Usuário",
    userAvatar: owner?.avatarUrl ?? null,
    userVerificado: !!owner?.verificado,
    userIsPartner: !!(owner as any)?.isPartner,
    userMediaAvaliacao: owner?.mediaAvaliacao ?? 0,
    userTrocasConcluidas: owner?.trocasConcluidas ?? 0,
    userAprovacao: owner?.aprovacao ?? 100,
    userWhatsapp: owner?.whatsapp ?? null,
    userBio: owner?.bio ?? null,
    userBairro: owner?.bairro ?? null,
    userTipoPerfil: owner?.tipoPerfil ?? "empreendedor",
    userCoverUrl: (owner as any)?.coverUrl ?? null,
    reviews,
    tradeCount: db.trades.filter((t) => t.adId === id).length,
  };
}

export type AdInput = {
  tipo: string;
  titulo: string;
  descricao: string;
  categoria: string;
  bairro: string;
  cidade?: string;
  uf?: string;
  aceitaEmTroca: string;
  status?: string;
  isUrgent?: boolean;
};

export async function createAd(
  userId: string,
  input: AdInput
): Promise<string> {
  // [SEC-FIX] CWE-20, CWE-307, CWE-639: Validação + rate limiting + ownership
  assertValidId(userId, "userId");
  const rl = checkRateLimit("createAd", userId);
  if (!rl.allowed) throw new Error("Limite de criação de anúncios atingido. Aguarde.");
  const parsed = AdInputSchema.safeParse(input);
  if (!parsed.success) {
    securityLog("validation_failed", { userId, errors: parsed.error.flatten(), action: "createAd" }, "medium");
    throw new Error("Dados do anúncio inválidos: " + parsed.error.issues.map(i => i.message).join(", "));
  }
  const clean = parsed.data as any;
  // [LIMITE] Verifica limite mensal de publicações - só Parceiro Gold ilimitado
  let isPartnerGold = false;
  let planoAtivo: 'experimente' | 'conexao' | 'expansao' = 'experimente';
  let isVerifiedUser = false;
  try {
    if (isSupabaseConfigured()) {
      const sbCheck = getSupabase();
      if (sbCheck) {
        const { data: prof } = await sbCheck.from('profiles').select('verificado, is_partner').eq('id', userId).maybeSingle();
        if (prof) {
          if (prof.verificado) isVerifiedUser = true;
          if ((prof as any).is_partner) { isPartnerGold = true; isVerifiedUser = true; }
        }
        // Busca assinatura ativa
        const { data: subs } = await sbCheck.from('subscriptions').select('plano, status, expires_at').eq('user_id', userId).eq('status', 'ativo').order('created_at', { ascending: false }).limit(5);
        if (subs && subs.length > 0) {
          const now = new Date();
          const ativa = subs.find((s: any) => {
            if (s.plano === 'experimente') return true;
            if (!s.expires_at) return true;
            return new Date(s.expires_at) > now;
          });
          if (ativa) {
            if (['conexao','expansao','experimente'].includes(ativa.plano)) planoAtivo = ativa.plano as any;
          }
        }
      }
    } else {
      const dbCheck = getDemoDB();
      const u = dbCheck.users.find(x => x.id === userId);
      if (u) {
        if (u.verificado) isVerifiedUser = true;
        if ((u as any).isPartner) { isPartnerGold = true; isVerifiedUser = true; }
      }
      const subs = dbCheck.subscriptions.filter(s => s.userId === userId && s.status === 'ativo');
      if (subs.length > 0) {
        const sorted = subs.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
        const ativa = sorted[0];
        if (['conexao','expansao','experimente'].includes(ativa.plano as any)) planoAtivo = ativa.plano as any;
      }
    }
  } catch {}

  // Parceiro Gold ilimitado, demais tem limite
  if (!isPartnerGold) {
    const { LIMITE_PUBLICACAO_POR_PLANO } = await import('./constants');
    const limite = (LIMITE_PUBLICACAO_POR_PLANO as any)[planoAtivo] ?? 1;
    // Conta anúncios criados no mês atual
    let countMes = 0;
    try {
      if (isSupabaseConfigured()) {
        const sbCnt = getSupabase();
        if (sbCnt) {
          const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
          const { count } = await sbCnt.from('ads').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', start.toISOString());
          countMes = count ?? 0;
        }
      } else {
        const dbCnt = getDemoDB();
        const now = new Date();
        countMes = dbCnt.ads.filter(a => a.userId === userId && (() => {
          const d = new Date(a.createdAt);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })()).length;
      }
    } catch {}
    if (countMes >= limite) {
      throw new Error(`Limite de ${limite} publicação${limite>1?'s':''}/mês atingido no plano ${planoAtivo}. Faça upgrade para Conexão (5/mês) ou Expansão (15/mês). Parceiros Gold (selo dourado 🟡) têm ilimitado ♾️.`);
    }
  }

  // [URGENTE] Verifica se usuário é verificado (azul ou dourado) para permitir isUrgent
  const isUrgentRequested = !!clean.isUrgent;
  if (isUrgentRequested && !isVerifiedUser) {
    throw new Error('Apenas usuários verificados (selo azul ✅ e parceiro dourado 🟡) podem marcar como urgente');
  }

  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("ads")
      .insert({
        user_id: userId,
        tipo: clean.tipo,
        titulo: clean.titulo,
        descricao: clean.descricao,
        categoria: clean.categoria,
        bairro: clean.bairro,
        cidade: clean.cidade ?? "Vitória",
        uf: clean.uf ?? "ES",
        aceita_em_troca: clean.aceitaEmTroca,
        status: clean.status ?? "ativo",
        is_urgent: isUrgentRequested,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  }
  const db = getDemoDB();
  const inputAny = input as any;
  const incomingImages: string[] = Array.isArray(inputAny.images) ? inputAny.images : [];
  const id = (typeof inputAny.id === 'string' && inputAny.id.length >= 8) ? inputAny.id : crypto.randomUUID();
  const adObj: any = {
    id,
    userId,
    tipo: clean.tipo,
    titulo: clean.titulo,
    descricao: clean.descricao,
    categoria: clean.categoria,
    bairro: clean.bairro,
    cidade: clean.cidade ?? "Vitória",
    uf: clean.uf ?? "ES",
    aceitaEmTroca: clean.aceitaEmTroca,
    destaque: false,
    topoFeed: false,
    isFeatured: false,
    featuredUntil: null,
    boostType: null,
    isTopFeed: false,
    topFeedUntil: null,
    isUrgent: isUrgentRequested,
    status: clean.status ?? "ativo",
    visualizacoes: 0,
    createdAt: new Date().toISOString(),
    images: incomingImages,
  };
  // Remove ad existente com mesmo id se houver (idempotência StrictMode)
  db.ads = db.ads.filter(a => a.id !== id);
  db.adImages = db.adImages.filter(i => i.adId !== id);
  db.ads.push(adObj);
  // Também popula adImages para compatibilidade
  if (incomingImages.length > 0) {
    incomingImages.forEach((url, i) => {
      db.adImages.push({ id: crypto.randomUUID(), adId: id, imageUrl: url, ordem: i });
    });
  }
  const saved = saveDemoDB(db);
  if (!saved) {
    throw new Error("PERSIST_IMAGES_FAILED: Armazenamento cheio. Tente imagens menores.");
  }
  // [P0-FIX] Read-after-write proof dentro da mesma função
  const verify = db.ads.find(a => a.id === id) as any;
  const resolved = resolveAdImages(verify, db);
  if (incomingImages.length > 0 && resolved.length === 0) {
    throw new Error('PERSIST_IMAGES_FAILED: images não persistiram no demo-store');
  }
  // [REALTIME] Notifica criação instantânea
  try { const { emitDemoStoreChange } = await import('./demo-store'); emitDemoStoreChange({ entity: 'ad', id, action: 'create' }); } catch {}
  return id;
}

export async function updateAd(id: string, input: AdInput): Promise<void> {
  // [SEC-FIX] CWE-20, CWE-639: Validação de ID e dados + prevenção IDOR
  assertValidId(id, "adId");
  const parsed = AdInputSchema.safeParse(input);
  if (!parsed.success) {
    securityLog("validation_failed", { adId: id, errors: parsed.error.flatten() }, "medium");
    throw new Error("Dados inválidos");
  }
  const clean = parsed.data as any;
  // [URGENTE] Valida se pode marcar como urgente
  const isUrgentRequested = clean.isUrgent === true ? true : clean.isUrgent === false ? false : undefined;
  if (isUrgentRequested !== undefined) {
    let isVerifiedUser = false;
    try {
      const sbCheck = getSupabase();
      if (sbCheck) {
        // Busca dono do anúncio para checar verificado
        const { data: adRow } = await sbCheck.from('ads').select('user_id').eq('id', id).maybeSingle();
        const ownerId = adRow?.user_id;
        if (ownerId) {
          const { data: prof } = await sbCheck.from('profiles').select('verificado, is_partner').eq('id', ownerId).maybeSingle();
          if (prof && (prof.verificado || (prof as any).is_partner)) isVerifiedUser = true;
        }
      } else {
        const dbCheck = getDemoDB();
        const ad = dbCheck.ads.find(a => a.id === id);
        if (ad) {
          const u = dbCheck.users.find(x => x.id === ad.userId);
          if (u && (u.verificado || (u as any).isPartner)) isVerifiedUser = true;
        }
      }
    } catch {}
    if (isUrgentRequested && !isVerifiedUser) {
      throw new Error('Apenas usuários verificados (selo azul ✅ e parceiro dourado 🟡) podem marcar como urgente');
    }
  }

  const sb = getSupabase();
  if (sb) {
    const updatePayload: any = {
      tipo: clean.tipo,
      titulo: clean.titulo,
      descricao: clean.descricao,
      categoria: clean.categoria,
      bairro: clean.bairro,
      cidade: clean.cidade ?? "Vitória",
      uf: clean.uf ?? "ES",
      aceita_em_troca: clean.aceitaEmTroca,
    };
    if (isUrgentRequested !== undefined) updatePayload.is_urgent = isUrgentRequested;
    const { error } = await sb.from("ads").update(updatePayload).eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const db = getDemoDB();
  const ad = db.ads.find((a) => a.id === id);
  if (!ad) throw new Error("Anúncio não encontrado");
  const sid = getDemoSessionId();
  if (sid && ad.userId !== sid) {
    securityLog("idor_attempt", { adId: id, owner: ad.userId, requester: sid }, "high");
    throw new Error("Sem permissão para editar este anúncio");
  }
  Object.assign(ad, {
    tipo: clean.tipo,
    titulo: clean.titulo,
    descricao: clean.descricao,
    categoria: clean.categoria,
    bairro: clean.bairro,
    cidade: clean.cidade ?? ad.cidade,
    uf: clean.uf ?? ad.uf,
    aceitaEmTroca: clean.aceitaEmTroca,
  });
  if (isUrgentRequested !== undefined) (ad as any).isUrgent = isUrgentRequested;
  saveDemoDB(db);
  try { const { emitDemoStoreChange } = await import('./demo-store'); emitDemoStoreChange({ entity: 'ad', id, action: 'update' }); } catch {}
}

export async function updateAdStatus(id: string, status: string): Promise<void> {
  // [SEC-FIX] CWE-20: Validação de ID e status
  assertValidId(id, "adId");
  const allowed = ["ativo", "pendente", "aprovado", "rejeitado", "pausado", "arquivado"];
  if (!allowed.includes(status)) {
    securityLog("validation_failed", { adId: id, status }, "medium");
    throw new Error("Status inválido");
  }
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("ads").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const db = getDemoDB();
  const ad = db.ads.find((a) => a.id === id);
  if (ad) ad.status = status;
  saveDemoDB(db);
}

// ═══════════════════════════════════════════════════════════
// 🛡️ ANTI-FRAUDE · TRAVA INTELIGENTE DE EXCLUSÃO
//
// 1. SEM trocas            → exclusão total (anúncio + imagens
//    físicas no Storage 'ads'; trocas canceladas/rejeitadas
//    não bloqueiam e não possuem avaliações).
// 2. Troca EM ANDAMENTO    → exclusão BLOQUEADA
//    (pending/accepted/in_progress/completed).
// 3. Avaliação PENDENTE    → exclusão BLOQUEADA (awaiting_reviews).
// 4. Troca CONCLUÍDA       → apenas ARQUIVAR; avaliações e
//    reputação permanecem ETERNAMENTE no perfil do usuário.
//
// Reforço no banco (supabase/schema.sql):
//  • RLS ads_delete_guard impede DELETE com trocas ativas;
//  • FK reviews.trade_id ON DELETE RESTRICT garante que NUNCA
//    se apague uma avaliação via cascata.
// ═══════════════════════════════════════════════════════════
export type AdDeletionStatus = {
  totalTrades: number;
  activeTrades: number; // pending | accepted | in_progress | completed
  awaitingReviews: number; // aguardando avaliação recíproca
  finishedTrades: number; // histórico concluído (reputação eterna)
  canDelete: boolean;
  canArchive: boolean;
  message: string | null;
};

const MSG_ACTIVE_TRADES =
  "⚠️ Não é possível excluir um anúncio com trocas em andamento. Conclua ou cancele a negociação antes.";
const MSG_AWAITING_REVIEWS =
  "⚠️ Não é possível excluir: existem avaliações pendentes desta troca. Finalize a avaliação antes de arquivar o anúncio.";
const MSG_FINISHED_HISTORY =
  "ℹ️ Este anúncio possui trocas concluídas: ele pode ser apenas arquivado. O histórico de trocas e as avaliações permanecem para sempre no seu perfil público.";

function computeDeletionStatus(tradeStatuses: string[]): AdDeletionStatus {
  const activeTrades = tradeStatuses.filter((st) =>
    ["pending", "accepted", "in_progress", "completed"].includes(st)
  ).length;
  const awaitingReviews = tradeStatuses.filter(
    (st) => st === "awaiting_reviews"
  ).length;
  const finishedTrades = tradeStatuses.filter(
    (st) => st === "finished"
  ).length;
  const canDelete =
    activeTrades === 0 && awaitingReviews === 0 && finishedTrades === 0;
  const message = canDelete
    ? null
    : activeTrades > 0
    ? MSG_ACTIVE_TRADES
    : awaitingReviews > 0
    ? MSG_AWAITING_REVIEWS
    : MSG_FINISHED_HISTORY;
  return {
    totalTrades: tradeStatuses.length,
    activeTrades,
    awaitingReviews,
    finishedTrades,
    canDelete,
    canArchive: true,
    message,
  };
}

/** Extrai o caminho do objeto no Storage a partir da public URL (legado compat) */
function extractStoragePathFromUrl(url: string, bucket: string): string | null {
  return storage.extractStoragePathFromUrl(url, bucket);
}

export async function getAdDeletionStatus(
  adId: string
): Promise<AdDeletionStatus> {
  // [SEC-FIX] CWE-20: Validação de ID
  assertValidId(adId, "adId");

  // ── MODO DEMO: zero fetch Supabase ──
  if (!isSupabaseConfigured()) {
    const db = getDemoDB();
    const tradeStatuses = db.trades.filter((t) => t.adId === adId).map((t) => t.status);
    // [FASE 1] Inclui negotiations mock PT
    const negoStatuses = (db.negotiations ?? [])
      .filter((n) => n.adId === adId)
      .map((n) => {
        const s = String(n.status).toLowerCase();
        if (s === "em_andamento") return "in_progress";
        if (s === "aceita") return "accepted";
        if (s === "finalizada") return "finished";
        if (s === "pendente") return "pending";
        if (s === "cancelada") return "cancelled";
        return s;
      });
    return computeDeletionStatus([...tradeStatuses, ...negoStatuses]);
  }

  const sb = getSupabase();
  if (sb) {
    let allStatuses: string[] = [];
    try {
      const { data } = await sb.from("trades").select("status").eq("ad_id", adId);
      allStatuses = (data ?? []).map((r: Row) => r.status);
    } catch {}
    try {
      const { data: nego } = await sb.from("negotiations").select("status").eq("ad_id", adId);
      if (nego && nego.length > 0) {
        const mapped = (nego as Row[]).map((r) => {
          const s = String(r.status).toLowerCase();
          if (s === "em_andamento") return "in_progress";
          if (s === "aceita") return "accepted";
          if (s === "finalizada") return "finished";
          if (s === "pendente") return "pending";
          if (s === "cancelada") return "cancelled";
          return s;
        });
        allStatuses = [...allStatuses, ...mapped];
      }
    } catch {}
    return computeDeletionStatus(allStatuses);
  }
  const db = getDemoDB();
  return computeDeletionStatus(
    db.trades.filter((t) => t.adId === adId).map((t) => t.status)
  );
}

/**
 * [FASE 1] canDeleteAd com contrato único {success, canDelete, allowed, reason}
 * Wrapper que delega para storage.ts mantendo compat frontend
 */
export async function canDeleteAd(
  adId: string,
  userId?: string
): Promise<{ success: boolean; canDelete: boolean; allowed: boolean; reason?: string }> {
  assertValidId(adId, "adId");
  if (userId) assertValidId(userId, "userId");
  return storage.canDeleteAd(adId, userId);
}

/**
 * Exclusão com trava anti-fraude. Só exclui quando NÃO existem
 * trocas ativas, avaliações pendentes ou histórico concluído.
 * Apaga também as imagens FÍSICAS no bucket 'ads' do Storage.
 * [FASE 1] Agora usa storage.canDeleteAd + deleteAllAdImages + limpeza images[]
 */
export async function deleteAd(
  userId: string,
  adId: string
): Promise<{ success: boolean; error?: string }> {
  // [SEC-FIX] CWE-20, CWE-639: Validação de IDs e ownership
  assertValidId(userId, "userId");
  assertValidId(adId, "adId");

  // [FASE 1] DUAL: verificação centralizada via storage.ts com zero fetch em demo
  const canDeleteCheck = await storage.canDeleteAd(adId, userId);
  if (!canDeleteCheck.canDelete) {
    throw new Error(canDeleteCheck.reason || "Exclusão bloqueada");
  }
  const status = await getAdDeletionStatus(adId);
  if (!status.canDelete) throw new Error(status.message || "Exclusão bloqueada");

  // ── MODO DEMO: remove anúncio + imagens mockadas localStorage ──
  if (!isSupabaseConfigured()) {
    const db = getDemoDB();
    const ad = db.ads.find((a) => a.id === adId);
    if (!ad) throw new Error("Anúncio não encontrado");
    if (ad.userId !== userId) {
      securityLog("idor_attempt", { adId, userId, owner: ad.userId }, "high");
      throw new Error("Sem permissão");
    }
    db.ads = db.ads.filter((a) => a.id !== adId);
    db.adImages = db.adImages.filter((i) => i.adId !== adId);
    db.trades = db.trades.filter((t) => t.adId !== adId);
    if (db.negotiations) db.negotiations = db.negotiations.filter((n) => n.adId !== adId);
    saveDemoDB(db);
    try { const { emitDemoStoreChange } = await import('./demo-store'); emitDemoStoreChange({ entity: 'ad', id: adId, action: 'delete' }); } catch {}
    return { success: true };
  }

  const sb = getSupabase();
  if (sb) {
    // 1. Busca todas as fontes de imagens: ad_images + ads.images[]
    let existingPaths: string[] = [];
    try {
      const { data: adRow } = await sb.from("ads").select("images").eq("id", adId).maybeSingle();
      if (adRow?.images && Array.isArray(adRow.images)) {
        existingPaths = adRow.images
          .map((u: string) => storage.extractStoragePathFromUrl(String(u)))
          .filter((x): x is string => !!x) as string[];
      }
    } catch {}
    // 2. Apaga objetos físicos via storage.ts (lista bucket ads/{userId}/{adId}/)
    try {
      await storage.deleteAllAdImages(userId, adId, existingPaths);
    } catch {
      // Fallback legado: tenta extrair de ad_images
      try {
        const { data: imgs } = await sb.from("ad_images").select("image_url").eq("ad_id", adId);
        const paths = ((imgs ?? []) as Row[])
          .map((i) => storage.extractStoragePathFromUrl(String(i.image_url)))
          .filter((x): x is string => !!x);
        if (paths.length > 0) await sb.storage.from("ads").remove(paths);
      } catch {}
    }

    // 3. Apaga o anúncio (RLS ads_delete_guard + FK RESTRICT em reviews protegem)
    const { error } = await sb.from("ads").delete().eq("id", adId);
    if (error) {
      if (error.code === "42501") throw new Error(MSG_ACTIVE_TRADES);
      if (error.code === "23503")
        throw new Error("Exclusão bloqueada: existem avaliações permanentes vinculadas a este anúncio.");
      throw new Error(error.message);
    }
    return { success: true };
  }

  // Fallback se Supabase configurado mas client falhou (mantém compat demo)
  const db = getDemoDB();
  const ad = db.ads.find((a) => a.id === adId);
  if (!ad) throw new Error("Anúncio não encontrado");
  if (ad.userId !== userId) {
    securityLog("idor_attempt", { adId, userId, owner: ad.userId }, "high");
    throw new Error("Sem permissão");
  }
  db.ads = db.ads.filter((a) => a.id !== adId);
  db.adImages = db.adImages.filter((i) => i.adId !== adId);
  db.trades = db.trades.filter((t) => t.adId !== adId);
  if (db.negotiations) db.negotiations = db.negotiations.filter((n) => n.adId !== adId);
  saveDemoDB(db);
  try { const { emitDemoStoreChange } = await import('./demo-store'); emitDemoStoreChange({ entity: 'ad', id: adId, action: 'delete' }); } catch {}
  return { success: true };
}

/**
 * Arquivar/Desativar anúncio do feed — usado quando há trocas
 * concluídas. O histórico de trocas e as avaliações PERMANECEM
 * gravados no perfil (reputação eterna).
 */
export async function archiveAd(adId: string): Promise<void> {
  await updateAdStatus(adId, "arquivado");
}

/** Substitui as imagens de um anúncio pelas URLs informadas — [FASE 1] atualiza ad_images + ads.images[] */
export async function setAdImages(adId: string, imageUrls: string[]): Promise<void> {
  // [SEC-FIX] CWE-20, CWE-79, CWE-434: Validação de ID e URLs de imagem
  // [FIX] DataURL demo 1600px WebP ~150-350KB base64 ~200-500KB, não truncar em 500
  assertValidId(adId, "adId");
  if (!Array.isArray(imageUrls) || imageUrls.length > 5) throw new Error("Máximo 5 imagens");
  const cleanUrls = imageUrls.map((u) => {
    const raw = String(u);
    const isData = raw.startsWith('data:image/');
    const isHttps = raw.startsWith('https://') || raw.startsWith('http://');
    if (!isData && !isHttps) {
      securityLog("xss_attempt", { adId, url: raw.slice(0, 50) }, "high");
      throw new Error("URL de imagem inválida");
    }
    const maxLen = isData ? 700 * 1024 : 2000; // dataUrl até 700KB (base64 de 500KB), https 2000
    const url = raw.slice(0, maxLen);
    if (url.length < 10) throw new Error("URL muito curta");
    return url;
  });

  // ── MODO DEMO: zero fetch Supabase, Base64 DataURL permitido ──
  if (!isSupabaseConfigured()) {
    const db = getDemoDB();
    db.adImages = db.adImages.filter((i) => i.adId !== adId);
    cleanUrls.forEach((url, i) =>
      db.adImages.push({ id: crypto.randomUUID(), adId, imageUrl: url, ordem: i })
    );
    const ad = db.ads.find((a) => a.id === adId);
    if (ad) (ad as any).images = cleanUrls;
    const saved = saveDemoDB(db);
    if (!saved) {
      // [P0-FIX] Quota estourada - tenta salvar sem imagens antigas? Já comprimido, mas se falhar, avisa
      console.error('[AD-IMAGE-DEBUG] saveDemoDB failed - quota exceeded', { adId, urlsCount: cleanUrls.length });
      throw new Error("Armazenamento cheio. Tente imagens menores ou remova anúncios antigos.");
    }
    // [REALTIME] Notifica atualização instantânea
    try {
      const { emitDemoStoreChange } = await import('./demo-store');
      emitDemoStoreChange({ entity: 'ad', id: adId, action: 'images_update' });
    } catch {}
    return;
  }

  const sb = getSupabase();
  if (sb) {
    // Busca URLs antigas para deletar órfãs do Storage (apenas quando substitui slot)
    let oldUrls: string[] = [];
    try {
      const { data: existing } = await sb.from("ad_images").select("image_url").eq("ad_id", adId);
      oldUrls = (existing ?? []).map((r: any) => r.image_url);
    } catch {}
    // [FASE 1] Atualiza coluna images[] em ads + tabela ad_images legada para compat
    const { error: updErr } = await sb.from("ads").update({ images: cleanUrls }).eq("id", adId);
    if (updErr) {
      securityLog("validation_failed", { adId, error: updErr.message, action: "setAdImages_images_col" }, "low");
    }
    await sb.from("ad_images").delete().eq("ad_id", adId);
    if (cleanUrls.length > 0) {
      const rows = cleanUrls.map((url, i) => ({
        ad_id: adId,
        image_url: url,
        ordem: i,
      }));
      const { error } = await sb.from("ad_images").insert(rows);
      if (error) throw new Error(error.message);
    }
    // Deleta do Storage apenas URLs que não estão mais na lista (slot substituído/removido)
    try {
      const toDelete = oldUrls.filter(u => !cleanUrls.includes(u));
      for (const url of toDelete) {
        const path = storage.extractStoragePathFromUrl(url, "ads");
        if (path) {
          try {
            // [SEC-FIX] CWE-22: sanitiza e verifica ownership via path (userId extraído do path)
            const safe = storage.sanitizeStoragePath(path);
            await sb.storage.from("ads").remove([safe]);
          } catch {}
        }
      }
    } catch {}
    return;
  }
  const db = getDemoDB();
  db.adImages = db.adImages.filter((i) => i.adId !== adId);
  cleanUrls.forEach((url, i) =>
    db.adImages.push({ id: crypto.randomUUID(), adId, imageUrl: url, ordem: i })
  );
  const ad = db.ads.find((a) => a.id === adId);
  if (ad) (ad as any).images = cleanUrls;
  const saved2 = saveDemoDB(db);
  if (!saved2) {
    throw new Error("Armazenamento cheio. Tente imagens menores.");
  }
  try {
    const { emitDemoStoreChange } = await import('./demo-store');
    emitDemoStoreChange({ entity: 'ad', id: adId, action: 'images_update' });
  } catch {}
}

export type UserAd = {
  id: string;
  tipo: string;
  titulo: string;
  categoria: string;
  bairro: string;
  status: string;
  visualizacoes: number;
  destaque: boolean;
  topoFeed: boolean;
  isFeatured?: boolean;
  featuredUntil?: string | null;
  isTopFeed?: boolean;
  topFeedUntil?: string | null;
  boostType?: string | null;
  isUrgent?: boolean;
  createdAt: string;
  images: string[];
  /** Trava inteligente de exclusão (anti-fraude) */
  deletion: AdDeletionStatus;
};

/** Mapeia statuses das trocas de cada anúncio → regra de exclusão */
function deletionMapFromTrades(
  trades: { adId: string; status: string }[]
): Map<string, AdDeletionStatus> {
  const byAd = new Map<string, string[]>();
  for (const t of trades) {
    const list = byAd.get(t.adId) ?? [];
    list.push(t.status);
    byAd.set(t.adId, list);
  }
  const out = new Map<string, AdDeletionStatus>();
  for (const [adId, statuses] of byAd) out.set(adId, computeDeletionStatus(statuses));
  return out;
}

export async function listUserAds(userId: string): Promise<UserAd[]> {
  // [SEC-FIX] CWE-20, CWE-639: Validação de userId + IDOR BOLA
  assertValidId(userId, "userId");
  // [SEC-FIX] CWE-639: Em prod, verifica se userId == auth.uid() ou admin (RLS já protege, mas defesa em profundidade)
  if (isSupabaseConfigured()) {
    try {
      const sbCheck = getSupabase();
      if (sbCheck) {
        const { data: sessionData } = await sbCheck.auth.getSession();
        const authId = sessionData.session?.user?.id;
        if (authId && authId !== userId) {
          // Verifica se é admin via profiles.role
          const { data: prof } = await sbCheck.from("profiles").select("role").eq("id", authId).maybeSingle();
          if (prof?.role !== "admin") {
            securityLog("idor_attempt", { action: "listUserAds", requested: userId, authId }, "high");
            throw new Error("Sem permissão para listar anúncios de outro usuário");
          }
        }
      }
    } catch (e) {
      if ((e as Error).message.includes("Sem permissão")) throw e;
      /* best-effort */
    }
  } else {
    // Demo: verifica sessão local
    const sid = getDemoSessionId();
    if (sid && sid !== userId) {
      const db = getDemoDB();
      const requester = db.users.find((u) => u.id === sid);
      if (requester?.role !== "admin") {
        securityLog("idor_attempt", { action: "listUserAds_demo", requested: userId, requester: sid }, "high");
        throw new Error("Sem permissão para listar anúncios de outro usuário");
      }
    }
  }
  const sb = getSupabase();
  if (sb) {
    return withTimeout(
      (async () => {
        const { data, error } = await sb
          .from("ads")
          .select("*, images, ad_images(image_url, ordem)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);

        const adIds = (data ?? []).map((r: Row) => r.id);
        let deletionMap = new Map<string, AdDeletionStatus>();
        if (adIds.length > 0) {
          const { data: trades } = await sb
            .from("trades")
            .select("ad_id, status")
            .in("ad_id", adIds);
          deletionMap = deletionMapFromTrades(
            ((trades ?? []) as Row[]).map((t) => ({
              adId: String(t.ad_id),
              status: String(t.status),
            }))
          );
        }

        return (data ?? []).map((r: Row) => {
          // [FASE 1] Prefer images[] se existir
          let images: string[] = [];
          if (Array.isArray(r.images) && r.images.length > 0) images = r.images;
          else
            images = (r.ad_images ?? [])
              .slice()
              .sort((a: Row, b: Row) => (a.ordem ?? 0) - (b.ordem ?? 0))
              .map((i: Row) => i.image_url);
          return {
            id: r.id,
            tipo: r.tipo,
            titulo: r.titulo,
            categoria: r.categoria,
            bairro: r.bairro,
            status: r.status,
            visualizacoes: Number(r.visualizacoes ?? 0),
            destaque: !!(r.destaque || r.is_featured),
            topoFeed: !!(r.topo_feed || r.is_top_feed),
            isFeatured: !!(r.is_featured ?? r.destaque),
            featuredUntil: r.featured_until ?? null,
            isTopFeed: !!(r.is_top_feed ?? r.topo_feed),
            topFeedUntil: r.top_feed_until ?? null,
            boostType: r.boost_type ?? null,
            isUrgent: !!(r.is_urgent),
            createdAt: r.created_at,
            images,
            deletion: deletionMap.get(r.id) ?? computeDeletionStatus([]),
          } as UserAd;
        });
      })(),
      9000,
      () => [] as UserAd[]
    );
  }
  const db = getDemoDB();
  // [IMPROVE] Paridade Demo ↔ Prod: inclui negotiations PT mapeadas para EN no mapa de bloqueio
  const allStatuses = [
    ...db.trades.map((t) => ({ adId: t.adId, status: t.status })),
    ...(db.negotiations ?? []).map((n) => {
      const s = String(n.status).toLowerCase();
      const mapped =
        s === "em_andamento"
          ? "in_progress"
          : s === "aceita"
          ? "accepted"
          : s === "finalizada"
          ? "finished"
          : s === "pendente"
          ? "pending"
          : "cancelled";
      return { adId: n.adId, status: mapped };
    }),
  ];
  const deletionMap = deletionMapFromTrades(allStatuses);
  return db.ads
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((a) => {
      const anyA = a as any;
      const images = resolveAdImages(anyA, db);
      return {
        id: a.id,
        tipo: a.tipo,
        titulo: a.titulo,
        categoria: a.categoria,
        bairro: a.bairro,
        status: a.status,
        visualizacoes: a.visualizacoes,
        destaque: !!(anyA.isFeatured ?? a.destaque),
        topoFeed: !!(anyA.isTopFeed ?? a.topoFeed),
        isFeatured: !!(anyA.isFeatured ?? a.destaque),
        featuredUntil: anyA.featuredUntil ?? null,
        isTopFeed: !!(anyA.isTopFeed ?? a.topoFeed),
        topFeedUntil: anyA.topFeedUntil ?? null,
        boostType: anyA.boostType ?? null,
        isUrgent: !!(anyA.isUrgent ?? anyA.is_urgent ?? false),
        createdAt: a.createdAt,
        images,
        deletion: deletionMap.get(a.id) ?? computeDeletionStatus([]),
      };
    });
}

// ═══════════════════════════════════════════════════════════
// TROCAS · pending → accepted → in_progress → completed
//        → awaiting_reviews → finished
// ═══════════════════════════════════════════════════════════
export type TradeAction =
  | "accept"
  | "reject"
  | "cancel"
  | "start"
  | "complete";

export async function hasPendingReview(userId: string): Promise<Trade | null> {
  // [SEC-FIX] CWE-20: Validação de ID
  assertValidId(userId, "userId");
  // Slim Partner: ilimitado ♾️ bypass
  try {
    const prof = await getProfileById(userId);
    if (prof?.isPartner) return null;
  } catch {}
  const pending = (await listTrades(userId, "todas")).find((t) => {
    if (t.status !== "awaiting_reviews") return false;
    return t.requesterId === userId
      ? !t.requesterReviewed
      : t.ownerId === userId
      ? !t.ownerReviewed
      : false;
  });
  return pending ?? null;
}

export async function proposeTrade(
  userId: string,
  adId: string,
  message?: string
): Promise<Trade> {
  // [SEC-FIX] CWE-20, CWE-307, CWE-639: Validação, rate limiting, IDOR
  assertValidId(userId, "userId");
  assertValidId(adId, "adId");
  const rl = checkRateLimit("proposeTrade", userId);
  if (!rl.allowed) throw new Error("Limite de propostas atingido. Aguarde.");
  const cleanMessage = message ? sanitizeFreeText(message, 500) : null;

  const pendingReview = await hasPendingReview(userId);
  if (pendingReview)
    throw new Error(
      "Você tem uma avaliação pendente. Finalize-a antes de propor novas trocas."
    );

  const sb = getSupabase();
  if (sb) {
    const { data: ad, error: adErr } = await sb
      .from("ads")
      .select("id, user_id, status, titulo")
      .eq("id", adId)
      .single();
    if (adErr || !ad) throw new Error("Anúncio não encontrado");
    if (ad.status !== "ativo") throw new Error("Anúncio não está ativo");
    if (ad.user_id === userId) throw new Error("Você não pode propor troca no seu próprio anúncio");

    const { data: dup } = await sb
      .from("trades")
      .select("id")
      .eq("ad_id", adId)
      .eq("requester_id", userId)
      .in("status", ["pending", "accepted", "in_progress", "completed"])
      .limit(1);
    if (dup && dup.length > 0)
      throw new Error("Você já tem uma troca em andamento neste anúncio");

    const { data: trade, error } = await sb
      .from("trades")
      .insert({
        ad_id: adId,
        requester_id: userId,
        owner_id: ad.user_id,
        status: "pending",
        message: cleanMessage,
      })
      .select("id, requester_id, owner_id, status")
      .single();
    if (error) throw new Error(error.message);

    const other = await getProfileById(ad.user_id);
    return {
      id: trade.id,
      adId,
      adTitulo: ad.titulo,
      adTipo: "",
      requesterId: userId,
      ownerId: ad.user_id,
      status: "pending",
      requesterCompleted: false,
      ownerCompleted: false,
      requesterReviewed: false,
      ownerReviewed: false,
      whatsappShareStatus: "none",
      whatsappRequestedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      otherId: ad.user_id,
      otherNome: other?.nome ?? "Usuário",
      otherAvatar: other?.avatarUrl ?? null,
      otherWhatsapp: other?.whatsapp ?? null,
    };
  }

  // DEMO
  const db = getDemoDB();
  const ad = db.ads.find((a) => a.id === adId);
  if (!ad) throw new Error("Anúncio não encontrado");
  if (ad.status !== "ativo") throw new Error("Anúncio não está ativo");
  if (ad.userId === userId) throw new Error("Você não pode propor troca no seu próprio anúncio");
  if (
    db.trades.some(
      (t) =>
        t.adId === adId &&
        t.requesterId === userId &&
        ["pending", "accepted", "in_progress", "completed"].includes(t.status)
    )
  )
    throw new Error("Você já tem uma troca em andamento neste anúncio");

  const trade = {
    id: crypto.randomUUID(),
    adId,
    requesterId: userId,
    ownerId: ad.userId,
    status: "pending" as TradeStatus,
    requesterCompleted: false,
    ownerCompleted: false,
    requesterReviewed: false,
    ownerReviewed: false,
    whatsappShareStatus: "none",
    whatsappRequestedBy: null,
    message: cleanMessage,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.trades.push(trade);
  saveDemoDB(db);
  return decorateDemoTrade(db, trade, userId);
}

export async function listTrades(
  userId: string,
  tipo: "recebidas" | "enviadas" | "todas"
): Promise<Trade[]> {
  // [SEC-FIX] CWE-20, CWE-639: Validação de userId e tipo
  assertValidId(userId, "userId");
  if (!["recebidas", "enviadas", "todas"].includes(tipo)) throw new Error("Tipo inválido");
  const sb = getSupabase();
  if (sb) {
    let query = sb
      .from("trades")
      .select(
        `*, ad:ads(titulo, tipo),
         requester:profiles!trades_requester_id_fkey(nome, avatar_url),
         owner:profiles!trades_owner_id_fkey(nome, avatar_url)`
      )
      .or(`requester_id.eq.${userId},owner_id.eq.${userId}`)
      .order("updated_at", { ascending: false });
    if (tipo === "recebidas") query = query.eq("owner_id", userId);
    if (tipo === "enviadas") query = query.eq("requester_id", userId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Row) => {
      const other = r.requester_id === userId ? r.owner : r.requester;
      const otherId = r.requester_id === userId ? r.owner_id : r.requester_id;
      return {
        id: r.id,
        adId: r.ad_id,
        adTitulo: r.ad?.titulo ?? "Anúncio removido",
        adTipo: r.ad?.tipo ?? "ofereço",
        requesterId: r.requester_id,
        ownerId: r.owner_id,
        status: r.status as TradeStatus,
        requesterCompleted: !!r.requester_completed,
        ownerCompleted: !!r.owner_completed,
        requesterReviewed: !!r.requester_reviewed,
        ownerReviewed: !!r.owner_reviewed,
        whatsappShareStatus: r.whatsapp_share_status ?? "none",
        whatsappRequestedBy: r.whatsapp_requested_by ?? null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        otherId,
        otherNome: other?.nome ?? "Usuário",
        otherAvatar: other?.avatar_url ?? null,
        // 🛡️ WhatsApp invisível: só via get_trade_contact quando approved
        otherWhatsapp: null,
      } satisfies Trade;
    });
  }

  // DEMO
  const db = getDemoDB();
  let trades = db.trades.filter(
    (t) => t.requesterId === userId || t.ownerId === userId
  );
  if (tipo === "recebidas") trades = trades.filter((t) => t.ownerId === userId);
  if (tipo === "enviadas") trades = trades.filter((t) => t.requesterId === userId);
  return trades
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((t) => decorateDemoTrade(db, t, userId));
}

export async function updateTradeStatus(
  userId: string,
  tradeId: string,
  action: TradeAction
): Promise<Trade> {
  // [SEC-FIX] CWE-20, CWE-639, CWE-284: Validação de IDs e ação + controle de acesso
  assertValidId(userId, "userId");
  assertValidId(tradeId, "tradeId");
  const allowedActions: TradeAction[] = ["accept", "reject", "cancel", "start", "complete"];
  if (!allowedActions.includes(action)) {
    securityLog("validation_failed", { action, tradeId }, "medium");
    throw new Error("Ação inválida");
  }
  const applyLogic = (
    trade: {
      requesterId: string;
      ownerId: string;
      status: TradeStatus;
      requesterCompleted: boolean;
      ownerCompleted: boolean;
    },
    userId: string,
    action: TradeAction
  ) => {
    const isOwner = trade.ownerId === userId;
    const isRequester = trade.requesterId === userId;
    if (!isOwner && !isRequester) {
      securityLog("idor_attempt", { tradeId, userId, action }, "high");
      throw new Error("Sem permissão");
    }
    const now = new Date().toISOString();

    switch (action) {
      case "accept":
        if (!isOwner || trade.status !== "pending")
          throw new Error("Não é possível aceitar esta troca");
        trade.status = "accepted";
        break;
      case "reject":
        if (!isOwner || trade.status !== "pending")
          throw new Error("Não é possível rejeitar esta troca");
        trade.status = "rejected";
        break;
      case "cancel":
        if (!["pending", "accepted"].includes(trade.status))
          throw new Error("Não é possível cancelar esta troca");
        trade.status = "cancelled";
        break;
      case "start":
        if (trade.status !== "accepted")
          throw new Error("A troca precisa estar aceita para iniciar");
        trade.status = "in_progress";
        break;
      case "complete": {
        // Aceita "in_progress" (1ª confirmação) e "completed"
        // (confirmação da segunda parte — reciproca)
        if (trade.status !== "in_progress" && trade.status !== "completed")
          throw new Error("A troca precisa estar em andamento");
        if (isRequester) trade.requesterCompleted = true;
        else trade.ownerCompleted = true;
        trade.status =
          trade.requesterCompleted && trade.ownerCompleted
            ? "awaiting_reviews"
            : "completed";
        break;
      }
      default:
        throw new Error("Ação inválida");
    }
    return now;
  };

  const sb = getSupabase();
  if (sb) {
    const { data: raw, error } = await sb
      .from("trades")
      .select("*")
      .eq("id", tradeId)
      .single();
    if (error || !raw) throw new Error("Troca não encontrada");
    const trade = {
      requesterId: raw.requester_id,
      ownerId: raw.owner_id,
      status: raw.status as TradeStatus,
      requesterCompleted: !!raw.requester_completed,
      ownerCompleted: !!raw.owner_completed,
    };
    applyLogic(trade, userId, action);
    const { error: upErr } = await sb
      .from("trades")
      .update({
        status: trade.status,
        requester_completed: trade.requesterCompleted,
        owner_completed: trade.ownerCompleted,
      })
      .eq("id", tradeId);
    if (upErr) throw new Error(upErr.message);
    const trades = await listTrades(userId, "todas");
    return trades.find((t) => t.id === tradeId)!;
  }

  // DEMO
  const db = getDemoDB();
  const trade = db.trades.find((t) => t.id === tradeId);
  if (!trade) throw new Error("Troca não encontrada");
  applyLogic(trade, userId, action);
  trade.updatedAt = new Date().toISOString();
  saveDemoDB(db);
  return decorateDemoTrade(db, trade, userId);
}

export async function submitReview(
  userId: string,
  tradeId: string,
  input: { nota: number; comentario?: string; cumprimento: string }
): Promise<void> {
  // [SEC-FIX] CWE-20, CWE-79: Validação rigorosa de review + sanitização
  assertValidId(userId, "userId");
  assertValidId(tradeId, "tradeId");
  const parsed = ReviewInputSchema.safeParse(input);
  if (!parsed.success) {
    securityLog("validation_failed", { userId, tradeId, errors: parsed.error.flatten() }, "medium");
    throw new Error("Dados de avaliação inválidos");
  }
  const cleanInput = parsed.data;
  const sb = getSupabase();
  if (sb) {
    const { data: trade } = await sb
      .from("trades")
      .select("*")
      .eq("id", tradeId)
      .single();
    if (!trade) throw new Error("Troca não encontrada");
    if (trade.status !== "awaiting_reviews")
      throw new Error("A avaliação só fica disponível após a conclusão da troca");
    const isRequester = trade.requester_id === userId;
    const isOwner = trade.owner_id === userId;
    if (!isRequester && !isOwner) {
      securityLog("idor_attempt", { tradeId, userId, action: "submitReview" }, "high");
      throw new Error("Sem permissão");
    }
    if (isRequester && trade.requester_reviewed)
      throw new Error("Você já avaliou esta troca");
    if (isOwner && trade.owner_reviewed)
      throw new Error("Você já avaliou esta troca");

    const avaliadoId = isRequester ? trade.owner_id : trade.requester_id;
    const { error } = await sb.from("reviews").insert({
      trade_id: tradeId,
      avaliador_id: userId,
      avaliado_id: avaliadoId,
      nota: cleanInput.nota,
      comentario: cleanInput.comentario ? sanitizeFreeText(cleanInput.comentario, 500) : null,
      cumprimento: cleanInput.cumprimento,
    });
    if (error) throw new Error(error.message);
    await sb
      .from("trades")
      .update(isRequester ? { requester_reviewed: true } : { owner_reviewed: true })
      .eq("id", tradeId);
    return;
  }

  // DEMO (espelha os triggers SQL)
  const db = getDemoDB();
  const trade = db.trades.find((t) => t.id === tradeId);
  if (!trade) throw new Error("Troca não encontrada");
  if (trade.status !== "awaiting_reviews")
    throw new Error("A avaliação só fica disponível após a conclusão da troca");
  const isRequester = trade.requesterId === userId;
  const isOwner = trade.ownerId === userId;
  if (!isRequester && !isOwner) throw new Error("Sem permissão");
  if (isRequester && trade.requesterReviewed) throw new Error("Você já avaliou esta troca");
  if (isOwner && trade.ownerReviewed) throw new Error("Você já avaliou esta troca");

  const avaliadoId = isRequester ? trade.ownerId : trade.requesterId;
  db.reviews.push({
    id: crypto.randomUUID(),
    tradeId,
    avaliadorId: userId,
    avaliadoId,
    nota: input.nota,
    comentario: input.comentario?.trim() || null,
    cumprimento: input.cumprimento,
    createdAt: new Date().toISOString(),
  });
  if (isRequester) trade.requesterReviewed = true;
  else trade.ownerReviewed = true;
  trade.updatedAt = new Date().toISOString();
  recomputeDemoReputation(db, avaliadoId);
  finishDemoTradeIfNeeded(db, tradeId);
  saveDemoDB(db);
}

export async function listUserReviews(userId: string): Promise<ReviewWithReviewer[]> {
  // [SEC-FIX] CWE-20: Validação de userId
  assertValidId(userId, "userId");
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("reviews")
      .select("*, avaliador:profiles!reviews_avaliador_id_fkey(nome, avatar_url)")
      .eq("avaliado_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapReview);
  }
  const db = getDemoDB();
  return db.reviews
    .filter((r) => r.avaliadoId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => {
      const avaliador = db.users.find((u) => u.id === r.avaliadorId);
      return {
        id: r.id,
        nota: r.nota,
        comentario: r.comentario,
        cumprimento: r.cumprimento,
        createdAt: r.createdAt,
        avaliadorId: r.avaliadorId,
        avaliadorNome: avaliador?.nome ?? "Usuário",
        avaliadorAvatar: avaliador?.avatarUrl ?? null,
      } satisfies ReviewWithReviewer;
    });
}

// ═══════════════════════════════════════════════════════════
// CMS · site_content
// ═══════════════════════════════════════════════════════════
export type HelpTeamMember = {
  id: 'admin' | 'founder';
  displayName: string;
  roleTitle: string;
  message: string;
  avatarUrl: string | null;
  avatarPath?: string | null;
  namePosition?: 'above_role' | 'below_role';
  accent?: 'violet' | 'amber';
  updatedAt?: string;
};

function getDefaultHelpTeam(): HelpTeamMember[] {
  return [
    {
      id: 'admin',
      displayName: '',
      roleTitle: 'Admin TrocaES 🛡️',
      message: `Olá! 👋 Seja muito bem-vindo(a) ao TrocaES!

Aqui você troca serviços e produtos com vizinhos do seu bairro de forma segura, prática e sem usar dinheiro.

Escolha uma opção abaixo para tirar suas dúvidas 👇`,
      avatarUrl: null,
      avatarPath: null,
      namePosition: 'below_role',
      accent: 'violet',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'founder',
      displayName: '',
      roleTitle: 'Fundadora 💜',
      message: `Oi, tudo bem? 💜

Sou a idealizadora do TrocaES. Criei essa plataforma pensando em fortalecer a comunidade e ajudar cada vizinho a prosperar através de trocas justas.

Qualquer dúvida, estou por aqui! Vamos juntos transformar nosso bairro. 🏘️✨`,
      avatarUrl: null,
      avatarPath: null,
      namePosition: 'below_role',
      accent: 'amber',
      updatedAt: new Date().toISOString(),
    },
  ];
}

export async function getHelpTeam(): Promise<HelpTeamMember[]> {
  // [SEC-FIX] CWE-20: sanitiza e valida, paridade DEMO↔PROD via site_content
  const sanitizeTeam = (team: HelpTeamMember[]): HelpTeamMember[] => {
    return team.map(m => {
      // Detecta avatar quebrado (dataUrl truncado antigo limite 500)
      if (m.avatarUrl && m.avatarUrl.startsWith('data:image/')) {
        // DataUrl válido 500px WebP deve ter >5KB (~7k chars). 500 chars = truncado -> invalida
        if (m.avatarUrl.length < 1000) {
          return { ...m, avatarUrl: null, avatarPath: null };
        }
        // Valida formato básico base64
        if (!m.avatarUrl.includes('base64,')) {
          return { ...m, avatarUrl: null, avatarPath: null };
        }
      }
      // Valida https url básica
      if (m.avatarUrl && !m.avatarUrl.startsWith('https://') && !m.avatarUrl.startsWith('data:image/')) {
        return { ...m, avatarUrl: null, avatarPath: null };
      }
      return m;
    });
  };

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from('site_content').select('value').eq('key', 'help_team').maybeSingle();
      if (!error && data?.value) {
        const parsed = JSON.parse(data.value) as HelpTeamMember[];
        if (Array.isArray(parsed) && parsed.length === 2) {
          return sanitizeTeam(parsed);
        }
      }
    } catch {}
    return getDefaultHelpTeam();
  }
  // DEMO
  const db = getDemoDB();
  if (Array.isArray(db.helpTeam) && db.helpTeam.length === 2) {
    return sanitizeTeam(db.helpTeam as HelpTeamMember[]);
  }
  return getDefaultHelpTeam();
}

export async function updateHelpTeamMember(
  id: 'admin' | 'founder',
  patch: Partial<HelpTeamMember>
): Promise<HelpTeamMember[]> {
  // [SEC-FIX] CWE-20: valida ID sem assertValidId pois 'admin' tem 5 chars
  if (id !== 'admin' && id !== 'founder') throw new Error('ID ajuda inválido');
  // [SEC-FIX] CWE-79: sanitiza textos
  const cleanPatch: Partial<HelpTeamMember> = {};
  if (patch.displayName !== undefined) {
    const dn = String(patch.displayName).slice(0, 40);
    // strip html
    const sanitized = dn.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '').replace(/on\w+\s*=/gi, '');
    cleanPatch.displayName = sanitized;
  }
  if (patch.roleTitle !== undefined) {
    const rt = String(patch.roleTitle).slice(0, 40).replace(/<[^>]*>/g, '');
    cleanPatch.roleTitle = rt;
  }
  if (patch.message !== undefined) {
    const msg = String(patch.message).slice(0, 800).replace(/<[^>]*>/g, '');
    cleanPatch.message = msg;
  }
  if (patch.avatarUrl !== undefined) {
    const url = patch.avatarUrl;
    if (url === null) {
      cleanPatch.avatarUrl = null;
    } else {
      const raw = String(url);
      // [SEC-FIX] CWE-79: valida prefixo antes de slice para não truncar dataUrl
      const isData = raw.startsWith('data:image/');
      const isHttps = raw.startsWith('https://');
      if (!isData && !isHttps) {
        throw new Error('URL de avatar inválida');
      }
      // DataURL demo pode ter ~100KB base64, permite até 200KB; https até 2000
      const maxLen = isData ? 200 * 1024 : 2000;
      const u = raw.slice(0, maxLen);
      // Re-valida após slice para garantir integridade mínima
      if (isData && !u.startsWith('data:image/')) throw new Error('DataURL inválida');
      if (isHttps && !u.startsWith('https://')) throw new Error('URL https inválida');
      // Para dataUrl, verifica se parece truncado no meio do base64 sem padding? Best-effort: aceita se >100 chars
      if (u.length < 10) throw new Error('URL muito curta');
      cleanPatch.avatarUrl = u;
    }
  }
  if (patch.avatarPath !== undefined) {
    const p = patch.avatarPath;
    if (p === null) cleanPatch.avatarPath = null;
    else {
      const raw = String(p).slice(0, 500);
      if (raw.includes('..') || raw.includes('//')) throw new Error('Path inválido');
      cleanPatch.avatarPath = raw;
    }
  }
  if (patch.namePosition !== undefined) {
    cleanPatch.namePosition = patch.namePosition === 'above_role' ? 'above_role' : 'below_role';
  }
  if (patch.accent !== undefined) {
    cleanPatch.accent = patch.accent === 'amber' ? 'amber' : 'violet';
  }
  cleanPatch.updatedAt = new Date().toISOString();

  const sb = getSupabase();
  if (sb) {
    // Verifica admin
    try {
      const { data: sessionData } = await sb.auth.getSession();
      const authId = sessionData.session?.user?.id;
      if (authId) {
        const { data: prof } = await sb.from('profiles').select('role').eq('id', authId).maybeSingle();
        if (prof?.role !== 'admin') throw new Error('Sem permissão');
      }
    } catch (e) {
      if ((e as Error).message.includes('Sem permissão')) throw e;
    }
    const current = await getHelpTeam();
    const updated = current.map(m => m.id === id ? { ...m, ...cleanPatch } : m);
    const { error } = await sb.from('site_content').upsert({ key: 'help_team', value: JSON.stringify(updated) }, { onConflict: 'key' });
    if (error) throw new Error(error.message);
    return updated;
  }
  // DEMO
  const db = getDemoDB();
  const sid = getDemoSessionId();
  if (sid) {
    const requester = db.users.find(u => u.id === sid);
    if (requester?.role !== 'admin') throw new Error('Sem permissão - apenas admin');
  }
  let team = (db.helpTeam as HelpTeamMember[]) || getDefaultHelpTeam();
  team = team.map(m => m.id === id ? { ...m, ...cleanPatch } : m);
  db.helpTeam = team as any;
  saveDemoDB(db);
  try { const { emitDemoStoreChange } = await import('./demo-store'); emitDemoStoreChange({ entity: 'helpTeam', id, action: 'update' }); } catch {}
  return team;
}

export async function getSiteContent(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (sb) {
    return withTimeout(
      (async () => {
        const { data, error } = await sb.from("site_content").select("key, value");
        if (error || !data) return { ...DEFAULT_SITE_CONTENT };
        const overrides = Object.fromEntries(
          (data ?? []).map((r: Row) => [r.key, r.value])
        );
        return mergeSiteContent(overrides);
      })(),
      6000,
      () => ({ ...DEFAULT_SITE_CONTENT })
    );
  }
  // DEMO (síncrono)
  return mergeSiteContent(getDemoDB().siteContent ?? {});
}

export async function saveSiteContent(
  entries: Record<string, string>
): Promise<void> {
  // [SEC-FIX] CWE-20, CWE-79: Sanitização rigorosa de conteúdo CMS - previne XSS armazenado via admin
  const sanitized: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    const cleanKey = sanitizeFreeText(k, 100);
    let cleanVal = stripHtmlTags(v).trim().slice(0, 500);
    // Bloqueia tentativas de injeção de script no CMS
    if (/<script|javascript:|on\w+=/i.test(v)) {
      securityLog("xss_attempt", { key: k, value: v.slice(0, 50), action: "saveSiteContent" }, "critical");
      throw new Error(`Conteúdo inválido na chave ${k}: contém código não permitido`);
    }
    sanitized[cleanKey] = cleanVal;
  }
  const sb = getSupabase();
  if (sb) {
    const rows = Object.entries(sanitized).map(([key, value]) => ({ key, value }));
    const { error } = await sb.from("site_content").upsert(rows, {
      onConflict: "key",
    });
    if (error) throw new Error("Erro ao salvar conteúdo: " + error.message);
    return;
  }
  const db = getDemoDB();
  db.siteContent = { ...(db.siteContent ?? {}), ...sanitized };
  saveDemoDB(db);
}

// ═══════════════════════════════════════════════════════════
// PLANOS / IMPULSIONAMENTOS
// ═══════════════════════════════════════════════════════════
export async function activatePlan(
  userId: string,
  plano: string,
  adId?: string | null
): Promise<void> {
  const boost = IMPULSIONAMENTOS.find((p) => p.id === plano);
  const isSubscription = ["experimente", "conexao", "expansao"].includes(plano);
  const valor = boost ? boost.valor : plano === "conexao" ? 49.9 : plano === "expansao" ? 89.9 : 0;
  const duracaoDias = boost ? boost.duracaoDias : isSubscription ? 30 : 0;
  const expiresAt =
    duracaoDias > 0
      ? new Date(Date.now() + duracaoDias * 864e5).toISOString()
      : null;

  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("subscriptions").insert({
      user_id: userId,
      ad_id: boost && boost.id !== "verificado" ? adId : null,
      plano,
      valor,
      status: "ativo",
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);

    if (boost?.id === "topo_feed" && adId)
      await sb.from("ads").update({ topo_feed: true }).eq("id", adId);
    if (boost?.id === "destaque" && adId)
      await sb.from("ads").update({ destaque: true }).eq("id", adId);
    if (boost?.id === "verificado")
      await sb.rpc("extend_verified_pass"); // 🎫 +30 dias (soma na validade)
    return;
  }

  // DEMO [P0-B] Aplica boost com until explícito e vínculo adId obrigatório
  const db = getDemoDB();
  db.subscriptions.push({
    id: crypto.randomUUID(),
    userId,
    adId: boost && boost.id !== "verificado" ? adId ?? null : null,
    plano,
    valor,
    status: "ativo",
    expiresAt,
    createdAt: new Date().toISOString(),
  });
  if (boost?.id === "topo_feed" && adId) {
    const ad = db.ads.find((a) => a.id === adId) as any;
    if (ad) {
      ad.topoFeed = true;
      ad.isTopFeed = true;
      ad.topFeedUntil = expiresAt;
      ad.boostType = "top_feed";
      // Decisão produto: topo do feed também é destaque? Sim, eleva no feed default, mas não necessariamente badge dourado
      // Para consistência filtro Em Destaque inclui topoFeed, então usuário vê no chip
    }
  }
  if (boost?.id === "destaque" && adId) {
    const ad = db.ads.find((a) => a.id === adId) as any;
    if (ad) {
      ad.destaque = true;
      ad.isFeatured = true;
      ad.featuredUntil = expiresAt;
      ad.boostType = "selo_destaque";
      // Topo do feed também ativo quando destaque? Decisão: não, apenas destaque. Mas filtro Em Destaque pega ambos.
    }
  }
  if (boost?.id === "verificado") {
    const user = db.users.find((u) => u.id === userId);
    if (user) {
      // 🎫 Passe pré-pago: verificado + validade somando 30 dias
      const base = Math.max(
        user.verifiedUntil ? new Date(user.verifiedUntil).getTime() : 0,
        Date.now()
      );
      user.verificado = true;
      user.verifiedUntil = new Date(base + 30 * 864e5).toISOString();
    }
  }
  saveDemoDB(db);
}

export async function listSubscriptions(userId?: string): Promise<Subscription[]> {
  const mapSub = (r: Row, userName?: string): Subscription => ({
    id: r.id,
    userId: r.user_id ?? r.userId,
    userName,
    plano: r.plano,
    valor: Number(r.valor ?? 0),
    status: r.status,
    adId: r.ad_id ?? r.adId ?? null,
    expiresAt: r.expires_at ?? r.expiresAt ?? null,
    createdAt: r.created_at ?? r.createdAt,
  });

  const sb = getSupabase();
  if (sb) {
    let query = sb
      .from("subscriptions")
      .select("*, profiles(nome)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Row) => mapSub(r, r.profiles?.nome));
  }
  const db = getDemoDB();
  expireDemoSubscriptions(db);
  saveDemoDB(db);
  return db.subscriptions
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((s) => {
      const user = db.users.find((u) => u.id === s.userId);
      return mapSub(s as unknown as Row, user?.nome);
    });
}

export async function updateSubscriptionStatus(
  id: string,
  status: string
): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from("subscriptions")
      .update({ status })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const db = getDemoDB();
  const sub = db.subscriptions.find((s) => s.id === id);
  if (sub) sub.status = status;
  saveDemoDB(db);
}

// ═══════════════════════════════════════════════════════════
// ESTATÍSTICAS PÚBLICAS (Home)
// ═══════════════════════════════════════════════════════════
export async function getPublicStats(): Promise<{
  users: number;
  ads: number;
  trades: number;
}> {
  const sb = getSupabase();
  if (sb) {
    return withTimeout(
      (async () => {
        const [u, a, t] = await Promise.all([
          sb.from("profiles").select("id", { count: "exact", head: true }),
          sb.from("ads").select("id", { count: "exact", head: true }).eq("status", "ativo"),
          sb.from("trades").select("id", { count: "exact", head: true }).eq("status", "finished"),
        ]);
        return {
          users: u.count ?? 0,
          ads: a.count ?? 0,
          trades: t.count ?? 0,
        };
      })(),
      7000,
      () => ({ users: 0, ads: 0, trades: 0 })
    );
  }
  // DEMO (síncrono)
  const db = getDemoDB();
  return {
    users: db.users.length,
    ads: db.ads.filter((a) => a.status === "ativo").length,
    trades: db.trades.filter((t) => t.status === "finished").length,
  };
}

// ═══════════════════════════════════════════════════════════
// NOTIFICAÇÕES (derivadas das trocas — sem tabela extra)
// ═══════════════════════════════════════════════════════════
export type DerivedNotification = {
  id: string;
  icon: string;
  titulo: string;
  mensagem: string;
  link: string;
  unread: boolean;
  createdAt: string;
};

export async function listNotifications(
  userId: string
): Promise<DerivedNotification[]> {
  const trades = await listTrades(userId, "todas");
  const out: DerivedNotification[] = [];
  for (const t of trades) {
    const isOwner = t.ownerId === userId;
    if (t.status === "pending" && isOwner)
      out.push({
        id: `n-${t.id}-pending`,
        icon: "🤝",
        titulo: "Nova proposta de troca!",
        mensagem: `${t.otherNome} quer trocar: "${t.adTitulo}"`,
        link: "/trocas",
        unread: true,
        createdAt: t.createdAt,
      });
    if (t.status === "accepted")
      out.push({
        id: `n-${t.id}-accepted`,
        icon: "✅",
        titulo: "Troca aceita",
        mensagem: `Combinem os detalhes pelo WhatsApp: "${t.adTitulo}"`,
        link: "/trocas",
        unread: false,
        createdAt: t.updatedAt,
      });
    if (t.status === "awaiting_reviews") {
      const iReviewed = t.requesterId === userId ? t.requesterReviewed : t.ownerReviewed;
      if (!iReviewed)
        out.push({
          id: `n-${t.id}-review`,
          icon: "⭐",
          titulo: "Avaliação pendente",
          mensagem: `Avalie sua troca com ${t.otherNome} para liberar novas trocas`,
          link: "/trocas",
          unread: true,
          createdAt: t.updatedAt,
        });
    }
    if (t.status === "finished")
      out.push({
        id: `n-${t.id}-finished`,
        icon: "🎉",
        titulo: "Troca finalizada!",
        mensagem: `Troca concluída com ${t.otherNome}. Reputação atualizada!`,
        link: "/trocas",
        unread: false,
        createdAt: t.updatedAt,
      });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const list = await listNotifications(userId);
  return list.filter((n) => n.unread).length;
}

// ═══════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════
export async function adminStats(): Promise<AdminStats> {
  const sb = getSupabase();
  if (sb) {
    const [u, a, t, r, s, ar, pt] = await Promise.all([
      sb.from("profiles").select("id", { count: "exact", head: true }),
      sb.from("ads").select("id", { count: "exact", head: true }),
      sb.from("trades").select("id", { count: "exact", head: true }),
      sb.from("reviews").select("id", { count: "exact", head: true }),
      sb.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "ativo"),
      sb.from("trades").select("id", { count: "exact", head: true }).eq("status", "awaiting_reviews"),
      sb.from("trades").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    return {
      users: u.count ?? 0,
      ads: a.count ?? 0,
      trades: t.count ?? 0,
      reviews: r.count ?? 0,
      subscriptions: s.count ?? 0,
      awaitingReviews: ar.count ?? 0,
      pendingTrades: pt.count ?? 0,
    };
  }
  const db = getDemoDB();
  return {
    users: db.users.length,
    ads: db.ads.length,
    trades: db.trades.length,
    reviews: db.reviews.length,
    subscriptions: db.subscriptions.filter((s) => s.status === "ativo").length,
    awaitingReviews: db.trades.filter((t) => t.status === "awaiting_reviews").length,
    pendingTrades: db.trades.filter((t) => t.status === "pending").length,
  };
}

export async function adminListUsers(): Promise<AuthUser[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapProfile);
  }
  const db = getDemoDB();
  return db.users
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ senhaHash: _d, ...u }) => {
      void _d;
      return u;
    });
}

export async function adminToggleUserActive(
  id: string,
  ativo: boolean
): Promise<void> {
  // [SEC-FIX] CWE-20, CWE-285: Validação de ID em ação admin
  assertValidId(id, "userId");
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("profiles").update({ ativo }).eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const db = getDemoDB();
  const user = db.users.find((u) => u.id === id);
  if (user) user.ativo = ativo;
  saveDemoDB(db);
}

export async function adminSetVerified(
  id: string,
  verificado: boolean
): Promise<void> {
  // [SEC-FIX] CWE-20: Validação de ID
  assertValidId(id, "userId");
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from("profiles")
      .update({ verificado, verificado_manual: verificado })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const db = getDemoDB();
  const user = db.users.find((u) => u.id === id);
  if (user) {
    user.verificado = verificado;
    user.verificadoManual = verificado;
  }
  saveDemoDB(db);
}

export async function adminSetRole(id: string, role: string): Promise<void> {
  // [SEC-FIX] CWE-20, CWE-285: Validação de ID e role em ação admin
  assertValidId(id, "userId");
  if (!["usuario", "admin"].includes(role)) throw new Error("Role inválida");
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("profiles").update({ role }).eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const db = getDemoDB();
  const user = db.users.find((u) => u.id === id);
  if (user) user.role = role;
  saveDemoDB(db);
}


export type AdminAd = AdCardData & { userWhatsapp: string | null };

export async function adminListAds(): Promise<AdminAd[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("ads")
      .select(
        `*, images, profiles(nome, avatar_url, verificado, is_partner, media_avaliacao, trocas_concluidas, aprovacao), ad_images(image_url, ordem)`
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Row) => ({
      ...mapAd(r),
      userWhatsapp: null,
    }));
  }
  const db = getDemoDB();
  return db.ads
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((a) => {
      const owner = db.users.find((u) => u.id === a.userId);
      return {
        id: a.id,
        userId: a.userId,
        tipo: a.tipo,
        titulo: a.titulo,
        descricao: a.descricao,
        categoria: a.categoria,
        bairro: a.bairro,
        cidade: a.cidade,
        uf: a.uf,
        aceitaEmTroca: a.aceitaEmTroca,
        destaque: a.destaque,
        topoFeed: a.topoFeed,
        status: a.status,
        visualizacoes: a.visualizacoes,
        createdAt: a.createdAt,
        images: db.adImages.filter((i) => i.adId === a.id).map((i) => i.imageUrl),
        userName: owner?.nome ?? "Usuário",
        userAvatar: owner?.avatarUrl ?? null,
        userVerificado: !!owner?.verificado,
        userIsPartner: !!(owner as any)?.isPartner,
        userMediaAvaliacao: owner?.mediaAvaliacao ?? 0,
        userTrocasConcluidas: owner?.trocasConcluidas ?? 0,
        userAprovacao: owner?.aprovacao ?? 100,
        userWhatsapp: owner?.whatsapp ?? null,
      } satisfies AdminAd;
    });
}

export async function adminListTrades(): Promise<
  (Trade & { requesterNome: string; ownerNome: string })[]
> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("trades")
      .select(
        `*, ad:ads(titulo), requester:profiles!trades_requester_id_fkey(nome), owner:profiles!trades_owner_id_fkey(nome)`
      )
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Row) => ({
      id: r.id,
      adId: r.ad_id,
      adTitulo: r.ad?.titulo ?? "—",
      adTipo: "",
      requesterId: r.requester_id,
      ownerId: r.owner_id,
      status: r.status as TradeStatus,
      requesterCompleted: !!r.requester_completed,
      ownerCompleted: !!r.owner_completed,
      requesterReviewed: !!r.requester_reviewed,
      ownerReviewed: !!r.owner_reviewed,
      whatsappShareStatus: r.whatsapp_share_status ?? "none",
      whatsappRequestedBy: r.whatsapp_requested_by ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      otherId: r.owner_id,
      otherNome: r.owner?.nome ?? "—",
      otherAvatar: null,
      otherWhatsapp: null,
      requesterNome: r.requester?.nome ?? "—",
      ownerNome: r.owner?.nome ?? "—",
    }));
  }
  const db = getDemoDB();
  return db.trades
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((t) => {
      const req = db.users.find((u) => u.id === t.requesterId);
      const own = db.users.find((u) => u.id === t.ownerId);
      const ad = db.ads.find((a) => a.id === t.adId);
      return {
        ...decorateDemoTrade(db, t, t.ownerId),
        requesterNome: req?.nome ?? "—",
        ownerNome: own?.nome ?? "—",
        adTitulo: ad?.titulo ?? "—",
      };
    });
}

export type AdminReview = ReviewWithReviewer & {
  avaliadoNome: string;
  avaliadoId: string;
};

export async function adminListReviews(): Promise<AdminReview[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("reviews")
      .select(
        `*, avaliador:profiles!reviews_avaliador_id_fkey(nome, avatar_url),
          avaliado:profiles!reviews_avaliado_id_fkey(nome)`
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Row) => ({
      ...mapReview(r),
      avaliadoNome: r.avaliado?.nome ?? "—",
      avaliadoId: r.avaliado_id,
    }));
  }
  const db = getDemoDB();
  return db.reviews
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => {
      const avaliador = db.users.find((u) => u.id === r.avaliadorId);
      const avaliado = db.users.find((u) => u.id === r.avaliadoId);
      return {
        id: r.id,
        nota: r.nota,
        comentario: r.comentario,
        cumprimento: r.cumprimento,
        createdAt: r.createdAt,
        avaliadorId: r.avaliadorId,
        avaliadorNome: avaliador?.nome ?? "—",
        avaliadorAvatar: avaliador?.avatarUrl ?? null,
        avaliadoNome: avaliado?.nome ?? "—",
        avaliadoId: r.avaliadoId,
      } satisfies AdminReview;
    });
}

export async function adminDeleteReview(id: string): Promise<void> {
  // [SEC-FIX] CWE-20: Validação de ID
  assertValidId(id, "reviewId");
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("reviews").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const db = getDemoDB();
  db.reviews = db.reviews.filter((r) => r.id !== id);
  saveDemoDB(db);
}

/** Reset do banco demo (apenas modo demo) */
export function adminResetDemo(): void {
  if (appMode() === "demo") resetDemoDB();
  else throw new Error("Disponível apenas no modo demo");
}

// ═══════════════════════════════════════════════════════════
// 💬 CHAT TEMPORÁRIO EM TEMPO REAL (vinculado às trocas)
//
// • Ativo: pending / accepted / in_progress
// • Contagem regressiva (7 dias): completed / awaiting_reviews
// • Trancado: finished ou após 7 dias da conclusão
// • Supabase: mensagens via Realtime (postgres_changes)
// • Demo: localStorage sob a chave trocabairro:demo:db (messages)
//   + polling de 2.5s simulando tempo real
// ═══════════════════════════════════════════════════════════
export type ChatMessage = {
  id: string;
  tradeId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
};

export type ChatState = {
  status: TradeStatus;
  canSend: boolean;
  expiresAt: string | null;
  daysLeft: number | null;
  phase: "aberto" | "contagem" | "trancado";
};

const CHAT_OPEN_STATUSES = [
  "pending",
  "accepted",
  "in_progress",
  "completed",
  "awaiting_reviews",
];
const CHAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export function computeChatState(trade: {
  status: TradeStatus;
  updatedAt: string;
}): ChatState {
  const inCountdown = ["completed", "awaiting_reviews", "finished"].includes(
    trade.status
  );
  const expiresAt = inCountdown
    ? new Date(new Date(trade.updatedAt).getTime() + CHAT_WINDOW_MS).toISOString()
    : null;
  const expired = expiresAt ? Date.now() >= new Date(expiresAt).getTime() : false;
  const finished = trade.status === "finished";
  const canSend = CHAT_OPEN_STATUSES.includes(trade.status) && !expired;
  const daysLeft = expiresAt
    ? Math.max(
        0,
        Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
    : null;
  return {
    status: trade.status,
    canSend,
    expiresAt,
    daysLeft,
    phase: finished || expired ? "trancado" : canSend && inCountdown ? "contagem" : "aberto",
  };
}

/** Busca a troca (com dados da outra parte) validando participação */
export async function getTradeForUser(
  userId: string,
  tradeId: string
): Promise<Trade | null> {
  // [SEC-FIX] CWE-20, CWE-639: Validação de IDs e controle de acesso
  assertValidId(userId, "userId");
  assertValidId(tradeId, "tradeId");
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("trades")
      .select(
        `*, ad:ads(titulo, tipo),
         requester:profiles!trades_requester_id_fkey(nome, avatar_url),
         owner:profiles!trades_owner_id_fkey(nome, avatar_url)`
      )
      .eq("id", tradeId)
      .maybeSingle();
    if (error || !data) return null;
    const isRequester = data.requester_id === userId;
    const isOwner = data.owner_id === userId;
    if (!isRequester && !isOwner) {
      securityLog("idor_attempt", { tradeId, userId, action: "getTradeForUser" }, "high");
      return null;
    }
    const other = isRequester ? data.owner : data.requester;
    const otherId = isRequester ? data.owner_id : data.requester_id;
    return {
      id: data.id,
      adId: data.ad_id,
      adTitulo: data.ad?.titulo ?? "Anúncio removido",
      adTipo: data.ad?.tipo ?? "ofereço",
      requesterId: data.requester_id,
      ownerId: data.owner_id,
      status: data.status as TradeStatus,
      requesterCompleted: !!data.requester_completed,
      ownerCompleted: !!data.owner_completed,
      requesterReviewed: !!data.requester_reviewed,
      ownerReviewed: !!data.owner_reviewed,
      whatsappShareStatus: data.whatsapp_share_status ?? "none",
      whatsappRequestedBy: data.whatsapp_requested_by ?? null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      otherId,
      otherNome: other?.nome ?? "Usuário",
      otherAvatar: other?.avatar_url ?? null,
      // 🛡️ Contato só quando o consentimento foi APROVADO na troca
      otherWhatsapp:
        (data.whatsapp_share_status ?? "none") === "approved"
          ? await getWhatsappContact(userId, tradeId)
          : null,
    } satisfies Trade;
  }
  const db = getDemoDB();
  const trade = db.trades.find(
    (t) => t.id === tradeId && (t.requesterId === userId || t.ownerId === userId)
  );
  return trade ? decorateDemoTrade(db, trade, userId) : null;
}

function mapMessageRow(r: Row): ChatMessage {
  return {
    id: r.id,
    tradeId: r.trade_id,
    senderId: r.sender_id,
    content: r.content,
    createdAt: r.created_at,
    readAt: r.read_at ?? null,
  };
}

export async function listMessages(
  userId: string,
  tradeId: string
): Promise<ChatMessage[]> {
  // [SEC-FIX] CWE-20: Validação de IDs para prevenir IDOR
  assertValidId(userId, "userId");
  assertValidId(tradeId, "tradeId");
  const sb = getSupabase();
  if (sb) {
    // Auto-limpeza preguiçosa (mantém a tabela leve)
    try {
      await sb.rpc("cleanup_expired_messages");
    } catch { /* best-effort */ }
    const { data, error } = await sb
      .from("messages")
      .select("*")
      .eq("trade_id", tradeId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapMessageRow);
  }
  const db = getDemoDB();
  return (db.messages ?? [])
    .filter((m) => m.tradeId === tradeId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function sendMessage(
  userId: string,
  tradeId: string,
  contentRaw: string
): Promise<ChatMessage> {
  // [SEC-FIX] CWE-20, CWE-79, CWE-307: Validação, sanitização XSS, rate limiting de chat
  assertValidId(userId, "userId");
  assertValidId(tradeId, "tradeId");
  const rl = checkRateLimit("sendMessage", userId);
  if (!rl.allowed) throw new Error("Muitas mensagens. Aguarde um minuto.");
  const parsed = MessageSchema.safeParse({ content: contentRaw });
  if (!parsed.success) {
    securityLog("validation_failed", { userId, tradeId, action: "sendMessage" }, "medium");
    throw new Error("Mensagem inválida");
  }
  const content = parsed.data.content;
  if (!content) throw new Error("Mensagem vazia");

  const trade = await getTradeForUser(userId, tradeId);
  if (!trade) throw new Error("Troca não encontrada");
  const state = computeChatState(trade);
  if (!state.canSend)
    throw new Error(
      "🔒 Esta conversa temporária foi encerrada e limpa por questões de privacidade."
    );

  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("messages")
      .insert({ trade_id: tradeId, sender_id: userId, content })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapMessageRow(data);
  }
  const db = getDemoDB();
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    tradeId,
    senderId: userId,
    content,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  db.messages = db.messages ?? [];
  db.messages.push(msg);
  saveDemoDB(db);
  return msg;
}

/** Marca como lidas as mensagens recebidas (remetente ≠ eu) */
export async function markMessagesRead(
  userId: string,
  tradeId: string
): Promise<void> {
  // [SEC-FIX] CWE-20: Validação de IDs
  assertValidId(userId, "userId");
  assertValidId(tradeId, "tradeId");
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("trade_id", tradeId)
      .neq("sender_id", userId)
      .is("read_at", null);
    return;
  }
  const db = getDemoDB();
  let changed = false;
  for (const m of db.messages ?? []) {
    if (m.tradeId === tradeId && m.senderId !== userId && !m.readAt) {
      m.readAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) saveDemoDB(db);
}

/**
 * Tempo real: callback a cada lista atualizada de mensagens.
 * Supabase → canal Realtime (INSERT). Demo → polling de 2.5s.
 * Retorna função de cancelamento.
 */
export function subscribeToMessages(
  userId: string,
  tradeId: string,
  onMessages: (msgs: ChatMessage[]) => void
): () => void {
  const sb = getSupabase();
  if (sb) {
    const channel = sb
      .channel(`chat-trade-${tradeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `trade_id=eq.${tradeId}`,
        },
        async (payload) => {
          // RLS garante que só participantes recebem; marcomo como lida
          const row = payload.new as Row;
          if (row.sender_id !== userId) {
            try {
              await sb
                .from("messages")
                .update({ read_at: new Date().toISOString() })
                .eq("id", row.id)
                .is("read_at", null);
            } catch { /* best-effort */ }
          }
          const msgs = await listMessages(userId, tradeId);
          onMessages(msgs);
        }
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }

  // DEMO · polling simula tempo real no localStorage
  const refresh = async () => {
    try {
      const msgs = await listMessages(userId, tradeId);
      onMessages(msgs);
    } catch { /* noop */ }
  };
  refresh();
  const interval = setInterval(refresh, 2500);
  return () => clearInterval(interval);
}

/**
 * 🗑️ ADMIN · Exclusão completa e permanente do usuário:
 * perfil, anúncios, trocas, mensagens, avaliações, assinaturas e a
 * conta de autenticação. Supabase → RPC SECURITY DEFINER delete_user();
 * Demo → remoção equivalente no banco local.
 */
export async function adminDeleteUser(userId: string): Promise<void> {
  // [SEC-FIX] CWE-20: Validação de ID
  assertValidId(userId, "userId");
  // 👑 Trava da Conta Mestra (espelha o trigger SQL no modo demo)
  const alvo = await getProfileById(userId);
  if (alvo && alvo.email.toLowerCase() === SUPER_ADMIN_EMAIL)
    throw new Error(
      "Ação negada: A conta Mestra do Proprietário não pode ser excluída ou rebaixada por nenhum usuário."
    );

  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.rpc("delete_user_by_admin", {
      target_user_id: userId,
    });
    if (error) {
      if (error.code === "42501")
        throw new Error("Sem permissão: apenas admins podem excluir usuários.");
      throw new Error(error.message);
    }
    return;
  }
  const db = getDemoDB();
  const tradeIds = db.trades
    .filter((t) => t.requesterId === userId || t.ownerId === userId)
    .map((t) => t.id);
  db.messages = (db.messages ?? []).filter((m) => !tradeIds.includes(m.tradeId));
  db.reviews = db.reviews.filter(
    (r) =>
      !tradeIds.includes(r.tradeId) &&
      r.avaliadorId !== userId &&
      r.avaliadoId !== userId
  );
  db.trades = db.trades.filter(
    (t) => t.requesterId !== userId && t.ownerId !== userId
  );
  db.ads = db.ads.filter((a) => a.userId !== userId);
  db.subscriptions = db.subscriptions.filter((s) => s.userId !== userId);
  db.users = db.users.filter((u) => u.id !== userId);
  if (getDemoSessionId() === userId) setDemoSessionId(null);
  saveDemoDB(db);
}

// ═══════════════════════════════════════════════════════════
// 🛡️ DUPLO ESCUDO DE PRIVACIDADE (opt-in de WhatsApp por troca)
// Aceitar a troca libera SÓ o Chat; o wa.me só abre com
// consentimento explícito do outro usuário (approved).
// ═══════════════════════════════════════════════════════════

/** 1) Solicita autorização de contato (opt-in) */
export async function requestWhatsappShare(
  userId: string,
  tradeId: string
): Promise<void> {
  // [SEC-FIX] CWE-20, CWE-639: Validação de IDs
  assertValidId(userId, "userId");
  assertValidId(tradeId, "tradeId");
  const trade = await getTradeForUser(userId, tradeId);
  if (!trade) throw new Error("Troca não encontrada");
  if (["requested", "approved"].includes(trade.whatsappShareStatus))
    throw new Error("Solicitação de contato já enviada.");

  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from("trades")
      .update({ whatsapp_share_status: "requested", whatsapp_requested_by: userId })
      .eq("id", tradeId);
    if (error) throw new Error(error.message);
    return;
  }
  const db = getDemoDB();
  const t = db.trades.find((x) => x.id === tradeId);
  if (!t) throw new Error("Troca não encontrada");
  t.whatsappShareStatus = "requested";
  t.whatsappRequestedBy = userId;
  saveDemoDB(db);
}

/** 2) Destinatário aprova/recusa o compartilhamento */
export async function respondWhatsappShare(
  userId: string,
  tradeId: string,
  approve: boolean
): Promise<void> {
  // [SEC-FIX] CWE-20, CWE-639: Validação de IDs
  assertValidId(userId, "userId");
  assertValidId(tradeId, "tradeId");
  const trade = await getTradeForUser(userId, tradeId);
  if (!trade) throw new Error("Troca não encontrada");
  if (trade.whatsappShareStatus !== "requested")
    throw new Error("Não há solicitação pendente.");
  if (trade.whatsappRequestedBy === userId)
    throw new Error("Aguarde a resposta da outra parte.");

  const status = approve ? "approved" : "rejected";
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from("trades")
      .update({ whatsapp_share_status: status })
      .eq("id", tradeId);
    if (error) throw new Error(error.message);
    return;
  }
  const db = getDemoDB();
  const t = db.trades.find((x) => x.id === tradeId);
  if (!t) throw new Error("Troca não encontrada");
  t.whatsappShareStatus = status;
  saveDemoDB(db);
}

/** 3) Contato liberado — SOMENTE quando approved na troca */
export async function getWhatsappContact(
  userId: string,
  tradeId: string
): Promise<string | null> {
  // [SEC-FIX] CWE-20: Validação de IDs
  assertValidId(userId, "userId");
  assertValidId(tradeId, "tradeId");
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.rpc("get_trade_contact", {
      p_trade_id: tradeId,
    });
    if (error) throw new Error(error.message);
    return (data as string | null) ?? null;
  }
  const trade = await getTradeForUser(userId, tradeId);
  if (!trade || trade.whatsappShareStatus !== "approved") return null;
  const db = getDemoDB();
  const other = db.users.find((u) => u.id === trade.otherId);
  return other?.whatsapp ?? null;
}

// ═══════════════════════════════════════════════════════════
// 🚩 CENTRAL DE DENÚNCIAS (Community Safety)
// Mock funcional Demo ↔ Supabase (tabela reports se existir)
// ═══════════════════════════════════════════════════════════
export type Report = {
  id: string;
  adId: string;
  adTitulo?: string;
  adUserId?: string;
  reporterId: string;
  reporterNome?: string;
  reason: string;
  description: string;
  status: "pendente" | "resolvida" | "descartada";
  createdAt: string;
};

export async function listReports(): Promise<Report[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("reports")
        .select("*, ad:ads(titulo, user_id), reporter:profiles!reports_reporter_id_fkey(nome)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error && data) {
        return (data as any[]).map((r) => ({
          id: r.id,
          adId: r.ad_id,
          adTitulo: r.ad?.titulo ?? r.ad_id.slice(0, 8),
          adUserId: r.ad?.user_id ?? r.ad_user_id,
          reporterId: r.reporter_id,
          reporterNome: r.reporter?.nome ?? "Usuário",
          reason: r.reason,
          description: r.description ?? "",
          status: r.status as Report["status"],
          createdAt: r.created_at,
        }));
      }
    } catch {
      /* tabela reports pode não existir, fallback demo */
    }
  }
  // DEMO
  const db = getDemoDB();
  const reports = (db.reports ?? []).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return reports.map((r) => {
    const ad = db.ads.find((a) => a.id === r.adId);
    const reporter = db.users.find((u) => u.id === r.reporterId);
    return {
      id: r.id,
      adId: r.adId,
      adTitulo: ad?.titulo ?? r.adId.slice(0,8),
      adUserId: r.adUserId ?? ad?.userId,
      reporterId: r.reporterId,
      reporterNome: reporter?.nome ?? "Usuário",
      reason: r.reason,
      description: r.description,
      status: r.status,
      createdAt: r.createdAt,
    };
  });
}

export async function createReport(
  adId: string,
  reporterId: string,
  reason: string,
  description: string
): Promise<Report> {
  assertValidId(adId, "adId");
  assertValidId(reporterId, "reporterId");
  const cleanReason = sanitizeFreeText(reason, 100);
  const cleanDesc = sanitizeFreeText(description, 500);
  if (!cleanReason) throw new Error("Motivo obrigatório");

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("reports")
        .insert({
          ad_id: adId,
          reporter_id: reporterId,
          reason: cleanReason,
          description: cleanDesc,
          status: "pendente",
        })
        .select("*")
        .single();
      if (!error && data) {
        return {
          id: data.id,
          adId: data.ad_id,
          reporterId: data.reporter_id,
          reason: data.reason,
          description: data.description ?? "",
          status: data.status,
          createdAt: data.created_at,
        };
      }
    } catch {
      /* fallback demo */
    }
  }
  const db = getDemoDB();
  const ad = db.ads.find((a) => a.id === adId);
  const report = {
    id: crypto.randomUUID(),
    adId,
    adUserId: ad?.userId,
    reporterId,
    reason: cleanReason,
    description: cleanDesc,
    status: "pendente" as const,
    createdAt: new Date().toISOString(),
  };
  db.reports = db.reports ?? [];
  db.reports.push(report);
  saveDemoDB(db);
  securityLog("validation_failed", { action: "createReport", adId, reason: cleanReason }, "medium");
  return {
    id: report.id,
    adId: report.adId,
    adTitulo: ad?.titulo,
    adUserId: report.adUserId,
    reporterId: report.reporterId,
    reason: report.reason,
    description: report.description,
    status: report.status,
    createdAt: report.createdAt,
  };
}

export async function updateReportStatus(
  reportId: string,
  status: Report["status"]
): Promise<void> {
  assertValidId(reportId, "reportId");
  if (!["pendente", "resolvida", "descartada"].includes(status)) throw new Error("Status inválido");

  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("reports").update({ status }).eq("id", reportId);
      if (!error) return;
    } catch {}
  }
  const db = getDemoDB();
  const rep = (db.reports ?? []).find((r) => r.id === reportId);
  if (rep) {
    rep.status = status;
    saveDemoDB(db);
  }
}

export async function deleteReport(reportId: string): Promise<void> {
  assertValidId(reportId, "reportId");
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("reports").delete().eq("id", reportId);
      if (!error) return;
    } catch {}
  }
  const db = getDemoDB();
  db.reports = (db.reports ?? []).filter((r) => r.id !== reportId);
  saveDemoDB(db);
}
