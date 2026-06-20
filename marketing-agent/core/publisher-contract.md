# Publisher Contract

## Role

Ce contrat definit l'entree et la sortie communes du futur Publisher Engine.

Il doit rester independant de tout provider ou reseau social concret.

## Input

Le Publisher doit pouvoir recevoir une structure equivalente aux champs
suivants :

- `campaignItem`
- `locale`
- `content`
- `image`
- `video`
- `metadata`

## Input Field Notes

### campaignItem

Identifiant du Campaign Item source.

### locale

Locale associee a la publication cible.

### content

Bloc de contenu localise pret pour la diffusion.

### image

Reference vers un ou plusieurs assets image valides.

### video

Reference vers un ou plusieurs assets video valides.

### metadata

Bloc libre pour hashtags, liens, CTA, tags ou contraintes de plateforme.

## Output

Le Publisher doit pouvoir produire une structure equivalente aux champs
suivants :

- `publicationRequest`
- `platform`
- `assets`
- `schedule`
- `metadata`
- `status`

## Output Field Notes

### publicationRequest

La demande de diffusion preparee pour une plateforme cible.

### platform

Plateforme visee par la publication.

### assets

Liste d'assets associes a la publication.

### schedule

Informations de date, heure, fuseau, priorite et expiration.

### metadata

Bloc d'informations techniques ou marketing associe a la diffusion.

### status

Etat courant de preparation ou de blocage de la publication.

Exemples :

- `draft`
- `ready`
- `blocked`
- `scheduled`

## Regles

- le Publisher ne doit jamais produire une publication sans Campaign Item
- la locale doit rester explicite
- les assets doivent rester tracables
- le schedule doit rester separable du contenu
