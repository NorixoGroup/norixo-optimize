# Campaign Items

## Role

Le Campaign Item est l'unite centrale du futur Campaign Engine.

Il represente une action editoriale precise a executer dans une campagne.

## Objectif

Decouper une campagne en blocs clairs, ordonnes et pilotables sans melanger
strategie globale et execution detaillee.

## Attributs minimaux

- id
- campaign id parent
- objectif
- angle
- audience
- format
- plateforme
- priorite
- date prevue
- dependances
- statut
- langue source
- liens vers contenus generes

## Informations utiles

- CTA attendu
- type d'item
- reseaux cibles secondaires
- besoin de localisation
- besoin visuel
- besoin video
- validation requise

## Types d'items utiles

- annonce
- tutoriel
- astuce
- comparaison
- FAQ
- etude de cas
- rappel CTA
- teasing
- recyclage

## Statuts possibles

- idee
- retenu
- brief pret
- contenu en cours
- contenu genere
- localise
- assets prets
- a valider
- planifie
- publie
- reporte
- abandonne

## Dependances possibles

- item precedent a publier avant
- contenu source obligatoire
- traduction obligatoire
- asset image obligatoire
- video obligatoire
- validation humaine obligatoire

## Liens attendus

Chaque item doit pouvoir pointer vers :

- le master content associe
- les variantes reseaux
- les localisations
- les assets image
- les assets video
- les publications prevues
- les performances observees

## Regles

- un item ne remplace pas une campagne
- un item ne doit pas devenir un second content source autonome
- un item doit pouvoir etre traite seul si necessaire
- un item doit rester compatible avec le calendrier, la QA et la memoire
