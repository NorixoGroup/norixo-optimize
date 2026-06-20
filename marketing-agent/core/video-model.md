# Video Model

## Role

Le modele video decrit les objets metier necessaires au futur Video Agent.

Il ne declenche aucune generation.

Il prepare uniquement la structure logique des jobs video, des scripts, des
storyboards, des pistes de voix, des sous-titres et des sorties video.

## Video Job

### Definition

Une demande video rattachee a un Campaign Item, une locale et une plateforme.

### Attributs minimaux

- id
- campaign item parent
- locale cible
- plateforme cible
- type de video
- format demande
- statut
- date

## Video Script

### Definition

Le script structure qui porte le message, le rythme et les intentions de voix.

### Attributs minimaux

- id
- video job parent
- hook
- probleme
- solution
- demonstration
- CTA
- ton
- statut

## Video Scene

### Definition

Une unite de narration ou de montage au sein d'une video.

### Attributs minimaux

- id
- storyboard parent
- ordre
- duree
- visuel
- texte ecran
- voix
- transition
- statut

## Video Storyboard

### Definition

Le plan scene par scene de la video.

### Attributs minimaux

- id
- video job parent
- liste de scenes
- structure de rythme
- besoins assets
- statut

## Voice Track

### Definition

La couche voix attendue pour la narration video.

### Attributs minimaux

- id
- video job parent
- langue
- ton
- style de diction
- vitesse
- statut

## Subtitle Track

### Definition

La couche de sous-titres rattachee a une locale et a une video cible.

### Attributs minimaux

- id
- video job parent
- langue
- texte segmente
- statut

## Video Output

### Definition

La sortie attendue ou recue d'un provider video ou d'un outil de montage.

### Attributs minimaux

- id
- video job parent
- format final
- fichier ou reference
- statut QA
- date

## Relations

### Campaign Item

Chaque Video Job doit remonter a un Campaign Item valide.

### Locale

Une video peut exister par locale si la voix, les sous-titres ou le message
evoluent.

### Platform

Le format, la duree et le montage dependent de la plateforme cible.

### Image Assets

Le storyboard peut reutiliser des images ou variantes visuelles deja preparees.

### Publisher

La sortie video validee devient un asset exploitable par le Publisher.

## Regles

- un Video Job peut produire plusieurs versions par plateforme
- chaque script doit remonter a un job parent
- chaque storyboard doit rester aligne sur le script
- chaque output doit rester tracable jusqu'au Campaign Item source
