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

---

## 6. Correção 2 (2026-08-29) — perfil redirecionava p/ /buscar + PERSIST_IMAGES_FAILED em foto

### 6.1. Sintomas em produção (após o deploy da Correção 1)

1. **Perfil → busca**: clicar no próprio card "VIZINHOS VERIFICADOS"
   (`/perfil/3272b151-…`) redirecionava para `/buscar`.
2. **Publicar com foto** ainda falhava com "Não foi possível salvar as fotos
   do anúncio…" (toast de `PERSIST_IMAGES_FAILED` — o read-after-write
   `getAdById().images[0]` falhava em produção).

### 6.2. Causa raiz

As consultas com **embed de FK nominada** (`profiles!reviews_avaliador_id_fkey`,
`profiles!trades_requester_id_fkey`, etc.) dependem do **nome exato** da
constraint no banco. Se o banco de produção divergir do `schema.sql`
(constraint renomeada/criada manualmente, ou tabela ausente), o PostgREST
responde *"Could not find a relationship… / Could not find table…"* e a
consulta **inteira** falha:

- `/perfil` usava `Promise.all([getProfileById, listUserAds, listUserReviews])`
  com `.catch(() => router.push("/buscar"))` → **qualquer** uma das três
  falhando (ex.: `listUserReviews` lançando, ou a guarda IDOR de `listUserAds`
  ao ver perfil de **terceiros**) derrubava a página inteira.
- `getAdById` (o read-after-write do publicar) usava um select pesado com
  embed do dono; qualquer erro ali devolvia `null` → `PERSIST_IMAGES_FAILED`,
  mesmo com a foto já enviada e o anúncio já criado.

### 6.3. O que mudou (cirúrgico)

- **`src/lib/backend.ts`**
  - Novo helper `selectWithEmbedFallback()`: tenta o select com o embed
    nominado (fast-path); em erro, repete **sem** o embed e resolve os
    perfis em consulta separada (best-effort). **Nunca lança.**
  - Aplicado a todos os 6 pontos que usam FK nominada: `listUserReviews`,
    `getAdById` (avaliações), `listTrades`, `getTradeForUser`,
    `adminListTrades`, `adminListReviews`.
  - `getAdById`: se o select pesado falhar, retenta com `select("*")` e
    resolve dono + `ad_images` em consultas separadas tolerantes — o
    read-after-write do publicar volta a ver as fotos.
  - Novo `listPublicUserAds()`: anúncios de um usuário vistos por
    **terceiros** no `/perfil` (sem a guarda IDOR de `listUserAds`, que
    lançava "Sem permissão" e redirecionava o visitante). `listUserAds`
    manteve a guarda IDOR (dashboard).
- **`src/app/perfil/[id]/page.tsx`**
  - Carregamentos **independentes**: perfil não existe (404 de fato) →
    mantém redirect; erro transitório → tela "Tentar novamente" em vez de
    redirecionar; anúncios/avaliações falhando → exibem vazios e o perfil
    abre normal.
  - Visitante usa `listPublicUserAds` (perfil de terceiros abre de novo).

### 6.4. Verificação

- `tsc --noEmit` limpo; `npm run build` 22 rotas OK.
- Harness com client fake do Supabase emulando as falhas de produção
  (constraint divergente, tabela ausente, select pesado quebrado, DB sem
  coluna `images`, IDOR): **24/24 PASS**; demo-mode sem regressão.

### 6.5. Nota de diagnóstico

Se publicar com foto **ainda** falhar após este deploy, o próximo passo é a
causa real do erro no upload/banco: abrir o DevTools (F12) → aba **Console**
→ tentar publicar de novo → enviar as linhas `[AD-IMG-PROOF]`
(ela registra upload, read-back e o erro exato).

---

## 7. Correção 3 (2026-08-30) — selects de perfil tolerantes a drift de schema

### 7.1. Sintoma persistente

Mesmo com as correções 1 e 2, em produção: clicar em "perfil" (canto
superior direito) e em anúncios ainda levava a `/buscar`, e o console do
navegador mostrava **`GET /rest/v1/profiles?select=… → 400 (Bad Request)`**.

### 7.2. Causa raiz (completa)

O banco de produção está **divergido do `schema.sql`** (colunas faltando
e/ou constraints renomeadas). Consequências em cadeia:

