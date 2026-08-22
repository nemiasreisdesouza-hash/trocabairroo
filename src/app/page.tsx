import Link from "next/link";
import { db } from "@/db";
import { ads, adImages, users } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import AdCard from "@/components/ads/AdCard";
import { ArrowRight, Repeat2, Users, Star, MapPin, CheckCircle2, Zap, Shield, TrendingUp } from "lucide-react";
import { getSession } from "@/lib/auth";

async function getFeaturedAds() {
  try {
    const result = await db
      .select({
        id: ads.id,
        userId: ads.userId,
        tipo: ads.tipo,
        titulo: ads.titulo,
        descricao: ads.descricao,
        categoria: ads.categoria,
        bairro: ads.bairro,
        aceitaEmTroca: ads.aceitaEmTroca,
        destaque: ads.destaque,
        topoFeed: ads.topoFeed,
        visualizacoes: ads.visualizacoes,
        createdAt: ads.createdAt,
        userName: users.nome,
        userAvatar: users.avatarUrl,
        userWhatsapp: users.whatsapp,
        userMediaAvaliacao: users.mediaAvaliacao,
        userTrocasConcluidas: users.trocasConcluidas,
        userVerificado: users.verificado,
      })
      .from(ads)
      .innerJoin(users, eq(ads.userId, users.id))
      .where(eq(ads.status, "ativo"))
      .orderBy(desc(ads.topoFeed), desc(ads.destaque), desc(ads.createdAt))
      .limit(6);

    if (result.length === 0) return [];

    const adIds = result.map((a) => a.id);
    const images = await db
      .select({ adId: adImages.adId, imageUrl: adImages.imageUrl })
      .from(adImages)
      .where(
        sql`${adImages.adId} = ANY(${sql.raw(`ARRAY['${adIds.join("','")}']::uuid[]`)})`
      )
      .orderBy(adImages.ordem);

    const imagesMap: Record<string, string[]> = {};
    images.forEach((img) => {
      if (!imagesMap[img.adId]) imagesMap[img.adId] = [];
      imagesMap[img.adId].push(img.imageUrl);
    });

    return result.map((ad) => ({ ...ad, images: imagesMap[ad.id] || [] }));
  } catch {
    return [];
  }
}

async function getStats() {
  try {
    const [usersCount, adsCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(ads).where(eq(ads.status, "ativo")),
    ]);
    return {
      users: Number(usersCount[0]?.count || 0),
      ads: Number(adsCount[0]?.count || 0),
    };
  } catch {
    return { users: 0, ads: 0 };
  }
}

