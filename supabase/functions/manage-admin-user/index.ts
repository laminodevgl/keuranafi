import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type RequestBody = {
  action?: unknown;
  user_id?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Méthode non autorisée." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, {
      error: "La fonction de gestion des comptes n’est pas correctement configurée.",
    });
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!authorization || !accessToken) {
    return jsonResponse(401, { error: "Connexion administrateur requise." });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user: requestingUser },
    error: authError,
  } = await userClient.auth.getUser(accessToken);
  if (authError || !requestingUser) {
    return jsonResponse(401, { error: "La session administrateur est invalide." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: requesterAccess, error: requesterError } = await adminClient
    .from("admin_users")
    .select("role, is_suspended")
    .eq("user_id", requestingUser.id)
    .maybeSingle();
  if (requesterError) {
    return jsonResponse(500, { error: "Impossible de vérifier les droits de ce compte." });
  }
  if (requesterAccess?.role !== "super_admin" || requesterAccess.is_suspended) {
    return jsonResponse(403, {
      error: "Seuls les administrateurs suprêmes actifs peuvent gérer les comptes.",
    });
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return jsonResponse(400, { error: "Les informations du compte sont invalides." });
  }
  if (
    typeof parsedBody !== "object" ||
    parsedBody === null ||
    Array.isArray(parsedBody)
  ) {
    return jsonResponse(400, { error: "Les informations du compte sont invalides." });
  }
  const body = parsedBody as RequestBody;

  if (body.action === "create") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role;
    if (!isValidEmail(email)) {
      return jsonResponse(400, { error: "Saisissez une adresse e-mail valide." });
    }
    if (password.length < 8 || password.length > 128) {
      return jsonResponse(400, {
        error: "Le mot de passe doit contenir entre 8 et 128 caractères.",
      });
    }
    if (role !== "super_admin" && role !== "employee") {
      return jsonResponse(400, { error: "Choisissez un type de compte valide." });
    }

    const { data: createdUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (createError || !createdUser.user) {
      return jsonResponse(400, {
        error: createError?.message ?? "Le compte n’a pas pu être créé.",
      });
    }

    const { error: accessError } = await userClient.rpc("manage_admin_users", {
      p_action: "add",
      p_user_id: createdUser.user.id,
      p_role: role,
    });
    if (accessError) {
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(
        createdUser.user.id,
      );
      return jsonResponse(500, {
        error: cleanupError
          ? "Le compte a été créé, mais son rôle n’a pas pu être configuré. Contactez un administrateur."
          : "Le rôle n’a pas pu être attribué ; le compte créé a été supprimé. Vérifiez la configuration Supabase.",
      });
    }

    return jsonResponse(201, {
      user_id: createdUser.user.id,
      email: createdUser.user.email,
      role,
      is_suspended: false,
    });
  }

  if (body.action !== "update" && body.action !== "suspend" && body.action !== "reactivate") {
    return jsonResponse(400, { error: "Action de gestion invalide." });
  }

  const targetUserId =
    typeof body.user_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.user_id)
      ? body.user_id
      : "";
  if (!targetUserId) {
    return jsonResponse(400, { error: "Le compte sélectionné est invalide." });
  }

  const { data: targetAccess, error: targetAccessError } = await adminClient
    .from("admin_users")
    .select("role, is_suspended")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (targetAccessError) {
    return jsonResponse(500, { error: "Impossible de lire les informations du compte." });
  }
  if (!targetAccess) {
    return jsonResponse(404, { error: "Ce compte n’existe plus dans la gestion des accès." });
  }

  if (body.action === "update") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role;
    if (!isValidEmail(email)) {
      return jsonResponse(400, { error: "Saisissez une adresse e-mail valide." });
    }
    if (password && (password.length < 8 || password.length > 128)) {
      return jsonResponse(400, {
        error: "Le nouveau mot de passe doit contenir entre 8 et 128 caractères.",
      });
    }
    if (role !== "super_admin" && role !== "employee") {
      return jsonResponse(400, { error: "Choisissez un type de compte valide." });
    }

    const { data: targetAuth, error: targetAuthError } =
      await adminClient.auth.admin.getUserById(targetUserId);
    if (targetAuthError || !targetAuth.user) {
      return jsonResponse(404, { error: "Le compte de connexion est introuvable." });
    }

    const roleChanged = role !== targetAccess.role;
    if (roleChanged) {
      const { error: roleUpdateError } = await userClient.rpc("manage_admin_users", {
        p_action: "update_role",
        p_user_id: targetUserId,
        p_role: role,
      });
      if (roleUpdateError) {
        return jsonResponse(400, { error: roleUpdateError.message });
      }
    }

    const authUpdates: { email?: string; email_confirm?: boolean; password?: string } = {};
    if (email !== (targetAuth.user.email ?? "").toLowerCase()) {
      authUpdates.email = email;
      authUpdates.email_confirm = true;
    }
    if (password) authUpdates.password = password;

    if (Object.keys(authUpdates).length > 0) {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
        targetUserId,
        authUpdates,
      );
      if (authUpdateError) {
        if (roleChanged) {
          const { error: rollbackError } = await userClient.rpc("manage_admin_users", {
            p_action: "update_role",
            p_user_id: targetUserId,
            p_role: targetAccess.role,
          });
          if (rollbackError) {
            return jsonResponse(500, {
              error: "La modification a échoué et le rôle du compte n’a pas pu être rétabli. Vérifiez ce compte.",
            });
          }
        }
        return jsonResponse(400, { error: authUpdateError.message });
      }
    }

    return jsonResponse(200, {
      user_id: targetUserId,
      email,
      role,
      is_suspended: targetAccess.is_suspended,
    });
  }

  const action = body.action === "suspend" ? "suspend" : "reactivate";
  const { error: accessUpdateError } = await userClient.rpc("manage_admin_users", {
    p_action: action,
    p_user_id: targetUserId,
  });
  if (accessUpdateError) {
    return jsonResponse(400, { error: accessUpdateError.message });
  }

  const { error: banError } = await adminClient.auth.admin.updateUserById(
    targetUserId,
    { ban_duration: action === "suspend" ? "876000h" : "none" },
  );
  if (banError) {
    const rollbackAction = action === "suspend" ? "reactivate" : "suspend";
    const { error: rollbackError } = await userClient.rpc("manage_admin_users", {
      p_action: rollbackAction,
      p_user_id: targetUserId,
    });
    return jsonResponse(500, {
      error: rollbackError
        ? "La modification a échoué et le statut du compte n’a pas pu être rétabli. Vérifiez ce compte."
        : `Le statut Auth du compte n’a pas pu être modifié : ${banError.message}`,
    });
  }

  return jsonResponse(200, {
    user_id: targetUserId,
    role: targetAccess.role,
    is_suspended: action === "suspend",
  });
});