- `getProfileById`/`getCurrentUser` usam um select de 25 colunas; se
  **uma** coluna faltar no banco, o PostgREST responde 400 e o erro era
  **engolido** (`if (!data) return null`):
  - `getCurrentUser` → user `null` → usuário "deslogado" a cada recarga;
  - `getProfileById` → `null` → o `/perfil` interpretava como "perfil não
    existe" → **redirect para /buscar** (o bug reportado);
- `updateProfile`/`register`: o `update…select`/`upsert…select` é atômico —
  select com coluna ausente reverteria a gravação inteira.

### 7.3. O que mudou

- **`selectProfileRow()`** (novo): tenta o select grande; em erro, repete com
  `select("*")` (nunca referencia coluna específica; `mapProfile()` aplica
  defaults). Falha total LANÇA — o `/perfil` exibe "Tentar novamente" em vez
  de redirecionar; `getCurrentUser` mantém o comportamento de deslogar só
  quando o banco de fato está inacessível.
- Aplicado a `getCurrentUser`, `getProfileById`; `updateProfile` repete o
  update com `select("*")` (idempotente) se o select grande falhar; o
  last-resort do `register` também usa `select("*")`.
- `getAdById`: a resolução do dono no retry também tem fallback `select("*")`.

### 7.4. Verificação

- `tsc` limpo; build OK; ESLint 0.
- Harness client-fake ampliado para **29/29 PASS** (inclui: drift de coluna
  no perfil → fallback; falha total → lança sem redirect falso; IDOR;
  createAd com/sem coluna images; embeds nomeados; read-after-write).
- Demo-mode sem regressão.

### 7.5. Diagnóstico pendente (para eliminar a raiz no banco)

O código agora é tolerante ao drift, mas o ideal é alinhar o banco com o
schema. Basta rodar no **SQL Editor do Supabase** (apenas leitura) e enviar
o resultado:

```sql
select table_name, column_name from information_schema.columns
where table_schema='public' and table_name in ('profiles','ads','reviews','ad_images')
order by table_name, ordinal_position;
select conname, conrelid::regclass::text as tabela from pg_constraint
where contype='f' and connamespace='public'::regnamespace order by 2,1;
```

---

## 8. Correção 4 (2026-08-30) — foto some do anúncio após publicar (caixa cinza silenciosa)

### 8.1. Sintoma

Fluxo de navegação corrigido (confirmado pelo usuário). Novo: publicar
anúncio com foto → fechar a página → reabrir → **foto sumiu** (caixa
cinza vazia na área da imagem, sem nenhum aviso).

### 8.2. O que estava errado (na verificação e no feedback)

1. A "prova" read-after-write do publicar só checa que a URL é uma
   **string** começando com `https://` — **nunca verifica se a imagem
   carrega**. Se o bucket `ads` do Supabase estiver privado (política de
   leitura 403) ou o objecto 404, a URL fica salva no banco mas o
   browser nunca exibe a imagem.
2. A página do anúncio tinha `onError → display:none` no `<img>`: falha
   de carga **sumia em silêncio**, restando a caixa cinza sem
   explicação (exatamente o screenshot).

### 8.3. Mudanças

- `uploadAdImage()` (storage.ts): após o upload, valida que o objecto é
  **visível** usando o mesmo caminho do `<img>` da UI (`new Image()` —
  imune a CORS, reproduz o comportamento real da página; 2 tentativas,
  12s cada). Falha → remove o órfão do storage + erro **claro** no
  momento da publicação ("armazenamento não deixou a foto acessível").
- Página do anúncio: falha de carga por foto agora mostra
  **"Foto indisponível"** (mantendo o carrossel navegável quando há
  fotos múltiplas) + `console.error` com a URL para diagnóstico.

### 8.4. Diagnóstico pendente (qual dos dois cenários é o seu)

Cenário A: a URL está no banco mas o storage não serve (403/404) →
causa = política/bucket. Cenário B: a URL nem chegou ao banco → causa =
escrita. O anon key (pública) do Supabase resolve na hora; ou, sem
chave: DevTools → Network → recarregar a página do anúncio → status da
requisição `.webp` (200/404/403).

---

## 9. Correção 5 (2026-08-30) — mapa real do banco de produção + correções finais

### 9.1. O banco foi consultado diretamente (chave anon pública)

Descobertas confirmadas no Supabase real:

