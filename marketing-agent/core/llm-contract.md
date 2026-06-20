# LLM Contract

## Role

Ce document definit le contrat unique que tous les futurs fournisseurs de
langage devront respecter dans Norixo AI.

## Input

Chaque requete transmise a l'adapter doit contenir :

- role
- contexte
- brief
- contraintes
- format attendu

## Input Expectations

### role

Definit la fonction demandee au modele.

Exemples :

- content-drafter
- translation-assistant
- social-copywriter
- title-optimizer

### contexte

Resume la situation utile au modele :

- type de scenario
- objectif marketing
- audience
- source documentaire disponible

### brief

Contient la matiere principale a traiter :

- editorial brief
- notes de scenario
- master content
- instructions produit

### contraintes

Cadre ce que le fournisseur doit respecter :

- ton
- limites factuelles
- interdictions
- reseaux cibles
- longueur attendue

### format attendu

Indique la forme de sortie voulue :

- markdown
- texte brut
- JSON structure
- sections nommees

## Output

Chaque fournisseur doit renvoyer une reponse normalisee contenant :

- texte
- metadonnees
- score de confiance
- erreurs eventuelles

## Output Expectations

### texte

Le contenu principal retourne par le fournisseur.

### metadonnees

Informations utiles de tracabilite :

- provider
- modele
- version
- timestamp logique
- type de tache

### score de confiance

Indicateur simple fourni par le systeme ou par le provider pour aider la revue
humaine.

### erreurs eventuelles

Liste vide si tout se passe bien, ou messages structures si le provider ne peut
pas repondre correctement.

## Contract Rule

Tous les futurs fournisseurs devront respecter exactement ce contrat, afin que
les agents Norixo AI puissent changer de moteur sans changer leur logique.

## Runtime Alignment

Ce contrat documentaire est maintenant prolonge par une fondation runtime :

- `runtime-request.md`
- `runtime-response.md`
- `runtime-contract.md`

Ces trois documents definissent la traduction executable de ce contrat pour les
futurs providers et pour le LLM Adapter.
