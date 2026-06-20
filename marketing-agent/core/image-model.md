# Image Model

## Role

Le modele image decrit les objets metier necessaires au futur Image Agent.

Il ne declenche aucune generation.

Il prepare uniquement la structure logique des demandes, variantes, prompts et
sorties images.

## Image Job

### Definition

Une demande image rattachee a un Campaign Item, une locale et une plateforme.

### Attributs minimaux

- id
- campaign item parent
- locale cible
- plateforme cible
- type d'image
- format demande
- statut
- date

## Image Variant

### Definition

Une variante d'execution d'un meme Image Job.

### Attributs minimaux

- id
- image job parent
- variante de cadrage
- variante de texte
- variante de couleur
- statut

## Image Prompt

### Definition

Le brief structure transmis au futur provider d'images.

### Attributs minimaux

- id
- image job parent
- objectif visuel
- scene
- message
- overlay eventuel
- contraintes de marque
- contraintes de plateforme
- langue

## Image Output

### Definition

La sortie attendue ou recue d'un provider d'images.

### Attributs minimaux

- id
- image job parent
- format final
- fichier ou reference
- statut QA
- date

## Relations

### Campaign Item

Chaque Image Job doit remonter a un Campaign Item valide.

### Locale

Une image peut exister par locale si un texte ou un contexte culturel varie.

### Plateforme

Le format et le cadrage dependent de la plateforme cible.

## Regles

- un Image Job peut produire plusieurs variantes
- chaque variante doit remonter a un job parent
- chaque output doit remonter a un prompt et a un item source
- les overlays et contraintes de langue doivent rester tracables
