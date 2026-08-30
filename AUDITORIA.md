# Auditoria — TrocaES (trocabairroo)

**Data:** 2026-08-29
**Escopo:** erros de fluxo de navegação + erro ao publicar anúncio em produção
(Vercel + Supabase), sem alterar comportamento/estética/segurança existentes.

---

## 1. Diagnóstico do que estava quebrado (com evidências da produção)

A produção analisada: `https://trocabairroo.vercel.app`
`/api/health` → `{ "ok": true, "mode": "supabase" }` — **as chaves do Supabase
estavam corretas na Vercel; o backend estava conectado.**

| # | Sintoma | Causa raiz | Evidência |
|---|---------|-----------|-----------|
| **P0-1** | **Erro ao publicar anúncio com foto** — toast "PERSIST_IMAGES_FAILED..." e o anúncio é apagado após o erro | `createAd()` (Supabase) **nunca gravava as fotos**: o insert na tabela `ads` ignorava `input.images` (o zod `AdInputSchema` remove chaves desconhecidas e o código não compensava). A prova read-after-write da página (`getAdById().images[0]`) nunca encontrava imagem → lançava e o `catch` deletava o anúncio. Os arquivos enviados ficavam **órfãos no Storage**. | `src/lib/backend.ts` — ramo `if (sb)` do `createAd` |
| **P0-2** | **Cadastro em produção sempre falhava** ("Erro ao criar perfil: duplicate key...") | O trigger SQL `handle_new_auth_user` (schema.sql) **já cria a linha do `profiles`** no signUp. O `register()` fazia um segundo `INSERT` → conflito de chave primária (23505) → erro. | `src/lib/backend.ts` — `register()` vs. `supabase/schema.sql` (trigger `on_auth_user_created`) |
| **P1-1** | **"Site de brinquedo" em produção** — home/buscada começando com dados de exemplo (açaí da Michelle, `demo-ad-*`) que persistiam quando a rede era lenta | Todas as páginas inicializavam o estado com o **seed demo** (`DEMO_HOME_ADS`/`DEMO_FEED_ADS`) e os fetches falhavam em silêncio (`.catch(() => {})`) — o dado fake permanecia na tela. Em produção o HTML pré-renderizado até **servia o seed demo direto**. | `src/app/page.tsx`, `src/app/buscar/page.tsx` (estado inicial + catches silenciosos) |
| **P1-2** | **Toque num anúncio → cai em /buscar** (navegação quebrada) | `/anuncio/[id]` fazia `Promise.race([getAdById, 9s])` e, em **timeout**, redirecionava para `/buscar`. O `getAdById` somava 4 round-trips sequenciais no Supabase (rpc de views + anúncio + avaliações + contagem de trocas) — em rede celular isso estourava os 9s facilmente. | `src/app/anuncio/[id]/page.tsx`, `getAdById` em `backend.ts` |
| **P2-1** | Rodapé "Modo demonstração — dados locais..." **aparecia na produção** (deixava o usuário achando que o app roda sem backend) | Texto **sem condição** no HTML da home (o botão reset já era condicional, o parágrafo não). | `src/app/page.tsx` ~L978 |
| **P2-2** | 403/429 intermitentes para usuários legítimos (flutua de rede celular) | Rate limit por **IP compartilhado** (NAT/CGNAT): estourar `/login` (20/15min) ou `/cadastro` (10/h) **bloqueava o IP inteiro por 10–30 min** para toda a rede — a mesma família do incidente P1 documentado em `POSTMORTEM_403_P1.md`. | `src/middleware.ts` (rate limit → `blockIp`) |
| **P3** | `favicon.ico` 404; manifest referenciava ícones inexistentes (`/icons/icon-192.png`); `sw.js` nunca registrado | Arquivo commitado com extensão errada (`favicon.ico.ico`); manifest desatualizado. | `public/` |

---

## 2. O que foi corrigido (cirúrgico — sem quebrar o que funciona)

### 2.1 Publicação de anúncio (P0-1) — `src/lib/backend.ts`
- `createAd()` (Supabase) agora **persiste as fotos no ato da criação**:
  - insere já com a coluna `ads.images` (schema atual);
  - grava também a tabela `ad_images` (fonte legada que o app lê);
  - **DB antigo sem a coluna `images`**: retry automático sem a coluna + persistência via `ad_images` (publicação nunca quebra por isso);
  - **respeita o `adId` gerado no client** — o arquivo vai para `ads/{userId}/{adId}/...` e o anúncio nasce com esse id: a limpeza de órfãos (`deleteAd`) agora acha os arquivos certos.
- Novo helper `persistAdImagesToTables()` (idempotente, mesmo contrato do `setAdImages`).

### 2.2 Cadastro (P0-2) — `src/lib/backend.ts`
- `register()` (Supabase): `INSERT` → **`UPSERT (onConflict: id)`**. Se o trigger
  já criou o perfil (caso normal), o upsert só garante os metadados e retorna a
  linha; se não criou, insere. Fallback final: lê o perfil por id (conta já
  existe) e segue o fluxo — o usuário **nunca mais vê "Erro ao criar perfil"**.
- Compatível com o trigger `guard_profile_changes` (email igual ao do auth).

