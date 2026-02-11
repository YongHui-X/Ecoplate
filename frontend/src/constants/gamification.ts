import { Check, DollarSign, X } from "lucide-react";

export const ACTION_CONFIG: Record<
  string,
  {
    label: string;
    icon: typeof Check;
    points: number;
    color: string;
    bgColor: string;
    chartColor: string;
    description: string;
  }
> = {
  consumed: {
    label: "Consumed",
    icon: Check,
    points: 0,
    color: "text-success",
    bgColor: "bg-success/10",
    chartColor: "hsl(var(--success))",
    description: "Points based on CO2 saved",
  },
  sold: {
    label: "Sold",
    icon: DollarSign,
    points: 0,
    color: "text-secondary",
    bgColor: "bg-secondary/10",
    chartColor: "hsl(var(--secondary))",
    description: "1.5x CO2 bonus for marketplace sales",
  },
  wasted: {
    label: "Wasted",
    icon: X,
    points: 0,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    chartColor: "hsl(var(--destructive))",
    description: "Penalty based on CO2 impact",
  },
};

export type ActionConfigType = typeof ACTION_CONFIG;

export const INITIAL_TX_COUNT = 10;
