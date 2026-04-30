# Comparaison des taux utilises

Source de depart : `CALCUL PAYE.ods`.
Documents controles : `GRH00131_V2_17022026_fil.pdf` et `ENSAO RH00010_V1_18102013_fil.pdf`.

## Changements appliques

- ICH / indemnite contrainte hebergement : l'ODS indiquait 22,10 EUR. Le RH00010 present dans le dossier indique un taux unique de 21,90 EUR pour le groupe 1. L'application utilise donc 21,90 EUR.
- Indemnite contrainte logement : l'ODS indique 12,32 EUR et le RH00010 confirme 12,32 EUR. Pas de changement.
- Les libelles du planning affichent maintenant les taux reels utilises par l'application, au lieu d'anciens montants saisis en dur.
- Les estimations d'heures nuit, milieu nuit et dimanches/feries dans le planning utilisent maintenant les constantes de calcul de l'application.

## Points encore non verifies

Le GRH00131 explique les regles, mais renvoie les montants de plusieurs primes vers des baremes absents du dossier :

- `GRH00372` pour de nombreux taux d'indemnites et allocations.
- `GRH00389` pour la prime de travail.

En attendant ces fichiers, l'application conserve les taux issus de `CALCUL PAYE.ods` pour les primes non confirmees par les documents presents.