export default async function HomePage() {
  const [featuredAds, stats, session] = await Promise.all([
    getFeaturedAds(),
    getStats(),
    getSession(),
  ]);

  return (
    <div className="min-h-screen bg-[#FAF9FB]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-700 rounded-xl flex items-center justify-center">
              <span className="text-white text-sm font-black">TB</span>
            </div>
            <span className="font-black text-purple-700 text-lg tracking-tight">
              Troca<span className="text-yellow-500">Bairro</span>
            </span>
          </div>
          <div className="flex gap-2">
            {session ? (
              <Link
                href="/dashboard"
                className="text-sm font-semibold bg-purple-700 text-white rounded-2xl px-4 py-2 hover:bg-purple-800 transition-colors"
              >
                Meu Painel
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-purple-700 px-3 py-2"
                >
                  Entrar
                </Link>
                <Link
                  href="/cadastro"
                  className="text-sm font-semibold bg-purple-700 text-white rounded-2xl px-4 py-2 hover:bg-purple-800 transition-colors"
                >
                  Cadastrar
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-purple-800 to-purple-700 pt-20">
        <div className="absolute inset-0 bg-black/20" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url('/images/hero-bg.jpg')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="relative max-w-lg mx-auto px-5 py-12 text-center">
          <div className="inline-flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/40 rounded-full px-4 py-1.5 mb-6">
            <MapPin className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-300 text-sm font-semibold">
              Jesus de Nazaré · Vitória/ES
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
            Troque serviços com
            <span className="text-yellow-400"> gente do seu bairro</span>
          </h1>
          <p className="text-purple-100 text-lg mb-8 leading-relaxed">
            Sem dinheiro. Apenas{" "}
            <span className="font-bold text-white">confiança</span>, parcerias e
            oportunidades.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/cadastro"
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-lg py-4 rounded-2xl transition-all active:scale-95 shadow-lg"
            >
              🚀 Publicar anúncio grátis
            </Link>
            <Link
              href="/buscar"
              className="w-full bg-white/15 hover:bg-white/25 text-white font-semibold text-base py-3.5 rounded-2xl border border-white/30 transition-all"
            >
              Ver anúncios do bairro
            </Link>
          </div>

          {/* Quick stats */}
          {(stats.users > 0 || stats.ads > 0) && (
            <div className="flex justify-center gap-8 mt-8">
              <div className="text-center">
                <p className="text-2xl font-black text-white">{stats.users}</p>
                <p className="text-purple-200 text-sm">Usuários</p>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <p className="text-2xl font-black text-white">{stats.ads}</p>
                <p className="text-purple-200 text-sm">Anúncios</p>
              </div>
            </div>
          )}
        </div>

        {/* Wave */}
        <div className="relative">
          <svg viewBox="0 0 1440 60" className="w-full" fill="#FAF9FB">
            <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" />
          </svg>
        </div>
      </section>

      <main className="max-w-lg mx-auto px-4 pb-28">
        {/* How it works */}
        <section className="py-8">
          <h2 className="text-2xl font-black text-gray-900 text-center mb-6">
            Como funciona? 🤔
          </h2>
          <div className="flex flex-col gap-4">
            {[
              {
                emoji: "📣",
                num: "1",
                title: "Publique o que tem",
                desc: "Ofereça um serviço ou diga o que você precisa. É grátis!",
              },
              {
                emoji: "🤝",
                num: "2",
                title: "Encontre seu par",
                desc: "Conecte com alguém do bairro pelo WhatsApp e combinem a troca.",
              },
              {
                emoji: "⭐",
                num: "3",
                title: "Avalie e ganhe reputação",
                desc: "Após a troca, ambos avaliam. Sua reputação cresce no bairro!",
              },
            ].map(({ emoji, num, title, desc }) => (
              <div
                key={num}
                className="flex gap-4 items-start bg-white rounded-2xl p-4 shadow-sm"
              >
                <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl">
                  {emoji}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base mb-1">
                    {title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Ads */}
        {featuredAds.length > 0 ? (
          <section className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-gray-900">
                Anúncios em destaque ✨
              </h2>
              <Link
                href="/buscar"
                className="flex items-center gap-1 text-purple-700 font-semibold text-sm"
              >
                Ver todos
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {featuredAds.map((ad) => (
                <AdCard key={ad.id} ad={ad} />
              ))}
            </div>
          </section>
        ) : (
          <section className="py-8">
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
              <div className="text-5xl mb-4">🌱</div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">
                Seja o primeiro do bairro!
              </h3>
              <p className="text-gray-600 mb-4">
                Nenhum anúncio ainda. Publique o primeiro e comece a trocar!
              </p>
              <Link
                href="/cadastro"
                className="inline-block bg-purple-700 text-white font-bold py-3 px-6 rounded-2xl"
              >
                Publicar grátis
              </Link>
            </div>
          </section>
        )}

        {/* Benefits */}
        <section className="py-6">
          <h2 className="text-xl font-black text-gray-900 text-center mb-4">
            Por que usar o TrocaBairro?
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <Shield className="w-5 h-5" />, text: "100% Gratuito", color: "text-green-600 bg-green-100" },
              { icon: <Users className="w-5 h-5" />, text: "Gente do bairro", color: "text-blue-600 bg-blue-100" },
              { icon: <Star className="w-5 h-5" />, text: "Sistema de reputação", color: "text-yellow-600 bg-yellow-100" },
              { icon: <Zap className="w-5 h-5" />, text: "Via WhatsApp", color: "text-purple-600 bg-purple-100" },
            ].map(({ icon, text, color }) => (
              <div
                key={text}
                className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center gap-2 text-center"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
                  {icon}
                </div>
                <span className="text-sm font-semibold text-gray-800">{text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-4">
          <h2 className="text-xl font-black text-gray-900 text-center mb-4">
            Quem já trocou 💬
          </h2>
          <div className="flex flex-col gap-3">
            {[
              {
                name: "Michelle A.",
                bairro: "Jesus de Nazaré",
                text: "Troquei vídeos pro meu açaí por 3 semanas. Incrível demais!",
                stars: 5,
              },
              {
                name: "Carlos V.",
                bairro: "Goiabeiras",
                text: "Consegui um designer pro meu logo em troca de aula de violão.",
                stars: 5,
              },
              {
                name: "Ana P.",
                bairro: "Jardim Camburi",
                text: "A plataforma é simples e direta. Já fiz 4 trocas!",
                stars: 5,
              },
            ].map(({ name, bairro, text, stars }) => (
              <div key={name} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex gap-0.5 mb-2">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
                <p className="text-gray-700 text-sm mb-3">"{text}"</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center">
                    <span className="text-purple-800 text-sm font-bold">
                      {name[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{name}</p>
                    <p className="text-xs text-gray-500">{bairro}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-6">
          <div className="bg-gradient-to-br from-purple-700 to-purple-900 rounded-3xl p-6 text-center text-white">
            <h2 className="text-2xl font-black mb-2">
              Comece agora, é grátis! 🎉
            </h2>
            <p className="text-purple-100 mb-5 text-sm">
              Cadastre-se em 2 minutos e conecte com seu bairro.
            </p>
            <Link
              href="/cadastro"
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-base py-4 rounded-2xl transition-all inline-block active:scale-95"
            >
              Criar conta grátis
            </Link>
          </div>
        </section>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          <Link href="/" className="flex flex-col items-center py-3 px-3 text-purple-700">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
            <span className="text-xs font-medium mt-0.5">Início</span>
          </Link>
          <Link href="/buscar" className="flex flex-col items-center py-3 px-3 text-gray-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span className="text-xs font-medium mt-0.5">Buscar</span>
          </Link>
          <Link href={session ? "/anuncio/criar" : "/cadastro"} className="flex flex-col items-center py-2 px-3 -mt-4">
            <div className="w-14 h-14 bg-purple-700 rounded-full flex items-center justify-center shadow-lg shadow-purple-300">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </div>
            <span className="text-xs font-semibold text-purple-700 mt-1">Publicar</span>
          </Link>
          <Link href={session ? "/interesses" : "/login"} className="flex flex-col items-center py-3 px-3 text-gray-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span className="text-xs font-medium mt-0.5">Trocas</span>
          </Link>
          <Link href={session ? `/perfil/${session.id}` : "/login"} className="flex flex-col items-center py-3 px-3 text-gray-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span className="text-xs font-medium mt-0.5">Perfil</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
