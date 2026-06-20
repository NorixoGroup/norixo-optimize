# Image Provider Layer

## Role

La couche Image Provider execute ou simule la generation d'images a partir d'un
prompt visuel prepare par l'Image Agent.

Elle n'invente pas la campagne.

Elle ne choisit pas le message marketing.

Elle ne localise pas le contenu.

## Responsibilities

- recevoir un prompt image deja prepare
- choisir ou executer un provider image concret
- renvoyer un statut exploitable par la QA et les outils
- preparer une sortie remplacable pour des providers futurs
- conserver un comportement mock et local tant qu'aucun provider reel n'est
  active

## Non-Responsibilities

La couche provider image ne doit pas :

- definir la strategie de campagne
- rediger le contenu marketing
- traduire les messages
- valider la qualite artistique finale
- publier les assets

## Separation With Image Agent

L'Image Agent :

- lit le Campaign Item valide
- lit le contenu localise
- choisit un type d'image
- choisit un format
- prepare le prompt visuel

Le provider image :

- recoit ce prompt
- execute ou simule la generation
- retourne un resultat standardise

## Future Providers

La couche est prevue pour accueillir plus tard :

- OpenAI Images
- Flux
- Ideogram
- Midjourney
- Stable Diffusion
- Mock Image Provider

## Current Mode

Dans cette phase, seul un Mock Image Provider est branche.

Il ne genere rien.

Il confirme uniquement que le futur raccord provider est pret.
