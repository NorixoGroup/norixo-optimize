# Publisher Schedule

## Role

Le schedule publisher decrit la couche de planification rattachee a une
publication preparee.

Il ne publie rien.

Il prepare uniquement la structure de diffusion.

## Champs

### Date

Jour cible de diffusion.

### Heure

Heure cible de diffusion.

### Fuseau

Fuseau horaire applique a la publication.

### Plateforme

Plateforme cible du schedule associe.

### Priorite

Niveau de priorite de diffusion.

Exemples :

- high
- normal
- low

### Statut

Etat du schedule.

Exemples :

- draft
- ready
- scheduled
- paused
- expired

### Retries

Nombre de tentatives autorisees ou deja consommees.

### Expiration

Date ou heure limite a partir de laquelle la publication ne doit plus etre
diffusee.

## Regles

- le fuseau doit toujours etre explicite
- la plateforme doit rester associee au schedule
- la priorite doit rester visible pour l'orchestration
- l'expiration doit proteger les contenus lies a une campagne temporaire
