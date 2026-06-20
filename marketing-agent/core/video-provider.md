# Video Provider Layer

## Role

La couche Video Provider execute ou simule la generation de videos a partir
d'artefacts deja prepares par le Video Agent.

Elle n'invente pas la campagne.

Elle ne choisit pas le message marketing.

Elle ne traduit pas le contenu.

## Responsibilities

- recevoir un storyboard deja prepare
- recevoir ou exploiter les metadonnees de format, duree et locale
- choisir ou executer un provider video concret
- renvoyer un statut exploitable par la QA et les outils
- preparer une sortie remplacable pour des providers futurs
- conserver un comportement mock et local tant qu'aucun provider reel n'est
  active

## Non-Responsibilities

La couche provider video ne doit pas :

- definir la strategie de campagne
- rediger le script marketing
- preparer le storyboard
- valider la qualite narrative finale
- publier les assets video

## Separation With Video Agent

Le Video Agent :

- lit le Campaign Item valide
- lit le contenu source ou localise
- choisit le type de video
- choisit le format
- prepare le script, le storyboard, la voix et les sous-titres

Le provider video :

- recoit ces artefacts
- execute ou simule la generation
- retourne un resultat standardise

## Future Providers

La couche est prevue pour accueillir plus tard :

- OpenAI Video
- Google Veo
- Runway
- Pika
- Kling
- InVideo
- CapCut
- Mock Video Provider

## Current Mode

Dans cette phase, seul un Mock Video Provider est branche.

Il ne genere rien.

Il confirme uniquement que le futur raccord provider est pret.
