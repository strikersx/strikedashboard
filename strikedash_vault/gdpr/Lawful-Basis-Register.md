---
title: Registo de Bases Legais — StrikeLab
type: reference
status: draft
created: 2026-05-29
tags:
  - strikelab
  - gdpr
related:
  - "[[DPIA-StrikeLab]]"
---

# Registo de Bases Legais — StrikeLab Gamificação

Cada tratamento de dados pessoais no StrikeLab é mapeado a uma base legal do Art. 6(1) RGPD.

## Tratamentos e Bases Legais

| # | Tratamento | Base legal (Art. 6) | Justificação | Consentimento retractável? |
|---|-----------|---------------------|-------------|--------------------------|
| T1 | Contagem de presenças (check-in) | (a) Consentimento + (f) Interesse legítimo | Utilizador opt-in ao StrikeLab. Interesse legítimo: operar programa de fidelização. | Sim — opt-out pára contagem |
| T2 | Cálculo de pontos/XP | (a) Consentimento | Derivado de T1, necessário para gamificação | Sim |
| T3 | Identidade multi-canal (phone/email/IG) | (a) Consentimento explícito | Ligação entre sistemas só com consentimento | Sim |
| T4 | Registo de consentimentos | (c) Obrigação legal | Art. 7(1) RGPD exige demonstração do consentimento | Não — obrigação legal |
| T5 | Leaderboard/ranking | (a) Consentimento | Nome real só com toggle `consentRealName`. Sem consentimento, usa alias. | Sim |
| T6 | Erasure (Art. 17) | (c) Obrigação legal | Direito do titular, cumprimento obrigatório | N/A |
| T7 | DOB / menores | (c) Obrigação legal + (a) Consentimento | Obrigação de proteger menores (Art. 8). Consentimento parental para <18. | Parcial — obrigação legal de verificar |

## Consentimentos Específicos (4 toggles)

| Toggle | Efeito se activo | Base legal |
|--------|-----------------|-----------|
| `consentTraining` | Participa no StrikeLab, pontos creditados | (a) Consentimento |
| `consentUgc` | Conteúdo gerado pelo utilizador pode ser usado em marketing | (a) Consentimento |
| `consentRealName` | Nome real aparece no leaderboard | (a) Consentimento |
| `consentBroadcasts` | Recebe comunicações sobre o programa | (a) Consentimento — NÃO é contrato |

## Notas

- Todos os consentimentos são granulares e retractáveis a qualquer momento
- Consentimento é recolhido via bot WhatsApp com audit trail
- Versão do consentimento registada (`consentVersion`, default "v1.0")
- Menores (<18): consentimento parental obrigatório antes de todos os toggles
