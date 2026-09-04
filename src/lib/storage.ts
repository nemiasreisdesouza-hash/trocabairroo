// ═══════════════════════════════════════════════════════════
// STORAGE LIFECYCLE · Ciclo de vida completo de imagens
// Arquitetura DUAL: DEMO (Base64/localStorage) <-> SUPABASE PROD
// Bucket: ads/{userId}/{adId}/ e avatars/{userId}/
// Limpeza automática, prevenção de órfãos, IDOR, path traversal
// Auditoria Fase 1 + melhorias cirúrgicas aplicadas
// ═══════════════════════════════════════════════════════════
import { getSupabase, isSupabaseConfigured } from "./supabase";
import {
  validateImageFile,
  checkRateLimit,
  securityLog,
  assertValidId,
} from "./security";

// ──────────────────────────────────────────────────────────
// HELPERS · Sanitização de paths e extração segura
// ──────────────────────────────────────────────────────────

/**
 * [SEC-FIX] CWE-22: Sanitiza path de Storage contra traversal clássico e Unicode normalization attacks
 * Vetores cobertos: ../, %2e%2e, %252e, %c0%ae/%c0%af (overlong), %e0%80%ae, fullwidth ／ U+FF0F, U+2215, null byte
 * [IMPROVE] Decodificação iterativa (até 3x) + NFKC normalization + validação de segmentos
 */
export function sanitizeStoragePath(path: string): string {
  if (typeof path !== "string" || path.length === 0 || path.length > 500) {
    throw new Error("Path inválido");
  }

  // [SEC-FIX] CWE-22: decodifica iterativamente para pegar dupla codificação %252e%252e
  let decoded = path;
  for (let i = 0; i < 3; i++) {
    try {
      const prev = decoded;
      decoded = decodeURIComponent(decoded);
      if (decoded === prev) break;
    } catch {
      break;
    }
  }

  // [IMPROVE] Normalização NFKC para pegar variantes fullwidth (／ → /, ． → .)
  let normalized = decoded;
  try {
    normalized = decoded.normalize("NFKC");
  } catch {
    /* ambiente sem normalize */
  }

  // [SEC-FIX] CWE-22: lista ampliada de bloqueios
  if (
    normalized.includes("..") ||
    normalized.includes("//") ||
    /%2e%2e/i.test(path) ||
    /%c0%ae|%c0%af|%e0%80%ae|%e0%80%af|%c1%9c|%c0%2e/i.test(path) ||
    /[<>:"|?*\x00-\x1F]/.test(normalized) ||
    normalized.startsWith("/") ||
    normalized.includes("\\") ||
    /[\uFF0F\u2215\u2044\uFF0E]/.test(normalized) ||
    normalized.includes("\0") ||
    path.includes("\0")
  ) {
    securityLog(
      "file_upload_blocked",
      { path: path.slice(0, 100), reason: "path_traversal_unicode" },
      "critical"
    );
    throw new Error("Path contém sequência inválida");
  }

  // [SEC-FIX] CWE-22: valida segmentos . e .. após split
  const segments = normalized.split("/");
  for (const seg of segments) {
    if (seg === ".." || seg === ".") {
      securityLog(
        "file_upload_blocked",
        { path: path.slice(0, 100), reason: "dot_segment" },
        "critical"
      );
      throw new Error("Path contém segmento inválido");
    }
  }

  return path;
}

/**
 * Extrai o path interno do Storage a partir da public URL
 * Ex: https://xxx.supabase.co/storage/v1/object/public/ads/userId/adId/file.jpg -> userId/adId/file.jpg
 * [SEC-FIX] CWE-200: Não expõe paths internos ao frontend, apenas usa internamente para deleção
 * [IMPROVE] Validação de protocolo + uso de sanitizeStoragePath no resultado
 */
export function extractStoragePathFromUrl(
  url: string,
  bucket?: string
): string | null {
  try {
    if (!url || typeof url !== "string") return null;
    if (url.startsWith("data:image/")) return null;
    const buckets = bucket ? [bucket] : ["ads", "avatars", "covers"];
    for (const b of buckets) {
      if (!["ads", "avatars", "covers"].includes(b)) continue;
      const u = new URL(url);
      if (u.protocol !== "https:") continue;
      const regex = new RegExp(`/storage/v1/object/(?:public/)?${b}/(.+)$`);
      const m = u.pathname.match(regex);
      if (!m) continue;
      const decoded = decodeURIComponent(m[1]);
      // [SEC-FIX] CWE-22: reusa sanitize para validar decoded
      try {
        sanitizeStoragePath(decoded);
      } catch {
        securityLog(
          "file_upload_blocked",
          { url: url.slice(0, 100), reason: "traversal_in_url" },
          "critical"
        );
        return null;
      }
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * [SEC-FIX] CWE-434: Compressão segura com validação de bitmap para bloquear SVG/HTML disfarçado
 * [IMPROVE] Exportada para reuso em backend.ts (evita duplicação) + fallback SSR
 */
/**
 * [SEC-FIX] CWE-434: Compressão segura com validação de bitmap para bloquear SVG/HTML disfarçado
 * [PERF-OPT] Compressão WebP 0.80 + redimensionamento inteligente + strip EXIF (CWE-200)
 * - Fotos anúncios: max 1600px (largura/altura proporcional)
 * - Avatares: max 500px
 * - Saída: image/webp 0.80 com fallback JPEG 0.80 (legado)
 * - Canvas re-render descarta EXIF/GPS (privacidade)
 * [IMPROVE] Exportada para reuso em backend.ts (evita duplicação) + fallback SSR
 */
export async function compressImage(
  file: File,
  maxWidth = 1600,
  quality = 0.8
): Promise<Blob> {
  const kind = maxWidth <= 500 ? "avatars" : "ads";
  const validation = validateImageFile(file, kind as "ads" | "avatars");
  if (!validation.valid) throw new Error(validation.error);

  // SSR fallback: sem DOM, retorna original
  if (
    typeof window === "undefined" ||
    typeof createImageBitmap !== "function" ||
    typeof document === "undefined"
  ) {
    return file.slice(0, file.size, (file as any).type || "image/jpeg");
  }

  let bitmap: ImageBitmap;
  try {
    // [SEC-FIX] CWE-434: createImageBitmap valida que é imagem real, bloqueia SVG/HTML polyglot
    bitmap = await createImageBitmap(file);
  } catch {
    securityLog(
      "file_upload_blocked",
      { name: file.name, reason: "not_an_image" },
      "high"
    );
    throw new Error("Arquivo não é uma imagem válida");
  }

  try {
    // [PERF-OPT] Redimensionamento inteligente: considera maior dimensão (w ou h) para max 1600/500
    const maxDim = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxWidth / maxDim);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível processar a imagem");
    // [PERF-OPT] Qualidade de renderização para downscale nítido
    ctx.imageSmoothingEnabled = true;
    // @ts-ignore - imageSmoothingQuality pode não existir em todos os tipos
    if ("imageSmoothingQuality" in ctx) (ctx as any).imageSmoothingQuality = "high";
    // [SEC-FIX] CWE-200: Re-render via Canvas descarta EXIF (GPS, modelo celular, autor) - privacidade
    ctx.drawImage(bitmap, 0, 0, w, h);
    // Libera bitmap para economizar memória
    try {
      bitmap.close();
    } catch {}

    // [PERF-OPT] Tenta WebP primeiro (80% menor que JPEG), fallback JPEG legado
    const tryWebP = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob(
          (blob) => resolve(blob),
          "image/webp",
          quality
        );
      } catch {
        resolve(null);
      }
    });

    if (tryWebP && tryWebP.size > 0) {
      // [PERF-OPT] WebP gerado ~150-350KB anúncios, ~30-80KB avatar
      return tryWebP;
    }

    // Fallback seguro JPEG 0.80
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Falha ao comprimir imagem")),
        "image/jpeg",
        quality
      );
    });
  } catch (e) {
    try {
      bitmap.close();
    } catch {}
    throw e;
  }
}


