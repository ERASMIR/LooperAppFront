---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

> **Adaptación LOOPER (modificado respecto del original de vercel-labs/agent-skills):** las reglas se leen de la copia
> local `guidelines.md` (no se descargan: la red local bloquea descargas). Origen y versión en `../README.md`.
> Antes de auditar, lee `../auditoria-ui/SKILL.md` (reglas de estilo de LOOPER, excepciones y formato de salida).

## How It Works

1. Read the guidelines from `guidelines.md` (in this folder)
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the guidelines, with the LOOPER exceptions listed in `../auditoria-ui/SKILL.md`
4. Output findings in the terse `file:line` format, in Spanish

## Usage

When a user provides a file or pattern argument:
1. Read `guidelines.md`
2. Read the specified files
3. Apply all rules from the guidelines
4. Output findings using the format specified in the guidelines

If no files specified, use the scope defined in `../auditoria-ui/SKILL.md` or ask the user which files to review.
