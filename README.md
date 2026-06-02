# Plan de révision · Session juin 2026

Site statique interactif pour suivre la progression de révision sur 4 examens (Algèbre, Thermodynamique, Analyse II, Métrologie).

## Structure des fichiers

```
.
├── index.html        → coquille HTML (structure, aide-mémoire, dialog paramètres)
├── style.css         → tous les styles (light/dark mode, responsive)
├── app.js            → logique applicative + sync GitHub API
├── data.js           → données du plan (jours, tâches, examens)
├── progress.json     → état de progression (mis à jour par l'app)
├── .nojekyll         → désactive Jekyll sur GitHub Pages
└── README.md
```

---

## Déploiement sur GitHub Pages

### 1 — Créer le dépôt

```bash
# Crée un nouveau dépôt public sur github.com, puis :
git clone https://github.com/<ton-username>/<nom-du-depot>.git
cd <nom-du-depot>
# Copie tous les fichiers ici
git add .
git commit -m "Initial commit"
git push origin main
```

### 2 — Activer GitHub Pages

Dans le dépôt sur github.com :

1. **Settings** → **Pages**
2. Source : `Deploy from a branch`
3. Branch : `main` / `/ (root)`
4. Cliquer **Save**

Le site sera disponible à `https://<ton-username>.github.io/<nom-du-depot>/` en quelques minutes.

---

## Synchronisation de la progression entre appareils

Par défaut la progression est sauvegardée dans le `localStorage` du navigateur (donc propre à chaque appareil).

Pour qu'elle se synchronise entre ton ordinateur et ton téléphone :

### 3 — Créer un Personal Access Token GitHub

1. Aller sur <https://github.com/settings/tokens?type=beta> (fine-grained PAT)
2. **Generate new token**
3. **Repository access** : seulement ce dépôt
4. **Permissions** → Contents : `Read and write`
5. Copier le token (commence par `github_pat_...`)

### 4 — Configurer dans l'app

1. Ouvrir le site sur l'un de tes appareils
2. Cliquer l'icône ⚙ en haut à droite
3. Entrer ton token, ton nom d'utilisateur, le nom du dépôt
4. Cliquer **Tester la connexion** puis **Enregistrer**

L'app lit `progress.json` depuis le dépôt au chargement, et y écrit automatiquement (avec un délai de 2,5 s) à chaque case cochée.

**Répéter l'étape 4 sur chaque appareil** (le token est stocké dans le localStorage local — il ne transite pas dans le dépôt).

### Fonctionnement technique

```
Cocher une tâche
  → localStorage mis à jour immédiatement
  → après 2,5 s d'inactivité : PUT /repos/{owner}/{repo}/contents/progress.json
    (commit automatique sur la branche main)

Charger la page
  → GET /repos/{owner}/{repo}/contents/progress.json
  → si succès : utilise l'état du dépôt (sync inter-appareils)
  → si échec / pas configuré : utilise le localStorage
```

Le point coloré en haut à droite indique l'état :

| Couleur | Signification |
|---------|---------------|
| 🟢 vert | Synchronisé avec GitHub |
| 🟠 orange (clignotant) | Sauvegarde en cours |
| 🔴 rouge | Erreur de sync (vérifie le token) |
| ⚫ gris | Sauvegarde locale uniquement |

---

## Modifier le plan

Tout le contenu est dans **`data.js`** — chaque objet de `PLAN` est un jour ou un séparateur de phase. Tu peux ajouter, supprimer ou modifier des tâches librement. Recharge la page après modification.

```js
{ id: 'd01', wd: 'mar', d: '2 juin', h: '~8 h',
  title: 'Titre du jour',
  sub: 'Sous-titre optionnel',
  blocks: [
    { when: 'Matin', tasks: [
      { tag: 'alg', label: 'Description de la tâche' },
    ]},
  ]
},
```

Tags disponibles : `alg` · `thermo` · `analyse` · `metro` · `rest`
