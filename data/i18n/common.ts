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
  de: {
    actions: {
      save: "Speichern",
      cancel: "Abbrechen",
      delete: "Löschen",
      edit: "Bearbeiten",
      loading: "Wird geladen...",
      back: "Zurück",
      continue: "Weiter",
    },
  },
  it: {
    actions: {
      save: "Salva",
      cancel: "Annulla",
      delete: "Elimina",
      edit: "Modifica",
      loading: "Caricamento...",
      back: "Indietro",
      continue: "Continua",
    },
  },
  pt: {
    actions: {
      save: "Guardar",
      cancel: "Cancelar",
      delete: "Eliminar",
      edit: "Editar",
      loading: "A carregar...",
      back: "Voltar",
      continue: "Continuar",
    },
  },
  nl: {
    actions: {
      save: "Opslaan",
      cancel: "Annuleren",
      delete: "Verwijderen",
      edit: "Bewerken",
      loading: "Bezig met laden...",
      back: "Terug",
      continue: "Doorgaan",
    },
  },
  ja: {
    actions: {
      save: "保存",
      cancel: "キャンセル",
      delete: "削除",
      edit: "編集",
      loading: "読み込み中...",
      back: "戻る",
      continue: "続行",
    },
  },
  zh: {
    actions: {
      save: "保存",
      cancel: "取消",
      delete: "删除",
      edit: "编辑",
      loading: "加载中...",
      back: "返回",
      continue: "继续",
    },
  },
  ko: {
    actions: {
      save: "저장",
      cancel: "취소",
      delete: "삭제",
      edit: "수정",
      loading: "로딩 중...",
      back: "뒤로",
      continue: "계속",
    },
  },
  ar: {
    actions: {
      save: "حفظ",
      cancel: "إلغاء",
      delete: "حذف",
      edit: "تعديل",
      loading: "جارٍ التحميل...",
      back: "رجوع",
      continue: "متابعة",
    },
  },
} satisfies Partial<Record<Locale, unknown>>;
