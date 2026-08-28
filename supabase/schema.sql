-- ═══════════════════════════════════════════════════════════════════════════
-- TROCAES · SCHEMA SUPABASE (PostgreSQL + Auth + Storage + RLS)
-- Execute este arquivo completo no SQL Editor do seu projeto Supabase.
-- Idempotente: pode ser executado mais de uma vez sem quebrar dados.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 0. EXTENSÕES
-- ─────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- 1. TABELAS
-- ─────────────────────────────────────────────────────────────

-- PROFILES (estende auth.users)
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  nome              text not null default '',
  email             text not null unique,
  whatsapp          text,
  cpf               text,
  avatar_url        text,
  bio               text,
  uf                varchar(2) not null default 'ES',
  cidade            text not null default 'Vitória',
  bairro            text,
  tipo_perfil       text not null default 'empreendedor'
                    check (tipo_perfil in ('empreendedor', 'criador', 'ambos')),
  categorias        text[] not null default '{}',
  media_avaliacao   real not null default 0,
  aprovacao         real not null default 100,
  total_avaliacoes  integer not null default 0,
  trocas_concluidas integer not null default 0,
  verificado        boolean not null default false,
  verificado_manual boolean not null default false,
  -- 🎫 Passe Pré-Pago do Selo Verificado (30 dias, sem cancelamento)
  verified_until    timestamptz,
  -- Slim Partner — checkmark dourado único
  is_partner        boolean not null default false,
  cover_url         text,
  cover_path        text,
  role              text not null default 'usuario'
                    check (role in ('usuario', 'admin')),
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ADS (anúncios)
create table if not exists public.ads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  tipo            text not null check (tipo in ('ofereço', 'preciso')),
  titulo          varchar(255) not null,
  descricao       text not null,
  categoria       varchar(100) not null,
  bairro          varchar(255) not null,
  cidade          varchar(255) not null default 'Vitória',
  uf              varchar(2) not null default 'ES',
  aceita_em_troca text not null,
  destaque        boolean not null default false,
  topo_feed       boolean not null default false,
  status          text not null default 'ativo'
                  check (status in ('pendente', 'aprovado', 'rejeitado', 'pausado', 'arquivado', 'ativo')),
  visualizacoes   integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- AD_IMAGES
create table if not exists public.ad_images (
  id         uuid primary key default gen_random_uuid(),
  ad_id      uuid not null references public.ads (id) on delete cascade,
  image_url  text not null,
  ordem      integer not null default 0,
  created_at timestamptz not null default now()
);

-- TRADES (trocas)
-- Fluxo: pending → accepted → in_progress → completed → awaiting_reviews → finished
-- (cancelled / rejected são estados terminais)
create table if not exists public.trades (
  id                  uuid primary key default gen_random_uuid(),
  ad_id               uuid not null references public.ads (id) on delete cascade,
  requester_id        uuid not null references public.profiles (id) on delete cascade,
  owner_id            uuid not null references public.profiles (id) on delete cascade,
  status              text not null default 'pending'
                      check (status in (
                        'pending', 'accepted', 'in_progress', 'completed',
                        'awaiting_reviews', 'finished', 'cancelled', 'rejected'
                      )),
  requester_completed boolean not null default false,
  owner_completed     boolean not null default false,
  requester_reviewed  boolean not null default false,
  owner_reviewed      boolean not null default false,
  -- 🛡️ DUPLO ESCUDO DE PRIVACIDADE: o WhatsApp só é liberado com
  -- consentimento explícito (opt-in) DENTRO da troca — nunca no aceite.
  whatsapp_share_status text not null default 'none'
    check (whatsapp_share_status in ('none','requested','approved','rejected')),
  whatsapp_requested_by uuid references public.profiles (id) on delete set null,
  message             text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint trades_no_self check (requester_id <> owner_id)
);