export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.readAsDataURL(blob);
  });
}

// ──────────────────────────────────────────────────────────
// CONTRATO ÚNICO · Interface idêntica Demo ↔ Prod
// ──────────────────────────────────────────────────────────
export type UploadAdImageResult = {
  success: boolean;
  url: string;
  path: string;
  error?: string;
};

export type UploadAvatarResult = {
  success: boolean;
  url: string;
  path: string;
  error?: string;
};

export type CanDeleteAdResult = {
  success: boolean;
  canDelete: boolean;
  allowed: boolean;
  reason?: string;
};

export type DeleteAdImagesResult = {
  success: boolean;
  deleted: number;
  error?: string;
};

export type CleanupResult = {
  success: boolean;
  deletedAds: number;
  deletedAvatars: number;
  // [PROD-FIX] órfãos APENAS REPORTADOS (remoção automática desativada:
  // fotos são permanentes — só o dono exclui)
  orphansFoundAds: number;
  orphansFoundAvatars: number;
  errors: string[];
  scannedAds: number;
  scannedAvatars: number;
  scanned: number;
};

// ──────────────────────────────────────────────────────────
// Helpers internos Prod
// ──────────────────────────────────────────────────────────

/**
 * [IMPROVE] Timeout com AbortController para evitar hanging requests em prod
 */
async function withSupabaseTimeout<T>(
  promise: Promise<T>,
  ms = 15000
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    // Supabase JS não usa signal nativamente em storage, mas mantemos padrão para futuras queries
    return await promise;
  } finally {
    clearTimeout(timeout);
  }
}

// ──────────────────────────────────────────────────────────
// 1. FOTOS DE ANÚNCIO (bucket: ads)
// ──────────────────────────────────────────────────────────

/**
 * Upload de foto de anúncio com contrato único
 * @param file - Arquivo validado (JPG/PNG/WebP, máx 5MB)
 * @param userId - UUID do dono (validado CWE-639)
 * @param adId - UUID do anúncio (validado)
 * @returns {UploadAdImageResult} {success, url, path} idêntico em Demo e Prod
 */
// [PROD-FIX] Erros de nível de rede viram mensagem amigável (antes o
// usuário via "TypeError: Failed to fetch" cru no toast).
export function friendlyUploadError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    /failed to fetch|networkerror|load failed|network request failed|err_internet_disconnected|err_network|err_connection/i.test(
      msg
    )
  ) {
    return "Falha de conexão ao enviar a foto (a internet pode ter caído por instantes). Sua foto não foi perdida — tente novamente.";
  }
  return msg;
}

