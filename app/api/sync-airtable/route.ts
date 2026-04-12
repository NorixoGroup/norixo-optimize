import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const airtableBaseId = process.env.AIRTABLE_BASE_ID;
const airtableApiKey = process.env.AIRTABLE_API_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing in .env.local");
}

if (!supabaseServiceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing in .env.local");
}

if (!airtableBaseId) {
  throw new Error("AIRTABLE_BASE_ID is missing in .env.local");
}

if (!airtableApiKey) {
  throw new Error("AIRTABLE_API_KEY is missing in .env.local");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const AIRTABLE_BASE = airtableBaseId;
const AIRTABLE_KEY = airtableApiKey;

// IDs EXACTS des tables Airtable
const AIRTABLE_TABLES = {
  kpi: "tblqw3H1JRhqnNVRg",
  workspaceRevenue: "tblJEM98rdxV59FL9",
  monthlyRevenue: "tblJzrSjEsEqHhcg2",
  topWorkspaces: "tbluepMO0LuUoed44",
  productActivity: "tblNZiLuExtnZcG3R",
} as const;

type AirtableRecord = Record<string, unknown>;

function normalizeValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function cleanRecord(record: AirtableRecord): AirtableRecord {
  const cleaned: AirtableRecord = {};

  for (const [key, rawValue] of Object.entries(record)) {
    // On ignore le champ id générique venant de Supabase
    if (key === "id") continue;

    const value = normalizeValue(rawValue);

    if (value === undefined) continue;

    cleaned[key] = value;
  }

  return cleaned;
}

function escapeAirtableFormulaValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

async function fetchAirtableRecordBySyncId(
  tableId: string,
  syncSourceId: string
): Promise<{ recordId: string | null }> {
  const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`;
  const formula = `({sync_source_id}='${escapeAirtableFormulaValue(syncSourceId)}')`;
  const url = `${baseUrl}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${AIRTABLE_KEY}`,
    },
    cache: "no-store",
  });

  const json = await res.json();

  if (!res.ok) {
    console.error("Airtable lookup error:", {
      tableId,
      syncSourceId,
      status: res.status,
      statusText: res.statusText,
      response: json,
    });

    throw new Error(
      `Airtable lookup failed for "${tableId}": ${json?.error?.message || res.statusText}`
    );
  }

  const recordId = json?.records?.[0]?.id ?? null;
  return { recordId };
}

async function createAirtableRecord(tableId: string, fields: AirtableRecord) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AIRTABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      records: [{ fields }],
      typecast: true,
    }),
    cache: "no-store",
  });

  const json = await res.json();

  if (!res.ok) {
    console.error("Airtable create error:", {
      tableId,
      status: res.status,
      statusText: res.statusText,
      response: json,
    });

    throw new Error(
      `Airtable create failed for "${tableId}": ${json?.error?.message || res.statusText}`
    );
  }

  return json;
}

async function updateAirtableRecord(
  tableId: string,
  recordId: string,
  fields: AirtableRecord
) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}/${recordId}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${AIRTABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields,
      typecast: true,
    }),
    cache: "no-store",
  });

  const json = await res.json();

  if (!res.ok) {
    console.error("Airtable update error:", {
      tableId,
      recordId,
      status: res.status,
      statusText: res.statusText,
      response: json,
    });

    throw new Error(
      `Airtable update failed for "${tableId}": ${json?.error?.message || res.statusText}`
    );
  }

  return json;
}

async function upsertToAirtable(tableId: string, records: AirtableRecord[]) {
  if (!records.length) return;

  for (const rawRecord of records) {
    const cleaned = cleanRecord(rawRecord);
    const syncSourceId = cleaned.sync_source_id;

    if (typeof syncSourceId !== "string" || !syncSourceId.trim()) {
      console.warn(`Skipping record without valid sync_source_id for table ${tableId}`);
      continue;
    }

    const { recordId } = await fetchAirtableRecordBySyncId(tableId, syncSourceId);

    if (recordId) {
      await updateAirtableRecord(tableId, recordId, cleaned);
      console.log(`UPDATED ${tableId} -> ${syncSourceId}`);
    } else {
      await createAirtableRecord(tableId, cleaned);
      console.log(`CREATED ${tableId} -> ${syncSourceId}`);
    }
  }
}

export async function GET() {
  try {
    // =========================
    // KPI Revenue
    // =========================
    const { data: kpi, error: kpiError } = await supabase
      .from("revenue_kpi_summary")
      .select("*")
      .single();

    if (kpiError) {
      throw new Error(`Supabase revenue_kpi_summary failed: ${kpiError.message}`);
    }

    if (kpi) {
      await upsertToAirtable(AIRTABLE_TABLES.kpi, [
        {
          ...kpi,
          sync_source_id: "global",
        },
      ]);
    }

    // =========================
    // Revenue by Workspace
    // =========================
    const { data: workspaces, error: workspacesError } = await supabase
      .from("workspace_revenue_with_status")
      .select("*");

    if (workspacesError) {
      throw new Error(`Supabase workspace_revenue_summary failed: ${workspacesError.message}`);
    }

    if (workspaces?.length) {
      await upsertToAirtable(
        AIRTABLE_TABLES.workspaceRevenue,
        workspaces.map((w) => ({
          ...w,
          sync_source_id: String(w.workspace_id),
        }))
      );
    }

    // =========================
    // Monthly Revenue
    // =========================
    const { data: monthly, error: monthlyError } = await supabase
      .from("monthly_revenue_summary")
      .select("*");

    if (monthlyError) {
      throw new Error(`Supabase monthly_revenue_summary failed: ${monthlyError.message}`);
    }

    if (monthly?.length) {
      await upsertToAirtable(
        AIRTABLE_TABLES.monthlyRevenue,
        monthly.map((m) => ({
          ...m,
          sync_source_id: `${String(m.month_key)}_${String(m.plan_code)}`,
        }))
      );
    }

    // =========================
    // Top Workspaces
    // =========================
    const { data: top, error: topError } = await supabase
      .from("top_workspaces_by_revenue")
      .select("*")
      .limit(20);

    if (topError) {
      throw new Error(`Supabase top_workspaces_by_revenue failed: ${topError.message}`);
    }

    if (top?.length) {
      await upsertToAirtable(
        AIRTABLE_TABLES.topWorkspaces,
        top.map((t) => ({
          ...t,
          sync_source_id: String(t.workspace_id),
        }))
      );
    }

    // =========================
    // Product Activity
    // =========================
    const { data: activity, error: activityError } = await supabase
      .from("workspace_product_activity_summary")
      .select("*");

    if (activityError) {
      throw new Error(
        `Supabase workspace_product_activity_summary failed: ${activityError.message}`
      );
    }

    if (activity?.length) {
      await upsertToAirtable(
        AIRTABLE_TABLES.productActivity,
        activity.map((a) => ({
          ...a,
          sync_source_id: String(a.workspace_id),
        }))
      );
    }

    return Response.json({
      success: true,
      synced: {
        kpi: kpi ? 1 : 0,
        workspaceRevenue: workspaces?.length ?? 0,
        monthlyRevenue: monthly?.length ?? 0,
        topWorkspaces: top?.length ?? 0,
        productActivity: activity?.length ?? 0,
      },
    });
  } catch (error) {
    console.error("sync-airtable error:", error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown sync error",
      },
      { status: 500 }
    );
  }
}