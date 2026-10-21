CREATE TABLE "insurer_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"raw_name" text NOT NULL,
	"insurer_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurers" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_fa" text NOT NULL,
	"logo_url" text,
	CONSTRAINT "insurers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_response_id" integer NOT NULL,
	"quote_request_id" integer NOT NULL,
	"source_id" integer NOT NULL,
	"insurer_id" integer NOT NULL,
	"base_price" bigint NOT NULL,
	"discount_amount" bigint NOT NULL,
	"final_cash_price" bigint NOT NULL,
	"coverage_amount" bigint,
	"buy_url" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"offer_id" integer NOT NULL,
	"kind" text NOT NULL,
	"months" integer,
	"down_payment" bigint,
	"installment_amount" bigint,
	"total_payable" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_hash" text NOT NULL,
	"vehicle_type" text NOT NULL,
	"vehicle_model_id" integer NOT NULL,
	"build_year" integer NOT NULL,
	"discount_percent" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_requests_request_hash_unique" UNIQUE("request_hash")
);
--> statement-breakpoint
CREATE TABLE "search_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"raw_text" text NOT NULL,
	"parsed_request" jsonb NOT NULL,
	"quote_request_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"quote_request_id" integer NOT NULL,
	"status" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"error" text,
	"raw_payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "vehicle_model_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"source_brand_id" text,
	"source_model_id" text NOT NULL,
	"vehicle_model_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"vehicle_type" text NOT NULL,
	"brand_fa" text NOT NULL,
	"model_fa" text NOT NULL,
	"cylinder_class" text,
	CONSTRAINT "vehicle_models_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "insurer_aliases" ADD CONSTRAINT "insurer_aliases_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurer_aliases" ADD CONSTRAINT "insurer_aliases_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_source_response_id_source_responses_id_fk" FOREIGN KEY ("source_response_id") REFERENCES "public"."source_responses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_quote_request_id_quote_requests_id_fk" FOREIGN KEY ("quote_request_id") REFERENCES "public"."quote_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_vehicle_model_id_vehicle_models_id_fk" FOREIGN KEY ("vehicle_model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_quote_request_id_quote_requests_id_fk" FOREIGN KEY ("quote_request_id") REFERENCES "public"."quote_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_responses" ADD CONSTRAINT "source_responses_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_responses" ADD CONSTRAINT "source_responses_quote_request_id_quote_requests_id_fk" FOREIGN KEY ("quote_request_id") REFERENCES "public"."quote_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_model_aliases" ADD CONSTRAINT "vehicle_model_aliases_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_model_aliases" ADD CONSTRAINT "vehicle_model_aliases_vehicle_model_id_vehicle_models_id_fk" FOREIGN KEY ("vehicle_model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "insurer_aliases_source_raw" ON "insurer_aliases" USING btree ("source_id","raw_name");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_model_aliases_source_model" ON "vehicle_model_aliases" USING btree ("source_id","source_model_id");