-- REVIEWS (avaliações recíprocas de trocas)
-- 🛡️ ANTI-FRAUDE: as avaliações pertencem AO PERFIL do usuário
-- (avaliado_id → profiles) e ficam gravadas ETERNAMENTE.
-- ON DELETE RESTRICT: excluir uma troca/anúncio NUNCA apaga reviews.
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  trade_id     uuid not null references public.trades (id) on delete restrict,
  avaliador_id uuid not null references public.profiles (id) on delete cascade,
  avaliado_id  uuid not null references public.profiles (id) on delete cascade,
  nota         integer not null check (nota between 1 and 5),
  comentario   text,
  cumprimento  text not null check (cumprimento in ('sim', 'parcialmente', 'nao')),
  created_at   timestamptz not null default now(),
  unique (trade_id, avaliador_id)
);

-- MESSAGES · Chat temporário em tempo real vinculado às trocas
-- 🕒 TEMPORÁRIO POR DESIGN: mensagens de trocas concluídas (finished)
-- há mais de 7 dias são apagadas automaticamente (cleanup_expired_messages).
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  trade_id   uuid not null references public.trades (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index if not exists idx_messages_trade on public.messages (trade_id, created_at);
create index if not exists idx_messages_created on public.messages (created_at);

-- SITE_CONTENT (CMS dinâmico da Home / páginas públicas)
create table if not exists public.site_content (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- SUBSCRIPTIONS (planos freemium + impulsionamentos)
create table if not exists public.subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  ad_id      uuid references public.ads (id) on delete set null,
  plano      text not null check (plano in (
             'experimente', 'conexao', 'expansao',
             'topo_feed', 'destaque', 'verificado')),
  valor      numeric(10, 2) not null default 0,
  status     text not null default 'ativo'
             check (status in ('ativo', 'pendente', 'cancelado', 'expirado')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. ÍNDICES
-- ─────────────────────────────────────────────────────────────
create index if not exists idx_ads_status_created   on public.ads (status, created_at desc);
create index if not exists idx_ads_bairro           on public.ads (bairro);
create index if not exists idx_ads_user             on public.ads (user_id);
create index if not exists idx_ad_images_ad         on public.ad_images (ad_id, ordem);
create index if not exists idx_trades_owner         on public.trades (owner_id);
create index if not exists idx_trades_requester     on public.trades (requester_id);
create index if not exists idx_reviews_avaliado     on public.reviews (avaliado_id);
create index if not exists idx_subscriptions_user   on public.subscriptions (user_id);

-- ─────────────────────────────────────────────────────────────
-- 2.5 MIGRAÇÕES ANTI-FRAUDE (idempotentes para bancos existentes)
-- ─────────────────────────────────────────────────────────────

-- a0) Passe pré-pago do Selo Verificado (30 dias)
alter table public.profiles add column if not exists verified_until timestamptz;
-- Slim Partner
alter table public.profiles add column if not exists is_partner boolean not null default false;
alter table public.profiles add column if not exists cover_url text;
alter table public.profiles add column if not exists cover_path text;

-- a) Status 'arquivado' para anúncios com histórico de trocas
alter table public.ads drop constraint if exists ads_status_check;
alter table public.ads add constraint ads_status_check
  check (status in ('pendente', 'aprovado', 'rejeitado', 'pausado', 'arquivado', 'ativo'));

-- [URGENTE] Coluna is_urgent exclusiva verificados azul/dourado + colunas boost
alter table public.ads add column if not exists is_urgent boolean not null default false;
alter table public.ads add column if not exists is_featured boolean not null default false;
alter table public.ads add column if not exists featured_until timestamptz;
alter table public.ads add column if not exists is_top_feed boolean not null default false;
alter table public.ads add column if not exists top_feed_until timestamptz;
alter table public.ads add column if not exists boost_type text;
alter table public.ads add column if not exists images text[] not null default '{}';
alter table public.ads add column if not exists avatar_path text;


-- b) Avaliações são ETERNAS: excluir trades/ads NUNCA apaga reviews.
--    (FK de cascata → RESTRICT: o Postgres bloqueia fisicamente)
alter table public.reviews drop constraint if exists reviews_trade_id_fkey;
alter table public.reviews add constraint reviews_trade_id_fkey
  foreign key (trade_id) references public.trades (id) on delete restrict;

