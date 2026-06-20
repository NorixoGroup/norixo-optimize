# Simulation Mode

## Objectif

Le mode Simulation permet a Norixo AI de fonctionner comme s'il etait en
production, sans aucun effet reel de diffusion.

La logique, les decisions et les sorties sont produites normalement, mais rien
n'est publie.

## Ce que le mode Simulation doit faire

- executer tout le pipeline
- choisir les sujets
- produire les contenus
- produire les prompts image
- produire les scripts video
- preparer le calendrier
- remplir la memoire
- mettre a jour les analytics simules si necessaire

## Ce qu'il ne doit jamais faire

- publier
- envoyer un email
- appeler une API sociale
- modifier des donnees de production

## Usage

Le mode Simulation sert a :

- tester la qualite des decisions du Marketing Brain
- verifier la coherence des contenus generes
- valider les formats et les CTA
- simuler une journee editoriale complete
- accumuler une memoire exploitable avant automatisation reelle

## Benefice principal

Verifier l'ensemble du systeme sans risque de publication prematuree.

