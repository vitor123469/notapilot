export type TranslationAction = {
  label: string;
  href?: string;
  kind?: "link" | "button";
};

export type TranslationField = {
  field: string;
  label: string;
  suggestion?: string;
};

export type Translation = {
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  actions: TranslationAction[];
  fields?: TranslationField[];
};