-- c) Comentário documental da regra de reputação
comment on table public.reviews is
  'Avaliações recíprocas de trocas. Reputação (estrelas, % de aprovação, trocas concluídas) é agregada e gravada no PERFIL (profiles) via trigger — desativar/excluir anúncio NÃO altera o histórico.';

-- ═══════════════════════════════════════════════════════════
-- 🛡️ DUPLO ESCUDO · coluna whatsapp protegida no nível de coluna
-- Terceiros NÃO conseguem ler profiles.whatsapp diretamente; o acesso
-- só existe via SECURITY DEFINER: dono (get/set_own_whatsapp) ou troca
-- com whatsapp_share_status='approved' (get_trade_contact).
-- ═══════════════════════════════════════════════════════════
revoke select on public.profiles from anon, authenticated;
grant select (id, nome, email, cpf, avatar_url, bio, uf, cidade, bairro,
  tipo_perfil, categorias, media_avaliacao, aprovacao, total_avaliacoes,
  trocas_concluidas, verificado, verificado_manual, verified_until, is_partner, cover_url, role, ativo,
  created_at, updated_at) on public.profiles to anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (nome, whatsapp, bio, uf, cidade, bairro, tipo_perfil,
  categorias, avatar_url, cover_url, cover_path) on public.profiles to authenticated;

-- WhatsApp do próprio usuário (edição de perfil)
create or replace function public.get_own_whatsapp() returns text
language sql security definer set search_path = public as $$
  select whatsapp from public.profiles where id = auth.uid();
$$;
create or replace function public.set_own_whatsapp(p_whatsapp text) returns void
language sql security definer set search_path = public as $$
  update public.profiles set whatsapp = p_whatsapp where id = auth.uid();
$$;
grant execute on function public.get_own_whatsapp() to authenticated;
grant execute on function public.set_own_whatsapp(text) to authenticated;

-- 📱 Contato da troca: SOMENTE com consentimento aprovado
create or replace function public.get_trade_contact(p_trade_id uuid) returns text
language sql security definer set search_path = public stable as $$
  select pr.whatsapp
  from public.trades t
  join public.profiles pr
    on pr.id = case when t.requester_id = auth.uid() then t.owner_id
                    else t.requester_id end
  where t.id = p_trade_id
    and (t.requester_id = auth.uid() or t.owner_id = auth.uid())
    and t.whatsapp_share_status = 'approved'
  limit 1;
