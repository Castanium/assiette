# Assiette

Une petite web app pour **équilibrer son assiette** du midi et du soir à partir de portions de référence.

Tu as envie de gyozas ? Saisis leurs valeurs nutritionnelles (ou scanne le code-barres) : Assiette te dit **combien de grammes** tu peux en manger à ce repas, et **avec quoi compléter**, en grammes (protéines, féculents, matières grasses, légumes).

- Tout fonctionne hors ligne, dans le navigateur. Pas de compte, pas de cookie, pas de mesure d’audience.
- Tes réglages restent dans ton navigateur (localStorage). Tu peux les exporter et les importer en JSON depuis les Réglages.
- Seul le scan contacte Open Food Facts, et il n’envoie que le code-barres.

> Assiette applique des portions de référence et ne remplace pas un suivi professionnel.

## Régler ses portions

Ouvre **Réglages** (bouton en haut à droite de l’écran d’accueil) :

- **Portions de référence** : ce qu’apporte chaque portion, en glucides, protéines et lipides (protéines, féculents, matières grasses du déjeuner et du dîner, fromage et pain). Les légumes (200 g) sont toujours ajoutés en plus.
- **Tolérance** : marge appliquée au calcul de la quantité du plat (10 % par défaut).
- **Compléments préférés** : l’aliment proposé par défaut dans chaque catégorie, et les valeurs de la base de compléments.
- **Mon profil** (facultatif) : une estimation de budgets à partir de ton profil, à comparer avec les portions de référence. Rien ne change tant que tu ne le choisis pas.

Les valeurs par défaut se trouvent dans `src/config/reference.ts`.

## Lancer en local

Il faut Node.js 20 ou plus récent.

```sh
npm install
npm run dev        # serveur de développement
npm test           # tests du moteur de calcul
npm run build      # produit dist/index.html, un seul fichier autonome
npm run check      # vérification d'anonymat (lancée aussi avant chaque push et en CI)
npm run icons      # régénère favicon et icônes à partir de src/assets/logo.svg
```

Le scan par caméra nécessite HTTPS (ou `localhost`).

## Ajouter à l’écran d’accueil de l’iPhone

1. Ouvre l’adresse de l’app dans **Safari**.
2. Touche le bouton **Partager** (le carré avec une flèche vers le haut).
3. Choisis **Sur l’écran d’accueil**, puis **Ajouter**.

L’app s’ouvre alors en plein écran, comme une application.

## Déploiement

Chaque push sur `main` lance les tests, la vérification d’anonymat et le build, puis publie `dist/` sur GitHub Pages (`.github/workflows/pages.yml`).

Valeurs des compléments d’après la table Ciqual de l’ANSES. Polices Shrikhand et Nunito (licence OFL) embarquées dans le build.