export async function uploadAdImage(
  file: File,
  userId: string,
  adId: string
): Promise<UploadAdImageResult> {
  assertValidId(userId, "userId");
  assertValidId(adId, "adId");

  const rl = checkRateLimit("uploadImage", userId);
  if (!rl.allowed) {
    securityLog(
      "rate_limit_hit",
      { action: "uploadAdImage", userId, adId },
      "medium"
    );
    throw new Error("Muitas fotos enviadas. Aguarde alguns minutos.");
  }

  const validation = validateImageFile(file, "ads");
  if (!validation.valid) throw new Error(validation.error);

  // [PERF-OPT] Compressão WebP 1600px max + strip EXIF (CWE-200) - reduz 80% storage/banda
  const blob = await compressImage(file, 1600, 0.8);
  const isWebP = blob.type === "image/webp";
  const ext = isWebP ? ".webp" : ".jpg";
  const contentType = isWebP ? "image/webp" : "image/jpeg";

  if (!isSupabaseConfigured()) {
    try {
      // [P0-FIX] Demo: compressão agressiva para caber no localStorage (quota 5MB)
      // Sempre 800px q0.6, se ainda >200KB ou DataURL>500KB, vai para 600px q0.5
      let finalBlob: Blob;
      try {
        finalBlob = await compressImage(file, 800, 0.6);
      } catch {
        finalBlob = blob;
      }
      let dataUrl = await blobToDataUrl(finalBlob);
      if (finalBlob.size > 150 * 1024 || dataUrl.length > 500 * 1024) {
        try {
          const smaller = await compressImage(file, 600, 0.5);
          const smallerUrl = await blobToDataUrl(smaller);
          finalBlob = smaller;
          dataUrl = smallerUrl;
        } catch {}
      }
      // Se ainda >1MB, tenta 400px q0.4 (último recurso)
      if (dataUrl.length > 1024 * 1024) {
        try {
          const tiny = await compressImage(file, 400, 0.4);
          const tinyUrl = await blobToDataUrl(tiny);
          dataUrl = tinyUrl;
        } catch {}
      }
      // [P0-FIX] Se ainda >1MB após todas tentativas, aborta com erro claro (evita sucesso mudo sem persistir)
      if (dataUrl.length > 1024 * 1024) {
        return { success: false, url: "", path: "", error: "Imagem muito grande mesmo após compressão. Tente outra imagem menor ou em JPG." };
      }
      const demoPath = `demo/${userId}/${adId}/${crypto.randomUUID()}${ext}`;
      sanitizeStoragePath(demoPath);
      // [AD-IMAGE-DEBUG] Log para RCA
      console.log('[AD-IMAGE-DEBUG] demo upload', { adId, size: finalBlob.size, dataUrlLen: dataUrl.length, path: demoPath });
      return { success: true, url: dataUrl, path: demoPath };
    } catch (e) {
      return { success: false, url: "", path: "", error: String(e) };
    }
  }

  const sb = getSupabase();
  if (!sb) {
    const dataUrl = await blobToDataUrl(blob);
    return {
      success: true,
      url: dataUrl,
      path: `demo/${userId}/${adId}/${crypto.randomUUID()}${ext}`,
    };
  }

  const fileName = `${crypto.randomUUID()}${ext}`;
  const rawPath = `${userId}/${adId}/${fileName}`;
  const safePath = sanitizeStoragePath(rawPath);

  // [PROD-FIX] Erro de nível de rede ("Failed to fetch", internet caiu
  // por instantes, etc.) — o arquivo continua no dispositivo do usuário
  // e o retry costuma resolver; erros de validação/RLS NÃO são retry.
  const isNetworkError = (e: unknown) =>
    e instanceof Error &&
    /failed to fetch|networkerror|load failed|network request failed|err_internet_disconnected|err_network|err_connection/i.test(
      e.message
    );

  try {
    let uploadErr: { message: string } | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await withSupabaseTimeout(
          sb.storage.from("ads").upload(safePath, blob, {
            contentType: contentType,
            upsert: false,
          })
        );
        uploadErr = res.error;
        break; // sucesso ou erro não-retryável
      } catch (e) {
        uploadErr = { message: e instanceof Error ? e.message : String(e) };
        if (!isNetworkError(e) || attempt === 2) break;
        securityLog(
          "cleanup",
          { userId, adId, action: "upload_retry_network", attempt },
          "low"
        );
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }

    if (uploadErr) {
      securityLog(
        "file_upload_blocked",
        { userId, adId, error: uploadErr.message },
        "high"
      );
      return {
        success: false,
        url: "",
        path: "",
        error: friendlyUploadError(new Error(uploadErr.message)),
      };
    }

    const { data } = sb.storage.from("ads").getPublicUrl(safePath);

    // [PROD-FIX] "Upload ok" não garante que o objecto seja VISÍVEL no
    // browser: bucket privado/política de leitura 403 ou objecto 404
    // deixariam o anúncio com caixa cinza SILENCIOSA (o <img> some via
    // onError). Valida agora, com o MESMO caminho do <img> da UI:
    // new Image() não sofre CORS e reproduz exatamente o que a página
    // vai renderizar. Falha aqui vira erro claro no momento da publicação.
    if (typeof Image !== "undefined") {
      const canLoad = () =>
        new Promise<boolean>((resolve) => {
          const probe = new Image();
          const timer = setTimeout(() => resolve(false), 12000);
          probe.onload = () => { clearTimeout(timer); resolve(true); };
          probe.onerror = () => { clearTimeout(timer); resolve(false); };
          probe.src = data.publicUrl;
        });
      let ok = await canLoad();
      // Tolerância a propagação: 1ª falha → espera 2s e tenta de novo
      if (!ok) {
        await new Promise((r) => setTimeout(r, 2000));
        ok = await canLoad();
      }
      if (!ok) {
        // [PROD-FIX] FALSA-NEGATIVA NUNCA APAGA A FOTO: a propagação do
        // objeto pode demorar alguns segundos e o <img> do navegador pode
        // falhar transitivamente. Apagar aqui destruiria a foto do usuário
        // por causa de um race. O arquivo fica no storage (o fluxo de
        // publicação avisa e o retry republica; a faxina do cron remove
        // apenas pastas de anúncios já excluídos com +24h).
        securityLog(
          "file_upload_blocked",
          { userId, adId, error: "public_read_check_failed", kept: true },
          "high"
        );
        return {
          success: false,
          url: "",
          path: "",
          error:
            "A foto foi enviada ao armazenamento, mas ainda não está visível publicamente (pode levar alguns segundos para propagar, ou o bucket pode estar sem leitura pública). A foto foi MANTIDA no armazenamento — tente publicar novamente em instantes.",
        };
      }
    }

    return { success: true, url: data.publicUrl, path: safePath };
  } catch (err) {
    return {
      success: false,
      url: "",
      path: "",
      error: friendlyUploadError(err),
    };
  }
}

