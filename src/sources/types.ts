import type { QuoteRequest } from "@/domain/quote-request";

export interface SourceVehicle {
  sourceModelId: string;
  vehicleType: string;
  brand: string;
  model: string;
}

/** A price exactly as the source gives it, before normalization. Amounts are in Toman. */
export interface RawQuote {
  insurerName: string;
  basePrice: number;
  discountAmount: number;
  finalCashPrice: number;
  coverageAmount: number | null;
  buyUrl: string;
  installments: { months: number; downPayment: number; installmentAmount: number }[];
}

export interface SourceResponse {
  sourceId: string;
  quotes: RawQuote[];
  /** Kept as-is so mappers can be re-run and tested without asking the source again. */
  rawPayload: unknown;
  /** True when the source only has sample data that may not match the request exactly. */
  isSample: boolean;
  receivedAt: string;
}

/** The only thing a source must implement. A contract-based API adapter will implement the same. */
export interface SourceAdapter {
  readonly sourceId: string;
  readonly displayName: string;
  listVehicles(): Promise<SourceVehicle[]>;
  /** `sourceModelId` is this source's own id for the vehicle in `request`. */
  fetchQuotes(request: QuoteRequest, sourceModelId: string): Promise<SourceResponse>;
}
