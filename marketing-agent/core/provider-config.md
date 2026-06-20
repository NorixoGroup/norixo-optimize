# Provider Config

## Role

Ce document decrit la configuration unique des futurs fournisseurs de langage
dans Norixo AI.

## Default Configuration

```txt
default_provider = mock
```

## Available Providers

- mock
- openai
- claude
- gemini
- mistral
- ollama
- deepseek

## Configuration Principles

- un seul provider par defaut
- un fallback explicite
- une liste de providers supportables sans coupler les agents
- une configuration stable, lisible et facilement evolutive

## V1 Rule

Dans la version actuelle, le provider par defaut est toujours `mock`.

Aucune cle API n'est utilisee.
Aucun acces reseau n'est active.
