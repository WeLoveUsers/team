# Plan de refonte UX-Tools Notion

## Vue d'ensemble
Refonte complète de l'UI avec Tailwind CSS v4, ajout de toutes les fonctionnalités manquantes du RoR, et statistiques pour les 6 types de questionnaires.

---

## Phase 1 : Infrastructure (Tailwind + Chart.js + restructuration)

### 1.1 Installer Tailwind CSS v4
- `npm install tailwindcss @tailwindcss/vite`
- Configurer vite.config.ts avec le plugin Tailwind
- Remplacer index.css par `@import "tailwindcss";`
- Supprimer App.css et PublicQuestionnaire.css

### 1.2 Installer Chart.js
- `npm install chart.js react-chartjs-2`

### 1.3 Créer la structure de fichiers
```
src/
├── main.tsx
├── index.css                    (Tailwind + custom base styles)
├── api.ts                       (garder, enrichir avec nouveaux endpoints)
├── questionnaires.ts            (garder tel quel)
├── lib/
│   └── stats.ts                 (module stats porté du RoR)
├── components/
│   ├── Layout.tsx               (shell: sidebar + main)
│   ├── Sidebar.tsx              (liste projets + bouton nouveau)
│   ├── ProjectForm.tsx          (créer/modifier projet)
│   ├── ProjectDetail.tsx        (affichage projet + stats + réponses)
│   ├── ResponsesTable.tsx       (tableau des réponses avec actions)
│   ├── DeleteConfirmModal.tsx   (modal de confirmation suppression)
│   ├── stats/
│   │   ├── SusStats.tsx
│   │   ├── DeepStats.tsx
│   │   ├── UmuxStats.tsx
│   │   ├── UmuxLiteStats.tsx
│   │   ├── AttrakDiffStats.tsx
│   │   └── StatsCard.tsx        (composant réutilisable carte stat)
│   └── charts/
│       ├── SusGauge.tsx         (jauge score SUS)
│       ├── DeepBarChart.tsx     (barres 6 dimensions)
│       ├── AttrakDiffPortfolio.tsx (scatter QP vs QH)
│       ├── AttrakDiffWordPairs.tsx (barres horizontales paires de mots)
│       └── UmuxBarChart.tsx     (barres score global + sous-scores)
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx        (layout + gestion état projets)
│   └── PublicQuestionnairePage.tsx (refonte de l'existant)
```

---

## Phase 2 : Module statistiques (src/lib/stats.ts)

Porter fidèlement le module Stats du RoR (`app/models/stats.rb`) :

### Fonctions helper
- `computeStatsSummary(values: number[], n: number)` → { mean, sd, ci90, ci95, ci99 }
- `tDistributionPValue(alpha, df)` — approximation t de Student
- `zPValue(alpha)` — approximation distribution normale
- `confidenceInterval(mean, sd, n, population, x)` → [lower, upper]

### SUS
- `computeSusScore(answers)` → score individuel (0-100)
- `computeSusStats(responses)` → { n, mean, sd, grade, ci95 }
- `susGrade(score)` → 'A+' à 'F'

### DEEP
- `computeDeepStats(responses)` → { G1..G6: { mean, sd, ci95 } }
- Groupes : G1(Q1-Q4), G2(Q5-Q7), G3(Q8-Q10), G4(Q11-Q13), G5(Q14-Q16), G6(Q17-Q19)
- Exclure les valeurs 0 ("non applicable")

### UMUX
- `computeUmuxScore(answers)` → score individuel = 100*(Q1+Q2+Q3+Q4)/24
- `computeUmuxStats(responses)` → { n, mean, sd, ci95 }

### UMUX-Lite
- `computeUmuxLiteScore(answers)` → score = 100*(Q1+Q3)/12
- `computeUmuxLiteStats(responses)` → { global, usability (Q3), usefulness (Q1) }

### AttrakDiff (+ abrégé)
- `computeAttrakDiffStats(responses, abridged)` → { QP, QHS, QHI, ATT, QH: { mean, sd, ci95 } }
- `computeWordPairAverages(responses, abridged)` → { QP1..ATT7: mean }
- Items complet : QP(1-7), QHS(1-7), QHI(1-7), ATT(1-7)
- Items abrégé : QP(2,3,5,6), QHS(2,5), QHI(3,4), ATT(2,5)

---

## Phase 3 : UI Admin — Pages et composants

