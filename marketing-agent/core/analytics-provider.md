# Analytics Provider Layer

## Role

La couche Analytics Provider execute ou simule la collecte de metriques a
partir d'une demande preparee par l'Analytics Agent.

Elle n'invente pas la campagne.

Elle ne choisit pas la strategie marketing.

Elle ne normalise pas seule les rapports metier finaux.

## Responsibilities

- recevoir une demande analytics deja preparee
- choisir ou executer un provider analytics concret
- renvoyer un statut exploitable par la QA et les outils
- preparer une sortie remplacable pour des providers futurs
- conserver un comportement mock et local tant qu'aucun provider reel n'est
  active

## Non-Responsibilities

La couche provider analytics ne doit pas :

- definir la strategie de campagne
- publier du contenu
- creer du contenu marketing
- apprendre ou decider seule
- modifier les artefacts amont

## Separation With Analytics Agent

L'Analytics Agent :

- lit les Campaign IDs
- lit les Publication Status
- prepare la demande de collecte
- prepare les rapports cibles et la normalisation

Le provider analytics :

- recoit cette demande
- execute ou simule la collecte
- retourne un resultat standardise

## Future Providers

La couche est prevue pour accueillir plus tard :

- Google Analytics
- Google Search Console
- Meta Insights
- LinkedIn Analytics
- X Analytics
- YouTube Analytics
- TikTok Analytics
- Stripe
- PostHog
- Vercel Analytics
- Mock Analytics Provider

## Current Mode

Dans cette phase, seul un Mock Analytics Provider est branche.

Il ne collecte rien.

Il confirme uniquement que le futur raccord provider est pret.