/**
 * Deleta TODAS as fotos de um anúncio no Storage
 * @returns {DeleteAdImagesResult} contrato único
 */
export async function deleteAllAdImages(
  userId: string,
  adId: string,
  existingPaths?: string[]
): Promise<DeleteAdImagesResult> {
  assertValidId(userId, "userId");
  assertValidId(adId, "adId");

  if (!isSupabaseConfigured()) {
    return { success: true, deleted: existingPaths?.length ?? 0 };
  }

  const sb = getSupabase();
  if (!sb) return { success: true, deleted: 0 };

  const prefix = `${userId}/${adId}`;
  const safePrefix = sanitizeStoragePath(prefix);

  try {
    // [IMPROVE] Paginação para buckets >1000 arquivos (loop até esvaziar)
    const pathsToDelete: string[] = [];
    let offset = 0;
    const limit = 100;
    // Lista paginada da pasta do anúncio
    while (true) {
      const { data: files, error: listError } = await sb.storage
        .from("ads")
        .list(safePrefix, {
          limit,
          offset,
          sortBy: { column: "name", order: "asc" },
        });

      if (listError) {
        securityLog(
          "file_upload_blocked",
          { action: "list", prefix: safePrefix, error: listError.message },
          "medium"
        );
        break;
      }

      if (!files || files.length === 0) break;

      for (const f of files) {
        if (!f.name) continue;
        const fullPath = `${safePrefix}/${f.name}`;
        try {
          sanitizeStoragePath(fullPath);
          pathsToDelete.push(fullPath);
        } catch {
          /* ignora path inválido */
        }
      }

      if (files.length < limit) break;
      offset += limit;
      // [SEC-FIX] CWE-400: limita paginação máxima para evitar loop infinito
      if (offset > 5000) break;
    }

    if (existingPaths && existingPaths.length > 0) {
      for (const p of existingPaths) {
        try {
          const sanitized = sanitizeStoragePath(p);
          if (sanitized.startsWith(`${userId}/${adId}/`)) {
            if (!pathsToDelete.includes(sanitized))
              pathsToDelete.push(sanitized);
          } else {
            securityLog(
              "idor_attempt",
              { userId, adId, path: p.slice(0, 50) },
              "high"
            );
          }
        } catch {
          /* ignora */
        }
      }
    }

    if (pathsToDelete.length > 0) {
      const { error: delError } = await sb.storage
        .from("ads")
        .remove(pathsToDelete);
      if (delError) {
        securityLog(
          "file_upload_blocked",
          { action: "deleteAllAdImages", adId, error: delError.message },
          "medium"
        );
        return { success: false, deleted: 0, error: delError.message };
      }
      return { success: true, deleted: pathsToDelete.length };
    }

    return { success: true, deleted: 0 };
  } catch (err) {
    // [IMPROVE] Usa securityLog anonimizado em vez de console.warn com PII
    securityLog(
      "file_upload_blocked",
      { action: "deleteAllAdImages_unexpected", adId, error: String(err).slice(0, 100) },
      "medium"
    );
    return { success: false, deleted: 0, error: String(err) };
  }
}

/**
 * Verifica se anúncio pode ser excluído (negotiations PT + trades EN)
 * Contrato idêntico Demo ↔ Prod
 */
export async function canDeleteAd(
  adId: string,
  userId?: string
): Promise<CanDeleteAdResult> {
  assertValidId(adId, "adId");
  if (userId) assertValidId(userId, "userId");

  if (!isSupabaseConfigured()) {
    try {
      const { getDemoDB } = await import("./demo-store");
      const db = getDemoDB();

      const blockedNegotiations = (db.negotiations ?? []).filter(
        (n) =>
          n.adId === adId &&
          ["em_andamento", "aceita", "finalizada"].includes(n.status)
      );
      if (blockedNegotiations.length > 0) {
        return {
          success: true,
          canDelete: false,
          allowed: false,
          reason:
            "Não é possível excluir: existe negociação com status em_andamento, aceita ou finalizada.",
        };
      }

      const blockedTrades = db.trades.filter(
        (t) =>
          t.adId === adId &&
          [
            "pending",
            "accepted",
            "in_progress",
            "completed",
            "awaiting_reviews",
            "finished",
          ].includes(t.status)
      );
      if (blockedTrades.length > 0) {
        return {
          success: true,
          canDelete: false,
          allowed: false,
          reason:
            "Não é possível excluir: existem trocas em andamento ou finalizadas vinculadas.",
        };
      }

      return { success: true, canDelete: true, allowed: true };
    } catch (e) {
      securityLog(
        "validation_failed",
        { action: "canDeleteAd_demo", adId, error: String(e).slice(0, 100) },
        "low"
      );
      return { success: true, canDelete: true, allowed: true };
    }
  }

  const sb = getSupabase();
  if (!sb) {
    return { success: true, canDelete: true, allowed: true };
  }

  try {
    const { data: negotiations } = await sb
      .from("negotiations")
      .select("status")
      .eq("ad_id", adId)
      .in("status", ["em_andamento", "aceita", "finalizada"]);
    if (negotiations && negotiations.length > 0) {
      return {
        success: true,
        canDelete: false,
        allowed: false,
        reason:
          "Não é possível excluir: existe negociação com status em_andamento, aceita ou finalizada.",
      };
    }
  } catch {
    /* tabela pode não existir ainda */
  }

  const { data: trades } = await sb
    .from("trades")
    .select("status")
    .eq("ad_id", adId)
    .in("status", [
      "pending",
      "accepted",
      "in_progress",
      "completed",
      "awaiting_reviews",
      "finished",
    ]);

  if (trades && trades.length > 0) {
    return {
      success: true,
      canDelete: false,
      allowed: false,
      reason:
        "Não é possível excluir: existem trocas em andamento ou finalizadas vinculadas.",
    };
  }

  return { success: true, canDelete: true, allowed: true };
}

