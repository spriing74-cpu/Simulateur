# Paie SNCF

Application locale d'estimation de paie SNCF avec saisie planning, extras, detail de calcul et configuration.

## Lancer en local

Ouvrir `index.html` directement dans le navigateur ou servir le dossier avec un petit serveur local.

## Notes calcul

- Les EVS sont prises en compte en M+1 : la paie du mois affiche les elements variables saisis sur le mois precedent.
- Les documents de paie source restent locaux et ne sont pas versionnes par defaut.
- Le fichier `documents/comparaison-taux.md` resume les ecarts controles entre l'ODS et les documents RH/GRH disponibles.
