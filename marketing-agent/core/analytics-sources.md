# Analytics Sources

## Role

Ce document recense les futures sources de donnees du Analytics Engine.

Il ne connecte encore aucune API.

Il prepare uniquement la cartographie des integrations a venir.

## Future Sources

### Google Analytics

Source web et conversion pour trafic, sessions, objectifs et revenus.

### Google Search Console

Source SEO pour impressions de recherche, clics organiques et positions.

### Meta Insights

Source social pour Facebook et Instagram.

### LinkedIn Analytics

Source social et B2B pour LinkedIn.

### X Analytics

Source social pour X.

### YouTube Analytics

Source video pour YouTube.

### TikTok Analytics

Source video et social pour TikTok.

### Stripe

Source business pour revenus, conversions et paiements.

### PostHog

Source produit et parcours utilisateur pour evenements, funnels et retention.

### Vercel Analytics

Source technique et web pour trafic, performances et disponibilite.

## Principles

- chaque source doit rester isolable
- chaque source doit pouvoir etre remplacee
- la normalisation doit rester distincte de la collecte
- aucune source ne doit imposer son schema brut au reste du systeme
