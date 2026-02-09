import { Leaf } from "lucide-react";
import { cn } from "../../lib/utils";

interface Co2BadgeProps {
  co2Saved: number | null;
  variant?: "compact" | "full";
  className?: string;
}

/**
 * CO2 Badge component to display environmental impact
 *
 * @param co2Saved - kg of CO2 saved (null if not available)
 * @param variant - "compact" for small inline badge, "full" for card-style display
 */
export function Co2Badge({ co2Saved, variant = "compact", className }: Co2BadgeProps) {
  if (co2Saved === null || co2Saved === undefined || co2Saved <= 0) {
    return null;
  }

  const formattedValue = co2Saved >= 1 ? co2Saved.toFixed(1) : co2Saved.toFixed(2);

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
          "bg-success/10 text-success",
          className
        )}
      >
        <Leaf className="h-3 w-3" />
        <span>{formattedValue}kg CO2</span>
      </div>
    );
  }

  // Full variant - card style
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl",
        "bg-success/10 border border-success/20",
        className
      )}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
        <Leaf className="h-5 w-5 text-success" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">CO2 Saved</p>
        <p className="text-lg font-semibold text-success">{formattedValue} kg</p>
      </div>
    </div>
  );
}

/**
 * CO2 factors by category for frontend preview calculations
 * Must match backend/src/utils/co2-calculator.ts
 */
const CO2_FACTORS: Record<string, number> = {
  produce: 1.0,
  dairy: 7.0,
  meat: 20.0,
  bakery: 1.5,
  frozen: 4.0,
  beverages: 1.0,
  pantry: 2.0,
  other: 2.5,
};

const DISPOSAL_FACTOR = 0.5;

/**
 * Convert quantity to kg for preview calculation
 */
function convertToKg(quantity: number, unit: string): number {
  const normalizedUnit = unit.toLowerCase().trim();

  switch (normalizedUnit) {
    case "kg":
      return quantity;
    case "g":
      return quantity / 1000;
    case "l":
    case "ml":
      return normalizedUnit === "ml" ? quantity / 1000 : quantity;
    case "item":
    case "pcs":
    case "pack":
      return quantity * 0.3;
    default:
      return quantity * 0.3;
  }
}

/**
 * Calculate estimated CO2 saved (for frontend preview)
 * This mirrors the backend calculation for preview purposes
 */
export function calculateCo2Preview(
  quantity: number,
  unit: string,
  category: string
): number {
  const weightKg = convertToKg(quantity, unit);
  const categoryFactor = CO2_FACTORS[category.toLowerCase()] ?? CO2_FACTORS.other;
  const totalFactor = categoryFactor + DISPOSAL_FACTOR;
  const co2Saved = weightKg * totalFactor;
  return Math.round(co2Saved * 100) / 100;
}
