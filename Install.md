# Installation / Deploiement

Ce document decrit le deploiement de l'app avec authentification multi-utilisateurs (D1 + JWT).

## 1) Prerequis

- Node.js installe
- `wrangler` utilisable via `npx`
- Acces au compte Cloudflare cible

## 2) Frontend (build local)

Depuis la racine du projet:

```bash
cd /Users/flornet/Sites/team.weloveusers.com
npm install
npm run build
```

## 3) Worker: creation de la base D1

```bash
cd /Users/flornet/Sites/team.weloveusers.com/worker-cloudflare
npx wrangler d1 create outils-wlu-auth
```

Recuperer le `database_id` retourne et le renseigner dans:

- `/Users/flornet/Sites/team.weloveusers.com/worker-cloudflare/wrangler.jsonc`
- cle: `d1_databases[0].database_id`

## 4) Configuration `wrangler.jsonc`

Verifier/renseigner les variables:

- `NOTION_PROJECTS_DB_ID`
- `NOTION_RESPONSES_DB_ID`
- `NOTION_TEMPLATES_DB_ID` (actuel: `3099264124f2804196a1c478912dd393`)
- `JWT_TTL_SECONDS` (ex: `"43200"` pour 12h)
- `BOOTSTRAP_ADMIN_EMAIL` (email du premier admin)
- `BOOTSTRAP_ADMIN_NAME` (nom du premier admin)
- `BOOTSTRAP_ADMIN_EXPIRES_AT` (date future, ex: `2027-12-31`)

## 5) Secrets Cloudflare

```bash
cd /Users/flornet/Sites/team.weloveusers.com/worker-cloudflare
npx wrangler secret put NOTION_API_KEY
npx wrangler secret put JWT_SECRET
npx wrangler secret put BOOTSTRAP_ADMIN_PASSWORD
```

Exemple generation `JWT_SECRET`:

```bash
openssl rand -hex 64
```

## 6) Migration D1

```bash
cd /Users/flornet/Sites/team.weloveusers.com/worker-cloudflare
npx wrangler d1 migrations apply DB --remote
```

## 7) Deploiement Worker

```bash
cd /Users/flornet/Sites/team.weloveusers.com/worker-cloudflare
npx wrangler deploy
```

## 8) Premier login admin (automatique)

Le premier utilisateur `admin` est cree automatiquement au login si:

1. la table `users` est vide
2. `BOOTSTRAP_ADMIN_EMAIL` est defini
3. `BOOTSTRAP_ADMIN_PASSWORD` est defini
4. `BOOTSTRAP_ADMIN_EXPIRES_AT` est valide et dans le futur

Connecte-toi ensuite avec cet email + mot de passe.

## 9) Nettoyage recommande apres 1er login

Supprimer le secret bootstrap:

```bash
cd /Users/flornet/Sites/team.weloveusers.com/worker-cloudflare
npx wrangler secret delete BOOTSTRAP_ADMIN_PASSWORD
```
