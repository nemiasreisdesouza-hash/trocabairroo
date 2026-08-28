# RCA P0 Foto + Filtros Premium — TrocaES

## 1. RCA do bug da foto (causa raiz)

**Causa raiz:** Pipeline de upload em `anuncio/criar` usava `backend.uploadImage` (retorna string) + `setAdImages` em dois passos não-atômicos, sem validação de sucesso e sem rollback. Se `compressImage`/`blobToDataUrl` falhasse ou `localStorage` estourasse quota (DataURL Base64 ~1.2MB por 3 fotos), `saveDemoDB` falhava silenciosamente (`safeSetItem` retorna false) mas `cache` mantinha imagens só em memória; após F5 ou navegação para `/anuncio/[id]` que relê `adImages` do storage, imagem sumia e card mostrava placeholder cinza. Além disso, `adId` era criado antes do upload mas, em caso de falha, o anúncio órfão sem imagens permanecia publicado (“sucesso mudo”).

**Fix:** Ordem atômica com contrato `{success, url, path}` via `uploadAdImageWithCleanup` (storage.ts já comprimia WebP 1600px + strip EXIF), coleta de URLs, `setAdImages` só após todos uploads OK, redirect só depois de persistência, e rollback `deleteAd` se falhar.

## 2. Tabela dos filtros com critério implementado

| Filtro (label curto) | Critério EXATO implementado | Ordenação | Empty State |
|---|---|---|---|
| **Parceiros** (substitui Recomendados) | `ad.userIsPartner === true` (ou `isPartner`). Checa `ad.userIsPartner` e `userIsPartner`. | Mais recentes primeiro; tie-break `destaque/topoFeed` | “Nenhum parceiro publicou ainda no seu raio. Em breve!” |
| **No seu Bairro** | Cascata: a) mesmo `bairro` do usuário logado (match normalizado trim+lowercase+NFD sem acento). b) Se zero: mesmo `cidade` + mesma UF se existir. c) Se ainda zero: empty. Usuário sem bairro → CTA “Complete seu bairro no perfil”. | Recentes (herda) | “Nada no seu bairro ainda — veja Parceiros ou publique o primeiro.” / CTA bairro |
| **Combina Comigo** (NOVO) | Match bidirecional: pega categorias/tags/`aceitaEmTroca` dos anúncios ATIVOS do usuário logado. Tokens normalizados (split vírgula, lowercase, sem acento). Outros usuários onde: o que eles OFERECEM intersecta o que EU ACEITO/PRECISO OU o que eles ACEITAM intersecta o que EU OFEREÇO. Fallback: `user.categorias` se sem anúncios; senão “Publique um anúncio para ver combinações.” | Recentes | “Publique um anúncio para ver combinações.” |
| **Urgente** | Mapeamento existente: `tipo === "preciso"` (proxy de “Precisa Hoje”) + heurística texto: titulo/descricao/aceitaEmTroca contém `urgente`, `hoje`, `precisa hoje`, `urgencia` normalizado. Documentado como proxy pois não há flag `urgent` consistente no schema. | Recentes | “Nenhum anúncio marcado como urgente (tipo PRECISO) no momento.” |
| **Em Destaque** | `destaque === true` ou `topoFeed === true` (boost pago, flag já usada nos cards “⭐ DESTAQUE”). | Mais recentes primeiro | “Nenhum anúncio em destaque neste momento.” |

**Default Home:** Parceiros se houver resultados; senão No seu Bairro; senão feed geral recente. Implementado via `useEffect` que calcula `tabCounts` e seta `activeTab` se usuário não selecionou manualmente (`hasManuallySelectedTab`).

**UI:** Pill roxo ativo (`bg-purple-700 text-white`), outline inativo (`bg-white border-2 border-gray-200`), contador discreto `(N)` com `bg-white/20` ativo e `bg-gray-100` inativo.

## 3. Diffs principais (arquivos)

### `src/app/anuncio/criar/page.tsx`
- **Antes:** `uploadImage` → string → `setAdImages`, sem rollback, redirect mesmo se upload falhar parcialmente.
- **Depois:** 
  ```ts
  const adId = await createAd(...);
  for (img of images) {
    const result = await uploadAdImageWithCleanup(file, userId, adId);
    if (!result.success) throw...
    urls.push(result.url);
  }
  await setAdImages(adId, urls);
  // só então redirect
  catch: await deleteAd(userId, adId) // evita placeholder cinza
  ```

