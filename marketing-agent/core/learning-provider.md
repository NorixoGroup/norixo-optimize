# Learning Provider Layer

## Role

La couche Learning Provider execute ou simule l'analyse des learning inputs
prepares par le Learning Agent.

Elle n'invente pas la campagne.

Elle ne choisit pas seule la strategie marketing.

Elle ne modifie aucune decision sans validation.

## Responsibilities

- recevoir une learning input deja preparee
- choisir ou executer un provider learning concret
- renvoyer un statut exploitable par la QA et les outils
- preparer une sortie remplacable pour des providers futurs
- conserver un comportement mock et local tant qu'aucun provider reel n'est
  active

## Non-Responsibilities

La couche provider learning ne doit pas :

- definir la strategie de campagne
- publier du contenu
- creer du contenu marketing
- prendre une decision finale seule
- modifier les artefacts amont

## Separation With Learning Agent

Le Learning Agent :

- lit les Analytics Status
- prepare les learning inputs
- structure les signaux, insights et recommandations cibles

Le provider learning :

- recoit cette entree
- execute ou simule l'analyse
- retourne un resultat standardise

## Future Providers

La couche est prevue pour accueillir plus tard :

- Rule-based Learning
- LLM Learning
- Pattern Detection
- Statistical Learning
- Reinforcement Learning
- Hybrid Learning
- Mock Learning Provider

## Current Mode

Dans cette phase, seul un Mock Learning Provider est branche.

Il n'apprend rien.

Il confirme uniquement que le futur raccord provider est pret.
