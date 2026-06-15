import type { Locale } from "@/data/i18n";

export const dashboardCopy: Record<
  Locale,
  {
    nav: {
      overview: string;
      listings: string;
      audits: string;
      billing: string;
      settings: string;
      admin: string;
    };
    auth: {
      signOut: string;
      signingOut: string;
    };
  }
> = {
  en: {
    nav: {
      overview: "Overview",
      listings: "Listings",
      audits: "Audits",
      billing: "Billing",
      settings: "Settings",
      admin: "Admin",
    },
    auth: {
      signOut: "Sign out",
      signingOut: "Signing out...",
    },
  },
  fr: {
    nav: {
      overview: "Vue d’ensemble",
      listings: "Annonces",
      audits: "Audits",
      billing: "Facturation",
      settings: "Paramètres",
      admin: "Admin",
    },
    auth: {
      signOut: "Se déconnecter",
      signingOut: "Déconnexion...",
    },
  },
  es: {
    nav: {
      overview: "Resumen",
      listings: "Anuncios",
      audits: "Auditorías",
      billing: "Facturación",
      settings: "Ajustes",
      admin: "Admin",
    },
    auth: {
      signOut: "Cerrar sesión",
      signingOut: "Cerrando sesión...",
    },
  },
};
