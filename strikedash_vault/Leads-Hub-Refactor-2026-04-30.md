---
title: Leads Hub Refactor
type: technical
date: 2026-04-30
commit: 7dcb9a7
status: deployed
---

# Leads Hub Consolidation

**Date**: 2026-04-30  
**Commit**: 7dcb9a7  
**Status**: ✅ Deployed to Production  

## Problem

Confusion between "Leads" and "Trials" in navigation. Users saw these as separate categories when they're actually different stages of the same funnel:

- **Leads** page = cold contacts without trial
- **Trials** page = people who took trial but didn't convert

This caused mixed terminology and unclear action items. Navigation was conceptually broken.

## Solution: Unified Leads Hub

Created a single Leads hub at `/dashboard/leads` with two sub-tabs representing funnel stages:

### 1. Interessados (MQL - Marketing Qualified Lead)

- **Who**: People who registered/signed up
- **Status**: No trial pass yet
- **Funnel Stage**: Topo (top of funnel)
- **Action**: Convencer a testar aula (convince to try class)
- **Sort**: Most recent first (by createdAt)
- **Typical messaging**: "Vem conhecer nosso estúdio"

### 2. Follow-up (Opportunity - Lost/Pending)

- **Who**: People who took trial but didn't convert to membership
- **Status**: Have trial pass but no membership
- **Funnel Stage**: Fundo (bottom of funnel)
- **Sub-states**:
  - **Hot** (Foram à aula) — attended the trial class → Close in 24-48h
  - **Cold** (Faltaram) — no-show / scheduled but didn't attend → Reschedule or reengagement
- **Also shows**: Trial class schedule with signup counts
- **Typical messaging**: "Gostou da aula? Aproveita e vira membro" OR "Vimos que faltou, quer remarcar?"

## UI Architecture

### Bottom Navigation (all roles)
```
Início  Funil  Leads  [Mais — admin only]
```

**Change**: Removed "Trials" tab, consolidated into "Leads" → `/dashboard/leads`

### Leads Hub Page

**URL**: `/dashboard/leads`

**Header**:
```
Leads
Gestão do funil de conversão
```

**Sub-tabs**:
- `Interessados` (green #00E5A0 when active)
- `Follow-up` (orange #FF9500 when active)

Each tab renders its own content:
- **Interessados**: List of leads without trial (sorted by createdAt desc)
- **Follow-up**: Split stats (Hot/Cold) + list view + trial class schedule

## Technical Implementation

### Files Modified

#### 1. `/src/app/dashboard/leads/page.tsx`

Converted to consolidated hub:

```
LeadsPage (main hub)
├── LeadsInterested (tab content 1)
│   └── renders: cold leads list
└── LeadsFollowup (tab content 2)
    ├── renders: hot/cold trial stats & list
    └── renders: upcoming trial classes
```

Key components:
- `LeadRow` — single lead in "Interessados" tab
- `TrialRow` — single trial person in "Follow-up" tab
- Tab state: `useState<"interested" | "followup">`

#### 2. `/src/components/bottom-tab-bar.tsx`

Updated TABS array:

**Before**:
```
[Início, Funil, Leads→/dashboard/leads, Trials→/dashboard/trials, Mais]
```

**After**:
```
[Início, Funil, Leads→/dashboard/leads, Mais]
```

Removed:
- `{ id: "trials", href: "/dashboard/trials", label: "Trials", icon: <FlameIcon> }`
- FlameIcon import (no longer needed)

#### 3. `/src/app/dashboard/more/page.tsx`

Removed SECTIONS entries:
- "Leads Frios" (now in Leads hub "Interessados" tab)
- "Experimentais" (schedule now in Leads hub "Follow-up" tab)

## Business Mapping

| Dashboard Stage | Marketing Term | Description |
|---|---|---|
| Leads → Interessados | **MQL** | Interested, not yet qualified for sales |
| Leads → Follow-up (Hot) | **Opportunity** | Took trial, high intent to convert |
| Leads → Follow-up (Cold) | **Lost Opportunity** | Took trial, needs reengagement |

## User Experience

### Before
- "Where are my leads?" → User goes to "Leads" tab
- User sees cold prospects, confused why "Trials" is a separate tab
- "Where are my trials?" → User goes to "Trials" tab
- User sees people who are also leads, more confusion
- Navigation doesn't reflect business reality

### After
- "Where are my leads?" → User goes to "Leads" tab
- User sees two sub-tabs: "Interessados" (topo) and "Follow-up" (fundo)
- Both tabs are leads in different funnel stages
- Clear action items per stage
- Navigation reflects marketing/sales funnel logic

## Future Extensions

1. **Kanban board** for Lead stages (Interessado → Agendada → Trial → Decidindo → Membro)
2. **WhatsApp integration** — track outreach per lead in each stage
3. **Bulk actions** — send message to all "Hot" opportunities or all "Cold" no-shows
4. **Conversion tracking** — measure time from Interessado → Membro

## Related Docs

- [[The Vault.md]] — main index
- [[Dashboard-Architecture]] — overall page structure
- [[Navigation-Structure]] — how tabs and pages connect
- [[Lead-Filtering-Logic]] — data queries for leads/trials/opportunities
