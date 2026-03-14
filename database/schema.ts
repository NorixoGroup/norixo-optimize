// Core table definitions for Supabase (placeholder, not executed directly)

export const profilesTable = {
  name: "profiles",
  columns: {
    id: "uuid PRIMARY KEY",
    email: "text NOT NULL UNIQUE",
    full_name: "text",
    created_at: "timestamptz DEFAULT now()",
  },
};

export const listingsTable = {
  name: "listings",
  columns: {
    id: "uuid PRIMARY KEY",
    owner_id: "uuid NOT NULL REFERENCES profiles(id)",
    url: "text NOT NULL",
    platform: "text NOT NULL",
    title: "text NOT NULL",
    city: "text",
    country: "text",
    created_at: "timestamptz DEFAULT now()",
    last_audit_id: "uuid",
  },
};

export const auditsTable = {
  name: "audits",
  columns: {
    id: "uuid PRIMARY KEY",
    listing_id: "uuid NOT NULL REFERENCES listings(id)",
    created_at: "timestamptz DEFAULT now()",
    overall_score: "numeric NOT NULL",
    suggested_opening_paragraph: "text",
  },
};

export const auditScoresTable = {
  name: "audit_scores",
  columns: {
    id: "uuid PRIMARY KEY",
    audit_id: "uuid NOT NULL REFERENCES audits(id)",
    photo_quality: "numeric NOT NULL",
    photo_order: "numeric NOT NULL",
    description_quality: "numeric NOT NULL",
    amenities_completeness: "numeric NOT NULL",
    seo_strength: "numeric NOT NULL",
    conversion_strength: "numeric NOT NULL",
  },
};

export const improvementsTable = {
  name: "improvements",
  columns: {
    id: "uuid PRIMARY KEY",
    audit_id: "uuid NOT NULL REFERENCES audits(id)",
    title: "text NOT NULL",
    description: "text NOT NULL",
    impact: "text NOT NULL",
    order_index: "integer NOT NULL",
  },
};

export const subscriptionsTable = {
  name: "subscriptions",
  columns: {
    id: "uuid PRIMARY KEY",
    profile_id: "uuid NOT NULL REFERENCES profiles(id)",
    stripe_customer_id: "text",
    stripe_subscription_id: "text",
    plan: "text NOT NULL",
    status: "text NOT NULL",
    current_period_end: "timestamptz",
  },
};

export const monthlyUsageTable = {
  name: "monthly_usage",
  columns: {
    id: "uuid PRIMARY KEY",
    profile_id: "uuid NOT NULL REFERENCES profiles(id)",
    month: "text NOT NULL",
    included_listings: "integer NOT NULL",
    extra_listings: "integer NOT NULL",
  },
};
