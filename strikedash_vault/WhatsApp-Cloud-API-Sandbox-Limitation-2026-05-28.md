---
title: WhatsApp Cloud API — Sandbox Number Limitation
type: reference
status: open-blocker
date: 2026-05-28
related: [[WhatsApp-Group-Invite-Rollout-2026-05-27]], [[WhatsApp-Bot-Design]]
---

# WhatsApp Cloud API — Sandbox Number Limitation

> **TL;DR:** O bulk invite (PR #18 + #23) está deployed e a funcionar. O bloqueio é Meta-side: a conta está a usar o **número sandbox grátis da Meta** (`+1 555-647-8265`), que tem cap permanente de **5 recipients** na allow-list. Para escalar precisa de **número próprio + business verification**.

## O que descobrimos

Em 2026-05-28 ~12:55 o Ricardo disparou `Convidar todos` para 32 subscritores. Resultado:

- Test send para `+351912873698` (próprio nº): ✅ sent
- Bulk send para 32 nº na bucket Faltam Convidar: ❌ 32× failed
- Erro consistente: `metaStatus: 400`, body code **131030 — "Recipient phone number not in allowed list"**

Confirmado via `GET /v21.0/{PHONE_NUMBER_ID}`:

```json
{
  "id": "1148538915006619",
  "display_phone_number": "+1 555-647-8265",
  "verified_name": "Test Number"
}
```

O número configurado em `WA_PHONE_NUMBER_ID` é o **sandbox grátis da Meta**, não um número de produção da Striker's House.

## Como a sandbox da Meta funciona

A Meta dá um número sandbox grátis para devs testarem a Cloud API antes de comprar/registar um número de produção. Limites do sandbox:

| Limite | Valor |
|---|---|
| Recipients allow-list | máx **5** nº |
| Quota de mensagens diárias | 1000 (mais que suficiente) |
| Templates aprovados | sem limite |
| Conversation pricing | grátis |
| Webhook | funciona normalmente |
| Remoção da allow-list cap | **não é possível** — limite hard da Meta |

A allow-list:
- Cada nº adicionado recebe SMS com código de 6 dígitos
- Alguém com acesso ao phone tem de entrar o código no Business Manager
- A API pública para gerir esta lista **não existe** — só UI

## Por que o teste funcionou e o bulk falhou

O `+351912873698` (nº do Ricardo) está na allow-list do sandbox (provavelmente adicionado quando o bot foi configurado pela primeira vez para testes manuais). Os 32 da bucket Faltam Convidar não estão.

## O que está garantido

- ✅ Código do dashboard funciona (PR #18 + #23 deployed em produção)
- ✅ Template `convite_grupo_whatsapp` (id `2043735509515639`) aprovado pela Meta em pt_PT MARKETING
- ✅ `WA_GROUP_INVITE_URL` configurado em Vercel (dev + preview + prod)
- ✅ Endpoint `/api/whatsapp/admin/group-invite/bulk` testa, persiste, idempotência funciona, error handling fica detalhado em `WaOutbound.error`
- ✅ UI `/dashboard/wa/coverage` tem botão Convidar todos + input Testar + badges per-row

## Os dois caminhos para resolver

### A — Curto prazo: usar sandbox com 5 recipients

Add 5 nº via Business Manager:

1. https://business.facebook.com/wa/manage/phone-numbers/
2. Selecciona o nº `+1 555 647 8265`
3. **API Setup** → secção **To** → dropdown → **Manage phone number list** → **Add phone number**
4. Insere nº em formato `+351...` → Meta manda SMS → destinatário entra código → submit
5. Repete até 5

Limitação: cada destinatário tem de cooperar (entrar o código no SMS).

Sugestão de quem adicionar para validação real-world:
- Ricardo (já está)
- Marcelo (outro admin)
- 2-3 subscritores activos com quem o Ricardo tem contacto directo
- 1 ex-cliente próximo (opcional — testa o template em alguém que já saiu)

### B — Médio prazo: registar número próprio + business verification

Único caminho para enviar a todos os 32+ sem cap.

**Pré-requisitos:**
- **1 número de telefone** dedicado à Striker's House WhatsApp Business:
  - Opção 1: SIM física (compra novo, ou usa o nº fixo da academia se houver)
  - Opção 2: VOIP que aceite SMS — ex: Twilio, Vonage, MessageBird. Custo ~10€/mês
  - **Importante:** o nº não pode estar a usar WhatsApp pessoal ou Business num device — terá de ser desactivado primeiro
- Documentação da empresa para verificação:
  - Certidão comercial actualizada
  - NIF
  - Comprovativo de morada (factura de água/luz/internet)
  - Telefone fixo verificável OU email empresarial num domínio próprio

**Passos:**

1. **Adicionar nº ao WABA**
   - https://business.facebook.com/wa/manage/phone-numbers/
   - **Add phone number**
   - Meta verifica via SMS ou chamada (Ricardo escolhe; SMS é mais rápido)
   - Quando verificado, fica disponível como `WA_PHONE_NUMBER_ID` alternativo

2. **Business verification**
   - https://business.facebook.com/security/businessverificationapproval/
   - Submete documentos (anexa o certificado registado)
   - Meta valida 1-3 dias úteis (às vezes mais — depende da carga deles)
   - Quando aprovada, a conta passa de development para production

3. **Switch do código para o nº novo**
   - Update `WA_PHONE_NUMBER_ID` em Vercel (dev + preview + prod)
   - Re-deploy
   - Confirmar com `GET /v21.0/{new_phone_id}` que `verified_name` ≠ "Test Number"

4. **Disparar bulk**
   - `/dashboard/wa/coverage` → **Convidar todos** → confirma → vai correr para os 27 restantes (assumindo que os 5 da Opção A já foram inseridos no grupo)

## Caminho recomendado

Os dois caminhos não são exclusivos. **Faz ambos em paralelo:**

| Quando | Acção |
|---|---|
| Hoje | Add 4 nº ao sandbox via UI A → Convidar via Enviar teste → confirma que template fica bem em produção |
| Esta semana | Decide SIM dedicada vs VOIP. Compra/configura. Adiciona ao WABA. |
| Próximas 2 sem | Submete business verification. Aprovada → switch `WA_PHONE_NUMBER_ID` → bulk para os restantes |

## Anexo — error body completo

```json
{
  "error": {
    "message": "(#131030) Recipient phone number not in allowed list",
    "code": 131030,
    "type": "OAuthException",
    "error_data": {
      "messaging_product": "whatsapp",
      "details": "Recipient phone number not in allowed list..."
    }
  }
}
```

Persistido em `WaOutbound.error` por cada falha, e em `WaEvent kind