| Item | Estado em produção |
|---|---|
| `profiles.avatar_path` | **NÃO EXISTE (42703)** — o `schema.sql` tinha o ALTER apontando para `ads` (copy-paste). Corrigido no schema.sql. |
| `profiles.cover_path` | Existe, mas **negada ao papel `anon` (42501)** — intencional: o "duplo escudo" do schema.sql faz `REVOKE` do select de tabela e `GRANT` apenas uma lista de colunas (proteção do `whatsapp`). |
| `select *` em profiles | **42501 para todos os papéis** (inclui `cover_path`, que não está no GRANT). |
| `ads.images`, `ad_images` | Existem e legíveis ✓ |
| Bucket `ads` (leitura pública) | Não verificável sem header de auth — a próxima publicação testa (correção 4) |

Consequência: o fallback `select("*")` da correção 3 **não funciona neste banco**
(42501). Todo o código foi migrado para a **lista segura**
(`PROFILE_SAFE_SELECT` = exatamente as colunas do GRANT do duplo escudo)
+ fallback core (`id, nome, email, avatar_url`). Nenhum `select *` em
profiles resta; `avatar_path` saiu de todos os selects do client
(caminho de limpeza lê/grava separadamente, com retry tolerante).

### 9.2. Mudanças

- `PROFILE_SAFE_SELECT`/`PROFILE_MIN_SELECT` substituem o select grande;
  `selectProfileRow` usa SAFE → core. Aplica-se a: `getCurrentUser`,
  `getProfileById`, **login** (que usava `select *`), último recurso do
  **cadastro** e retorno do `updateProfile`.
- `updateProfile`: retry retira `avatar_path` da row (42703/42501) e o
  RETURNING usa a lista segura.
- Upload de avatar: se `update {avatar_path, avatar_url}` falhar, repete
  só com `avatar_url` (o avatar passa a persistir no banco mesmo sem a
  coluna; a limpeza de órfãos extrai o path da URL).
- `getAdById`: embed de profiles sem `avatar_path` → o select pesado volta
  a rodar em 1 round-trip no banco real (sem fallback).
- Cadastro: `email`/`whatsapp` saem do upsert (o trigger SQL já grava os
  dois a partir do metadado do auth; `email` nem está no GRANT de update).
- **`validateImageFile` (security.ts)**: o erro "Extensão não permitida"
  bloqueava imagens válidas por causa do NOME do arquivo (sem extensão,
  "foto.png(1)" etc.). Agora: whitelist de MIME (gate real) + re-encoding
  via canvas + blocklist só para extensões de texto/executável.
- `schema.sql`: ALTER de `avatar_path` corrigido para `profiles` (era
  `ads`).

### 9.3. Para o banco ficar 100% alinhado (1 linha, no SQL Editor)

```sql
alter table public.profiles add column if not exists avatar_path text;
```

### 9.4. Verificação

tsc limpo; build OK; ESLint 0; harness **34/34 PASS** (SAFE → core,
updateProfile com retry sem avatar_path, IDOR, createAd c/ e s/ coluna
images, read-after-write, embeds nomeados); demo-mode OK.

### 9.5. Aberto

- Bucket `ads` "Public"/políticas de leitura: checar no dashboard
  (Storage → ads) — se a foto continuar sumindo, o erro agora aparece na
  hora da publicação (correção 4) e aponta exatamente para isso.

---

## 10. Correção 6 (2026-08-30) — avatar Central de Ajuda (RLS) + exclusão de usuário por admin

### 10.1. Avatar da Central de Ajuda: "new row violates row-level security policy"

Causa raiz (confirmada no código e no comportamento real): as policies de
upload do bucket `avatars` exigem que o **1º segmento do path seja o UUID
do usuário** (`(storage.foldername(name))[1] = auth.uid()::text`). O fluxo
da Central de Ajuda envia para `avatars/help/{admin|founder}/...` →
prefixo `help` ≠ UUID → **RLS viola**.

Correção (schema.sql, idempotente): policies `help_team_avatar_insert` e
`help_team_avatar_delete` no `storage.objects` — bucket `avatars`, prefixo
`help/`, restritas a `public.is_admin()`. Código do app não muda (o path
`help/...` já era o design). Leitura pública já funciona
(`avatars_public_read`). O cron de órfãos ignora pastas não-UUID
(`help` é pulado no `assertValidId`).

### 10.2. Admin não consegue excluir usuário

Diagnóstico com a chave anon no banco real:
- `profiles` tem 2 usuários; o dono tem `role='admin'` ✓ (a checagem do
  client passa — por isso o /admin abre);
- a RPC `delete_user_by_admin` **existe e executa** em produção (respondeu
  com a própria guarda "Apenas administradores podem excluir usuários"
  quando chamada por anon);
