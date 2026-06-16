import type { Locale } from "@/data/i18n";

export const commonCopy = {
  en: {
    actions: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      loading: "Loading...",
      back: "Back",
      continue: "Continue",
    },
  },
  fr: {
    actions: {
      save: "Enregistrer",
      cancel: "Annuler",
      delete: "Supprimer",
      edit: "Modifier",
      loading: "Chargement...",
      back: "Retour",
      continue: "Continuer",
    },
  },
  es: {
    actions: {
      save: "Guardar",
      cancel: "Cancelar",
      delete: "Eliminar",
      edit: "Editar",
      loading: "Cargando...",
      back: "Volver",
      continue: "Continuar",
    },
  },
} satisfies Partial<Record<Locale, unknown>>;
