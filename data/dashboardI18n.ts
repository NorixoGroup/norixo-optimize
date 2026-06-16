export const dashboardCopy: Partial<Record<string, {
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
>> = {
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

  de: {
    nav: {
      overview: "Übersicht",
      listings: "Inserate",
      audits: "Audits",
      billing: "Abrechnung",
      settings: "Einstellungen",
      admin: "Admin",
    },
    auth: {
      signOut: "Abmelden",
      signingOut: "Abmeldung...",
    },
  },

  it: {
    nav: {
      overview: "Panoramica",
      listings: "Annunci",
      audits: "Audit",
      billing: "Fatturazione",
      settings: "Impostazioni",
      admin: "Admin",
    },
    auth: {
      signOut: "Disconnetti",
      signingOut: "Disconnessione...",
    },
  },

  pt: {
    nav: {
      overview: "Visão geral",
      listings: "Anúncios",
      audits: "Auditorias",
      billing: "Faturação",
      settings: "Definições",
      admin: "Admin",
    },
    auth: {
      signOut: "Terminar sessão",
      signingOut: "A terminar sessão...",
    },
  },

  nl: {
    nav: {
      overview: "Overzicht",
      listings: "Advertenties",
      audits: "Audits",
      billing: "Facturatie",
      settings: "Instellingen",
      admin: "Admin",
    },
    auth: {
      signOut: "Afmelden",
      signingOut: "Bezig met afmelden...",
    },
  },
};