### `src/app/anuncio/editar/[id]/page.tsx`
- Mesma atomicidade: `uploadAdImageWithCleanup(file, userId, id)` (3 args), `setAdImages` antes de redirect, limpeza de imagens quando lista vazia.

### `src/app/page.tsx`
- **TabId:** `recomendados` → `parceiros|bairro|combina|urgente|destaques|vizinho`
- **Helpers:** `normalizeText` (NFD sem acento), `tokenize` (split vírgula, palavras >2), `isPartnerAd`, `isDestaqueAd`, `isUrgenteAd`.
- **feedList useMemo:** lógica premium com cascata bairro→cidade, parceiros recentes+tie-break destaque, urgente heurística, destaque recentes, combina bidirecional com Sets `myOffering`/`mySeeking` vs `otherOffering`/`otherSeeking`.
- **tabCounts useMemo:** contadores discretos por filtro.
- **Default tab useEffect:** parceiros>0 ? parceiros : bairro>0 ? bairro : parceiros.
- **Render tabs:** pill roxo ativo, contador opcional.
- **Empty states:** mensagens exatas do product decision + CTA bairro.

### `src/lib/backend.ts` / `src/lib/storage.ts`
- Nenhuma mudança de schema, apenas reuso de `uploadAdImageWithCleanup` que já fazia compressão WebP 1600px + strip EXIF + validação MIME/size.

## 4. Checklist de teste manual

- [ ] **P0 1 foto:** Criar OFEREÇO com 1 foto JPG 2MB → toast sucesso → `/perfil/[id]` lista mostra foto → `/anuncio/[id]` carrossel mostra foto → F5 mantém foto (demo localStorage).
- [ ] **P0 3 fotos:** Criar OFEREÇO com 3 fotos PNG/WebP → detalhe carrossel 3 dots, navegação left/right OK → editar removendo 1 foto, adicionando nova → listagem e detalhe refletem 3 fotos novas → F5 OK.
- [ ] **P0 falha upload:** Simular arquivo >5MB ou tipo HEIC → toast erro “Falha ao enviar foto” → permanece no form, nenhum anúncio órfão sem imagem criado (verifica dashboard não tem placeholder).
- [ ] **Parceiros:** Logar com usuário parceiro (isPartner) publicar anúncio → Home chip Parceiros mostra (N) ≥1 → filtro lista só parceiros, mais recente primeiro → empty state “Nenhum parceiro publicou ainda no seu raio. Em breve!” quando zero.
- [ ] **No seu Bairro:** Usuário com bairro “Jesus de Nazaré” → chip Bairro mostra anúncios mesmo bairro normalizado (case/acento) → se zero, mostra mesma cidade Vitória → se sem bairro no perfil, empty CTA “Complete seu bairro no perfil” → link para `/perfil/editar`.
- [ ] **Combina Comigo:** Usuário com anúncio ofereço “Design” aceita “Açaí” → outro usuário oferece “Açaí” → Combina lista esse anúncio → usuário sem anúncios mas com categorias favoritas → fallback categorias → usuário sem nada → empty “Publique um anúncio para ver combinações.”
- [ ] **Urgente:** Anúncio tipo “preciso” aparece em Urgente → anúncio com “urgente” ou “hoje” no título também aparece (heurística) → documentado.
- [ ] **Em Destaque:** Ativar plano destaque/topo via `activatePlan` → chip Destaque mostra → ordenação mais recentes.
- [ ] **Default:** Abrir Home sem filtro manual → se parceiros >0, ativo Parceiros; senão se bairro >0, ativo Bairro; senão feed geral.
- [ ] **Segurança:** `npx tsc --noEmit` 0 erros, WAF intacto, VerifiedBadge e isPartner CTA preservados.

## 5. Comandos

```bash
npx tsc --noEmit
git add .
git commit -m "feat(home): filtros premium (Parceiros/Bairro/Combina/Urgente/Destaque) + fix P0 imagens no create ad"
git push origin arena/01a04342-trocabairroo
```