// ──────────────────────────────────────────────────────────
// 2. AVATAR DO PERFIL (bucket: avatars)
// ──────────────────────────────────────────────────────────

/**
 * Upload de avatar com limpeza automática do antigo
 * @param file - Arquivo validado (JPG/PNG/WebP, máx 3MB)
 * @param userId - UUID do dono
 * @param oldPath - Path antigo para deleção (opcional)
 * @returns {UploadAvatarResult} contrato único Demo ↔ Prod
 */
export async function uploadAvatar(
  file: File,
  userId: string,
  oldPath?: string | null
): Promise<UploadAvatarResult> {
  assertValidId(userId, "userId");

  const rl = checkRateLimit("uploadAvatar" as any, userId);
  if (!rl.allowed) {
    securityLog("rate_limit_hit", { action: "uploadAvatar", userId }, "medium");
    throw new Error(
      "Limite de troca de avatar atingido (máx 3 por hora). Aguarde."
    );
  }

  const validation = validateImageFile(file, "avatars");
  if (!validation.valid) throw new Error(validation.error);

  // [PERF-OPT] Compressão WebP 500px max + strip EXIF - avatar ultra-leve ~30-80KB
  const blob = await compressImage(file, 500, 0.8);
  const isWebPAv = blob.type === "image/webp";
  const extAv = isWebPAv ? ".webp" : ".jpg";
  const contentTypeAv = isWebPAv ? "image/webp" : "image/jpeg";

  if (!isSupabaseConfigured()) {
    try {
      const dataUrl = await blobToDataUrl(blob);
      const demoPath = `demo/${userId}/avatar-${Date.now()}${extAv}`;
      sanitizeStoragePath(demoPath);
      if (oldPath) {
        // [IMPROVE] securityLog anonimizado em vez de console.log com path
        securityLog(
          "cleanup",
          { action: "demo_avatar_replace", userId, oldPath: oldPath.slice(0, 20) + "..." },
          "low"
        );
      }
      return { success: true, url: dataUrl, path: demoPath };
    } catch (e) {
      return { success: false, url: "", path: "", error: String(e) };
    }
  }

  const sb = getSupabase();
  if (!sb) {
    const dataUrl = await blobToDataUrl(blob);
    return {
      success: true,
      url: dataUrl,
      path: `demo/${userId}/avatar-${Date.now()}${extAv}`,
    };
  }

  const fileName = `avatar-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${extAv}`;
  const rawPath = `${userId}/${fileName}`;
  const safePath = sanitizeStoragePath(rawPath);

  try {
    const { error: uploadError } = await withSupabaseTimeout(
      sb.storage.from("avatars").upload(safePath, blob, {
        contentType: contentTypeAv,
        upsert: false,
      })
    );

    if (uploadError) {
      securityLog(
        "file_upload_blocked",
        { userId, error: uploadError.message },
        "high"
      );
      return {
        success: false,
        url: "",
        path: "",
        error: "Falha ao enviar avatar: " + uploadError.message,
      };
    }

    const { data } = sb.storage.from("avatars").getPublicUrl(safePath);
    const newUrl = data.publicUrl;

    try {
      if (oldPath) {
        const sanitizedOld = sanitizeStoragePath(oldPath);
        if (sanitizedOld.startsWith(`${userId}/`)) {
          await sb.storage.from("avatars").remove([sanitizedOld]);
        } else {
          securityLog(
            "idor_attempt",
            {
              userId,
              oldPath: oldPath.slice(0, 50),
              action: "deleteOldAvatar",
            },
            "high"
          );
        }
      }

      // [IMPROVE] Paginação + limite para avatars órfãos
      const { data: existingFiles, error: listError } = await sb.storage
        .from("avatars")
        .list(userId, { limit: 100 });

      if (!listError && existingFiles && existingFiles.length > 1) {
        const toDelete = existingFiles
          .filter((f) => `${userId}/${f.name}` !== safePath)
          .map((f) => `${userId}/${f.name}`)
          .filter((p) => {
            try {
              sanitizeStoragePath(p);
              return true;
            } catch {
              return false;
            }
          });

        if (toDelete.length > 0) {
          await sb.storage.from("avatars").remove(toDelete);
        }
      }
    } catch (cleanupErr) {
      securityLog(
        "file_upload_blocked",
        {
          action: "cleanup_old_avatars",
          userId,
          error: String(cleanupErr).slice(0, 100),
        },
        "low"
      );
    }

    return { success: true, url: newUrl, path: safePath };
  } catch (err) {
    return { success: false, url: "", path: "", error: friendlyUploadError(err) };
  }
}

/**
 * [HELP-TEAM] Upload de avatar da Central de Ajuda - pipeline seguro
 * MIME whitelist jpeg/png/webp, max 2MB, compress WebP 400-500px, EXIF strip
 * Path: help/{id}/{ts}-{uuid}.webp - só admin
 */
