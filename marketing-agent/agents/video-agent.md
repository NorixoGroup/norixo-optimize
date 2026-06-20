# Video Agent

## Mission

Le Video Agent pilote la preparation video de Norixo AI.

Il ne cree pas encore de videos.

Il ne depend d'aucun outil unique et ne monte pas lui-meme les videos.

Son role est d'orchestrer la preparation, le format, le script, le storyboard,
la voix, les sous-titres, les assets et l'appel a un futur provider video ou
outil de montage interchangeable.

## Responsabilites

- recevoir un Campaign Item valide
- recevoir le contenu source ou localise associe
- reutiliser eventuellement des image assets prepares par l'Image Agent
- choisir le type de video adapte
- choisir le bon format video selon la plateforme
- preparer un script video exploitable
- preparer un storyboard clair scene par scene
- preparer les indications de voix
- preparer les sous-titres
- lister les assets necessaires
- transmettre un package coherent au futur provider video ou outil de montage

## Entrees

- Campaign Item valide
- contenu source ou contenu localise
- langue cible
- plateforme cible
- image assets disponibles si necessaire
- contraintes de marque
- contraintes de format
- angle narratif et CTA attendu

## Sorties

- recommandation de format
- script video structure
- storyboard
- indications de voix
- sous-titres prepares
- liste d'assets
- brief de generation pour un futur Video Provider
- job video pret pour execution

## Ce qu'il ne fait pas

- il ne choisit pas la campagne
- il ne traduit pas lui-meme
- il ne monte pas lui-meme les videos
- il ne depend pas d'un outil unique
- il ne publie pas directement
- il ne remplace pas le Publisher Agent
- il ne remplace pas la validation humaine

## Regles

- la video doit rester alignee sur le Campaign Item
- la langue et les sous-titres doivent rester explicites
- les contraintes de plateforme doivent etre explicites
- les assets images et visuels doivent rester tracables
- la coherence de marque reste obligatoire
