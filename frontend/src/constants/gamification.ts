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
    points: 5,
    color: "text-success",
    bgColor: "bg-success/10",
    chartColor: "hsl(var(--success))",
    description: "Eat food before it expires (scales with quantity)",
  },
  sold: {
    label: "Sold",
    icon: DollarSign,
    points: 8,
    color: "text-secondary",
    bgColor: "bg-secondary/10",
    chartColor: "hsl(var(--secondary))",
    description: "Sell products on the marketplace (scales with quantity)",
  },
  wasted: {
    label: "Wasted",
    icon: X,
    points: -3,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    chartColor: "hsl(var(--destructive))",
    description: "Wasting food costs you points (scales with quantity)",
  },
};

export type ActionConfigType = typeof ACTION_CONFIG;

export const INITIAL_TX_COUNT = 10;
