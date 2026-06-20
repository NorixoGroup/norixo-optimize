# Runtime Request

## Role

Ce document definit la structure d'entree runtime commune pour tous les
providers LLM de Norixo AI.

## Common Structure

Chaque requete runtime doit exposer les champs suivants :

- requestId
- provider
- role
- scenario
- prompt
- constraints
- language
- metadata
- expectedOutput
- timestamp

## Field Definitions

### requestId

Identifiant unique de la requete.

Il permet de relier une requete a une reponse, a des logs et a une trace
d'execution.

### provider

Nom du provider resolu ou demande.

Exemples :

- mock
- openai
- claude
- gemini
- mistral
- ollama
- deepseek

### role

Role fonctionnel demande au moteur.

Exemples :

- content-drafter
- translation-assistant
- social-copywriter
- title-optimizer

### scenario

Reference du scenario ou du contexte de travail.

Exemples :

- scenario-003-booking-optimizer
- scenario-007-product-release

### prompt

Charge utile textuelle principale a transmettre au provider.

Ce champ peut provenir d'un editorial brief, d'un draft, d'un master content
ou d'une construction intermediaire preparee par l'adapter.

### constraints

Liste des contraintes de generation a respecter.

Exemples :

- ton
- limites factuelles
- longueur
- reseau cible
- interdictions explicites

### language

Langue cible principale attendue pour la sortie.

Exemples :

- fr
- en
- es

### metadata

Bloc libre mais structure pour porter les informations complementaires utiles.

Exemples :

- source
- taskType
- audience
- template
- providerMode

### expectedOutput

Definition de la forme de sortie attendue.

Exemples :

- markdown
- plain-text
- json
- named-sections

### timestamp

Marqueur temporel logique de creation de la requete.

Il sert a tracer l'execution, pas a piloter une logique marketing.

## Invariant

Tous les providers devront accepter cette structure d'entree, meme s'ils ont
ensuite besoin d'un mapping interne propre a leur API.
