# Déployer le site

Les images de la galerie et leur sélection sont enregistrées dans Supabase, pas dans le dossier du site. Pour retrouver les mêmes images après déploiement, Netlify ou Vercel doit utiliser le même projet Supabase que le site local.

## Netlify

1. Importez le dépôt dans Netlify. Le fichier `netlify.toml` configure déjà la commande `npm run build`, le dossier publié `dist` et les routes de l’application.
2. Dans **Site configuration → Environment variables**, ajoutez :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Récupérez ces deux valeurs dans les paramètres du projet Supabase utilisé par le site local. Ne mettez jamais une clé `service_role` dans une variable `VITE_*`.
4. Relancez un déploiement après avoir ajouté ou modifié ces variables.

## Vercel

1. Importez le dépôt dans Vercel. Le fichier `vercel.json` configure Vite, la commande `npm run build`, le dossier `dist` et les routes de l’application.
2. Dans **Project Settings → Environment Variables**, ajoutez les mêmes variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`, au minimum pour **Production** (et aussi **Preview** si nécessaire).
3. Utilisez les valeurs du même projet Supabase que le site local. Ne mettez jamais une clé `service_role` dans une variable `VITE_*`.
4. Relancez un déploiement après avoir ajouté ou modifié ces variables.

## Déploiement manuel

Construisez d’abord le site avec `npm run build`, après avoir configuré les deux variables dans `.env.local`. Publiez uniquement le contenu du dossier `dist` sur l’hébergeur. N’envoyez pas le dossier source en supposant qu’il sera compilé automatiquement.

Si l’ancien contenu apparaît encore, vérifiez que l’URL Supabase du déploiement correspond au projet où les photos ont été téléversées, puis lancez un nouveau build et déploiement. Chaque photo utilise une URL publique du stockage Supabase ; les images ne sont pas copiées dans `dist`.
