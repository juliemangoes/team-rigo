// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedRoles = new Set([
  "Campaign Manager",
  "Zone Leader",
  "Campaigner",
  "Driver",
  "Scrutineer",
]);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanNullable(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function findAuthUserByEmail(adminClient, email) {
  const targetEmail = normalizeEmail(email);
  let page = 1;
  const perPage = 1000;

  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    const found = users.find(
      (user) => normalizeEmail(user.email || "") === targetEmail
    );

    if (found) return found;
    if (users.length < perPage) return null;

    page += 1;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(
      { error: "Missing Supabase function environment variables." },
      500
    );
  }

  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization header." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user?.email) {
    return jsonResponse({ error: "Invalid or expired login session." }, 401);
  }

  const { data: callerProfile, error: callerError } = await adminClient
    .from("campaigners")
    .select("id, full_name, email, role")
    .ilike("email", user.email)
    .maybeSingle();

  if (callerError) {
    return jsonResponse(
      { error: `Could not verify caller role: ${callerError.message}` },
      500
    );
  }

  if (callerProfile?.role !== "Campaign Manager") {
    return jsonResponse(
      { error: "Only a Campaign Manager can create or reset team logins." },
      403
    );
  }

  let payload;

  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const action = payload.action || "create-team-member";
  const email = normalizeEmail(payload.email || "");
  const password = String(payload.password || "").trim();

  if (!email || !email.includes("@")) {
    return jsonResponse({ error: "A valid email is required." }, 400);
  }

  if (!password || password.length < 8) {
    return jsonResponse(
      { error: "Temporary password must be at least 8 characters." },
      400
    );
  }

  if (action === "reset-password") {
    let authUser;

    try {
      authUser = await findAuthUserByEmail(adminClient, email);
    } catch (error) {
      return jsonResponse(
        { error: `Could not search Auth users: ${error.message}` },
        500
      );
    }

    if (!authUser?.id) {
      return jsonResponse(
        {
          error:
            "No Supabase Auth user was found for this email. Create the login first or correct the email.",
        },
        404
      );
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      authUser.id,
      {
        password,
        email_confirm: true,
      }
    );

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 400);
    }

    return jsonResponse({
      success: true,
      action: "reset-password",
      auth_user_id: authUser.id,
      email,
    });
  }

  const fullName = String(payload.full_name || "").trim();
  const role = payload.role || "Campaigner";

  if (!fullName) {
    return jsonResponse({ error: "Full name is required." }, 400);
  }

  if (!allowedRoles.has(role)) {
    return jsonResponse({ error: "Invalid role." }, 400);
  }

  if (role === "Scrutineer") {
    if (
      !cleanNullable(payload.assigned_polling_area) ||
      !cleanNullable(payload.assigned_classroom) ||
      !cleanNullable(payload.surname_from) ||
      !cleanNullable(payload.surname_to)
    ) {
      return jsonResponse(
        {
          error:
            "Scrutineers require polling area, classroom, and surname range.",
        },
        400
      );
    }
  }

  let authUserCreated = true;
  let authUserId = null;

  const { data: createdUser, error: createUserError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
      },
    });

  if (createUserError) {
    const message = createUserError.message || "";

    if (
      message.toLowerCase().includes("already") ||
      message.toLowerCase().includes("registered") ||
      message.toLowerCase().includes("exists")
    ) {
      authUserCreated = false;

      try {
        const existingUser = await findAuthUserByEmail(adminClient, email);
        authUserId = existingUser?.id || null;
      } catch (_error) {
        authUserId = null;
      }
    } else {
      return jsonResponse({ error: message }, 400);
    }
  } else {
    authUserId = createdUser?.user?.id || null;
  }

  const profilePayload = {
    full_name: fullName,
    email,
    phone: cleanNullable(payload.phone),
    role,
    zone: cleanNullable(payload.zone),
    assigned_polling_area:
      role === "Scrutineer" ? cleanNullable(payload.assigned_polling_area) : null,
    assigned_classroom:
      role === "Scrutineer" ? cleanNullable(payload.assigned_classroom) : null,
    surname_from:
      role === "Scrutineer"
        ? cleanNullable(payload.surname_from)?.toUpperCase()
        : null,
    surname_to:
      role === "Scrutineer"
        ? cleanNullable(payload.surname_to)?.toUpperCase()
        : null,
  };

  const { data: existingProfile, error: existingProfileError } =
    await adminClient
      .from("campaigners")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

  if (existingProfileError) {
    return jsonResponse(
      { error: `Could not check existing profile: ${existingProfileError.message}` },
      500
    );
  }

  let savedProfile;

  if (existingProfile?.id) {
    const { data, error } = await adminClient
      .from("campaigners")
      .update(profilePayload)
      .eq("id", existingProfile.id)
      .select("id, full_name, email, role, zone")
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    savedProfile = data;
  } else {
    const { data, error } = await adminClient
      .from("campaigners")
      .insert(profilePayload)
      .select("id, full_name, email, role, zone")
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    savedProfile = data;
  }

  return jsonResponse({
    success: true,
    action: "create-team-member",
    auth_user_created: authUserCreated,
    auth_user_id: authUserId,
    profile: savedProfile,
  });
});