$$;
grant execute on function public.get_trade_contact(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. FUNÇÕES AUXILIARES
-- ─────────────────────────────────────────────────────────────

-- Verifica se o usuário autenticado é admin
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Mantém updated_at atualizado
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_ads_updated on public.ads;
create trigger trg_ads_updated before update on public.ads
  for each row execute function public.set_updated_at();

drop trigger if exists trg_trades_updated on public.trades;
create trigger trg_trades_updated before update on public.trades
  for each row execute function public.set_updated_at();

-- Cria o profile automaticamente quando o usuário se cadastra no Auth.
-- Lê os metadados enviados no signUp para já preencher o cadastro.
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- 👑 SUPER ADMIN MESTRE: e-mail do proprietário nasce ADMIN
  insert into public.profiles (id, email, nome, whatsapp, cpf, uf, cidade, bairro, tipo_perfil, categorias, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'whatsapp',
    new.raw_user_meta_data ->> 'cpf',
    coalesce(new.raw_user_meta_data ->> 'uf', 'ES'),
    coalesce(new.raw_user_meta_data ->> 'cidade', 'Vitória'),
    new.raw_user_meta_data ->> 'bairro',
    coalesce(new.raw_user_meta_data ->> 'tipo_perfil', 'empreendedor'),
    coalesce(
      (select array_agg(x) from jsonb_array_elements_text(
        coalesce(new.raw_user_meta_data -> 'categorias', '[]'::jsonb)
      ) as x),
      '{}'::text[]
    ),
    -- Auto-promoção do Dono/Fundador
    case when lower(new.email) = 'nemiasreisdesouza@gmail.com'
      then 'admin' else 'usuario' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Bloqueia escalada de privilégios: só admin (ou contexto security-definer
-- / SQL Editor, onde current_user = 'postgres') pode alterar estes campos.
create or replace function public.guard_profile_changes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role
      or new.verificado is distinct from old.verificado
      or new.verificado_manual is distinct from old.verificado_manual
      or new.is_partner is distinct from old.is_partner
      or new.ativo is distinct from old.ativo
      or new.email is distinct from old.email)
     and current_user <> 'postgres'
     and not public.is_admin() then
    raise exception 'Sem permissão para alterar estes campos.';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profiles on public.profiles;
create trigger trg_guard_profiles before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- ═══════════════════════════════════════════════════════════
-- 👑 TRAVA INVIOLÁVEL DA CONTA MESTRA DO PROPRIETÁRIO
-- Nem admins (nem o próprio delete_user_by_admin) podem excluir,
-- rebaixar (role <> 'admin') ou alterar o e-mail da conta Mestra.
-- ═══════════════════════════════════════════════════════════
create or replace function public.guard_master_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(old.email) = 'nemiasreisdesouza@gmail.com' then
    if tg_op = 'DELETE'
       or new.role is distinct from 'admin'
       or lower(new.email) is distinct from lower(old.email) then
      raise exception 'Ação negada: A conta Mestra do Proprietário não pode ser excluída ou rebaixada por nenhum usuário.';
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_guard_master_profiles on public.profiles;
create trigger trg_guard_master_profiles
  before update or delete on public.profiles
  for each row execute function public.guard_master_owner();

-- Recalcula reputação + finaliza troca quando as 2 avaliações existem:
--  • % aprovação = (positivas / total) * 100  → cumprimento = 'sim'
--  • média de estrelas = avg(nota)
--  • trocas_concluidas += 1 para os dois lados quando trade → finished
create or replace function public.handle_review_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_total integer;
  v_positivas integer;
  v_media numeric;
  v_review_count integer;
  v_requester uuid;
  v_owner uuid;
begin
  -- Reputação de quem foi avaliado
  select count(*), count(*) filter (where cumprimento = 'sim'), coalesce(avg(nota), 0)
    into v_total, v_positivas, v_media
  from public.reviews where avaliado_id = new.avaliado_id;

  update public.profiles set
    total_avaliacoes = v_total,
    aprovacao = case when v_total > 0 then round((v_positivas::numeric / v_total) * 100) else 100 end,
    media_avaliacao = round(v_media, 2)
  where id = new.avaliado_id;

  -- Finaliza a troca quando ambos avaliaram
  select count(*) into v_review_count from public.reviews where trade_id = new.trade_id;

  if v_review_count >= 2 then
    select requester_id, owner_id into v_requester, v_owner
    from public.trades where id = new.trade_id;

    update public.trades set status = 'finished'
    where id = new.trade_id and status = 'awaiting_reviews';

    update public.profiles set trocas_concluidas = trocas_concluidas + 1
    where id in (v_requester, v_owner);
  end if;

  return new;
end $$;

drop trigger if exists trg_reviews_reputation on public.reviews;
create trigger trg_reviews_reputation after insert on public.reviews
  for each row execute function public.handle_review_insert();

-- Incrementa visualizações do anúncio (executado por qualquer visitante)
create or replace function public.increment_ad_views(p_ad_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.ads set visualizacoes = coalesce(visualizacoes, 0) + 1
  where id = p_ad_id;
$$;

-- Expira impulsionamentos/planos vencidos e remove selos correspondentes
create or replace function public.expire_subscriptions() returns void
language sql security definer set search_path = public as $$
  update public.subscriptions set status = 'expirado'
  where status = 'ativo' and expires_at is not null and expires_at < now();

  update public.ads set topo_feed = false
  where topo_feed and not exists (
    select 1 from public.subscriptions s
    where s.ad_id = public.ads.id and s.plano = 'topo_feed' and s.status = 'ativo'
  );

  update public.ads set destaque = false
  where destaque and not exists (
    select 1 from public.subscriptions s
    where s.ad_id = public.ads.id and s.plano = 'destaque' and s.status = 'ativo'
  );

  -- 🎫 Passe pré-pago: selo apaga quando verified_until vence
  update public.profiles set verificado = false
  where verificado
    and not verificado_manual
    and (verified_until is not null and verified_until < now());
$$;

-- 🧹 AUTO-LIMPEZA DO CHAT (expiração de 7 dias):
-- apaga mensagens de trocas finalizadas (finished) há mais de 7 dias,
-- mantendo a tabela leve (~0.1% do plano gratuito). O app também chama
-- esta função ao abrir qualquer chat (belt & suspenders).
create or replace function public.cleanup_expired_messages() returns integer
language sql security definer set search_path = public as $$
  with deleted as (
    delete from public.messages m
    using public.trades t
    where m.trade_id = t.id
      and t.status = 'finished'
      and t.updated_at < now() - interval '7 days'
    returning 1
  )
  select count(*)::integer from deleted;
$$;

grant execute on function public.cleanup_expired_messages() to anon, authenticated;

-- 🗑️ EXCLUSÃO COMPLETA DE USUÁRIO (apenas admin)
-- Remove o usuário de profiles + ads + trades + messages + reviews +
-- subscriptions e da autenticação (auth.users). SECURITY DEFINER é
-- necessário porque auth.users não é acessível via cliente.
create or replace function public.delete_user_by_admin(target_user_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  -- Apenas administradores (auth.uid() continua sendo o chamador)
  if not public.is_admin() then
    raise exception 'Apenas administradores podem excluir usuários.';
  end if;
  -- Proteção absoluta: nunca a conta Mestra do Proprietário
  if exists (
    select 1 from public.profiles
    where id = target_user_id and lower(email) = 'nemiasreisdesouza@gmail.com'
  ) then
    raise exception 'Ação negada: A conta Mestra do Proprietário não pode ser excluída ou rebaixada por nenhum usuário.';
  end if;
  -- Proteção: não excluir a si mesmo nem outro admin
  if target_user_id = auth.uid() then
    raise exception 'Você não pode excluir a própria conta.';
  end if;
  if exists (
    select 1 from public.profiles
    where id = target_user_id and role = 'admin'
  ) then
    raise exception 'Não é permitido excluir outro administrador.';
  end if;

  -- 1. Mensagens das trocas do usuário
  delete from public.messages m
  using public.trades t
  where m.trade_id = t.id
    and (t.requester_id = target_user_id or t.owner_id = target_user_id);

  -- 2. Avaliações das trocas do usuário (FK RESTRICT exige ordem)
  delete from public.reviews r
  using public.trades t
  where r.trade_id = t.id
    and (t.requester_id = target_user_id or t.owner_id = target_user_id);

  -- 3. Trocas, anúncios, assinaturas e avaliações avulsas
  delete from public.trades
  where requester_id = target_user_id or owner_id = target_user_id;
  delete from public.ads where user_id = target_user_id;
  delete from public.subscriptions where user_id = target_user_id;
  delete from public.reviews
  where avaliador_id = target_user_id or avaliado_id = target_user_id;

  -- 4. Perfil e conta de autenticação (profiles.id → auth.users cascade)
  delete from public.profiles where id = target_user_id;
  delete from auth.users where id = target_user_id;
end $$;

grant execute on function public.delete_user_by_admin(uuid) to authenticated;

-- Agendamento diário (se a extensão pg_cron estiver disponível no projeto)
do $cleanup_sched$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'trocabairro-chat-cleanup',
      '17 3 * * *',
      'select public.cleanup_expired_messages();'
    );
  end if;
exception when others then
  null; -- pg_cron ausente: o app chama a função de forma preguiçosa
end
$cleanup_sched$;

grant execute on function public.increment_ad_views(uuid) to anon, authenticated;
grant execute on function public.expire_subscriptions() to anon, authenticated;

-- 🎫 PASSE PRÉ-PAGO (30 dias, PIX/acesso fixo — sem cancelamento):
-- cada pagamento SOMA 30 dias na data final (renovação antecipada soma)
create or replace function public.extend_verified_pass() returns void
language sql security definer set search_path = public as $$
  update public.profiles
     set verificado = true,
         verified_until =
           coalesce(greatest(verified_until, now()), now()) + interval '30 days'
   where id = auth.uid();
$$;

grant execute on function public.extend_verified_pass() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.ads           enable row level security;
alter table public.ad_images     enable row level security;
alter table public.trades        enable row level security;
alter table public.reviews       enable row level security;
alter table public.site_content  enable row level security;
alter table public.subscriptions enable row level security;

-- PROFILES
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated using (public.is_admin());

-- ADS
drop policy if exists ads_select on public.ads;
create policy ads_select on public.ads
  for select using (status = 'ativo' or user_id = auth.uid() or public.is_admin());

drop policy if exists ads_insert_own on public.ads;
create policy ads_insert_own on public.ads
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists ads_update_own on public.ads;
create policy ads_update_own on public.ads
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- 🛡️ ANTI-FRAUDE (RLS): proíbe excluir anúncio com trocas ativas
-- (pending, accepted, in_progress, completed, awaiting_reviews).
-- Anúncios só com trocas canceladas/rejeitadas podem ser excluídos;
-- anúncios com trocas concluídas seguem protegidos pela FK RESTRICT
-- de reviews (avaliações eternas) e devem ser apenas ARQUIVADOS.
drop policy if exists ads_delete_own on public.ads;
drop policy if exists ads_delete_guard on public.ads;
create policy ads_delete_guard on public.ads
  for delete to authenticated
  using (
    (user_id = auth.uid() or public.is_admin())
    and not exists (
      select 1 from public.trades t
      where t.ad_id = public.ads.id
        and t.status in (
          'pending', 'accepted', 'in_progress', 'completed', 'awaiting_reviews'
        )
    )
  );

-- AD_IMAGES
drop policy if exists ad_images_select on public.ad_images;
create policy ad_images_select on public.ad_images
  for select using (true);

drop policy if exists ad_images_insert_own on public.ad_images;
create policy ad_images_insert_own on public.ad_images
  for insert to authenticated with check (
    exists (select 1 from public.ads a where a.id = ad_id and a.user_id = auth.uid())
  );

drop policy if exists ad_images_delete_own on public.ad_images;
create policy ad_images_delete_own on public.ad_images
  for delete to authenticated using (
    exists (select 1 from public.ads a where a.id = ad_id and a.user_id = auth.uid())
    or public.is_admin()
  );

-- TRADES · fluxo de solicitação/aceite: o solicitante cria (pending),
-- o dono aceita — apenas participantes (ou admin) veem e movem o status.
-- O WhatsApp é liberado pelo app apenas após aceite (accepted+).
drop policy if exists trades_participants_select on public.trades;
create policy trades_participants_select on public.trades
  for select using (
    requester_id = auth.uid() or owner_id = auth.uid() or public.is_admin()
  );

drop policy if exists trades_insert_requester on public.trades;
create policy trades_insert_requester on public.trades
  for insert to authenticated with check (requester_id = auth.uid());

drop policy if exists trades_update_participants on public.trades;
create policy trades_update_participants on public.trades
  for update to authenticated
  using (requester_id = auth.uid() or owner_id = auth.uid() or public.is_admin());

drop policy if exists trades_delete_admin on public.trades;
create policy trades_delete_admin on public.trades
  for delete to authenticated using (public.is_admin());

-- REVIEWS
drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews
  for select using (true);

drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews
  for insert to authenticated with check (
    avaliador_id = auth.uid()
    and exists (
      select 1 from public.trades t
      where t.id = trade_id
        and t.status in ('awaiting_reviews', 'finished')
        and (t.requester_id = auth.uid() or t.owner_id = auth.uid())
        and (t.requester_reviewed = false or t.owner_reviewed = false)
    )
  );

drop policy if exists reviews_update_admin on public.reviews;
create policy reviews_update_admin on public.reviews
  for update to authenticated using (public.is_admin());

drop policy if exists reviews_delete_admin on public.reviews;
create policy reviews_delete_admin on public.reviews
  for delete to authenticated using (public.is_admin());

-- MESSAGES · apenas os participantes da troca (ou admin) leem/enviam
alter table public.messages enable row level security;

drop policy if exists messages_participants_select on public.messages;
create policy messages_participants_select on public.messages
  for select using (
    exists (
      select 1 from public.trades t
      where t.id = trade_id
        and (t.requester_id = auth.uid() or t.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists messages_participants_insert on public.messages;
create policy messages_participants_insert on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.trades t
      where t.id = trade_id
        and (t.requester_id = auth.uid() or t.owner_id = auth.uid())
        and t.status in ('pending', 'accepted', 'in_progress', 'completed', 'awaiting_reviews')
        and t.updated_at > now() - interval '7 days'
    )
  );

drop policy if exists messages_recipient_update on public.messages;
-- Marcar como lida: apenas o destinatário (participante que não enviou)
create policy messages_recipient_update on public.messages
  for update to authenticated using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.trades t
      where t.id = trade_id
        and (t.requester_id = auth.uid() or t.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists messages_admin_delete on public.messages;
create policy messages_admin_delete on public.messages
  for delete to authenticated using (public.is_admin());

-- SITE_CONTENT (leitura pública, escrita só admin)
drop policy if exists site_content_select on public.site_content;
create policy site_content_select on public.site_content
  for select using (true);

drop policy if exists site_content_admin_write on public.site_content;
create policy site_content_admin_write on public.site_content
  for insert to authenticated with check (public.is_admin());

drop policy if exists site_content_admin_update on public.site_content;
create policy site_content_admin_update on public.site_content
  for update to authenticated using (public.is_admin());

drop policy if exists site_content_admin_delete on public.site_content;
create policy site_content_admin_delete on public.site_content
  for delete to authenticated using (public.is_admin());

-- SUBSCRIPTIONS
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists subscriptions_insert_own on public.subscriptions;
create policy subscriptions_insert_own on public.subscriptions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists subscriptions_update on public.subscriptions;
create policy subscriptions_update on public.subscriptions
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists subscriptions_delete_admin on public.subscriptions;
create policy subscriptions_delete_admin on public.subscriptions
  for delete to authenticated using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 5. STORAGE — buckets públicos 'ads' e 'avatars'
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('ads', 'ads', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

drop policy if exists "ads_public_read" on storage.objects;
create policy "ads_public_read" on storage.objects
  for select using (bucket_id = 'ads');

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "ads_owner_upload" on storage.objects;
create policy "ads_owner_upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'ads' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_upload" on storage.objects;
create policy "avatars_owner_upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "ads_owner_update" on storage.objects;
create policy "ads_owner_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'ads' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "ads_owner_delete" on storage.objects;
create policy "ads_owner_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'ads' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "covers_public_read" on storage.objects;
create policy "covers_public_read" on storage.objects
  for select using (bucket_id = 'covers');

drop policy if exists "covers_owner_upload" on storage.objects;
create policy "covers_owner_upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "covers_owner_update" on storage.objects;
create policy "covers_owner_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "covers_owner_delete" on storage.objects;
create policy "covers_owner_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────
-- 5.5 REALTIME · chat em tempo real (Supabase Realtime)
-- ─────────────────────────────────────────────────────────────
do $realtime_pub$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then null; -- publicação inexistente (self-hosted)
end
$realtime_pub$;

-- ─────────────────────────────────────────────────────────────
-- 6. SEED · CMS padrão (site_content)
--    Espelha os defaults do código (src/lib/site-content.ts).
--    O site funciona mesmo com a tabela vazia (fallback em código).
-- ─────────────────────────────────────────────────────────────
insert into public.site_content (key, value) values
  ('home.hero.badge',            'Jesus de Nazaré · Vitória/ES'),
  ('home.hero.title',            'Troque serviços com'),
  ('home.hero.title_highlight',  'gente do seu bairro'),
  ('home.hero.subtitle',         'Sem dinheiro. Apenas **confiança**, parcerias e oportunidades.'),
  ('home.hero.cta_primary',      '🚀 Começar minha troca agora'),
  ('home.hero.cta_secondary',    'Explorar anúncios perto de mim'),
  ('home.como_funciona.title',   'Como funciona? 🤔'),
  ('home.como_funciona.1.emoji', '📣'),
  ('home.como_funciona.1.title', 'Publique o que tem'),
  ('home.como_funciona.1.desc',  'Ofereça um serviço ou diga o que você precisa. É grátis!'),
  ('home.como_funciona.2.emoji', '🤝'),
  ('home.como_funciona.2.title', 'Encontre seu par'),
  ('home.como_funciona.2.desc',  'Conecte com alguém do bairro pelo WhatsApp e combinem a troca.'),
  ('home.como_funciona.3.emoji', '⭐'),
  ('home.como_funciona.3.title', 'Avalie e ganhe reputação'),
  ('home.como_funciona.3.desc',  'Após a troca, ambos avaliam. Sua reputação cresce no bairro!'),
  ('home.porque.title',          'Por que usar o TrocaES?'),
  ('home.porque.1.emoji',        '🛡️'),
  ('home.porque.1.text',         '100% Gratuito'),
  ('home.porque.2.emoji',        '👥'),
  ('home.porque.2.text',         'Gente do bairro'),
  ('home.porque.3.emoji',        '⭐'),
  ('home.porque.3.text',         'Sistema de reputação'),
  ('home.porque.4.emoji',        '⚡'),
  ('home.porque.4.text',         'Via WhatsApp'),
  ('home.depoimentos.title',     'Quem já trocou 💬'),
  ('home.depoimentos.1.name',    'Michelle A.'),
  ('home.depoimentos.1.bairro',  'Jesus de Nazaré'),
  ('home.depoimentos.1.text',    'Troquei vídeos pro meu açaí por 3 semanas. Incrível demais!'),
  ('home.depoimentos.1.stars',   '5'),
  ('home.depoimentos.2.name',    'Carlos V.'),
  ('home.depoimentos.2.bairro',  'Goiabeiras'),
  ('home.depoimentos.2.text',    'Consegui um designer pro meu logo em troca de aula de violão.'),
  ('home.depoimentos.2.stars',   '5'),
  ('home.depoimentos.3.name',    'Ana P.'),
  ('home.depoimentos.3.bairro',  'Jardim Camburi'),
  ('home.depoimentos.3.text',    'A plataforma é simples e direta. Já fiz 4 trocas!'),
  ('home.depoimentos.3.stars',   '5'),
  ('home.cta.title',             'Comece agora, é grátis! 🎉'),
  ('home.cta.subtitle',          'Cadastre-se em 2 minutos e conecte com seu bairro.')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 7. COMO PROMOVER O PRIMEIRO ADMIN
--    Crie sua conta normalmente em /cadastro e depois execute:
--
--    update public.profiles set role = 'admin'
--    where email = 'seu-email@exemplo.com';
-- ─────────────────────────────────────────────────────────────
