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
import { getSupabase, appMode } from "./supabase";
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
import { IMPULSIONAMENTOS } from "./constants";
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
    role: r.role ?? "usuario",
    ativo: r.ativo ?? true,
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

function mapAd(r: Row): AdCardData {
  const profile = r.profiles ?? {};
  const images: string[] = (r.ad_images ?? [])
    .slice()
    .sort((a: Row, b: Row) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((i: Row) => i.image_url);
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
    destaque: !!r.destaque,
    topoFeed: !!r.topo_feed,
    status: r.status,
    visualizacoes: Number(r.visualizacoes ?? 0),
    createdAt: r.created_at,
    images,
    userName: profile.nome ?? "Usuário",
    userAvatar: profile.avatar_url ?? null,
    userVerificado: !!profile.verificado,
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
    comentario: r.comentario ?? null,
    cumprimento: r.cumprimento,
    createdAt: r.created_at,
    avaliadorId: r.avaliador_id,
    avaliadorNome: avaliador.nome ?? "Usuário",
    avaliadorAvatar: avaliador.avatar_url ?? null,
  };
}

const sanitizeSearch = (term: string) =>
  term.replace(/[%_,()]/g, "").trim();

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
// IMAGENS · compressão client + upload (Storage ou dataURL)
// ═══════════════════════════════════════════════════════════
async function compressImage(
  file: File,
  maxWidth = 900,
  quality = 0.8
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao comprimir imagem"))),
      "image/jpeg",
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Faz upload de imagem para o bucket 'ads' ou 'avatars' (Supabase)
 * ou converte em dataURL no modo demo.
 */
export async function uploadImage(
  file: File,
  kind: "ads" | "avatars",
  userId: string
): Promise<string> {
  const blob = await compressImage(file, kind === "avatars" ? 500 : 900, 0.8);

  const sb = getSupabase();
  if (sb) {
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage
      .from(kind)
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error(error.message);
    const { data } = sb.storage.from(kind).getPublicUrl(path);
    return data.publicUrl;
  }

  // MODO DEMO → dataURL no localStorage
  return blobToDataUrl(blob);
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
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const user = mapProfile(data);
    return user.ativo ? user : null;
  }

  // DEMO
  const sid = getDemoSessionId();
  if (!sid) return null;
  const db = getDemoDB();
  const user = db.users.find((u) => u.id === sid);
  if (!user || !user.ativo) return null;
  const { senhaHash: _drop, ...clean } = user;
  void _drop;
  return clean;
}

export async function login(email: string, senha: string): Promise<AuthUser> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: senha,
    });
    if (error || !data.user) throw new Error("Email ou senha incorretos");
    const { data: profile, error: pErr } = await sb
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();
    if (pErr || !profile) throw new Error("Perfil não encontrado");
    const user = mapProfile(profile);
    if (!user.ativo)
      throw new Error("Conta suspensa. Entre em contato com o suporte.");
    return user;
  }

  // DEMO
  const db = getDemoDB();
  const user = db.users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase().trim()
  );
  if (!user || user.senhaHash !== demoHash(senha))
    throw new Error("Email ou senha incorretos");
  if (!user.ativo)
    throw new Error("Conta suspensa. Entre em contato com o suporte.");
  setDemoSessionId(user.id);
  const { senhaHash: _d, ...clean } = user;
  void _d;
  return clean;
}

export type RegisterResult = {
  user: AuthUser | null;
  needsEmailConfirmation: boolean;
};

