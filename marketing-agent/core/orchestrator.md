# Orchestrator

## Role

L'Orchestrator est le chef d'orchestre du futur systeme Norixo AI.

Il ne cree pas tout lui-meme. Il choisit quel agent declencher, dans quel ordre,
avec quel contexte et pour quel objectif.

## Responsabilites

- recevoir un besoin editorial ou marketing
- interroger le Knowledge Hub
- choisir le bon pipeline de production
- distribuer le travail entre agents specialises
- verifier qu'un meme sujet n'est pas traite sans raison
- gerer les dependances entre contenu, visuel, traduction et publication

## Decisions prises

- quel sujet traiter
- quel canal activer
- quel agent appeler
- quel niveau de priorite appliquer
- si un contenu doit etre recycle, adapte ou abandonne
- si un sujet releve d'un usage social, video, article, image ou multilingue

## Agents declenches

- Social Media Agent
- Video Agent
- Content Agent
- Translation Agent
- Image / Visual Agent
- Publisher Agent
- Analytics Agent pour les boucles d'amelioration

## Exemples de scenarios

### Scenario 1

Une nouvelle fonctionnalite Norixo est ajoutee.

L'Orchestrator :

- recupere le brief de fonctionnalite depuis le Knowledge Hub
- demande un angle explicatif au Content Agent
- demande des declinaisons reseaux au Social Media Agent
- demande un visuel au Visual Agent
- demande une adaptation future a la Translation Agent
- transmet au Publisher Agent pour validation et preparation

### Scenario 2

Une page ville performe bien et merite une declinaison sociale.

L'Orchestrator :

- lit le contexte ville
- choisit un angle local utile
- demande 3 variantes reseaux
- decide si un format video court est pertinent

## Limites

- il ne publie pas directement
- il ne remplace pas la validation humaine
- il ne doit pas inventer des faits absents du Knowledge Hub
- il ne doit pas coupler le systeme au code applicatif

## Regle cle

Aucune publication directe ne doit partir de l'Orchestrator dans la premiere
version.

