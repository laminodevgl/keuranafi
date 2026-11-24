# Configuration Supabase

1. Dans **Storage → New bucket**, créez le bucket `accommodation-photos` en mode **Public**, avec une limite de **10 MB** et les types `image/jpeg`, `image/png`, `image/webp` et `image/gif`. Créez également les buckets `reservation-receipts` et `restaurant-order-receipts` en mode **Private**, avec une limite de **10 MB** et les types `image/jpeg`, `image/png` et `image/webp`. Les buckets doivent être créés via le tableau de bord ou l’API Storage, pas par une insertion SQL dans les tables internes `storage`.
2. Ouvrez **SQL Editor**, collez le contenu à jour de `setup.sql`, puis exécutez-le. Si le site affiche `Could not find the table 'public.accommodations' in the schema cache`, exécutez ce script sur le même projet Supabase que celui configuré dans l’application. Le script peut être relancé après une version précédente : il crée ou met à jour les tables, champs, contraintes, fonctions et règles d’accès nécessaires, puis demande à l’API Supabase d’actualiser son cache de schéma. Les tables et demandes existantes ne sont pas supprimées. Les comptes déjà présents dans `admin_users` deviennent des administrateurs suprêmes lors de l’ajout de la colonne de rôle.
3. Désactivez les inscriptions publiques dans **Authentication → Settings**. Créez le premier compte de l’administrateur suprême dans **Authentication → Users**, avec son adresse e-mail et un mot de passe solide.
4. Ajoutez ce premier administrateur suprême à la liste des accès en exécutant la requête suivante, en remplaçant l’adresse e-mail :

   ```sql
   insert into public.admin_users (user_id, role)
   select id, 'super_admin'
   from auth.users
   where lower(email) = lower('admin@example.com')
   on conflict (user_id) do nothing;
   ```

5. Déployez la fonction sécurisée de gestion des comptes avec Supabase CLI :

   ```sh
   supabase link --project-ref VOTRE_ID_DE_PROJET
   supabase functions deploy manage-admin-user
   ```

   La fonction utilise `SUPABASE_SERVICE_ROLE_KEY` uniquement côté serveur pour créer et modifier les comptes, ou les suspendre et les réactiver. Ne placez jamais la clé `service_role` dans les variables `VITE_*` ni dans le code du navigateur.
6. Configurez `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` dans `.env.local` (local) et dans les variables de l’hébergeur (déploiement).
7. Lancez `npm run dev`, ouvrez `/admin`, puis connectez-vous avec le premier compte suprême. Depuis **Gestion des administrateurs**, les administrateurs suprêmes peuvent créer des employés et d’autres administrateurs suprêmes, modifier leur adresse e-mail, leur rôle et, si nécessaire, leur mot de passe, ou suspendre/réactiver leur compte. Les comptes créés sont activés immédiatement : transmettez les identifiants à leur titulaire de façon sécurisée. Les employés peuvent consulter les pages d’administration, mais seuls les administrateurs suprêmes actifs peuvent gérer les comptes. Un compte suspendu ne peut plus se connecter ni accéder aux données protégées. Le dernier administrateur suprême actif et le compte utilisé ne peuvent pas être suspendus.

Après toute modification de `setup.sql` ou de la fonction `manage-admin-user`, exécutez de nouveau le SQL à jour dans Supabase et redéployez la fonction avant d’utiliser les changements dans le site.

