# Marketing Brain Engine V0

## Role

Le Marketing Brain Engine V0 est la premiere couche executable du cerveau
marketing Norixo AI.

Il ne genere aucun contenu. Il produit uniquement une proposition de travail
pour le prochain scenario a creer.

## Decision Inputs

Le moteur s'appuie sur des signaux simples et documentes :

- le registre officiel des scenarios
- les scenarios deja presents dans `marketing-agent/simulations/`
- les familles deja couvertes
- les priorites documentees dans le registre

## Decision Criteria

La recommandation repose sur une logique V0 basee sur des regles :

- priorite declaree dans le registre
- niveau de couverture actuel
- presence ou absence d'une famille deja bien couverte
- manque d'un scenario strategique dans une famille importante

## Scoring Logic

Base de score :

- High : 90
- Medium : 75
- Low : 60

Bonus V0 possibles :

- +2 si la famille Booking reste partiellement couverte
- +1 si une famille prioritaire n'a encore aucun scenario complet

Le score devient ensuite un indicateur de confiance, pas une verite absolue.

## Priorities

Le moteur privilegie d'abord :

- les scenarios `High`
- les familles encore sous-couvertes
- les scenarios qui prolongent une couverture deja amorcee mais incomplete

## Expected Output

Le moteur doit fournir un rapport lisible contenant :

- les sujets analyses
- le scenario recommande
- la raison principale
- la priorite
- la confiance
- l'action recommandee

## Limits

- aucune IA
- aucun LLM
- aucun scoring semantique
- aucune lecture automatique des contenus scenario
- aucune prise en compte de performances reelles

## Human Validation

La proposition du moteur doit rester une aide a la decision.

La validation humaine reste obligatoire avant de creer un nouveau scenario ou
de modifier la roadmap documentaire.