export async function register(data: RegisterInput): Promise<RegisterResult> {
  const sb = getSupabase();
  if (sb) {
    const meta = {
      nome: data.nome.trim(),
      whatsapp: data.whatsapp,
      cpf: data.cpf.replace(/\D/g, ""),
      uf: data.uf,
      cidade: data.cidade,
      bairro: data.bairro,
      tipo_perfil: data.tipoPerfil,
      categorias: data.categorias,
    };
    const { data: authData, error } = await sb.auth.signUp({
      email: data.email.toLowerCase().trim(),
      password: data.senha,
      options: { data: meta },
    });
    if (error) throw new Error(translateAuthError(error.message));

    if (!authData.session) {
      // Projeto com confirmação de e-mail ativada
      return { user: null, needsEmailConfirmation: true };
    }

    const profileValues = mapRegisterToProfile(data);
    const { data: profile, error: upErr } = await sb
      .from("profiles")
      .upsert({ id: authData.user!.id, ...profileValues })
      .select()
      .single();
    if (upErr) throw new Error("Erro ao criar perfil: " + upErr.message);
    return { user: mapProfile(profile), needsEmailConfirmation: false };
  }

  // DEMO
  const db = getDemoDB();
  const email = data.email.toLowerCase().trim();
  if (db.users.some((u) => u.email.toLowerCase() === email))
    throw new Error("Este email já está cadastrado");
  const user: AuthUser & { senhaHash: string } = {
    id: crypto.randomUUID(),
    nome: data.nome.trim(),
    email,
    senhaHash: demoHash(data.senha),
    whatsapp: data.whatsapp,
    cpf: data.cpf.replace(/\D/g, ""),
    avatarUrl: null,
    bio: null,
    uf: data.uf || "ES",
    cidade: data.cidade || "Vitória",
    bairro: data.bairro,
    tipoPerfil: data.tipoPerfil,
    categorias: data.categorias,
    mediaAvaliacao: 0,
    aprovacao: 100,
    totalAvaliacoes: 0,
    trocasConcluidas: 0,
    verificado: false,
    role: "usuario",
    ativo: true,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  saveDemoDB(db);
  setDemoSessionId(user.id);
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
}>;

export async function updateProfile(
  userId: string,
  patch: ProfilePatch
): Promise<AuthUser> {
  const row: Row = {};
  if (patch.nome !== undefined) row.nome = patch.nome;
  if (patch.bio !== undefined) row.bio = patch.bio;
  if (patch.whatsapp !== undefined) row.whatsapp = patch.whatsapp;
  if (patch.bairro !== undefined) row.bairro = patch.bairro;
  if (patch.uf !== undefined) row.uf = patch.uf;
  if (patch.cidade !== undefined) row.cidade = patch.cidade;
  if (patch.tipoPerfil !== undefined) row.tipo_perfil = patch.tipoPerfil;
  if (patch.categorias !== undefined) row.categorias = patch.categorias;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;

  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("profiles")
      .update(row)
      .eq("id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapProfile(data);
  }

  const db = getDemoDB();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error("Usuário não encontrado");
  if (patch.nome !== undefined) user.nome = patch.nome;
  if (patch.bio !== undefined) user.bio = patch.bio;
  if (patch.whatsapp !== undefined) user.whatsapp = patch.whatsapp;
  if (patch.bairro !== undefined) user.bairro = patch.bairro;
  if (patch.uf !== undefined) user.uf = patch.uf;
  if (patch.cidade !== undefined) user.cidade = patch.cidade;
  if (patch.tipoPerfil !== undefined) user.tipoPerfil = patch.tipoPerfil;
  if (patch.categorias !== undefined) user.categorias = patch.categorias;
  if (patch.avatarUrl !== undefined) user.avatarUrl = patch.avatarUrl;
  saveDemoDB(db);
  const { senhaHash: _d, ...clean } = user;
  void _d;
  return clean;
}

export async function getProfileById(id: string): Promise<AuthUser | null> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
    return data ? mapProfile(data) : null;
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
  "*, profiles(nome, avatar_url, verificado, media_avaliacao, trocas_concluidas, aprovacao), ad_images(image_url, ordem)";

export async function listAds(filters: AdFilters): Promise<{
  ads: AdCardData[];
  total: number;
  page: number;
  pages: number;
}> {
  const page = Math.max(1, filters.page ?? 1);

  const sb = getSupabase();
  if (sb) {
    return withTimeout(
      listAdsSupabase(sb, filters),
      9000,
      () => ({ ads: [] as AdCardData[], total: 0, page, pages: 1 })
    );
  }

  // DEMO (síncrono — carregamento instantâneo)
  return listAdsDemo(filters);
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
      images: db.adImages
        .filter((i) => i.adId === a.id)
        .sort((x, y) => x.ordem - y.ordem)
        .map((i) => i.imageUrl),
      userName: owner?.nome ?? "Usuário",
      userAvatar: owner?.avatarUrl ?? null,
      userVerificado: !!owner?.verificado,
      userMediaAvaliacao: owner?.mediaAvaliacao ?? 0,
      userTrocasConcluidas: owner?.trocasConcluidas ?? 0,
      userAprovacao: owner?.aprovacao ?? 100,
    } satisfies AdCardData;
  });
  saveDemoDB(db);
  return { ads: paged, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getAdById(id: string): Promise<AdDetail | null> {
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.rpc("increment_ad_views", { p_ad_id: id });
    } catch { /* best-effort */ }

    const { data, error } = await sb
      .from("ads")
      .select(`*, profiles(*), ad_images(image_url, ordem)`)
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
      userWhatsapp: data.profiles?.whatsapp ?? null,
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
    destaque: ad.destaque,
    topoFeed: ad.topoFeed,
    status: ad.status,
    visualizacoes: ad.visualizacoes,
    createdAt: ad.createdAt,
    images: db.adImages
      .filter((i) => i.adId === ad.id)
      .sort((x, y) => x.ordem - y.ordem)
      .map((i) => i.imageUrl),
    userName: owner?.nome ?? "Usuário",
    userAvatar: owner?.avatarUrl ?? null,
    userVerificado: !!owner?.verificado,
    userMediaAvaliacao: owner?.mediaAvaliacao ?? 0,
    userTrocasConcluidas: owner?.trocasConcluidas ?? 0,
    userAprovacao: owner?.aprovacao ?? 100,
    userWhatsapp: owner?.whatsapp ?? null,
    userBio: owner?.bio ?? null,
    userBairro: owner?.bairro ?? null,
    userTipoPerfil: owner?.tipoPerfil ?? "empreendedor",
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
};