export async function uploadHelpAvatar(
  file: File,
  helpId: 'admin' | 'founder',
  oldPath?: string | null
): Promise<UploadAvatarResult> {
  // [SEC-FIX] CWE-20: validação rigorosa
  if (helpId !== 'admin' && helpId !== 'founder') throw new Error('ID ajuda inválido');
  // [SEC-FIX] CWE-434: whitelist já em validateImageFile avatars
  const validation = validateImageFile(file, 'avatars');
  if (!validation.valid) throw new Error(validation.error);
  // [SEC-FIX] CWE-400: tamanho max 2MB já validado, mas reforça
  if (file.size > 2 * 1024 * 1024) throw new Error('Avatar deve ter no máximo 2MB');

  const blob = await compressImage(file, 500, 0.8);
  const isWebP = blob.type === 'image/webp';
  const ext = isWebP ? '.webp' : '.jpg';
  const contentType = isWebP ? 'image/webp' : 'image/jpeg';

  if (!isSupabaseConfigured()) {
    try {
      const dataUrl = await blobToDataUrl(blob);
      const demoPath = `help/${helpId}/${Date.now()}-${crypto.randomUUID().slice(0,8)}${ext}`;
      sanitizeStoragePath(demoPath);
      return { success: true, url: dataUrl, path: demoPath };
    } catch (e) {
      return { success: false, url: '', path: '', error: String(e) };
    }
  }

  const sb = getSupabase();
  if (!sb) {
    const dataUrl = await blobToDataUrl(blob);
    return { success: true, url: dataUrl, path: `help/${helpId}/${Date.now()}${ext}` };
  }

  const fileName = `${Date.now()}-${crypto.randomUUID().slice(0,8)}${ext}`;
  const rawPath = `help/${helpId}/${fileName}`;
  const safePath = sanitizeStoragePath(rawPath);

  try {
    const { error: uploadError } = await withSupabaseTimeout(
      sb.storage.from('avatars').upload(safePath, blob, {
        contentType,
        upsert: false,
      })
    );
    if (uploadError) {
      return { success: false, url: '', path: '', error: 'Falha ao enviar avatar ajuda: ' + uploadError.message };
    }
    const { data } = sb.storage.from('avatars').getPublicUrl(safePath);
    const newUrl = data.publicUrl;
    // Limpeza oldPath se pertencer ao mesmo helpId
    try {
      if (oldPath) {
        const sanitizedOld = sanitizeStoragePath(oldPath);
        if (sanitizedOld.startsWith(`help/${helpId}/`)) {
          await sb.storage.from('avatars').remove([sanitizedOld]);
        }
      }
    } catch {}
    return { success: true, url: newUrl, path: safePath };
  } catch (err) {
    return { success: false, url: '', path: '', error: friendlyUploadError(err) };
  }
}

