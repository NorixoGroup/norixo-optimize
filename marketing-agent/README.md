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
- `locales/` : profils culturels et linguistiques par marche
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

## Data Model Foundation

Norixo AI possede desormais un modele metier independant de toute base de
donnees.

## History & Memory Foundation

Norixo AI dispose maintenant d'un cadre memoire pour eviter les doublons,
tracer les decisions et preparer l'apprentissage par performance.

## Analytics & Learning Foundation

Norixo AI peut desormais mesurer, apprendre et ameliorer progressivement sa
strategie de contenu.

## Approval & Safety Foundation

Norixo AI integre desormais une couche de gouvernance garantissant la qualite
et la securite des contenus avant publication.

## Simulation Mode

Norixo AI peut desormais produire une journee complete de contenus sans
publier.

Cette etape sert a valider la qualite des decisions avant l'automatisation
reelle.

## Marketing QA Framework

Norixo AI possede desormais un framework qualite inspire des QA de Norixo
Optimize.

## Scenario Registry

Norixo AI dispose maintenant d'un registre officiel de scenarios de simulation
pour suivre leur statut, leur couverture fonctionnelle, leur niveau QA et leur
etat de validation.

## LLM Adapter Foundation

Norixo AI dispose maintenant d'une couche d'abstraction LLM pour preparer de
futures integrations fournisseurs sans coupler les agents a OpenAI, Claude,
Gemini, Mistral, Ollama ou a un provider specifique.

## Provider Resolver Foundation

Norixo AI dispose maintenant d'une couche de resolution fournisseur qui permet
au LLM Adapter de demander un provider a un resolver dedie plutot que de le
choisir directement.

## Runtime Contract Foundation

Norixo AI dispose maintenant d'un contrat runtime explicite pour normaliser les
echanges entre agents, LLM Adapter, Provider Resolver et futurs providers sans
encore brancher de provider reel.

## Mock Runtime Wiring

Norixo AI dispose maintenant d'un premier flux runtime complet local reliant le
Draft Generator, le LLM Adapter, le Provider Resolver et un Mock Provider sans
reseau, sans cle API et sans provider reel.

## OpenAI Provider Alpha

Norixo AI peut maintenant reconnaitre un provider OpenAI optionnel, active
uniquement via configuration runtime, tout en conservant `mock` comme
comportement par defaut.

## Quality Gate Foundation

Norixo AI dispose maintenant d'une fondation commune de quality gate pour
definir des criteres de revue partages et executer un premier controle
structurel avant toute validation humaine, promotion ou publication.

## Locale Profiles Foundation

Norixo AI dispose maintenant d'une base de profils locales pour preparer les
adaptations linguistiques et culturelles du futur Localization Agent, ainsi que
les besoins du Video Agent, de l'Image Agent et du Publisher.

## Campaign Model Foundation

Norixo AI dispose maintenant d'une fondation documentaire pour structurer les
campagnes, leurs items, leur calendrier local et leur QA sans encore lancer de
generation operationnelle.

## Campaign Planner Foundation

Norixo AI dispose maintenant d'une couche documentaire pour choisir les types
de campagnes, les templates, la duree et le nombre d'items avant execution par
le Campaign Engine.

## Image Agent Foundation

Norixo AI dispose maintenant d'une fondation documentaire pour definir les
types d'images, les formats, les variantes, les overlays et le workflow du
futur Image Agent avant toute generation reelle.

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