export async function createAd(
  userId: string,
  input: AdInput
): Promise<string> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("ads")
      .insert({
        user_id: userId,
        tipo: input.tipo,
        titulo: input.titulo.trim(),
        descricao: input.descricao.trim(),
        categoria: input.categoria,
        bairro: input.bairro,
        cidade: input.cidade ?? "Vitória",
        uf: input.uf ?? "ES",
        aceita_em_troca: input.aceitaEmTroca.trim(),
        status: input.status ?? "ativo",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  }
  const db = getDemoDB();
  const id = crypto.randomUUID();
  db.ads.push({
    id,
    userId,
    tipo: input.tipo,
    titulo: input.titulo.trim(),
    descricao: input.descricao.trim(),
    categoria: input.categoria,
    bairro: input.bairro,
    cidade: input.cidade ?? "Vitória",
    uf: input.uf ?? "ES",
    aceitaEmTroca: input.aceitaEmTroca.trim(),
    destaque: false,
    topoFeed: false,
    status: input.status ?? "ativo",
    visualizacoes: 0,
    createdAt: new Date().toISOString(),
  });
  saveDemoDB(db);
  return id;
}

export async function updateAd(id: string, input: AdInput): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from("ads")
      .update({
        tipo: input.tipo,
        titulo: input.titulo.trim(),
        descricao: input.descricao.trim(),
        categoria: input.categoria,
        bairro: input.bairro,
        cidade: input.cidade ?? "Vitória",
        uf: input.uf ?? "ES",
        aceita_em_troca: input.aceitaEmTroca.trim(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const db = getDemoDB();
  const ad = db.ads.find((a) => a.id === id);
  if (!ad) throw new Error("Anúncio não encontrado");
  Object.assign(ad, {
    tipo: input.tipo,
    titulo: input.titulo.trim(),
    descricao: input.descricao.trim(),
    categoria: input.categoria,
    bairro: input.bairro,
    cidade: input.cidade ?? ad.cidade,
    uf: input.uf ?? ad.uf,
    aceitaEmTroca: input.aceitaEmTroca.trim(),
  });
  saveDemoDB(db);
}

export async function updateAdStatus(id: string, status: string): Promise<void> {
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

/** Extrai o caminho do objeto no Storage a partir da public URL */
function extractStoragePathFromUrl(url: string, bucket: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(
      new RegExp(`/storage/v1/object/(?:public/)?${bucket}/(.+)$`)
    );
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

export async function getAdDeletionStatus(
  adId: string
): Promise<AdDeletionStatus> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("trades")
      .select("status")
      .eq("ad_id", adId);
    return computeDeletionStatus((data ?? []).map((r: Row) => r.status));
  }
  const db = getDemoDB();
  return computeDeletionStatus(
    db.trades.filter((t) => t.adId === adId).map((t) => t.status)
  );
}

/**
 * Exclusão com trava anti-fraude. Só exclui quando NÃO existem
 * trocas ativas, avaliações pendentes ou histórico concluído.
 * Apaga também as imagens FÍSICAS no bucket 'ads' do Storage.
 */
export async function deleteAd(userId: string, adId: string): Promise<void> {
  const status = await getAdDeletionStatus(adId);
  if (!status.canDelete)
    throw new Error(status.message || "Exclusão bloqueada");

  const sb = getSupabase();
  if (sb) {
    // 1. Apaga os objetos físicos do bucket 'ads'
    const { data: imgs } = await sb
      .from("ad_images")
      .select("image_url")
      .eq("ad_id", adId);
    const paths = ((imgs ?? []) as Row[])
      .map((i) => extractStoragePathFromUrl(String(i.image_url), "ads"))
      .filter((x): x is string => !!x);
    if (paths.length > 0) {
      await sb.storage.from("ads").remove(paths);
    }

    // 2. Apaga o anúncio (RLS ads_delete_guard + FK RESTRICT
    //    em reviews protegem contra fraude no nível do banco)
    const { error } = await sb.from("ads").delete().eq("id", adId);
    if (error) {
      if (error.code === "42501")
        throw new Error(MSG_ACTIVE_TRADES);
      if (error.code === "23503")
        throw new Error(
          "Exclusão bloqueada: existem avaliações permanentes vinculadas a este anúncio."
        );
      throw new Error(error.message);
    }
    return;
  }

  // DEMO
  const db = getDemoDB();
  const ad = db.ads.find((a) => a.id === adId);
  if (!ad) throw new Error("Anúncio não encontrado");
  if (ad.userId !== userId) throw new Error("Sem permissão");
  db.ads = db.ads.filter((a) => a.id !== adId);
  db.adImages = db.adImages.filter((i) => i.adId !== adId);
  // Só sobram trocas canceladas/rejeitadas (sem avaliações) — ok remover
  db.trades = db.trades.filter((t) => t.adId !== adId);
  saveDemoDB(db);
}

/**
 * Arquivar/Desativar anúncio do feed — usado quando há trocas
 * concluídas. O histórico de trocas e as avaliações PERMANECEM
 * gravados no perfil (reputação eterna).
 */
export async function archiveAd(adId: string): Promise<void> {
  await updateAdStatus(adId, "arquivado");
}

/** Substitui as imagens de um anúncio pelas URLs informadas */
export async function setAdImages(adId: string, imageUrls: string[]): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    await sb.from("ad_images").delete().eq("ad_id", adId);
    if (imageUrls.length > 0) {
      const rows = imageUrls.map((url, i) => ({
        ad_id: adId,
        image_url: url,
        ordem: i,
      }));
      const { error } = await sb.from("ad_images").insert(rows);
      if (error) throw new Error(error.message);
    }
    return;
  }
  const db = getDemoDB();
  db.adImages = db.adImages.filter((i) => i.adId !== adId);
  imageUrls.forEach((url, i) =>
    db.adImages.push({ id: crypto.randomUUID(), adId, imageUrl: url, ordem: i })
  );
  saveDemoDB(db);
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
  const sb = getSupabase();
  if (sb) {
    return withTimeout(
      (async () => {
        const { data, error } = await sb
          .from("ads")
          .select("*, ad_images(image_url, ordem)")
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

        return (data ?? []).map((r: Row) => ({
          id: r.id,
          tipo: r.tipo,
          titulo: r.titulo,
          categoria: r.categoria,
          bairro: r.bairro,
          status: r.status,
          visualizacoes: Number(r.visualizacoes ?? 0),
          destaque: !!r.destaque,
          topoFeed: !!r.topo_feed,
          createdAt: r.created_at,
          images: (r.ad_images ?? [])
            .slice()
            .sort((a: Row, b: Row) => (a.ordem ?? 0) - (b.ordem ?? 0))
            .map((i: Row) => i.image_url),
          deletion:
            deletionMap.get(r.id) ?? computeDeletionStatus([]),
        }));
      })(),
      9000,
      () => [] as UserAd[]
    );
  }
  const db = getDemoDB();
  const deletionMap = deletionMapFromTrades(
    db.trades.map((t) => ({ adId: t.adId, status: t.status }))
  );
  return db.ads
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((a) => ({
      id: a.id,
      tipo: a.tipo,
      titulo: a.titulo,
      categoria: a.categoria,
      bairro: a.bairro,
      status: a.status,
      visualizacoes: a.visualizacoes,
      destaque: a.destaque,
      topoFeed: a.topoFeed,
      createdAt: a.createdAt,
      images: db.adImages
        .filter((i) => i.adId === a.id)
        .sort((x, y) => x.ordem - y.ordem)
        .map((i) => i.imageUrl),
      deletion: deletionMap.get(a.id) ?? computeDeletionStatus([]),
    }));
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
        message: message ?? null,
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
    message: message ?? null,
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
  const sb = getSupabase();
  if (sb) {
    let query = sb
      .from("trades")
      .select(
        `*, ad:ads(titulo, tipo),
         requester:profiles!trades_requester_id_fkey(nome, avatar_url, whatsapp),
         owner:profiles!trades_owner_id_fkey(nome, avatar_url, whatsapp)`
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
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        otherId,
        otherNome: other?.nome ?? "Usuário",
        otherAvatar: other?.avatar_url ?? null,
        otherWhatsapp: other?.whatsapp ?? null,
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
    if (!isOwner && !isRequester) throw new Error("Sem permissão");
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
    if (!isRequester && !isOwner) throw new Error("Sem permissão");
    if (isRequester && trade.requester_reviewed)
      throw new Error("Você já avaliou esta troca");
    if (isOwner && trade.owner_reviewed)
      throw new Error("Você já avaliou esta troca");

    const avaliadoId = isRequester ? trade.owner_id : trade.requester_id;
    const { error } = await sb.from("reviews").insert({
      trade_id: tradeId,
      avaliador_id: userId,
      avaliado_id: avaliadoId,
      nota: input.nota,
      comentario: input.comentario?.trim() || null,
      cumprimento: input.cumprimento,
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
  const sb = getSupabase();
  if (sb) {
    const rows = Object.entries(entries).map(([key, value]) => ({ key, value }));
    const { error } = await sb.from("site_content").upsert(rows, {
      onConflict: "key",
    });
    if (error) throw new Error("Erro ao salvar conteúdo: " + error.message);
    return;
  }
  const db = getDemoDB();
  db.siteContent = { ...(db.siteContent ?? {}), ...entries };
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
      await sb.rpc("activate_verified_badge");
    return;
  }

  // DEMO
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
    const ad = db.ads.find((a) => a.id === adId);
    if (ad) ad.topoFeed = true;
  }
  if (boost?.id === "destaque" && adId) {
    const ad = db.ads.find((a) => a.id === adId);
    if (ad) ad.destaque = true;
  }
  if (boost?.id === "verificado") {
    const user = db.users.find((u) => u.id === userId);
    if (user) user.verificado = true;
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
        `*, profiles(nome, avatar_url, verificado, media_avaliacao, trocas_concluidas, aprovacao, whatsapp), ad_images(image_url, ordem)`
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Row) => ({
      ...mapAd(r),
      userWhatsapp: r.profiles?.whatsapp ?? null,
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
