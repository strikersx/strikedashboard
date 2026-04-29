# Design Spec: Fidelidade Total ao Protótipo

**Data:** 2026-04-29  
**Tipo:** Redesign visual — Next.js dashboard → identical ao StrikeDashboard/  
**Referência:** `StrikeDashboard/` (protótipo JSX existente no repo)

---

## Contexto

O protótipo em `StrikeDashboard/` define o visual exacto do dashboard — fontes, cores, componentes, layout de navegação. A implementação actual em Next.js diverge significativamente: usa fontes genéricas, cores aproximadas (zinc-900), StatCards genéricos, e uma top nav em vez da bottom tab bar do protótipo.

Este spec define o que muda para tornar o Next.js dashboard visualmente idêntico ao protótipo.

---

## 1. Tipografia

Três famílias carregadas via Google Fonts no `layout.tsx`:

| Classe CSS | Fonte | Peso | Uso |
|---|---|---|---|
| `.num` | Barlow Condensed | 800 | Números, valores, KPIs |
| `.head` | Barlow Condensed | 700 | Títulos, section headers, labels uppercase |
| `.mono` | JetBrains Mono | 400/500 | Timestamps, dados técnicos |
| (body) | Inter | 400/500/600/700 | Todo o resto |

As classes `.num`, `.head`, `.mono` são definidas em `globals.css` e usadas directamente nos componentes.

---

## 2. Design Tokens

Substituir todas as cores genéricas Tailwind pelos tokens exactos do protótipo:

```
ZERO_BG    = #07070a   (background da página, anteriormente bg-black)
SURFACE    = #0F0F14   (cards, anteriormente bg-zinc-900)
SURFACE_2  = #15151C   (cards secundários, hover states)
BORDER     = rgba(255,255,255,0.06)
BORDER_STRONG = rgba(255,255,255,0.10)
MUTE       = rgba(255,255,255,0.5)
MUTE_STRONG = rgba(255,255,255,0.72)
```

Cores de acento (TONES):
```
electric = #00E5A0  (acento principal, activo)
coral    = #FF3D2E  (falhas, urgente)
amber    = #FFB627  (churn, aviso)
lime     = #A6E22E  (tendência positiva, leads)
magenta  = #FF2E88  (trials, vendas)
blue     = #3D7DFF  (subscritores)
mint     = #27D9A8  (receita)
```

Configurar em `tailwind.config.ts` como CSS vars + classes utilitárias.

---

## 3. Navegação — Bottom Tab Bar

Substituir o componente `Nav` actual pelo layout do protótipo:

**AppHeader (sticky topo):**
- Logo 38×38 verde com ícone trophy
- Título "STRIKER'S HOUSE" (Barlow Condensed)
- Subtitle: "Carcavelos · [role] ▾" (role clicável → logout)
- Botão refresh (↺) à direita

**LiveStatus pill:**
- Dot pulsante verde + "LIVE" + timestamp (JetBrains Mono)
- Aparece abaixo do header em todas as páginas

**BottomTabBar:**
```
Tab 1: Início    → /dashboard
Tab 2: Funil     → /dashboard/funnel
Tab 3: Subs      → /dashboard/subscribers
Tab 4: Leads     → /dashboard/trials
Tab 5: Mais      → /dashboard/more
```
- Tab activo: acento verde + barra de 28×3px no topo do tab
- Tabs inactivos: rgba(255,255,255,0.5)
- Background: rgba(7,7,10,0.95) + blur + border-top
- Padding bottom: 26px (safe area iOS)
- `pb-28` no content wrapper para não ficar tapado

**Layout do dashboard layout.tsx:**
- Remover padding/max-width actuais
- Estrutura: `<div>` full-screen com AppHeader + LiveStatus + `{children}` scrollável + BottomTabBar fixo

---

## 4. Página Início (`/dashboard`)

### Hero Card (Receita YTD)
- Card com `linear-gradient(135deg, #0F0F14, #12121A)` + border
- Glow radial no canto superior direito (acento 20% opacity)
- Valor grande em `.num` 56px
- TrendChip ao lado: `+12%` com fundo verde translúcido
- Sparkline SVG abaixo (linha + área preenchida com gradiente)
  - Dados: derivados dos `revenueItems` (total por mês, YTD)
  - Fallback: linha plana se sem dados
- Labels: "Jan 26", "Média €X/mês", "Hoje"

### KPI Grid (2×4)
Cada KPICard:
- Background SURFACE + border
- Glow radial no canto (cor do acento, 7% opacity, blur)
- Linha topo: ícone em box (22px, fundo acento 15%) + TrendChip
- Valor `.num` 36px
- Label `.head` 10px uppercase
- Sub-texto 10px MUTE

Mapeamento de acentos (conforme protótipo):
```
revenue  → mint
subs     → blue
churn    → amber (trendDir: down se piorou)
failed   → coral
leads    → lime
trials   → magenta
newtrials → electric
visitors → blue
```

**TrendChip:**
- `up`: lime bg + lime text + ▲
- `down`: coral bg + coral text + ▼
- `flat`: rgba bg + MUTE text + •

### Acções Recomendadas
Cada ActionRow (do protótipo):
- Stripe 3px colorida na margem esquerda
- Badge circular com count (`.num` 18px, fundo acento 10%)
- Título + detalhe
- Botão CTA com fundo sólido da cor do acento, texto `#0a0a0a`, uppercase

