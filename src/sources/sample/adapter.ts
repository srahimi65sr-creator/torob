import { z } from "zod";
import type { QuoteRequest } from "@/domain/quote-request";
import type { RawQuote, SourceAdapter, SourceResponse, SourceVehicle } from "../types";

export const sampleFileSchema = z.object({
  placeholder: z.boolean(),
  sourceId: z.string(),
  buyUrl: z.string().url(),
  vehicles: z.array(
    z.object({
      sourceModelId: z.string(),
      vehicleType: z.string(),
      brand: z.string(),
      model: z.string(),
      basePrice: z.number().int().positive(),
    }),
  ),
  insurers: z.array(
    z.object({
      insurerName: z.string().min(1),
      extraDiscountPercent: z.number().min(0).max(30),
      installment: z
        .object({
          months: z.number().int().positive(),
          downPaymentPercent: z.number().min(0).max(100),
          markupPercent: z.number().min(0),
        })
        .nullable(),
    }),
  ),
});

export type SampleFile = z.infer<typeof sampleFileSchema>;

const toThousand = (toman: number) => Math.round(toman / 1000) * 1000;

/**
 * Builds prices from simple rules in a JSON file. Stands in for a source until its API is connected.
 * Price = base rate × (1 − user's discount − insurer's extra discount), rounded to 1,000 Toman.
 */
export class SampleAdapter implements SourceAdapter {
  private readonly data: SampleFile;

  constructor(
    readonly sourceId: string,
    readonly displayName: string,
    file: unknown,
  ) {
    this.data = sampleFileSchema.parse(file);
    if (this.data.sourceId !== sourceId) {
      throw new Error(`Sample file is for "${this.data.sourceId}", not "${sourceId}"`);
    }
  }

  async listVehicles(): Promise<SourceVehicle[]> {
    return this.data.vehicles.map(({ sourceModelId, vehicleType, brand, model }) => ({
      sourceModelId,
      vehicleType,
      brand,
      model,
    }));
  }

  async fetchQuotes(request: QuoteRequest, sourceModelId: string): Promise<SourceResponse> {
    const vehicle = this.data.vehicles.find((v) => v.sourceModelId === sourceModelId);
    const quotes: RawQuote[] = vehicle
      ? this.data.insurers.map((insurer) => {
          const discountAmount = toThousand(
            (vehicle.basePrice * (request.discountPercent + insurer.extraDiscountPercent)) / 100,
          );
          const finalCashPrice = vehicle.basePrice - discountAmount;
          const plan = insurer.installment;
          const downPayment = plan ? toThousand((finalCashPrice * plan.downPaymentPercent) / 100) : 0;
          return {
            insurerName: insurer.insurerName,
            basePrice: vehicle.basePrice,
            discountAmount,
            finalCashPrice,
            coverageAmount: null,
            buyUrl: this.data.buyUrl,
            installments: plan
              ? [
                  {
                    months: plan.months,
                    downPayment,
                    installmentAmount: toThousand(
                      ((finalCashPrice - downPayment) * (1 + plan.markupPercent / 100)) / plan.months,
                    ),
                  },
                ]
              : [],
          };
        })
      : [];

    return {
      sourceId: this.sourceId,
      quotes,
      rawPayload: { sourceModelId, request, quotes },
      isSample: true,
      receivedAt: new Date().toISOString(),
    };
  }
}
