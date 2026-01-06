export type QuestionType = "boolean" | "number" | "scale" | "text" | "emoji";

export type Profile = {
  user_id: string;
  timezone: string | null;
  reminder_time: string | null;
  push_opt_in: boolean | null;
  is_admin: boolean | null;
};

export type QuestionTemplate = {
  id: string;
  category_id: string | null;
  title: string;
  type: QuestionType;
  meta: Record<string, unknown> | null;
  is_active: boolean | null;
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
