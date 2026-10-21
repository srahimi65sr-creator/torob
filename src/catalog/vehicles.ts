export interface CatalogVehicle {
  id: string;
  vehicleType: string;
  brand: string;
  model: string;
  /** Ways people write this model, longest first wins when parsing. */
  aliases: string[];
  /** This vehicle's id at each source. */
  sourceModelIds: Record<string, string>;
}

/** Only the vehicles that have sample data. Anything else gets Torob's "not found" page. */
export const VEHICLES: CatalogVehicle[] = [
  {
    id: "pride-131",
    vehicleType: "سواری",
    brand: "سایپا",
    model: "پراید ۱۳۱",
    aliases: ["پراید ۱۳۱", "پراید", "۱۳۱"],
    sourceModelIds: { azki: "pride-131", bimebazar: "pride-131" },
  },
  {
    id: "peugeot-206-t2",
    vehicleType: "سواری",
    brand: "ایران خودرو",
    model: "پژو ۲۰۶ تیپ ۲",
    aliases: ["پژو ۲۰۶ تیپ ۲", "پژو ۲۰۶", "۲۰۶ تیپ ۲", "۲۰۶"],
    sourceModelIds: { azki: "peugeot-206", bimebazar: "peugeot-206" },
  },
];

export const VEHICLE_TYPES = [...new Set(VEHICLES.map((v) => v.vehicleType))];

export function findVehicle(id: string): CatalogVehicle | null {
  return VEHICLES.find((v) => v.id === id) ?? null;
}
