---
title: Design System
type: design
---

# Design System

## Regras Core

1. **Dark theme obrigatorio.** Sem light mode.
2. **Mobile-first.** Marcelo usa no telemovel na recepcao.
3. **Zero UI libraries.** Sem Material UI, Chakra, shadcn. Tailwind CSS directo.
4. **Portugues de Portugal** na UI. "subscritor" nao "assinante", "telemovel" nao "celular".

## Color Semantics

Cada cor tem significado fixo — nao usar cores fora do contexto:

| Cor | Hex | Uso |
|-----|-----|-----|
| emerald | `#10b981` | Receita, sucesso, pagamentos, metricas positivas |
| blue | `#3b82f6` | Subscritores, membros, class signups |
| amber | `#f59e0b` | Churn risk, warnings, pagamentos a expirar |
| red | `#ef4444` | Erros, falhas, items urgentes |
| purple | `#a855f7` | Leads (prospects frios) |
| pink | `#ec4899` | Trials (aulas experimentais) |
| cyan | `#06b6d4` | PTs (personal trainers) |

## Color Map (Tailwind classes)

```typescript
COLOR_MAP = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500", pill: "bg-emerald-950 text-emerald-400" },
  blue:    { bg: "bg-blue-500/10",    text: "text-blue-500",    pill: "bg-blue-950 text-blue-400" },
  amber:   { bg: "bg-amber-500/10",   text: "text-amber-500",   pill: "bg-amber-950 text-amber-400" },
  red:     { bg: "bg-red-500/10",     text: "text-red-500",     pill: "bg-red-950 text-red-400" },
  purple:  { bg: "bg-purple-500/10",  text: "text-purple-500",  pill: "bg-purple-950 text-purple-400" },
  pink:    { bg: "bg-pink-500/10",    text: "text-pink-500",    pill: "bg-pink-950 text-pink-400" },
  cyan:    { bg: "bg-cyan-500/10",    text: "text-cyan-500",    pill: "bg-cyan-950 text-cyan-400" },
}
```

## Dark Theme Defaults

| Elemento | Classes |
|----------|---------|
| Background root | `bg-black` |
| Cards | `bg-zinc-900` |
| Nested panels | `bg-black/40` |
| Borders primary | `border-zinc-800` |
| Borders subtle | `border-zinc-800/40` |
| Text primary | `text-white` |
| Text secondary | `text-zinc-400` |
| Text tertiary | `text-zinc-500` |
| Hover border | `hover:border-zinc-700` |
| Hover bg | `hover:bg-black/40` |

## Typography

| Tipo | Classes |
|------|---------|
| KPI values | `text-2xl xl:text-3xl font-bold` |
| Section titles | `text-lg font-semibold` |
| Labels | `text-sm text-zinc-400` |
| Small text | `text-xs text-zinc-500` |
| Table headers | `text-xs uppercase tracking-wide text-zinc-500` |

## Layout & Spacing

| Elemento | Classes |
|----------|---------|
| Max width container | `max-w-7xl mx-auto` |
| Outer padding | `p-6` |
| Card padding | `p-5` a `p-6` |
| Gap entre seccoes | `gap-4` a `gap-6` |
| KPI grid | `grid grid-cols-2 lg:grid-cols-4 gap-4` |
| Border radius cards | `rounded-xl` |
| Border radius nested | `rounded-lg` |
| Border radius pills | `rounded` |

## Icons

- Icon in colored box: `p-2 rounded-lg {COLOR_MAP.bg} {COLOR_MAP.text}`
- Icon sizing: `w-5 h-5` (inline), `w-6 h-6` (default), `w-3 h-3` (small)
- Loader: `w-6 h-6 animate-spin`
- 16 icons SVG custom: Euro, Users, Trend, Card, Zap, Refresh, Trophy, Loader, ChevronRight, Calendar, Clock, UserPlus, Target, Check, X, Lock, Logout

## Related

- [[Arquitectura]] — stack e file structure
- [[Componentes]] — implementacao dos componentes
