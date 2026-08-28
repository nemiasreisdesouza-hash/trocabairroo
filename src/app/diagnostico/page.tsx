"use client";

import { useEffect, useState } from "react";

/**
 * Página de diagnóstico do demo-store
 * Mostra EXATAMENTE o que está no localStorage e prova se o fix P0 funcionou.
 * URL: /diagnostico
 */
export default function DiagnosticoPage() {
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const DB_KEY = "trocabairro:demo:db";
      const SESSION_KEY = "trocabairro:demo:session";

      // Probe storage
      let storageOk = true;
      try {
        const probe = "__tb_probe__";
        localStorage.setItem(probe, "1");
        localStorage.removeItem(probe);
      } catch {
        storageOk = false;
      }

      // Lê as DUAS chaves candidatas (a real e a do comando do user)
      const correctKeyRaw = localStorage.getItem(DB_KEY);
      const wrongKeyRaw = localStorage.getItem("trocabairro_demo_db");

      let correctDb: any = null;
      let correctErr: string | null = null;
      if (correctKeyRaw) {
        try {
          correctDb = JSON.parse(correctKeyRaw);
        } catch (e: any) {
          correctErr = String(e?.message ?? e);
        }
      }

      const sessionId = localStorage.getItem(SESSION_KEY);

      // Análise
      const ads = Array.isArray(correctDb?.ads) ? correctDb.ads : [];
      const adImages = Array.isArray(correctDb?.adImages) ? correctDb.adImages : [];
      const users = Array.isArray(correctDb?.users) ? correctDb.users : [];

      // Para cada ad: conta images (do campo) vs adImages (da tabela relacional)
      const adAnalysis = ads.map((a: any) => {
        const ownImagesField: string[] = Array.isArray(a.images) ? a.images : [];
        const fromAdImagesTable = adImages
          .filter((i: any) => i.adId === a.id)
          .sort((x: any, y: any) => (x.ordem ?? 0) - (y.ordem ?? 0))
          .map((i: any) => i.imageUrl);
        return {
          id: a.id,
          titulo: a.titulo,
          userId: a.userId,
          hasFieldImages: ownImagesField.length,
          fromAdImages: fromAdImagesTable.length,
          firstField: ownImagesField[0]?.slice(0, 50),
          firstAdImages: fromAdImagesTable[0]?.slice(0, 50),
          createdAt: a.createdAt,
        };
      });

      // Detecta ads NOVOS (do user) vs seed
      const seedIds = new Set([
        "demo-ad-1", "demo-ad-2", "demo-ad-3", "demo-ad-4", "demo-ad-5", "demo-ad-6",
      ]);
      const newAds = adAnalysis.filter((a: any) => !seedIds.has(a.id));
      const seedAds = adAnalysis.filter((a: any) => seedIds.has(a.id));

      // Storage size
      const totalSize = correctKeyRaw
        ? new Blob([correctKeyRaw]).size
        : 0;
      const quota = 5 * 1024 * 1024; // 5MB typical
      const quotaPct = ((totalSize / quota) * 100).toFixed(1);

      setReport({
        storageOk,
        sessionId,
        keys: {
          real: DB_KEY,
          realExists: !!correctKeyRaw,
          realSizeBytes: totalSize,
          realSizeHuman: (totalSize / 1024).toFixed(1) + " KB",
          quotaPct: quotaPct + "%",
          wrong: "trocabairro_demo_db",
          wrongExists: !!wrongKeyRaw,
          wrongSizeBytes: wrongKeyRaw ? new Blob([wrongKeyRaw]).size : 0,
        },
        counts: {
          ads: ads.length,
          newAds: newAds.length,
          seedAds: seedAds.length,
          adImages: adImages.length,
          users: users.length,
        },
        adAnalysis,
        newAds,
        correctErr,
        diagnoseMessage: buildDiagnoseMessage(
          newAds,
          adImages,
          storageOk,
          totalSize
        ),
      });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-mono text-sm">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-black mb-2 text-gray-900">
          🔬 Diagnóstico do demo-store
        </h1>
        <p className="text-gray-600 mb-6">
          Mostra exatamente o que está no localStorage do preview e prova se o
          fix P0 (commit <code>0c4350d</code>) está persistindo imagens.
        </p>

        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 mb-4">
            <strong className="text-red-700">Erro:</strong> {error}
          </div>
        )}

        {report && (
          <>
            {/* Diagnose principal */}
            <div
              className={`rounded-2xl p-5 mb-6 border-2 ${
                report.diagnoseMessage.ok
                  ? "bg-green-50 border-green-300"
                  : "bg-red-50 border-red-300"
              }`}
            >
              <h2 className="text-lg font-black mb-2">
                {report.diagnoseMessage.ok ? "✅ " : "❌ "}
                {report.diagnoseMessage.title}
              </h2>
              <p className="text-gray-800 mb-3">{report.diagnoseMessage.body}</p>
              {report.diagnoseMessage.action && (
                <pre className="bg-white/60 rounded-xl p-3 text-xs whitespace-pre-wrap">
                  {report.diagnoseMessage.action}
                </pre>
              )}
            </div>

            {/* Keys */}
            <Section title="1. Chaves do localStorage">
              <KV k="localStorage OK" v={String(report.storageOk)} />
              <KV k="Sessão demo" v={report.sessionId ?? "(nenhuma)"} />
              <KV k="Chave REAL (demo-store.ts:14)" v={report.keys.real} />
              <KV
                k="  Existe?"
                v={String(report.keys.realExists)}
                color={report.keys.realExists ? "green" : "red"}
              />
              <KV k="  Tamanho" v={report.keys.realSizeHuman} />
              <KV k="  % da quota 5MB" v={report.keys.quotaPct} />
              <KV
                k="Chave ERRADA (comando user)"
                v={report.keys.wrong}
                color="red"
              />
              <KV
                k="  Existe?"
                v={String(report.keys.wrongExists)}
                color="red"
              />
              <KV k="  Tamanho" v={`${report.keys.wrongSizeBytes} bytes`} />
              {report.correctErr && (
                <KV k="  Erro ao parsear chave real" v={report.correctErr} color="red" />
              )}
            </Section>

            {/* Counts */}
            <Section title="2. Contagens">
              <KV k="Total de ads" v={String(report.counts.ads)} />
              <KV k="  - do seed (6 esperados)" v={String(report.counts.seedAds)} />
              <KV k="  - NOVOS criados pelo user" v={String(report.counts.newAds)} color={report.counts.newAds > 0 ? "green" : "amber"} />
              <KV k="Total de adImages" v={String(report.counts.adImages)} />
              <KV k="Total de users" v={String(report.counts.users)} />
            </Section>

            {/* Análise por ad */}
            <Section title="3. Análise por anúncio">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-2">ID</th>
                    <th className="text-left p-2">Título</th>
                    <th className="text-left p-2">images[] (campo)</th>
                    <th className="text-left p-2">adImages (tabela)</th>
                    <th className="text-left p-2">Primeira URL (50 chars)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.adAnalysis.map((a: any) => {
                    const isNew = !a.id.startsWith("demo-");
                    return (
                      <tr
                        key={a.id}
                        className={`border-b ${isNew ? "bg-yellow-50" : ""}`}
                      >
                        <td className="p-2">
                          <code className="text-[10px]">{a.id.slice(0, 18)}…</code>
                          {isNew && <span className="ml-1 text-[10px] text-yellow-700">⭐ NOVO</span>}
                        </td>
                        <td className="p-2">{a.titulo}</td>
                        <td className="p-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded ${
                              a.hasFieldImages > 0
                                ? "bg-green-200 text-green-900"
                                : "bg-red-200 text-red-900"
                            }`}
                          >
                            {a.hasFieldImages}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded ${
                              a.fromAdImages > 0
                                ? "bg-green-200 text-green-900"
                                : "bg-red-200 text-red-900"
                            }`}
                          >
                            {a.fromAdImages}
                          </span>
                        </td>
                        <td className="p-2 text-[10px] text-gray-600">
                          {a.firstField ?? a.firstAdImages ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>

            {/* Ads novos do user */}
            {report.newAds.length > 0 && (
              <Section title="4. Ads NOVOS criados pelo user">
                <pre className="text-[11px] whitespace-pre-wrap break-all">
                  {JSON.stringify(report.newAds, null, 2)}
                </pre>
              </Section>
            )}

            {/* Comando correto para o console */}
            <Section title="5. Comando CORRETO para o DevTools Console">
              <pre className="bg-gray-900 text-green-300 rounded-xl p-4 text-xs overflow-auto">
{`// Use a chave REAL (com dois-pontos, não underscore):
const db = JSON.parse(localStorage.getItem('trocabairro:demo:db') || '{}');
console.log(JSON.stringify({
  ads: (db.ads||[]).map(a => ({
    id: a.id,
    titulo: a.titulo,
    images: a.images?.length ?? 0,
    first: a.images?.[0]?.slice(0,30) ?? null
  })),
  adImages: (db.adImages||[]).length,
  totalSizeKB: (new Blob([localStorage.getItem('trocabairro:demo:db') || '']).size / 1024).toFixed(1)
}, null, 2));`}
              </pre>
              <p className="text-xs text-gray-600 mt-2">
                ⚠️ O comando do user usou <code>trocabairro_demo_db</code> (underscore)
                — chave que NUNCA foi escrita. Por isso o <code>JSON.parse</code>{" "}
                retornou <code>{}</code> e <code>adImages.length === 0</code> é
                FALSO POSITIVO. A chave real é <code>trocabairro:demo:db</code>{" "}
                (com dois-pontos).
              </p>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-200">
      <h2 className="text-base font-black mb-3 text-gray-900">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function KV({ k, v, color }: { k: string; v: string; color?: "green" | "red" | "amber" }) {
  const colorClass =
    color === "green" ? "text-green-700" : color === "red" ? "text-red-700" : color === "amber" ? "text-amber-700" : "text-gray-900";
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-gray-500 min-w-[200px]">{k}</span>
      <span className={`font-bold ${colorClass}`}>{v}</span>
    </div>
  );
}

function buildDiagnoseMessage(
  newAds: any[],
  adImages: any[],
  storageOk: boolean,
  totalSize: number
): { ok: boolean; title: string; body: string; action?: string } {
  if (!storageOk) {
    return {
      ok: false,
      title: "localStorage bloqueado neste preview",
      body:
        "O browser está em modo restrito (sandbox/cookie desabilitado). O app segue em memória nesta sessão. F5 = perda total. Não é bug — é limitação do ambiente de preview.",
      action: "Abra em janela anônima fora do sandbox do agent para teste real.",
    };
  }

  if (newAds.length === 0) {
    return {
      ok: true,
      title: "Nenhum ad novo detectado ainda",
      body: `Existem apenas os 6 ads do seed. Crie um anúncio com foto nesta sessão e recarregue a página de diagnóstico (F5).`,
      action: "Vá em /anuncio/criar, preencha e adicione 1+ fotos, publique. Depois volte aqui e F5.",
    };
  }

  const newAdImages = newAds.map((a) => a.fromAdImages);
  const newFieldImages = newAds.map((a) => a.hasFieldImages);
  const allHaveField = newFieldImages.every((n) => n > 0);
  const allHaveAdImages = newAdImages.every((n) => n > 0);
  const quotaPct = ((totalSize / (5 * 1024 * 1024)) * 100).toFixed(1);

  if (allHaveField && allHaveAdImages) {
    return {
      ok: true,
      title: "✅ FIX FUNCIONOU! Imagens persistidas corretamente",
      body: `Todos os ${newAds.length} ads novos têm images[] no campo E em adImages. Storage: ${(totalSize / 1024).toFixed(1)} KB (${quotaPct}% da quota).`,
    };
  }

  if (!allHaveField && allHaveAdImages) {
    return {
      ok: false,
      title: "❌ images[] (campo) não persistiu",
      body: `adImages tem as URLs, mas ad.images[] está vazio. UI lê ad.images[0] (AdCard/Perfil/Dashboard/Home/Detalhe) — VAI mostrar placeholder.`,
    };
  }

  if (allHaveField && !allHaveAdImages) {
    return {
      ok: false,
      title: "❌ adImages (tabela) vazia",
      body: `ad.images[] tem URLs, mas adImages (tabela relacional) está vazia. listAdsDemo/getAdById fazem fallback, mas o primeiro read pode usar adImages e mostrar vazio.`,
    };
  }

  return {
    ok: false,
    title: "❌ NEM images[] NEM adImages persistiu",
    body: "Nem o campo nem a tabela têm a foto. Upload falhou ou write não chegou ao store. Verifique se a imagem escolhida era < 5MB e JPG/PNG/WebP. Storage atual: " +
      (totalSize / 1024).toFixed(1) +
      " KB.",
    action: "Abra DevTools → Console e procure por [AD-IMAGE-DEBUG] logs. Cole os logs aqui.",
  };
}
