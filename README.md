# Assiette

Une petite web app pour **équilibrer son assiette**, à partir de besoins calculés sur son profil.

Tu as envie de gyozas ? Saisis leurs valeurs nutritionnelles : Assiette te dit **combien de grammes** tu peux en manger, et **avec quoi compléter**, en grammes (protéine, féculent, matière grasse, légumes).

- Tout fonctionne dans le navigateur, **sans aucune connexion** : pas de compte, pas de cookie, pas de mesure d’audience, aucune requête réseau.
- Ton profil et tes réglages restent dans ton navigateur (localStorage). Tu peux les exporter et les importer en JSON depuis les Réglages.

> Estimation indicative, qui ne remplace pas un avis médical ou diététique.

## Comment les calculs fonctionnent

Au premier lancement, l’app demande ton profil : sexe, âge, taille, poids actuel, poids visé et niveau d’activité. Un poids visé sous un IMC de 18,5 est refusé.

**Besoins du jour**
1. **Dépense** : métabolisme de base par l’équation de Mifflin-St Jeor, multiplié par le coefficient d’activité (1,2 / 1,375 / 1,55 / 1,725).
2. **Déficit** réglable de 0 à 25 % (15 % par défaut), plafonné à 750 kcal par jour, sans jamais descendre sous le métabolisme de base. Si le poids visé est atteint, on calcule un maintien.
3. **Protéines d’abord** : 1,2, 1,8 (par défaut) ou 2,2 g par kg de poids visé. Les méta-analyses sur l’apport protéique et la position de l’International Society of Sports Nutrition situent l’apport utile entre 1,6 et 2,2 g/kg, plus haut en déficit.
4. **Lipides** : le plus grand de 0,8 g/kg de poids visé et 25 % des calories.
5. **Glucides** : le reste. Sous 100 g par jour, l’app conseille de réduire le déficit.

**Répartition** : deux repas principaux identiques se partagent 70, 75 (par défaut) ou 80 % de la journée ; le reste va aux collations, montrées à titre indicatif. Chaque repas principal reçoit au moins 0,4 g/kg de protéines, repère issu de la littérature sur la répartition des protéines par repas.

**Assiette**
- Les **légumes** non féculents (300 g par repas, au-dessus du minimum de 400 g de fruits et légumes par jour recommandé par l’OMS) sont retirés du budget en premier.
- La quantité du plat est limitée par les glucides et les lipides (tolérance de 10 %, réglable). Les protéines ne sont pas une limite.
- Les compléments viennent ensuite, dans l’ordre : protéine, féculent, matière grasse, en grammes arrondis à 5 g.
- Le rythme de perte estimé vaut déficit × 7 / 7 700 kg par semaine.

Valeurs des aliments d’après la table Ciqual de l’ANSES. Constantes de calcul et base d’aliments : `src/config/reference.ts`.

## Lancer en local

Il faut Node.js 20 ou plus récent.

```sh
npm install
npm run dev        # serveur de développement
npm test           # tests des moteurs de calcul
npm run build      # produit dist/index.html, un seul fichier autonome
npm run check      # vérification d'anonymat (lancée aussi avant chaque push et en CI)
npm run icons      # régénère favicon et icônes à partir de src/assets/logo.svg
```

## Ajouter à l’écran d’accueil de l’iPhone

1. Ouvre l’adresse de l’app dans **Safari**.
2. Touche le bouton **Partager** (le carré avec une flèche vers le haut).
3. Choisis **Sur l’écran d’accueil**, puis **Ajouter**.

L’app s’ouvre alors en plein écran, comme une application.

## Déploiement

Chaque push sur `main` lance les tests, la vérification d’anonymat et le build, puis publie `dist/` sur GitHub Pages (`.github/workflows/pages.yml`).

Polices Shrikhand et Nunito (licence OFL) embarquées dans le build.
