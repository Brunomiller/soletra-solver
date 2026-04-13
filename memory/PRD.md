# Soletra Solver - PRD

## Problem Statement
App para gerar respostas para o jogo Soletra em português. O usuário informa a letra central obrigatória e 6 letras externas. O app gera lista de palavras válidas.

## Architecture
- **Backend**: FastAPI + dicionário br-utf8.txt (261k palavras) carregado em memória
- **Frontend**: React + Tailwind CSS, layout hexagonal similar ao jogo original
- **Database**: MongoDB (não usado ativamente - dicionário é estático)

## Core Requirements
- Palavras com pelo menos 4 letras
- Deve conter a letra central
- Só usa as 7 letras fornecidas (podem repetir)
- Remove acentos para comparação
- Pangrams = palavras usando todas as 7 letras

## What's Been Implemented (2026-04-13)
- Backend: POST /api/solve endpoint com validação e filtragem
- Frontend: Layout hexagonal com 7 inputs circulares
- Resultados agrupados por tamanho
- Pangrams destacados com ícone e estilo verde
- Botão reset para limpar
- Responsivo (mobile/tablet/desktop)

## User Personas
- Jogadores do jogo Soletra que querem encontrar palavras possíveis

## Backlog
- P2: Salvar histórico de buscas
- P2: Compartilhar resultados
- P2: Modo escuro
