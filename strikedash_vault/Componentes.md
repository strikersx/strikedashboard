---
title: Componentes
type: technical
---

# Componentes

Todos custom, sem libs externas. Tailwind directo. Definidos em `src/components/`.

## StatCard

**File:** `src/components/stat-card.tsx`

KPI card grande com icone colorido, valor principal, sublabel.

```typescript
interface StatCardProps {
  icon: ReactNode
  label: string
  value: string | number
  sublabel?: string
  color: ColorName          // emerald, blue, amber, red, purple, pink, cyan
  loading?: boolean
  error?: string | null
  onClick?: () => void
  active?: boolean          // red border when active
}
```

Usado nas rows de KPIs no Overview e Sales Home.

## Pill

**File:** `src/components/pill.tsx`

Badge colorido inline para status/categoria.

```typescript
interface PillProps {
  children: ReactNode
  color?: ColorName         // default: blue
}
```

Usado para: nomes de plano, role badge, status pagamento, contadores de aulas.

## PaymentBadge

**File:** `src/components/payment-badge.tsx`

Badge inteligente de estado de pagamento. Calcula dias ate renovacao.

```typescript
interface PaymentBadgeProps {
  paidUntil: string | null  // date string
}
```

Logica:
- `paidUntil` null -> amber "pago externamente"
- dias < 0 -> red "venceu ha Xd"
- dias = 0 -> red "renova hoje"
- dias <= 3 -> red "renova em Xd"
- dias <= 7 -> amber "renova em Xd"
- dias > 7 -> emerald "renova em Xd"

## MiniStat

**File:** `src/components/mini-stat.tsx`

Stat box pequeno com label e valor colorido.

```typescript
interface MiniStatProps {
  label: string
  value: string | number
  color?: "white" | "emerald" | "purple" | "pink" | "cyan" | "blue"
}
```

Usado na Revenue page (4 mini stats no topo).

## BarChart

**File:** `src/components/bar-chart.tsx`

Grafico de barras SVG para faturacao mensal.

```typescript
interface BarChartProps {
  data: { label: string; value: number }[]
  height?: number           // default 240
  currentIdx?: number       // highlighted bar (current month)
}
```

Features:
- Grid lines e Y-axis labels
- Hover tooltips com valor em EUR
- Mes actual em emerald brilhante, passados em emerald escuro, futuros em cinza
- 100% responsive via viewBox SVG

## DataTable

**File:** `src/components/data-table.tsx`

Tabela generica com headers auto-detectados.

```typescript
interface DataTableProps {
  rows: Record<string, unknown>[] | undefined
  loading?: boolean
  error?: string | null
  title?: string
  empty?: string            // default "Sem dados"
  maxCols?: number          // default 8
}
```

Features:
- Headers extraidos da primeira row
- Loading spinner, error state, empty state
- Hover effect nas rows
- Overflow-x scroll em mobile
- Valores truncados a 80 chars

## ClassList

**File:** `src/components/class-list.tsx`

Lista de aulas agrupada por data.

```typescript
interface ClassListProps {
  classes: ClassItem[]
  mode?: "trial" | "visitors"   // default "trial"
  empty?: string
}
```

Features:
- Agrupamento por data com label em portugues
- "HOJE" highlighted em emerald
- Por aula: nome, horario, professor, sala
- Pills: inscritos (blue), check-in (emerald), USC (purple), CP (pink), Bruce (cyan), espera (amber)
- Border color: emerald para trials, blue para visitors

## Nav

**File:** `src/components/nav.tsx`

Header + tab navigation do dashboard.

```typescript
interface NavProps {
  role: Role
  onRefresh: () => void
  onLogout: () => void
  lastFetch: Date | null
}
```

Features:
- Logo + titulo + role pill
- Refresh button + logout button
- "Ultima act.: HH:MM:SS"
- Tabs filtrados por role (sales nao ve rotas admin-only)
- Tab activo com border vermelho

## Icons

**File:** `src/components/icons.tsx`

16 icones SVG custom. Cada um aceita `className` opcional.

| Icon | Default size | Uso principal |
|------|-------------|---------------|
| EuroIcon | w-5 h-5 | Revenue StatCard |
| UsersIcon | w-5 h-5 | Subscribers StatCard |
| TrendIcon | w-5 h-5 | Churn StatCard |
| CardIcon | w-5 h-5 | Failed payments StatCard |
| ZapIcon | w-5 h-5 | Funnel StatCard |
| RefreshIcon | w-4 h-4 | Nav refresh button |
| TrophyIcon | w-6 h-6 | Logo icon |
| LoaderIcon | w-6 h-6 animate-spin | Loading states |
| ChevronRightIcon | w-4 h-4 | StatCard clickable arrow |
| CalendarIcon | w-3.5 h-3.5 | ClassList date labels |
| ClockIcon | w-3 h-3 | ClassList time display |
| UserPlusIcon | w-5 h-5 | Leads/trials StatCards |
| TargetIcon | w-5 h-5 | Funnel StatCard |
| CheckIcon | w-3 h-3 | Success indicators |
| XIcon | w-3 h-3 | Error indicators |
| LockIcon | w-4 h-4 | Login page |
| LogoutIcon | w-4 h-4 | Nav logout button |

## Related

- [[Design-System]] — cores e spacing usados
- [[Paginas-Dashboard]] — onde cada componente e usado
- [[Business-Constants]] — COLOR_MAP