Les chambres sont enregistrées dans `accommodations`. Chaque chambre possède une capacité totale (`capacity`) et un nombre maximal d’enfants (`max_children`), configurés depuis la gestion des chambres. Le formulaire de réservation limite les compteurs d’adultes et d’enfants à ces capacités, et Supabase vérifie aussi la limite lors de l’enregistrement. Après ajout de `max_children`, exécutez le `setup.sql` à jour dans Supabase pour appliquer la migration. Seules les chambres marquées comme publiées et ayant un tarif renseigné peuvent être réservées. L’arrivée est possible à partir de 14 h 00, à l’heure estimée par le client ; le formulaire empêche de sélectionner une heure antérieure. Pour demander une arrivée avant 14 h, le client doit appeler l’établissement et obtenir son accord. Le départ normal doit avoir lieu avant 12 h 00 le jour suivant la dernière nuit réservée. Les séjours sont facturés à la nuitée. Le prix par nuit est lu depuis la base de données et le total est calculé automatiquement. La base rejette aussi toute demande dont l’heure d’arrivée estimée est antérieure à 14 h ; une arrivée anticipée ou un départ tardif exige l’accord de l’administrateur.

Dans le calendrier, le client choisit la première nuit puis la dernière nuit occupée ; le départ est automatiquement fixé au lendemain avant 12 h. Par exemple, sélectionner les nuits du 29 au 31 donne un départ le 1er avant midi, et le 1er n’est pas bloqué. Une vérification transactionnelle en base, sérialisée par chambre, protège aussi les demandes et les confirmations contre les chevauchements simultanés. Les demandes `pending` bloquent temporairement la chambre pendant 30 minutes après leur enregistrement ; ensuite, elles cessent de bloquer sans être supprimées. Les statuts `confirmed` et `in_progress` bloquent la chambre sans limite de temps. Les statuts `completed`, `rejected` et `cancelled` la libèrent. Le passage à `confirmed` ou `in_progress` est refusé si une autre demande active ou une période d’indisponibilité chevauche le séjour.

Le calendrier de l’espace administrateur propose les vues jour, semaine et mois, une ligne par chambre, des filtres par chambre/type et statut, ainsi que les détails accessibles au clic. La page **Arrivées et départs** sépare les séjours du jour et du lendemain, affiche les horaires, le téléphone et les voyageurs, signale les horaires dépassés ou les départs tardifs autorisés et permet de passer rapidement une arrivée confirmée à **Occupée** puis un départ à **Terminée**. La migration ajoute les tables de réservations et d’indisponibilités à la publication Realtime Supabase lorsqu’elle est disponible afin d’actualiser le calendrier après les changements. Si la connexion Realtime est indisponible, le bouton **Actualiser** recharge les données. Le calendrier précise qu’une chambre sans blocage n’est pas nécessairement prête : les équipes doivent vérifier le nettoyage et la maintenance avant l’accueil.

Les chambres bloquées pour maintenance ou nettoyage sont visibles et gérées depuis **Administration → Hébergement → Nettoyage**. La base refuse les plages qui chevauchent une demande encore active, une réservation confirmée/en cours ou une autre plage bloquée. L’administration peut également définir une heure d’arrivée anticipée ou un départ tardif pour une réservation ; ces horaires sont soumis au même contrôle de disponibilité.

Le formulaire de réservation demande le prénom, le nom, le téléphone, les dates, l’heure d’arrivée, le nombre d’adultes et d’enfants ainsi que la chambre choisie. Le dépôt d’un reçu de paiement dans les demandes de réservation est désactivé jusqu’à nouvel ordre. Le nombre de voyageurs est limité à la capacité de la chambre. Après l’envoi, les coordonnées configurées dans **Administration → Hébergement → Gestion des paiements** (Wave, Orange Money ou Free Money) sont affichées au client. La base conserve la colonne `receipt_path` pour les anciennes demandes ; l’accès admin aux reçus de réservation est masqué.

Le formulaire de commande du restaurant exige également un reçu de paiement (JPG, PNG ou WEBP, 10 Mo maximum). Les reçus sont enregistrés dans le bucket privé `restaurant-order-receipts` et accessibles uniquement aux administrateurs depuis les commandes. Après l’ajout de cette fonction, exécutez le `setup.sql` à jour dans Supabase et créez le bucket privé comme indiqué ci-dessus.
