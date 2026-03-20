# Automations Hub

Dashboard local para gerenciar automações e projetos Lovable do Comercial.

## Stack
- Python 3 + Flask
- HTML/CSS/JS inline (sem frameworks)
- config.json como "banco de dados"

## Estrutura
- `app.py` — Backend Flask (porta 5050)
- `config.json` — Registro de automações e projetos Lovable
- `templates/index.html` — Dashboard visual

## Regras
- Para adicionar nova automação: editar `config.json` e adicionar no array `automations`
- Para adicionar novo projeto Lovable: editar `config.json` e adicionar no array `lovable_projects`
- Nunca alterar o app.py para dados — tudo fica no config.json
- Toggle de launchd usa `launchctl load/unload`

## Execução
```bash
cd ~/Claude-Code/automations-hub && python3 app.py
```
Acesse: http://localhost:5050
