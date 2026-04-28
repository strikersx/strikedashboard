import { Pill } from "./pill";
import { daysUntil } from "@/lib/utils";

interface PaymentBadgeProps { paidUntil: string | null | undefined; }

export function PaymentBadge({ paidUntil }: PaymentBadgeProps) {
  if (!paidUntil) return <Pill color="amber">pago externamente</Pill>;
  const days = daysUntil(paidUntil);
  if (days === null) return <Pill color="amber">pago externamente</Pill>;
  if (days < 0) return <Pill color="red">venceu há {-days}d</Pill>;
  if (days === 0) return <Pill color="red">renova hoje</Pill>;
  if (days <= 3) return <Pill color="red">renova em {days}d</Pill>;
  if (days <= 7) return <Pill color="amber">renova em {days}d</Pill>;
  return <Pill color="emerald">renova em {days}d</Pill>;
}
