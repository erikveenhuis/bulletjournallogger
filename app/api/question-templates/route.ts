import { NextResponse } from "next/server";
import {
  getEffectiveSupabaseClient,
  getEffectiveUser,
  isImpersonating,
} from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function requireEffectiveUser() {
  const authClient = await createServerSupabaseClient();
  const {
    data: { user: actualUser },
  } = await authClient.auth.getUser();
  if (!actualUser) {
    return { supabase: authClient, user: null, impersonating: false };
  }

  const { user: effectiveUser } = await getEffectiveUser();
  const impersonating = await isImpersonating();
  const supabase = await getEffectiveSupabaseClient();
  return { supabase, user: effectiveUser ?? actualUser, impersonating };
}

async function getProfileAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from("profiles")
    .select("is_admin, account_tier")
    .eq("user_id", userId)
    .single();
  const accountTier = typeof data?.account_tier === "number" ? data.account_tier : 0;
  return { isAdmin: !!data?.is_admin, accountTier };
}

const defaultChoiceSteps = ["1", "2", "3", "4", "5"];

const normalizeSteps = (raw: unknown) => {
  if (!Array.isArray(raw)) return [];
  return raw.map((step) => String(step).trim()).filter((step) => step.length > 0);
};

const resolveChoiceMeta = (meta: Record<string, unknown> | null | undefined) => {
  const rawSteps = normalizeSteps(meta?.steps);
  const steps = rawSteps.length > 0 ? rawSteps : defaultChoiceSteps;
  if (steps.length < 2) {
    return { error: "Choice questions must have at least two options." };
  }
  return { meta: { steps } };
};

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const url = new URL(request.url);
  const categoryId = url.searchParams.get("category_id");
  let query = supabase
    .from("question_templates")
    .select("*, categories(name), answer_types(*)");
  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }
  query = query.eq("is_active", true).order("title", { ascending: true });
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { supabase, user, impersonating } = await requireEffectiveUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { isAdmin: profileIsAdmin, accountTier } = await getProfileAccess(supabase, user.id);
  const isAdmin = !impersonating && profileIsAdmin;
  if (!isAdmin && accountTier < 3) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isAdmin && accountTier === 3) {
    const { count, error: countError } = await supabase
      .from("question_templates")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user.id);
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }
    if ((count ?? 0) >= 5) {
      return NextResponse.json(
        { error: "Upgrade to create more personal questions." },
        { status: 403 },
      );
    }
  }


  const body = await request.json();
  const {
    title,
    category_id,
    meta,
    is_active = true,
    answer_type_id,
    scope,
  } = body;
  if (!answer_type_id) {
    return NextResponse.json({ error: "answer_type_id is required" }, { status: 400 });
  }

  // Validate that the answer_type_id exists
  const { data: answerType, error: answerTypeError } = await supabase
    .from("answer_types")
    .select("id, is_active, type")
    .eq("id", answer_type_id)
    .maybeSingle();

  if (answerTypeError) {
    return NextResponse.json({ error: answerTypeError.message }, { status: 400 });
  }

  if (!answerType) {
    return NextResponse.json({ error: "Invalid answer_type_id: answer type does not exist" }, { status: 400 });
  }
  if (answerType.is_active === false) {
    return NextResponse.json({ error: "Answer type is inactive." }, { status: 400 });
  }

  const baseMeta = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
  let metaPayload: Record<string, unknown> = baseMeta;
  if (answerType.type === "single_choice" || answerType.type === "multi_choice") {
    const resolved = resolveChoiceMeta(baseMeta);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    metaPayload = resolved.meta;
  } else if (answerType.type === "number") {
    const unit = typeof baseMeta.unit === "string" ? baseMeta.unit.trim() : "";
    metaPayload = unit ? { unit } : {};
  } else {
    metaPayload = {};
  }

  const isGlobalRequest = scope === "global";
  if (isGlobalRequest && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("question_templates").insert({
    title,
    category_id,
    meta: metaPayload,
    is_active,
    answer_type_id,
    created_by: isGlobalRequest ? null : user.id,
  });
  if (error) {
    if (error.code === "23505" && error.message?.includes("question_templates_title_per_user_ci")) {
      return NextResponse.json({ error: "You already have a question with this title." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  const { supabase, user, impersonating } = await requireEffectiveUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { isAdmin: profileIsAdmin, accountTier } = await getProfileAccess(supabase, user.id);
  const isAdmin = !impersonating && profileIsAdmin;
  if (!isAdmin && accountTier < 3) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    id,
    title,
    category_id,
    meta,
    is_active,
    answer_type_id,
  } = body;
  if (!id) {
    return NextResponse.json({ error: "Template id is required" }, { status: 400 });
  }

  const { data: existingTemplate, error: fetchError } = await supabase
    .from("question_templates")
    .select("answer_type_id, created_by, answer_types(type)")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 });
  }
  if (!existingTemplate) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  if (!isAdmin && existingTemplate.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existingAnswerType = Array.isArray(existingTemplate.answer_types)
    ? existingTemplate.answer_types[0]
    : existingTemplate.answer_types;

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (category_id !== undefined) updates.category_id = category_id;
  if (meta !== undefined) {
    const baseMeta = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
    const effectiveType =
      answer_type_id !== undefined
        ? undefined
        : (existingAnswerType?.type as string | undefined);
    if (effectiveType === "single_choice" || effectiveType === "multi_choice") {
      const resolved = resolveChoiceMeta(baseMeta);
      if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      updates.meta = resolved.meta;
    } else if (effectiveType === "number") {
      const unit = typeof baseMeta.unit === "string" ? baseMeta.unit.trim() : "";
      updates.meta = unit ? { unit } : {};
    } else if (effectiveType) {
      updates.meta = {};
    } else {
      updates.meta = baseMeta;
    }
  }
  if (is_active !== undefined) updates.is_active = is_active;
  if (answer_type_id !== undefined) {
    // Validate that the answer_type_id exists
    const { data: answerType, error: answerTypeError } = await supabase
      .from("answer_types")
      .select("id, is_active, type")
      .eq("id", answer_type_id)
      .maybeSingle();

    if (answerTypeError) {
      return NextResponse.json({ error: answerTypeError.message }, { status: 400 });
    }

    if (!answerType) {
      return NextResponse.json({ error: "Invalid answer_type_id: answer type does not exist" }, { status: 400 });
    }
    if (answerType.is_active === false && answer_type_id !== existingTemplate.answer_type_id) {
      return NextResponse.json({ error: "Answer type is inactive." }, { status: 400 });
    }

    updates.answer_type_id = answer_type_id;

    if (meta !== undefined) {
      const baseMeta = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
      if (answerType.type === "single_choice" || answerType.type === "multi_choice") {
        const resolved = resolveChoiceMeta(baseMeta);
        if ("error" in resolved) {
          return NextResponse.json({ error: resolved.error }, { status: 400 });
        }
        updates.meta = resolved.meta;
      } else if (answerType.type === "number") {
        const unit = typeof baseMeta.unit === "string" ? baseMeta.unit.trim() : "";
        updates.meta = unit ? { unit } : {};
      } else {
        updates.meta = {};
      }
    } else if (answerType.type === "single_choice" || answerType.type === "multi_choice") {
      updates.meta = { steps: defaultChoiceSteps };
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error } = await supabase.from("question_templates").update(updates).eq("id", id);
  if (error) {
    if (error.code === "23505" && error.message?.includes("question_templates_title_per_user_ci")) {
      return NextResponse.json({ error: "You already have a question with this title." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { supabase, user, impersonating } = await requireEffectiveUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { isAdmin: profileIsAdmin } = await getProfileAccess(supabase, user.id);
  const isAdmin = !impersonating && profileIsAdmin;

  const body = await request.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "Template id is required" }, { status: 400 });
  }

  if (!isAdmin) {
    const { data: existingTemplate, error: fetchError } = await supabase
      .from("question_templates")
      .select("created_by")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }
    if (!existingTemplate || existingTemplate.created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { error } = await supabase.from("question_templates").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}