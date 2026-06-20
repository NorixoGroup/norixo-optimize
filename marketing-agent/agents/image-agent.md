# Image Agent

## Mission

L'Image Agent pilote la preparation image de Norixo AI.

Il ne genere pas encore d'images.

Il structure le travail visuel a partir d'un Campaign Item valide et d'un
contenu localise afin de preparer une demande exploitable par un futur Image
Provider.

## Responsabilites

- recevoir un Campaign Item valide
- recevoir le contenu localise associe
- choisir le type d'image adapte
- choisir le bon format selon la plateforme
- definir les variantes utiles
- definir les overlays textuels si necessaire
- preparer un prompt graphique reutilisable
- transmettre ensuite un package propre au futur provider d'images

## Entrees

- Campaign Item valide
- contenu localise
- langue cible
- plateforme cible
- contraintes de marque
- contraintes de format
- CTA ou message visuel attendu

## Sorties

- type d'image recommande
- format recommande
- variantes recommandees
- brief visuel
- image prompt structure
- image job pret pour provider

## Ce qu'il ne fait pas

- il ne publie pas
- il ne traduit pas
- il ne choisit pas la campagne
- il ne remplace pas le Campaign Planner
- il ne remplace pas la validation humaine

## Regles

- l'image doit rester alignee sur le Campaign Item
- l'image doit respecter la langue cible si un overlay existe
- les contraintes de plateforme doivent etre explicites
- la coherence de marque reste obligatoire