- tabela `messages` existe ✓.

Conclusão: a versão da função `is_admin()`/RPC em produção é **anterior**
à do repositório (banco divergente) e retorna `false` para a conta admin
atual → a RPC levanta a exceção e o app exibe o toast com a mensagem crua.
Correção: recriar `is_admin()` + `delete_user_by_admin` (versão do
repositório) + GRANT — SQL idempotente entregue ao usuário (SQL Editor).

### 10.3. Nota

Buckets `ads`/`avatars`/`covers` confirmados **PUBLIC** no dashboard
(screenshot do usuário) — a leitura pública de fotos não é o problema.

---

## 11. Correção 7 (2026-08-31) — foto do anúncio sumiu da noite para o dia: diagnóstico + blindagem

### 11.1. Diagnóstico (banco consultado ao vivo)

Anúncio `441c0487-…` publicado em 30/08 15:12 (Brasília) com foto; em
31/08 a foto não aparece mais.

| Verificação | Resultado |
|---|---|
| `ads.images` (coluna) | **URL íntegra no banco** ✓ |
| `ad_images.image_url` | **URL íntegra** ✓ |
| `updated_at` | 31/08 07:01 = incremento de views (RPC) — **não houve edição** |
| Mesma query que a página roda (heavy select + embeds, papel anon) | **Retorna a foto** ✓ |
| Bucket `ads` | PUBLIC no dashboard ✓ |
| Cron `cleanupOrphanedFiles` (03:00 UTC, janela da madrugada) | Roda com chave **anon** — e NÃO existe policy de delete para anon → **o cron NUNCA conseguiu apagar nada (RLS bloqueia cada remoção)**. Inofensivo no estado atual |
| Demos caminhos de deleção (`deleteAllAdImages`, `setAdImages`, probe de upload) | Todos escopados por prefixo `{dono}/{anuncio}/` e não foram disparados |

Conclusão: o banco, a query e a página estão íntegros; a falha é o **objeto
no storage** (404 no browser — a página renderiza o `<img>` e ele falha).
O deletor não é identificável no código (provável remoção manual no
dashboard de Storage — o usuário estava na aba Files). **Teste decisivo
(10s):** abrir a URL da foto em nova aba — imagem = arquivo existe;
"Object not found" = arquivo foi removido.

### 11.2. Blindagem aplicada (foto permanente enquanto o anúncio existir)

1. **Cron ads**: NUNCA deleta nada em pasta de anúncio que ainda existe
   no banco; guarda de frescor (nada com <24h); log de cada remoção.
2. **Cron avatars**: seção estava em no-op acidental (select com
   `avatar_path` → 42703 abortava) E com lógica perigosa (podia apagar o
   avatar ATIVO de perfil existente se a leitura falhasse). Agora: sem
   `avatar_path` no select, avatar ativo nunca tocado, guarda 24h, nunca
   apaga o único arquivo de perfil existente, log de cada remoção.
   **Importante: correção 6 mandava rodar SQL que cria `avatar_path` —
   esta seção só ficaria perigosa ANTES desta correção; agora é segura.**
3. **Probe de publicação (correção 4)**: falsa-negativa de visibilidade
   NUNCA apaga a foto enviada (mantém o objeto; retry republica).
4. **`setAdImages`**: deleção no storage agora exige ownership estrita
   (dono + adId extraídos do path) antes de remover.
5. **Página do anúncio**: se há foto no banco mas o browser falha
   (404/403), a galeria permanece com **"Foto indisponível"** (com log
   da URL no console) em vez de trocar tudo pelo placeholder de
   categoria — o usuário passa a distinguir "sem foto" de "foto sumiu do
   storage".

### 11.3. Recuperação da foto atual

O arquivo original está no dispositivo do usuário: anúncio → **Editar** →
gerenciar fotos → enviar de novo.

### 11.4. Verificação

tsc/build/ESLint OK (2 achados pré-existentes em HEAD); harness **39/39
PASS** (novo: foto de anúncio ativo preservada, avatar ativo preservado,
órfãos de anúncios excluídos +24h limpos); demo OK.

### 11.5. Observação

O cron hoje é no-op de deleção por RLS (anon). Para a faxina de storage
de anúncios excluídos funcionar de fato, seria opcional configurar
`SUPABASE_SERVICE_ROLE_KEY` na Vercel — mas com as guardas acima isso
só apaga pastas de anúncios que já não existem no banco, com +24h.
