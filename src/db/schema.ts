import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  real,
  pgEnum,
  uuid,
  varchar,
  decimal,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const tipoPerfilEnum = pgEnum("tipo_perfil", [
  "empreendedor",
  "criador",
  "ambos",
]);
export const tipoAnuncioEnum = pgEnum("tipo_anuncio", ["ofereço", "preciso"]);
export const statusAnuncioEnum = pgEnum("status_anuncio", [
  "pendente",
  "aprovado",
  "rejeitado",
  "pausado",
  "ativo",
]);
export const statusInteresseEnum = pgEnum("status_interesse", [
  "pendente",
  "aceito",
  "concluido",
  "cancelado",
]);
export const cumprimentoEnum = pgEnum("cumprimento", [
  "sim",
  "parcialmente",
  "nao",
]);
export const roleEnum = pgEnum("role_usuario", ["usuario", "admin"]);
export const statusPagamentoEnum = pgEnum("status_pagamento", [
  "pendente",
  "aprovado",
  "rejeitado",
  "cancelado",
]);
export const tipoPlanEnum = pgEnum("tipo_plano", [
  "topo_feed",
  "destaque",
  "verificado",
]);
export const statusDenunciaEnum = pgEnum("status_denuncia", [
  "pendente",
  "analisado",
  "resolvido",
]);

// NEIGHBORHOODS
export const neighborhoods = pgTable("neighborhoods", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: varchar("nome", { length: 255 }).notNull(),
  cidade: varchar("cidade", { length: 255 }).notNull(),
  estado: varchar("estado", { length: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// USERS
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  senha: text("senha"),
  whatsapp: varchar("whatsapp", { length: 20 }),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  bairro: varchar("bairro", { length: 255 }),
  neighborhoodId: uuid("neighborhood_id").references(() => neighborhoods.id),
  tipoPerfil: tipoPerfilEnum("tipo_perfil").default("empreendedor"),
  categorias: text("categorias").array(),
  mediaAvaliacao: real("media_avaliacao").default(0),
  trocasConcluidas: integer("trocas_concluidas").default(0),
  verificado: boolean("verificado").default(false),
  role: roleEnum("role_usuario").default("usuario"),
  ativo: boolean("ativo").default(true),
  googleId: text("google_id"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ADS
export const ads = pgTable("ads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tipo: tipoAnuncioEnum("tipo").notNull(),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descricao: text("descricao").notNull(),
  categoria: varchar("categoria", { length: 100 }).notNull(),
  bairro: varchar("bairro", { length: 255 }).notNull(),
  neighborhoodId: uuid("neighborhood_id").references(() => neighborhoods.id),
  aceitaEmTroca: text("aceita_em_troca").notNull(),
  destaque: boolean("destaque").default(false),
  topoFeed: boolean("topo_feed").default(false),
  status: statusAnuncioEnum("status").default("ativo"),
  visualizacoes: integer("visualizacoes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AD_IMAGES
export const adImages = pgTable("ad_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  adId: uuid("ad_id")
    .notNull()
    .references(() => ads.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  ordem: integer("ordem").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// INTERESTS
export const interests = pgTable("interests", {
  id: uuid("id").primaryKey().defaultRandom(),
  adId: uuid("ad_id")
    .notNull()
    .references(() => ads.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  receiverId: uuid("receiver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: statusInteresseEnum("status").default("pendente"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// REVIEWS
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  avaliadorId: uuid("avaliador_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  avaliadoId: uuid("avaliado_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  interestId: uuid("interest_id").references(() => interests.id),
  nota: integer("nota").notNull(),
  comentario: text("comentario"),
  cumprimento: cumprimentoEnum("cumprimento").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// REPORTS
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  adId: uuid("ad_id")
    .notNull()
    .references(() => ads.id, { onDelete: "cascade" }),
  reporterId: uuid("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  motivo: text("motivo").notNull(),
  status: statusDenunciaEnum("status").default("pendente"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// PAYMENTS
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  adId: uuid("ad_id").references(() => ads.id),
  tipoPlano: tipoPlanEnum("tipo_plano").notNull(),
  valor: decimal("valor", { precision: 10, scale: 2 }).notNull(),
  status: statusPagamentoEnum("status").default("pendente"),
  mpPaymentId: text("mp_payment_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// NOTIFICATIONS
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  mensagem: text("mensagem").notNull(),
  tipo: varchar("tipo", { length: 50 }),
  visualizada: boolean("visualizada").default(false),
  link: text("link"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// SESSIONS (for auth)
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// RELATIONS
export const usersRelations = relations(users, ({ many, one }) => ({
  ads: many(ads),
  sentInterests: many(interests, { relationName: "sender" }),
  receivedInterests: many(interests, { relationName: "receiver" }),
  reviewsGiven: many(reviews, { relationName: "avaliador" }),
  reviewsReceived: many(reviews, { relationName: "avaliado" }),
  notifications: many(notifications),
  payments: many(payments),
  reports: many(reports),
  neighborhood: one(neighborhoods, {
    fields: [users.neighborhoodId],
    references: [neighborhoods.id],
  }),
}));

export const adsRelations = relations(ads, ({ one, many }) => ({
  user: one(users, { fields: [ads.userId], references: [users.id] }),
  images: many(adImages),
  interests: many(interests),
  reports: many(reports),
  neighborhood: one(neighborhoods, {
    fields: [ads.neighborhoodId],
    references: [neighborhoods.id],
  }),
}));

export const adImagesRelations = relations(adImages, ({ one }) => ({
  ad: one(ads, { fields: [adImages.adId], references: [ads.id] }),
}));

export const interestsRelations = relations(interests, ({ one }) => ({
  ad: one(ads, { fields: [interests.adId], references: [ads.id] }),
  sender: one(users, {
    fields: [interests.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  receiver: one(users, {
    fields: [interests.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  avaliador: one(users, {
    fields: [reviews.avaliadorId],
    references: [users.id],
    relationName: "avaliador",
  }),
  avaliado: one(users, {
    fields: [reviews.avaliadoId],
    references: [users.id],
    relationName: "avaliado",
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const neighborhoodsRelations = relations(neighborhoods, ({ many }) => ({
  users: many(users),
  ads: many(ads),
}));