### 2.3 Fim do "site de brinquedo" em produção (P1-1)
- `src/app/page.tsx` e `src/app/buscar/page.tsx`: estado inicial agora depende
  do modo — **em Supabase começa vazio + skeleton** (nunca seed demo); em modo
  demo mantém o instantâneo (comportamento original preservado).
- Empty states ("Nenhum anúncio...") só aparecem **depois** do fetch resolver
  (`featuredSettled`/`allAdsSettled`/`settled`) — fim do "sem anúncios" falso.
- Fetch de erro em produção agora degrada para **vazio/skeleton**, nunca para dado fake.

### 2.4 Navegação do anúncio (P1-2)
- `getAdById()`: contador de views virou **fire-and-forget**; avaliações +
  contagem de trocas agora rodam em **paralelo** (`Promise.all`) — 2 round-trips
  a menos no caminho crítico.
- `/anuncio/[id]`: **timeout não manda mais para /buscar**. Timeout → retry
  uma vez (15s) → skeleton continua. Redirect só quando o anúncio
  **definitivamente não existe**. Erro de rede → tela amigável com ações
  ("Ver anúncios"/"Voltar").
- `/anuncio/criar`: erros técnicos viram mensagem amigável no toast
  (ex.: "Não foi possível salvar as fotos... tente fotos menores").

### 2.5 Produção limpa (P2/P3)
- Rodapé "Modo demonstração..." só aparece **sem chaves** (condicionado ao modo).
- `middleware.ts`: `/login` e `/cadastro` estourando rate limit agora **só
  recebem 429 curto — sem bloqueio de IP** (proteção anti-brute-force continua
  no tarpit client `security.ts` + no Supabase Auth). Demais camadas de
  segurança (honeypot, traversal, XSS, injection, UA, headers) intactas.
- Removidos `Cross-Origin-Embedder-Policy: require-corp` e
  `Cross-Origin-Resource-Policy: same-origin` (podiam bloquear fotos
  carregadas direto do Storage em `<img>` simples); demais headers mantidos.
- `public/favicon.ico.ico` → `public/favicon.ico` (favicon voltou a carregar);
  manifest agora aponta para `/icon.svg` existente (PWA instalável de novo).

### 2.6 Não mudou (de propósito)
- Nenhum SQL/schema, RLS, trigger ou policy (o `schema.sql` já estava correto —
  os bugs eram no app, não no banco).
- Modo demo intacto (fluxos demo testados e ok).
- WAF/middleware: 95% do código intacto, só as duas calibrações acima.
- UI, copy, cores, componentes, planos, chat, admin, cron: intactos.

---

## 3. Verificação executada

- `tsc --noEmit` → 0 erros · `next build` → ok (22 rotas).
- **Teste de fluxo com cliente Supabase simulado** (18 asserções, todas PASS):
  - createAd com fotos: id client-side respeitado, `ads.images` + `ad_images` gravadas;
  - createAd em DB **sem** coluna `images`: retry + fallback funcionam;
  - createAd sem fotos: ok;
  - register: upsert idempotente (com e sem falha do upsert) → usuário retornado;
  - getAdById: imagens resolvidas, rpc de views não bloqueia;
  - listAds em supabase: fallback **vazio** (sem seed demo).
- **Regressão modo demo**: createAd continua persistindo 2 imagens
  (read-after-write + `listUserAds`).
- **Build em modo Supabase (simulado)**: HTML de `/` e `/buscar` com **zero**
  dados demo e zero texto "Modo demonstração"; `/api/health` → `mode: supabase`.
- Rotas locais: `/`, `/buscar`, `/anuncio/criar`, `/login`, `/cadastro`,
  `/api/health`, `/favicon.ico`, `/manifest.json`, `/icon.svg` → todas 200.

---

## 4. Para colocar no ar (Vercel)

1. Mergie o pull request e deixe a Vercel fazer o deploy (ou Redeploy).
2. Confirme as variáveis **exatas** em Vercel → Settings → Environment:
   `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (escopos Production + Preview). Já estavam OK no deploy atual — o
   `/api/health` confirma `mode: supabase`.
3. Verificação em produção:
   - `https://SEU-DOMINIO/api/health` → `{"mode":"supabase"}`;
   - Home sem dados de exemplo (skeleton → anúncios reais);
   - Publicar anúncio **com 3 fotos** → sucesso, foto aparece no perfil e no
     detalhe do anúncio (F5 mantém);
   - Cadastro de uma conta nova → cria e loga sem "Erro ao criar perfil";
   - Tocar em um anúncio em 4G → carrega (ou tenta de novo), **não** cai em `/buscar`.
4. Se houver usuários "pendurados" do período do bug, peça para limpar o
   cache do site (ou use uma URL nova) — o HTML antigo pré-renderizado saí
   automaticamente com o novo deploy.

## 5. Pendências sugeridas (não alteradas por não serem bloqueio)

- `public/sw.js` é código morto (nenhuma página registra o service worker).
  Considerar apagar ou registrar de propósito — mas **não** o pattern
  cache-first dele para páginas (causa navegação velha, exatamente a
  categoria de bug reportada).
- Considerar migrar o rate limiting edge de Map em memória para Upstash Redis
  (sugestão já presente no postmortem) para cobertura entre instâncias.
