# Norixo Social Media Agent

## Objectif

Ce dossier contient la base documentaire d'un agent IA marketing dedie uniquement
aux reseaux sociaux de Norixo.

Il est volontairement separe du produit principal pour eviter tout impact sur :

- le SEO public existant
- le dashboard
- le billing
- les pages marketing stables
- la logique coeur de Norixo Optimize

## Perimetre

L'agent doit aider Norixo a produire, planifier, archiver et publier du contenu
utile pour :

- Facebook
- Instagram
- Snapchat

Cette phase ne contient aucune automatisation de publication. Elle pose
uniquement une base modulaire et evolutive.

## Missions couvertes

- transformer les connaissances Norixo en sujets editoriaux
- proposer des angles adaptes aux hotes Airbnb et Booking
- rediger des variantes par reseau social
- suggerer des idees de visuels et des prompts image
- organiser un calendrier de publication
- archiver l'historique des posts

## Principes

- ton professionnel, moderne, expert et accessible
- contenu utile avant contenu promotionnel
- pas de publicite agressive
- priorite aux conseils concrets, a la pedagogie et a la clarte
- reutilisation intelligente des guides, villes, fonctionnalites et nouveautes

## Structure

- `core/` : fondations transversales Norixo AI
- `brand/` : regles de ton, CTA, hashtags
- `knowledge/` : base de connaissance Norixo
- `agents/` : fiches de role pour chaque agent specialise
- `templates/` : formats de sortie par reseau
- `history/` : archive editoriale
- `workflows/` : workflow editorial quotidien

## Norixo AI Foundation

Le dossier `marketing-agent/` represente le premier module de l'ecosysteme
Norixo AI.

La phase 2 ajoute trois fondations transversales :

- Knowledge Hub
- Orchestrator
- Asset Library

Ces fondations permettront ensuite de connecter plusieurs agents specialises
sans coupler le systeme au code applicatif de Norixo Optimize.

## Video Architecture

Norixo AI utilise un Video Agent independant du moteur video.

Les moteurs peuvent evoluer sans modifier l'architecture.

## Content Foundation

Toute la production editoriale de Norixo AI repose desormais sur un Master
Content unique, reutilise par tous les agents.

## Marketing Brain

Le cerveau marketing decide des sujets avant toute production.

Les agents executent ensuite ses decisions.

## Sorties attendues a terme

- idees de sujets
- briefs de contenu
- posts Facebook
- captions Instagram
- messages Snapchat
- idee de visuel
- prompt image
- calendrier de publication
- archive et analyse des performances

## Hors scope de cette phase

- publication automatique
- connexion API Meta ou Snapchat
- analytics connectees a des plateformes externes
- scoring automatique des performances
- generation d'images en production