Acções (ordem de urgência):
1. `{failedCount}` pagamentos falhados → coral → "Contactar" → `/dashboard/failed`
2. `{churnCount}` em risco de churn → amber → "Rever" → `/dashboard/churn`
3. `{trialAttendedCount}` trials que foram à aula → magenta → "Follow-up" → `/dashboard/trials`
4. `{trialNoShowCount}` trials que faltaram → electric → "Reagendar" → `/dashboard/trials`
5. `{leadsActionable.length}` leads sem contacto → lime → "WhatsApp" → `/dashboard/leads`

---

## 5. Página Subscritores (`/dashboard/subscribers`)

### Summary cards (2 colunas)
- Card "SUBSCRITORES": count total `.num` 38px
- Card "MRR ESTIMADO": valor em acento `.num` 38px

### Filter chips (pill-style)
- Todos / Activos / Risco / Falhas
- Activo: fundo acento, texto `#0a0a0a`
- Inactivo: SURFACE + border + MUTE_STRONG text

### SubRow
- Avatar 36×36 com iniciais (2 letras, gradient dark)
- Nome 13px + plano + aulas
- StatusPill direita:
  - `active`: dot verde + "renova em Xd"
  - `risk`: dot amber + "risco · Xd"
  - `failed/expired`: dot coral + "falha/venceu"

---

## 6. Página Leads/Trials (`/dashboard/trials`)

### Split stat cards (2 colunas)
- "FORAM À AULA": fundo magenta translúcido, border magenta, count grande
- "FALTARAM": SURFACE normal, label amber, count grande

### TrialRow
- Border-left 3px colorida (magenta = foi, amber = faltou)
- Avatar com fundo colorido translúcido + iniciais
- Nome + telefone + data
- Badge: "✓ FOI" ou "× FALTOU" em pill colorida

---

## 7. Nova Página "Mais" (`/dashboard/more`)

Nova rota `src/app/dashboard/more/page.tsx`.

**Secção "Outras secções":** lista de links para:
- Faturação → `/dashboard/revenue`
- PTs → `/dashboard/pts`
- Experimentais → `/dashboard/trials`
- Churn → `/dashboard/churn`
- Pagamentos falhados → `/dashboard/failed`
- Visitantes → `/dashboard/classes`

Cada item: ícone 36×36 (acento bg) + título + sub-texto + chevron direita.

**Secção "Conta":**
- Avatar "SH" em círculo com gradiente acento
- Nome "Striker's House · Carcavelos" + role
- Botão logout (ícone, sem texto)

---

## 8. Ficheiros a modificar / criar

| Ficheiro | Acção |
|---|---|
| `tailwind.config.ts` | Actualizar tokens de cor e font vars |
| `src/app/globals.css` | Adicionar `.num`, `.head`, `.mono`, `tap` animation |
| `src/app/layout.tsx` | Adicionar Google Fonts (Barlow Condensed, JetBrains Mono) |
| `src/app/dashboard/layout.tsx` | Substituir Nav por AppHeader + LiveStatus + BottomTabBar |
| `src/components/nav.tsx` | Substituir por `bottom-tab-bar.tsx` |
| `src/components/app-header.tsx` | Criar (extraído de shell.jsx) |
| `src/components/live-status.tsx` | Criar (extraído de shell.jsx) |
| `src/components/bottom-tab-bar.tsx` | Criar (extraído de shell.jsx) |
| `src/components/kpi-card.tsx` | Substituir StatCard |
| `src/components/trend-chip.tsx` | Criar |
| `src/components/action-row.tsx` | Substituir ActionRow actual |
| `src/components/sparkline.tsx` | Criar |
| `src/components/sub-row.tsx` | Criar |
| `src/components/status-pill.tsx` | Criar |
| `src/components/trial-row.tsx` | Criar |
| `src/app/dashboard/page.tsx` | Reconstruir HomeScreen |
| `src/app/dashboard/subscribers/page.tsx` | Reconstruir SubsScreen |
| `src/app/dashboard/trials/page.tsx` | Reconstruir LeadsScreen |
| `src/app/dashboard/more/page.tsx` | Criar MoreScreen |

---

## 9. Fora de Scope

- Funil (`/dashboard/funnel`) — manter estrutura actual, actualizar apenas tokens visuais
- Revenue, PTs, Churn, Failed, Classes — actualizar tokens visuais, sem reestruturar
- Bottom sheet / detail sheet — não implementar nesta sprint (fora do protótipo essencial)
- Animações (barGrow, sheetIn, fadeIn) — implementar apenas se simples; não bloquear

---

## 10. Notas de Implementação

- **Sparkline:** calcular pontos a partir dos `revenueItems` (um ponto por mês). Se <2 pontos, mostrar linha plana.
- **TrendChip:** sem dados históricos disponíveis, usar direcção semântica fixa por KPI. `trendDir` é passado como prop: `subs/revenue/leads` → `up`, `churn/failed` → `down` (piora), `newtrials/visitors` → `flat` se zero. O valor numérico mostra a contagem actual (ex: "+73", "+8"). Não calcular deltas reais nesta sprint.
- **pb-safe:** usar `pb-24` ou `pb-28` no wrapper de content para compensar a tab bar fixa.
- **Tap animation:** `.tap { transition: transform .12s ease; } .tap:active { transform: scale(0.98); }` — adicionar a todos os elementos interactivos.
- **Scroll:** esconder scrollbar em mobile (`::-webkit-scrollbar { width: 0; }`).
