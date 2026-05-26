---
title: Spotify Playlist Per Class — Design Spec (canonical pointer)
type: design
date: 2026-05-27
status: spec-locked-pending-implementation
---

# Spotify Playlist Per Class — Spec Pointer

Spec canónico em `docs/superpowers/specs/2026-05-27-spotify-playlist-per-class-design.md`.

## Sumário

Cada aula em grupo da Strike recebe automaticamente uma playlist Spotify gerada por cron diário, semeada com 20 faixas aleatórias da playlist-mestre. Alunos inscritos podem pedir **1 música** via WhatsApp; o pedido entra no topo (FIFO) e empurra a base para baixo, garantindo que toca. Sistema rejeita pedidos sincronamente se o género do artista cair numa blocklist (pagode, funk carioca, axé, etc.). Cancelar reserva remove automaticamente a música. Sem moderação humana.

## Princípios fechados

- 1 música por aluno por aula
- Apenas aulas em grupo (PTs excluídas)
- FIFO (1º a pedir = 1º a tocar = position 0)
- 20 músicas-base por aula (shuffle aleatório)
- Censura síncrona no pedido (blocklist por género + artista)
- Cancela reserva → cancela música automaticamente
- Janela: até 10 min APÓS início da aula

## Slicing (input para writing-plans)

A. Spotify auth + client · B. Daily cron · C. Genre filter · D. WA pedido + add · E. WA cancel + swap · F. WA discovery menu · G. Admin UI blocklist

## Related

- [[WhatsApp-Bot-v1-Spec]] — bot base onde isto se enxerta
- [[WhatsApp-Bot-Pending]] — anexar como growth follow-up
- [[Yogo-API]] — fonte da agenda de aulas
- [[Roadmap]] — encaixar como Sprint 5