### 3.1 LoginPage
- Centré verticalement, carte blanche sur fond gris clair
- Logo/titre "UX Tools", champs email/mot de passe, bouton "Se connecter"
- Bouton déconnexion dans le header une fois connecté

### 3.2 Layout + Sidebar
- Sidebar fixe à gauche (280px), fond blanc, bordure droite
- Header en haut avec titre "UX Tools" + bouton déconnexion
- Liste des projets dans la sidebar avec :
  - Badge statut (vert=Ouvert, gris=Fermé)
  - Badge type questionnaire (couleur par type)
  - Sélection active = bordure bleue gauche
- Bouton "+ Nouveau projet" en haut de la liste
- Zone principale à droite pour le détail

### 3.3 ProjectForm
- Mode création : formulaire dans la zone principale
- Mode édition : formulaire en haut du détail projet
- Champs : Nom, Type de questionnaire (select), Statut (select)
- Token public auto-généré (non éditable, avec bouton copier l'URL)
- Le type ne peut pas être changé si des réponses existent
- Bouton "Supprimer le projet" (rouge, avec confirmation modale)

### 3.4 ProjectDetail
- En-tête : nom du projet, badges, URL publique copiable
- Section statistiques (composant spécialisé selon le type)
- Section réponses (ResponsesTable)

### 3.5 ResponsesTable
- Tableau professionnel avec :
  - # (numéro répondant)
  - Score individuel
  - Note/Grade (pour SUS)
  - Date et heure
  - Action : Supprimer / Récupérer
- Pied de tableau : N=, Moyenne, σ
- Lignes supprimées barrées avec bouton "Récupérer"

### 3.6 Composants Stats par type
Chaque composant affiche :
- Carte(s) de score principal avec grande valeur
- Écart-type et intervalles de confiance
- Graphique Chart.js approprié
- Détail/formules en accordéon (details/summary)

---

## Phase 4 : Interface répondants (PublicQuestionnairePage)

### 4.1 Vérification statut projet
- Avant d'afficher le questionnaire, vérifier que le projet est ouvert
- Si fermé : message "Ce questionnaire n'est plus disponible"

### 4.2 Refonte visuelle
- Fond gris clair, carte blanche centrée (max-w-2xl)
- Titre du questionnaire + description HTML
- Questions numérotées
- Likert : boutons radio en ligne horizontale (chips sélectionnables)
- Bipolaire : échelle horizontale avec labels gauche/droite, cercles cliquables
- Indicateur de progression (X/Y questions répondues)

### 4.3 Validation
- Toutes les questions doivent être répondues
- Highlight des questions non répondues au submit
- DEEP : option "Non applicable" (valeur 0) en plus de l'échelle 1-5

### 4.4 Page de remerciement
- Après soumission : carte avec check vert, message "Merci pour votre participation"

---

## Phase 5 : API Worker — Nouveaux endpoints

### 5.1 DELETE /projects/:id
- Auth requise
- Archive la page Notion (archived: true)
- Retourne { ok: true }

### 5.2 DELETE /projects/:id/responses/:responseId
- Auth requise
- Archive la page réponse Notion (archived: true)
- Retourne { ok: true }

### 5.3 POST /projects/:id/responses/:responseId/recover
- Auth requise
- Désarchive la page réponse (archived: false)
- Retourne { ok: true }

### 5.4 GET /public/project-status/:token
- Sans auth
- Cherche le projet par token, retourne { status: "Ouvert"|"Fermé" }

### 5.5 Mise à jour CORS
- Ajouter DELETE aux méthodes autorisées

---

## Phase 6 : Export

### 6.1 Export CSV côté client
- Bouton "Exporter CSV" sur la page détail projet
- Génère un CSV avec les réponses brutes (toutes les colonnes Q1..Qn + score + date)
- Téléchargement via blob URL

---

## Ordre d'exécution

1. **Infra** : Tailwind + Chart.js + structure fichiers
2. **Stats** : lib/stats.ts (indépendant de l'UI)
3. **Worker** : nouveaux endpoints API
4. **API client** : enrichir api.ts
5. **Composants UI** : du plus simple au plus complexe
   - LoginPage → Layout/Sidebar → ProjectForm → ProjectDetail → ResponsesTable → Stats → Charts
6. **Interface répondants** : PublicQuestionnairePage refonte
7. **Export CSV**
8. **Nettoyage** : supprimer anciens fichiers CSS, code mort
