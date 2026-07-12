# Soletra Solver - PRD

## Problem Statement
App para gerar respostas para o jogo Soletra (G1) em português. O usuário informa a letra central obrigatória e 6 letras externas. O app gera lista de palavras válidas.

## Architecture (Frontend-only)
- **Frontend**: React + Tailwind CSS, layout hexagonal similar ao jogo original
- **Sem backend**: dicionários estáticos em `/public` (`br-utf8.txt` 74k estrito, `br-extra.txt` 325k extras), estado no `localStorage`
- **Deploy**: Vercel (yarn obrigatório; `vercel.json` com rewrite `/api/soletra-oficial` → `https://g1.globo.com/jogos/static/soletra.json` para contornar CORS; fallback local `soletra-oficial.json`)

## Core Requirements
- Palavras com pelo menos 4 letras, contendo a letra central, usando só as 7 letras (com repetição)
- Remove acentos para comparação; pangrams destacados
- Resultados agrupados por tamanho e ordem alfabética

## What's Been Implemented
### 2026-04 a 2026-06
- Migração completa para frontend-only (backend removido)
- Layout hexagonal, resultados agrupados, pangrams destacados, responsivo
- Persistência em localStorage (letras, marcações, navegação)
- Dicionário estrito filtrado (sem gerúndios/plurais/conjugações) + dicionário extra aditivo (botão)
- Marcação certo/errado por palavra com resumo
- Indicadores "+" entre palavras: injeta palavras filtradas (amarelo) e combinações de letras (laranja) por contexto de gap
- Integração G1 "Palavras Oficiais do Dia": busca via proxy Vercel, auto-preenche letras, exibe pontuação
### 2026-06-12
- Painel de palavras oficiais agora agrupado por quantidade de letras e ordenado alfabeticamente (pt-BR) dentro de cada grupo

## Critical Notes
- NÃO adicionar backend. NÃO usar npm (só yarn).
- Gerador de combinações limitado ao contexto do gap (evita travar navegador em palavras 7+)

## User Personas
- Jogadores do jogo Soletra que querem encontrar palavras possíveis

## Backlog
- P1: Verificar rewrite do Vercel em produção (proxy G1) — verificação do usuário pendente
- P2: Refatorar App.js (~750 linhas) em hooks/componentes menores
- P2: Salvar histórico de buscas, compartilhar resultados, modo escuro
