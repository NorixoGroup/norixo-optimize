# Publication Provider Layer

## Role

La couche Publication Provider execute ou simule la diffusion d'une publication
preparee par le Publisher Agent.

Elle n'invente pas la campagne.

Elle ne choisit pas le message marketing.

Elle ne genere ni image ni video.

## Responsibilities

- recevoir une publication deja preparee
- choisir ou executer un provider de publication concret
- renvoyer un statut exploitable par la QA et les outils
- preparer une sortie remplacable pour des providers futurs
- conserver un comportement mock et local tant qu'aucun provider reel n'est
  active

## Non-Responsibilities

La couche provider publication ne doit pas :

- definir la strategie de campagne
- rediger le contenu marketing
- traduire les messages
- generer les assets
- evaluer la qualite marketing finale

## Separation With Publisher Agent

Le Publisher Agent :

- lit le Campaign Item valide
- lit le contenu localise
- lit les assets image et video
- choisit les plateformes
- prepare la demande de publication

Le provider publication :

- recoit cette demande
- execute ou simule la diffusion
- retourne un resultat standardise

## Future Providers

La couche est prevue pour accueillir plus tard :

- Facebook Graph API
- Instagram Graph API
- LinkedIn API
- X API
- Threads API
- TikTok API
- YouTube API
- WordPress API
- Buffer
- Hootsuite
- Zapier
- Mock Publication Provider

## Current Mode

Dans cette phase, seul un Mock Publication Provider est branche.

Il ne publie rien.

Il confirme uniquement que le futur raccord provider est pret.