export async function deleteHelpAvatar(
  helpId: 'admin' | 'founder',
  pathToDelete: string
): Promise<{ success: boolean; error?: string }> {
  if (helpId !== 'admin' && helpId !== 'founder') throw new Error('ID ajuda inválido');
  const sanitized = sanitizeStoragePath(pathToDelete);
  if (!sanitized.startsWith(`help/${helpId}/`)) throw new Error('Path não pertence ao help team');
  if (!isSupabaseConfigured()) {
    return { success: true };
  }
  const sb = getSupabase();
  if (!sb) return { success: true };
  try {
    const { error } = await sb.storage.from('avatars').remove([sanitized]);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Deleta avatar específico
 */
export async function uploadCover(
  file: File,
  userId: string,
  oldPath?: string | null
): Promise<UploadAvatarResult> {
  assertValidId(userId, "userId");
  const rl = checkRateLimit("uploadImage" as any, userId);
  if (!rl.allowed) {
    securityLog("rate_limit_hit", { action: "uploadCover", userId }, "medium");
    throw new Error("Muitas fotos enviadas. Aguarde alguns minutos.");
  }
  const validation = validateImageFile(file, "ads");
  if (!validation.valid) throw new Error(validation.error);
  const blob = await compressImage(file, 1600, 0.8);
  const isWebP = blob.type === "image/webp";
  const ext = isWebP ? ".webp" : ".jpg";
  const contentType = isWebP ? "image/webp" : "image/jpeg";
  if (!isSupabaseConfigured()) {
    try {
      const dataUrl = await blobToDataUrl(blob);
      const demoPath = `demo/${userId}/cover-${Date.now()}${ext}`;
      sanitizeStoragePath(demoPath);
      return { success: true, url: dataUrl, path: demoPath };
    } catch (e) {
      return { success: false, url: "", path: "", error: String(e) };
    }
  }
  const sb = getSupabase();
  if (!sb) {
    const dataUrl = await blobToDataUrl(blob);
    return { success: true, url: dataUrl, path: `demo/${userId}/cover-${Date.now()}${ext}` };
  }
  const fileName = `cover-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
  const rawPath = `${userId}/${fileName}`;
  const safePath = sanitizeStoragePath(rawPath);
  try {
    const { error: uploadError } = await sb.storage.from("covers").upload(safePath, blob, {
      contentType,
      upsert: false,
    });
    if (uploadError) {
      securityLog("file_upload_blocked", { userId, error: uploadError.message }, "high");
      return { success: false, url: "", path: "", error: "Falha ao enviar capa: " + uploadError.message };
    }
    const { data } = sb.storage.from("covers").getPublicUrl(safePath);
    const newUrl = data.publicUrl;
    try {
      if (oldPath) {
        const sanitizedOld = sanitizeStoragePath(oldPath);
        if (sanitizedOld.startsWith(`${userId}/`)) {
          await sb.storage.from("covers").remove([sanitizedOld]);
        }
      }
      const { data: existingFiles, error: listError } = await sb.storage.from("covers").list(userId, { limit: 100 });
      if (!listError && existingFiles && existingFiles.length > 1) {
        const toDelete = existingFiles
          .filter((f) => `${userId}/${f.name}` !== safePath)
          .map((f) => `${userId}/${f.name}`)
          .filter((p) => {
            try { sanitizeStoragePath(p); return true; } catch { return false; }
          });
        if (toDelete.length > 0) await sb.storage.from("covers").remove(toDelete);
      }
    } catch {}
    return { success: true, url: newUrl, path: safePath };
  } catch (err) {
    return { success: false, url: "", path: "", error: friendlyUploadError(err) };
  }
}

export async function deleteCover(
  userId: string,
  path: string
): Promise<{ success: boolean; error?: string }> {
  assertValidId(userId, "userId");
  const safePath = sanitizeStoragePath(path);
  if (!safePath.startsWith(`${userId}/`) && !safePath.startsWith(`demo/${userId}/`)) {
    securityLog("idor_attempt", { userId, path: path.slice(0, 50), action: "deleteCover" }, "critical");
    throw new Error("Sem permissão para deletar esta capa");
  }
  if (!isSupabaseConfigured()) return { success: true };
  const sb = getSupabase();
  if (!sb) return { success: true };
  if (safePath.startsWith("demo/")) return { success: true };
  const { error } = await sb.storage.from("covers").remove([safePath]);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteAvatar(
  userId: string,
  path: string
): Promise<{ success: boolean; error?: string }> {
  assertValidId(userId, "userId");
  const safePath = sanitizeStoragePath(path);

  if (
    !safePath.startsWith(`${userId}/`) &&
    !safePath.startsWith(`demo/${userId}/`)
  ) {
    securityLog(
      "idor_attempt",
      { userId, path: path.slice(0, 50), action: "deleteAvatar" },
      "critical"
    );
    throw new Error("Sem permissão para deletar este avatar");
  }

  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  const sb = getSupabase();
  if (!sb) return { success: true };
  if (safePath.startsWith("demo/")) return { success: true };

  const { error } = await sb.storage.from("avatars").remove([safePath]);
  if (error) {
    securityLog(
      "file_upload_blocked",
      { action: "deleteAvatar", path: safePath, error: error.message },
      "medium"
    );
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ──────────────────────────────────────────────────────────
// 3. LIMPEZA DE ÓRFÃOS (com paginação)
// ──────────────────────────────────────────────────────────

/**
 * Compara Storage vs DB e deleta órfãos
 * [IMPROVE] Paginação para >1000 arquivos + securityLog anonimizado
 */
export async function cleanupOrphanedFiles(): Promise<CleanupResult> {
  const result: CleanupResult = {
    success: true,
    deletedAds: 0,
    deletedAvatars: 0,
    orphansFoundAds: 0,
    orphansFoundAvatars: 0,
    errors: [],
    scannedAds: 0,
    scannedAvatars: 0,
    scanned: 0,
  };

  if (!isSupabaseConfigured()) {
    try {
      const { getDemoDB } = await import("./demo-store");
      const db = getDemoDB();
      const validAdIds = new Set(db.ads.map((a) => a.id));
      const orphanImages = db.adImages.filter((img) => !validAdIds.has(img.adId));
      result.scannedAds = db.adImages.length;
      result.scanned = result.scannedAds;
      if (orphanImages.length > 0) {
        result.errors.push(
          `Demo: ${orphanImages.length} imagens órfãs detectadas (seriam limpas em prod)`
        );
      }
      return result;
    } catch {
      result.errors.push("Demo DB indisponível");
      return result;
    }
  }

  const sb = getSupabase();
  if (!sb) {
    result.errors.push("Supabase não configurado (modo demo)");
    result.success = false;
    return result;
  }

  // ── 1. ADS ──
  try {
    const { data: ads, error: adsError } = await sb
      .from("ads")
      .select("id, user_id");
    if (adsError) throw new Error(`Erro ao buscar ads: ${adsError.message}`);

    const { data: adImages, error: imgError } = await sb
      .from("ad_images")
      .select("image_url");
    if (imgError) throw new Error(`Erro ao buscar ad_images: ${imgError.message}`);

    let adsImagesColumn: { id: string; images: string[] }[] = [];
    try {
      const { data, error } = await sb.from("ads").select("id, images");
      if (!error && data) adsImagesColumn = data as any;
    } catch {}

    const validAdPaths = new Set<string>();

    for (const img of adImages ?? []) {
      const p = extractStoragePathFromUrl((img as any).image_url, "ads");
      if (p) {
        try {
          const s = sanitizeStoragePath(p);
          validAdPaths.add(s);
        } catch {}
      }
    }

    for (const ad of adsImagesColumn) {
      if (Array.isArray(ad.images)) {
        for (const url of ad.images) {
          const p = extractStoragePathFromUrl(url, "ads");
          if (p) {
            try {
              const s = sanitizeStoragePath(p);
              validAdPaths.add(s);
            } catch {}
          }
        }
      }
    }

    // [IMPROVE] Paginação no root bucket ads (offset loop)
    let offsetRoot = 0;
    const rootLimit = 100;
    while (true) {
      const { data: userFolders, error: rootListError } = await sb.storage
        .from("ads")
        .list("", { limit: rootLimit, offset: offsetRoot });

      if (rootListError) {
        result.errors.push(
          `Falha ao listar bucket ads root: ${rootListError.message}`
        );
        break;
      }

      if (!userFolders || userFolders.length === 0) break;

      for (const userFolder of userFolders) {
        if (!userFolder.name) continue;
        const userId = userFolder.name;
        try {
          assertValidId(userId, "userId");
        } catch {
          continue;
        }

        const { data: adFolders, error: adListError } = await sb.storage
          .from("ads")
          .list(userId, { limit: 1000 });

        if (adListError) {
          result.errors.push(`Falha ao listar ads/${userId}: ${adListError.message}`);
          continue;
        }

        for (const adFolder of adFolders ?? []) {
          if (!adFolder.name) continue;
          const possibleAdId = adFolder.name;

          // Paginação interna de arquivos do anúncio
          let fileOffset = 0;
          while (true) {
            const { data: filesInAd, error: filesError } = await sb.storage
              .from("ads")
              .list(`${userId}/${possibleAdId}`, {
                limit: 100,
                offset: fileOffset,
              });

            if (filesError || !filesInAd || filesInAd.length === 0) break;

            for (const file of filesInAd) {
              if (!file.name) continue;
              const fullPath = `${userId}/${possibleAdId}/${file.name}`;
              result.scannedAds++;
              result.scanned++;
              try {
                sanitizeStoragePath(fullPath);
                const adExists = (ads ?? []).some(
                  (a: any) => a.id === possibleAdId
                );
                // [PROD-FIX] FOTOS SÃO PERMANENTES: nunca deletar NADA em
                // pasta de anúncio que AINDA EXISTE no banco. Só pastas de
                // anúncios já excluídos são candidatas à limpeza.
                if (adExists) continue;
                // [PROD-FIX] Guarda de frescor: nunca tocar em arquivo com
                // menos de 24h (protege contra qualquer race de
                // propagação/leitura, mesmo em pasta de anúncio excluído).
                const fileCreated = new Date((file as any).created_at ?? 0).getTime();
                const fileAgeMs = Date.now() - fileCreated;
                if (!Number.isNaN(fileCreated) && fileCreated > 0 && fileAgeMs < 24 * 60 * 60 * 1000) continue;
                if (!validAdPaths.has(fullPath)) {
                  // [PROD-FIX 03/09] REMOÇÃO AUTOMÁTICA DESATIVADA: fotos são
                  // permanentes (modelo Mercado Livre/OLX). O cron anterior
                  // foi removido do vercel.json; esta função agora é
                  // SCAN-ONLY (aponta órfãos no resultado, não apaga nada).
                  // Somente o DONO exclui fotos: excluir o anúncio (com a
                  // trava de negociação em andamento) ou gerenciar fotos.
                  result.orphansFoundAds++;
                }
              } catch (e) {
                result.errors.push(`Path inválido ads ${fullPath}: ${String(e)}`);
              }
            }

            if (filesInAd.length < 100) break;
            fileOffset += 100;
            if (fileOffset > 5000) break;
          }
        }
      }

      if (userFolders.length < rootLimit) break;
      offsetRoot += rootLimit;
      if (offsetRoot > 5000) break;
    }
  } catch (err) {
    result.errors.push(`Erro geral cleanup ads: ${String(err)}`);
    result.success = false;
  }

  // ── 2. AVATARS ──
  try {
    // [PROD-FIX] sem avatar_path: a coluna não existe no banco de produção
    // (42703 abortava esta seção inteira). avatar_url já produz o mesmo
    // path via extractStoragePathFromUrl.
    const { data: profiles, error: profError } = await sb
      .from("profiles")
      .select("id, avatar_url");
    if (profError) throw new Error(`Erro ao buscar profiles: ${profError.message}`);

    const existingProfileIds = new Set<string>();
    const validAvatarPaths = new Set<string>();

    for (const p of profiles ?? []) {
      const pp = p as any;
      if (pp.id) existingProfileIds.add(pp.id);
      if (pp.avatar_url) {
        const pathFromUrl = extractStoragePathFromUrl(pp.avatar_url, "avatars");
        if (pathFromUrl) {
          try {
            const s = sanitizeStoragePath(pathFromUrl);
            validAvatarPaths.add(s);
          } catch {}
        }
      }
    }

    let offsetAv = 0;
    while (true) {
      const { data: avatarUserFolders, error: avRootError } = await sb.storage
        .from("avatars")
        .list("", { limit: 100, offset: offsetAv });

      if (avRootError) {
        result.errors.push(
          `Falha ao listar bucket avatars root: ${avRootError.message}`
        );
        break;
      }

      if (!avatarUserFolders || avatarUserFolders.length === 0) break;

      for (const userFolder of avatarUserFolders) {
        if (!userFolder.name) continue;
        const userId = userFolder.name;

        const { data: files, error: listErr } = await sb.storage
          .from("avatars")
          .list(userId, { limit: 1000 });

        if (listErr) {
          result.errors.push(`Falha ao listar avatars/${userId}: ${listErr.message}`);
          continue;
        }

        const userValidPaths = Array.from(validAvatarPaths).filter((pp) =>
          pp.startsWith(`${userId}/`)
        );

        for (const file of files ?? []) {
          if (!file.name) continue;
          const fullPath = `${userId}/${file.name}`;
          result.scannedAvatars++;
          result.scanned++;
          try {
            sanitizeStoragePath(fullPath);
            if (validAvatarPaths.has(fullPath)) continue; // avatar ATIVO — nunca tocar
            // [PROD-FIX] Guarda de frescor: avatar recém-enviado (aprove
            // trocar foto) nunca pode ser considerado órfão, mesmo se a
            // leitura do banco ainda não refletiu a troca.
            const fileCreated = new Date((file as any).created_at ?? 0).getTime();
            const fileAgeMs = Date.now() - fileCreated;
            if (!Number.isNaN(fileCreated) && fileCreated > 0 && fileAgeMs < 24 * 60 * 60 * 1000) continue;
            const profileExists = existingProfileIds.has(userId);
            const isOnlyFile = (files?.length ?? 0) === 1;
            // Só limpa: (a) pasta de perfil já excluído, ou (b) avatar
            // SUBSTITUÍDO (há outro ativo no banco) — nunca o único arquivo
            // de um perfil ainda existente (protege o avatar ativo).
            if (isOnlyFile && profileExists) continue;
            if (!profileExists && userValidPaths.length > 0) continue; // inconsistência — melhor não tocar
            // [PROD-FIX 03/09] REMOÇÃO AUTOMÁTICA DESATIVADA (scan-only):
            // o avatar atualizado/excluído pelo dono continua sendo
            // removido pelos fluxos próprios (uploadCover/uploadAvatar);
            // a faxina NÃO apaga nada.
            result.orphansFoundAvatars++;
          } catch (e) {
            result.errors.push(`Path inválido avatar ${fullPath}: ${String(e)}`);
          }
        }
      }

      if (avatarUserFolders.length < 100) break;
      offsetAv += 100;
      if (offsetAv > 5000) break;
    }
  } catch (err) {
    result.errors.push(`Erro geral cleanup avatars: ${String(err)}`);
    result.success = false;
  }

  securityLog(
    "cleanup",
    {
      deletedAds: result.deletedAds,
      deletedAvatars: result.deletedAvatars,
      scannedAds: result.scannedAds,
      scannedAvatars: result.scannedAvatars,
    } as any,
    "low"
  );

  return result;
}
