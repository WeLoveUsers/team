# Worker Cloudflare (Auth D1 + JWT)

## 1) Créer la base D1

```bash
cd worker-cloudflare
npx wrangler d1 create outils-wlu-auth
```

Copie le `database_id` retourné et remplace la valeur `database_id` dans `wrangler.jsonc`.

## 2) Variables `wrangler.jsonc`

Dans `worker-cloudflare/wrangler.jsonc`:

- `NOTION_PROJECTS_DB_ID`
- `NOTION_RESPONSES_DB_ID`
- `NOTION_TEMPLATES_DB_ID` (actuel: `3099264124f2804196a1c478912dd393`)
- `JWT_TTL_SECONDS` (ex: `"43200"` pour 12h)
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_NAME`
- `BOOTSTRAP_ADMIN_EXPIRES_AT` (ex: `2027-12-31`)
- binding D1 `DB`

## 3) Secrets Cloudflare

```bash
npx wrangler secret put NOTION_API_KEY
npx wrangler secret put JWT_SECRET
npx wrangler secret put BOOTSTRAP_ADMIN_PASSWORD
```

## 4) Appliquer la migration D1

```bash
npx wrangler d1 migrations apply DB --remote
```

La migration crée la table `users` avec:

- `role`: `admin` | `team`
- `status`: `active` | `suspended`
- `expires_at`: date d'expiration du compte

## 5) Déployer

```bash
npx wrangler deploy
```

## 6) Premier compte admin (bootstrap automatique)

Le worker crée automatiquement le premier utilisateur `admin` si:

1. la table `users` est vide,
2. `BOOTSTRAP_ADMIN_EMAIL` est défini,
3. `BOOTSTRAP_ADMIN_PASSWORD` (secret) est défini,
4. `BOOTSTRAP_ADMIN_EXPIRES_AT` est valide et dans le futur.

Ensuite connecte-toi avec cet email/mot de passe dans l'app.

## Recommandation après 1er login

Pour éviter toute création involontaire ultérieure, retire le secret bootstrap:

```bash
npx wrangler secret delete BOOTSTRAP_ADMIN_PASSWORD
```
