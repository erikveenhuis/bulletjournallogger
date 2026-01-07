// Legacy type - kept for backward compatibility during migration
// Use AnswerType.type instead
export type QuestionType = "boolean" | "number" | "scale" | "text" | "emoji" | "yes_no_list";

export type ChartStyle = "gradient" | "brush" | "solid";

export type Profile = {
  user_id: string;
  timezone: string | null;
  reminder_time: string | null;
  push_opt_in: boolean | null;
  is_admin: boolean | null;
  chart_palette?: ChartPalette | null;
  chart_style?: ChartStyle | null;
};

export type AdminProfile = Profile & {
  created_at?: string | null;
  email?: string | null;
  auth_created_at?: string | null;
  last_sign_in_at?: string | null;
};

export type ChartPalette = {
  accent: string;
  accentSoft: string;
  booleanYes: string;
  booleanNo: string;
  scaleLow: string;
  scaleHigh: string;
};

export type AnswerType = {
  id: string;
  name: string;
  description: string | null;
  type: "boolean" | "number" | "scale" | "text" | "emoji" | "yes_no_list";
  items: string[] | null;
  meta: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string | null;
};

export type QuestionTemplate = {
  id: string;
  category_id: string | null;
  title: string;
  meta: Record<string, unknown> | null;
  is_active: boolean | null;
  answer_type_id: string;
  categories?: {
    name: string;
  } | null;
  answer_types?: AnswerType | null;
};

export type UserQuestion = {
  id: string;
  user_id: string;
  template_id: string;
  sort_order: number | null;
  custom_label: string | null;
  is_active: boolean | null;
  template?: QuestionTemplate;
  category?: Category;
};

export type Category = {
  id: string;
  name: string;
  description: string | null;
};

export type PushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh?: string;
  auth?: string;
  ua: string | null;
  created_at: string;
  // Supabase may return the related profile either as an object or array depending on join syntax.
  profiles?:
    | {
        timezone: string | null;
        reminder_time: string | null;
        push_opt_in: boolean | null;
      }
    | {
        timezone: string | null;
        reminder_time: string | null;
        push_opt_in: boolean | null;
      }[]
    | null;
};