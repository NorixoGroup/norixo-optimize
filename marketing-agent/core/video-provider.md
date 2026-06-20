# Video Provider

## Role

Le Video Provider est le moteur de production video execute par le Video Agent.

Il recoit un package de production et genere la video a partir des elements
fournis.

## Entrees attendues

- script
- captures
- logo
- voix
- musique
- animations
- branding
- contraintes de format
- storyboard si disponible

## Sortie attendue

- une video master exploitable
- des exports ou rendus intermediaires si necessaire
- un resultat conforme au format demande

## Fournisseurs possibles

Le Provider doit rester interchangeable.

Exemples :

- InVideo
- CapCut
- Veo
- Runway
- futurs moteurs

## Regle d'architecture

Le Video Agent ne doit jamais etre concu pour un outil unique.

Le moteur peut changer sans remettre en cause :

- le workflow
- le script
- le storyboard
- la logique de validation
- la structure des agents

## Ce que le Provider ne decide pas

- le sujet
- la strategie editoriale
- le calendrier
- la priorite business
- la publication finale

