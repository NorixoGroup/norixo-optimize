# LLM Adapter

## Role

Le LLM Adapter est la couche d'abstraction entre les agents Norixo AI et les
futurs fournisseurs de langage.

## Responsibilities

- recevoir une demande normalisee
- choisir un provider selon une regle de selection
- appliquer le contrat unique
- renvoyer une reponse normalisee
- masquer les differences techniques entre fournisseurs

## Inputs

- role
- contexte
- brief
- contraintes
- format attendu

## Outputs

- texte
- metadonnees
- score de confiance
- erreurs eventuelles

## Non-Responsibilities

Le LLM Adapter ne doit pas :

- prendre une decision marketing
- redefinir le brief
- publier
- ecrire directement dans les scenarios
- contourner la validation humaine

## Selection Logic

La logique de selection pourra plus tard s'appuyer sur :

- type de tache
- cout autorise
- disponibilite du provider
- politique de confidentialite
- mode local ou cloud

## Foundation Rule

Les agents ne doivent jamais dependre directement d'un provider.

Ils doivent toujours passer par le LLM Adapter, meme en mode mock.
