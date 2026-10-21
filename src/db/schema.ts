import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// All amounts are Toman. bigint is read back as a JS number: insurance prices stay far below 2^53.
const toman = (name: string) => bigint(name, { mode: "number" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`);

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insurers = pgTable("insurers", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nameFa: text("name_fa").notNull(),
  logoUrl: text("logo_url"),
});

/** Each source's spelling of an insurer, pointing at the one canonical insurer. */
export const insurerAliases = pgTable(
  "insurer_aliases",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").notNull().references(() => sources.id),
    rawName: text("raw_name").notNull(),
    insurerId: integer("insurer_id").notNull().references(() => insurers.id),
  },
  (t) => [uniqueIndex("insurer_aliases_source_raw").on(t.sourceId, t.rawName)],
);

export const vehicleModels = pgTable("vehicle_models", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  vehicleType: text("vehicle_type").notNull(),
  brandFa: text("brand_fa").notNull(),
  modelFa: text("model_fa").notNull(),
  cylinderClass: text("cylinder_class"),
});

/** A vehicle's id at each source. */
export const vehicleModelAliases = pgTable(
  "vehicle_model_aliases",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").notNull().references(() => sources.id),
    sourceBrandId: text("source_brand_id"),
    sourceModelId: text("source_model_id").notNull(),
    vehicleModelId: integer("vehicle_model_id").notNull().references(() => vehicleModels.id),
  },
  (t) => [uniqueIndex("vehicle_model_aliases_source_model").on(t.sourceId, t.sourceModelId)],
);

/** One distinct question a user asked; `request_hash` is the cache key. */
export const quoteRequests = pgTable("quote_requests", {
  id: serial("id").primaryKey(),
  requestHash: text("request_hash").notNull().unique(),
  vehicleType: text("vehicle_type").notNull(),
  vehicleModelId: integer("vehicle_model_id").notNull().references(() => vehicleModels.id),
  buildYear: integer("build_year").notNull(),
  discountPercent: integer("discount_percent").notNull(),
  createdAt: createdAt(),
});

/** A source's raw answer to one request, kept so mappers can be re-run without asking again. */
export const sourceResponses = pgTable("source_responses", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => sources.id),
  quoteRequestId: integer("quote_request_id").notNull().references(() => quoteRequests.id),
  status: text("status", { enum: ["ok", "failed"] }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  error: text("error"),
  rawPayload: jsonb("raw_payload"),
});

export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  sourceResponseId: integer("source_response_id").notNull().references(() => sourceResponses.id),
  quoteRequestId: integer("quote_request_id").notNull().references(() => quoteRequests.id),
  sourceId: integer("source_id").notNull().references(() => sources.id),
  insurerId: integer("insurer_id").notNull().references(() => insurers.id),
  basePrice: toman("base_price").notNull(),
  discountAmount: toman("discount_amount").notNull(),
  finalCashPrice: toman("final_cash_price").notNull(),
  coverageAmount: toman("coverage_amount"),
  buyUrl: text("buy_url").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
});

export const paymentPlans = pgTable("payment_plans", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id").notNull().references(() => offers.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["cash", "installment"] }).notNull(),
  months: integer("months"),
  downPayment: toman("down_payment"),
  installmentAmount: toman("installment_amount"),
  totalPayable: toman("total_payable").notNull(),
});

/** What users typed and what the parser understood, to measure and improve the parser. */
export const searchLogs = pgTable("search_logs", {
  id: serial("id").primaryKey(),
  rawText: text("raw_text").notNull(),
  parsedRequest: jsonb("parsed_request").notNull(),
  quoteRequestId: integer("quote_request_id").references(() => quoteRequests.id),
  createdAt: createdAt(),
});
