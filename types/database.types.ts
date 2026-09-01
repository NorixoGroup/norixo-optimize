export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]


export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      anonymous_fact_groups: {
        Row: {
          capacity_band: string
          capture_period_bucket: string
          city: string
          confidence_input_band: string
          confidence_policy_version: string
          country: string
          created_at: string
          currency: string
          deduplication_policy_version: string
          eligibility_policy_version: string
          fact_contract_version: string
          fact_key: string | null
          freshness_input_band: string
          freshness_policy_version: string
          id: string
          market_cell_key: string
          market_cell_policy_version: string
          metric_family: string
          normalized_nightly_price: number | null
          observed_days_band: string | null
          platform: string
          price_band: string | null
          pricing_normalization_policy_version: string | null
          property_type: string
          source_class: string
          source_quality_band: string
          transformation_policy_version: string
          unavailability_rate_band: string | null
        }
        Insert: {
          capacity_band: string
          capture_period_bucket: string
          city: string
          confidence_input_band: string
          confidence_policy_version: string
          country: string
          created_at?: string
          currency: string
          deduplication_policy_version: string
          eligibility_policy_version: string
          fact_contract_version: string
          fact_key?: string | null
          freshness_input_band: string
          freshness_policy_version: string
          id?: string
          market_cell_key: string
          market_cell_policy_version: string
          metric_family: string
          normalized_nightly_price?: number | null
          observed_days_band?: string | null
          platform: string
          price_band?: string | null
          pricing_normalization_policy_version?: string | null
          property_type: string
          source_class: string
          source_quality_band: string
          transformation_policy_version: string
          unavailability_rate_band?: string | null
        }
        Update: {
          capacity_band?: string
          capture_period_bucket?: string
          city?: string
          confidence_input_band?: string
          confidence_policy_version?: string
          country?: string
          created_at?: string
          currency?: string
          deduplication_policy_version?: string
          eligibility_policy_version?: string
          fact_contract_version?: string
          fact_key?: string | null
          freshness_input_band?: string
          freshness_policy_version?: string
          id?: string
          market_cell_key?: string
          market_cell_policy_version?: string
          metric_family?: string
          normalized_nightly_price?: number | null
          observed_days_band?: string | null
          platform?: string
          price_band?: string | null
          pricing_normalization_policy_version?: string | null
          property_type?: string
          source_class?: string
          source_quality_band?: string
          transformation_policy_version?: string
          unavailability_rate_band?: string | null
        }
        Relationships: []
      }
      audit_credit_lots: {
        Row: {
          consumed_quantity: number
          created_at: string
          expires_at: string | null
          granted_quantity: number
          id: string
          metadata: Json
          period_end: string | null
          period_start: string | null
          plan_code: string | null
          source_ref: string
          source_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          consumed_quantity?: number
          created_at?: string
          expires_at?: string | null
          granted_quantity: number
          id?: string
          metadata?: Json
          period_end?: string | null
          period_start?: string | null
          plan_code?: string | null
          source_ref: string
          source_type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          consumed_quantity?: number
          created_at?: string
          expires_at?: string | null
          granted_quantity?: number
          id?: string
          metadata?: Json
          period_end?: string | null
          period_start?: string | null
          plan_code?: string | null
          source_ref?: string
          source_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_credit_lots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "audit_credit_lots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "audit_credit_lots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "audit_credit_lots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "audit_credit_lots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_entitlement_reservations: {
        Row: {
          audit_id: string | null
          created_at: string
          credit_allocations: Json
          failure_code: string | null
          finalized_at: string | null
          free_plan_gate: boolean
          id: string
          listing_id: string | null
          operation_key: string
          quantity: number
          released_at: string | null
          source: string
          status: string
          target_kind: string
          target_ref: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          audit_id?: string | null
          created_at?: string
          credit_allocations?: Json
          failure_code?: string | null
          finalized_at?: string | null
          free_plan_gate?: boolean
          id?: string
          listing_id?: string | null
          operation_key: string
          quantity?: number
          released_at?: string | null
          source: string
          status: string
          target_kind: string
          target_ref: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          audit_id?: string | null
          created_at?: string
          credit_allocations?: Json
          failure_code?: string | null
          finalized_at?: string | null
          free_plan_gate?: boolean
          id?: string
          listing_id?: string | null
          operation_key?: string
          quantity?: number
          released_at?: string | null
          source?: string
          status?: string
          target_kind?: string
          target_ref?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_entitlement_reservations_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_entitlement_reservations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_entitlement_reservations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "audit_entitlement_reservations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "audit_entitlement_reservations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "audit_entitlement_reservations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "audit_entitlement_reservations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          booking_lift_high: number | null
          booking_lift_low: number | null
          created_at: string | null
          created_by: string
          entitlement_reservation_id: string | null
          id: string
          listing_id: string
          listing_quality_index: number | null
          market_score: number | null
          overall_score: number | null
          potential_score: number | null
          result_payload: Json | null
          revenue_impact_high: number | null
          revenue_impact_low: number | null
          workspace_id: string
        }
        Insert: {
          booking_lift_high?: number | null
          booking_lift_low?: number | null
          created_at?: string | null
          created_by: string
          entitlement_reservation_id?: string | null
          id?: string
          listing_id: string
          listing_quality_index?: number | null
          market_score?: number | null
          overall_score?: number | null
          potential_score?: number | null
          result_payload?: Json | null
          revenue_impact_high?: number | null
          revenue_impact_low?: number | null
          workspace_id: string
        }
        Update: {
          booking_lift_high?: number | null
          booking_lift_low?: number | null
          created_at?: string | null
          created_by?: string
          entitlement_reservation_id?: string | null
          id?: string
          listing_id?: string
          listing_quality_index?: number | null
          market_score?: number | null
          overall_score?: number | null
          potential_score?: number | null
          result_payload?: Json | null
          revenue_impact_high?: number | null
          revenue_impact_low?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audits_entitlement_reservation_id_fkey"
            columns: ["entitlement_reservation_id"]
            isOneToOne: false
            referencedRelation: "audit_entitlement_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "audits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "audits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "audits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "audits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_activity: {
        Row: {
          action_type: string
          activity_key: string
          actor_user_id: string
          after_state: Json | null
          before_state: Json | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          occurred_at: string
          reason: string | null
          workspace_id: string
        }
        Insert: {
          action_type: string
          activity_key: string
          actor_user_id: string
          after_state?: Json | null
          before_state?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          reason?: string | null
          workspace_id: string
        }
        Update: {
          action_type?: string
          activity_key?: string
          actor_user_id?: string
          after_state?: Json | null
          before_state?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          reason?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_assets: {
        Row: {
          archived_at: string | null
          asset_key: string
          asset_type: string
          canonical_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          id: string
          lifecycle_status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          asset_key: string
          asset_type: string
          canonical_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          id?: string
          lifecycle_status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          asset_key?: string
          asset_type?: string
          canonical_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          id?: string
          lifecycle_status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_campaign_opportunities: {
        Row: {
          added_at: string
          added_by: string | null
          campaign_id: string
          campaign_priority: number | null
          membership_status: string
          opportunity_id: string
          removal_reason: string | null
          removed_at: string | null
          workspace_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          campaign_id: string
          campaign_priority?: number | null
          membership_status?: string
          opportunity_id: string
          removal_reason?: string | null
          removed_at?: string | null
          workspace_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          campaign_id?: string
          campaign_priority?: number | null
          membership_status?: string
          opportunity_id?: string
          removal_reason?: string | null
          removed_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_campaign_opportunities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "backlink_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_campaign_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "backlink_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_campaign_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_campaign_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_campaign_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_campaign_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_campaign_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_campaigns: {
        Row: {
          archived_at: string | null
          campaign_key: string
          created_at: string
          created_by: string | null
          end_at: string | null
          id: string
          live_initial_send_enabled: boolean
          name: string
          objective: string
          owner_id: string
          start_at: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          campaign_key: string
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          id?: string
          live_initial_send_enabled?: boolean
          name: string
          objective: string
          owner_id: string
          start_at?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          campaign_key?: string
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          id?: string
          live_initial_send_enabled?: boolean
          name?: string
          objective?: string
          owner_id?: string
          start_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_outreach_initial_attempt_snapshots: {
        Row: {
          approval_fingerprint: string
          approved_at: string
          approved_by: string | null
          attempt_id: string
          body: string
          campaign_id: string
          channel: string
          contact_id: string
          created_at: string
          idempotency_key: string
          opportunity_id: string
          outreach_id: string
          recipient_email: string
          subject: string
          target_url: string
          workspace_id: string
        }
        Insert: {
          approval_fingerprint: string
          approved_at: string
          approved_by?: string | null
          attempt_id: string
          body: string
          campaign_id: string
          channel: string
          contact_id: string
          created_at?: string
          idempotency_key: string
          opportunity_id: string
          outreach_id: string
          recipient_email: string
          subject: string
          target_url: string
          workspace_id: string
        }
        Update: {
          approval_fingerprint?: string
          approved_at?: string
          approved_by?: string | null
          attempt_id?: string
          body?: string
          campaign_id?: string
          channel?: string
          contact_id?: string
          created_at?: string
          idempotency_key?: string
          opportunity_id?: string
          outreach_id?: string
          recipient_email?: string
          subject?: string
          target_url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_outreach_initial_attempt_snapshots_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "backlink_outreach_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_initial_attempt_snapshots_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "backlink_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_initial_attempt_snapshots_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "backlink_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_initial_attempt_snapshots_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "backlink_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_initial_attempt_snapshots_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "backlink_outreach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_initial_attempt_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_outreach_initial_attempt_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_outreach_initial_attempt_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_outreach_initial_attempt_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_outreach_initial_attempt_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_contacts: {
        Row: {
          archived_at: string | null
          consent_or_basis_note: string | null
          contact_form_url: string | null
          contact_key: string
          contact_status: string
          created_at: string
          created_by: string | null
          do_not_contact_at: string | null
          do_not_contact_reason: string | null
          domain_id: string
          email_normalized: string | null
          full_name: string | null
          id: string
          last_verified_at: string | null
          linkedin_url: string | null
          role_title: string | null
          source_reference: string | null
          source_type: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          consent_or_basis_note?: string | null
          contact_form_url?: string | null
          contact_key: string
          contact_status?: string
          created_at?: string
          created_by?: string | null
          do_not_contact_at?: string | null
          do_not_contact_reason?: string | null
          domain_id: string
          email_normalized?: string | null
          full_name?: string | null
          id?: string
          last_verified_at?: string | null
          linkedin_url?: string | null
          role_title?: string | null
          source_reference?: string | null
          source_type?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          consent_or_basis_note?: string | null
          contact_form_url?: string | null
          contact_key?: string
          contact_status?: string
          created_at?: string
          created_by?: string | null
          do_not_contact_at?: string | null
          do_not_contact_reason?: string | null
          domain_id?: string
          email_normalized?: string | null
          full_name?: string | null
          id?: string
          last_verified_at?: string | null
          linkedin_url?: string | null
          role_title?: string | null
          source_reference?: string | null
          source_type?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_contacts_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "backlink_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_domain_tags: {
        Row: {
          added_at: string
          added_by: string | null
          domain_id: string
          tag_id: string
          workspace_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          domain_id: string
          tag_id: string
          workspace_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          domain_id?: string
          tag_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_domain_tags_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "backlink_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_domain_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "backlink_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_domain_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_domain_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_domain_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_domain_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_domain_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_domains: {
        Row: {
          archived_at: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          display_name: string | null
          domain_key: string
          editorial_category: string | null
          editorial_compatibility: string | null
          estimated_difficulty: string | null
          hostname: string
          id: string
          lifecycle_status: string
          primary_language: string | null
          region: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          domain_key: string
          editorial_category?: string | null
          editorial_compatibility?: string | null
          estimated_difficulty?: string | null
          hostname: string
          id?: string
          lifecycle_status?: string
          primary_language?: string | null
          region?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          domain_key?: string
          editorial_category?: string | null
          editorial_compatibility?: string | null
          estimated_difficulty?: string | null
          hostname?: string
          id?: string
          lifecycle_status?: string
          primary_language?: string | null
          region?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_domains_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_domains_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_domains_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_domains_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_domains_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_links: {
        Row: {
          acquired_at: string
          anchor_text: string | null
          asset_id: string
          backlink_key: string
          created_at: string
          created_by: string | null
          domain_id: string
          first_verified_at: string | null
          id: string
          last_seen_at: string | null
          last_verified_at: string | null
          link_location: string | null
          lost_at: string | null
          lost_reason: string | null
          opportunity_id: string
          outreach_id: string
          rel_type: string | null
          source_url: string
          status: string
          target_url: string
          updated_at: string
          verification_evidence: string | null
          verification_source: string | null
          workspace_id: string
        }
        Insert: {
          acquired_at: string
          anchor_text?: string | null
          asset_id: string
          backlink_key: string
          created_at?: string
          created_by?: string | null
          domain_id: string
          first_verified_at?: string | null
          id?: string
          last_seen_at?: string | null
          last_verified_at?: string | null
          link_location?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          opportunity_id: string
          outreach_id: string
          rel_type?: string | null
          source_url: string
          status?: string
          target_url: string
          updated_at?: string
          verification_evidence?: string | null
          verification_source?: string | null
          workspace_id: string
        }
        Update: {
          acquired_at?: string
          anchor_text?: string | null
          asset_id?: string
          backlink_key?: string
          created_at?: string
          created_by?: string | null
          domain_id?: string
          first_verified_at?: string | null
          id?: string
          last_seen_at?: string | null
          last_verified_at?: string | null
          link_location?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          opportunity_id?: string
          outreach_id?: string
          rel_type?: string | null
          source_url?: string
          status?: string
          target_url?: string
          updated_at?: string
          verification_evidence?: string | null
          verification_source?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_links_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "backlink_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_links_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "backlink_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_links_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "backlink_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_links_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "backlink_outreach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_verification_attempts: {
        Row: {
          attempted_at: string
          content_type: string | null
          created_at: string
          fetch_error_code: string | null
          fetch_error_message: string | null
          final_url: string | null
          http_status: number | null
          id: string
          link_id: string
          redirect_count: number | null
          requested_url: string | null
          runtime_kind: string
          runtime_reason: string | null
          source_url: string
          target_url: string
          verification_result: Json | null
          verification_status: string | null
          workspace_id: string
        }
        Insert: {
          attempted_at: string
          content_type?: string | null
          created_at?: string
          fetch_error_code?: string | null
          fetch_error_message?: string | null
          final_url?: string | null
          http_status?: number | null
          id?: string
          link_id: string
          redirect_count?: number | null
          requested_url?: string | null
          runtime_kind: string
          runtime_reason?: string | null
          source_url: string
          target_url: string
          verification_result?: Json | null
          verification_status?: string | null
          workspace_id: string
        }
        Update: {
          attempted_at?: string
          content_type?: string | null
          created_at?: string
          fetch_error_code?: string | null
          fetch_error_message?: string | null
          final_url?: string | null
          http_status?: number | null
          id?: string
          link_id?: string
          redirect_count?: number | null
          requested_url?: string | null
          runtime_kind?: string
          runtime_reason?: string | null
          source_url?: string
          target_url?: string
          verification_result?: Json | null
          verification_status?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_verification_attempts_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "backlink_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_verification_attempts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_verification_attempts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_verification_attempts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_verification_attempts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_verification_attempts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_verification_jobs: {
        Row: {
          attempt_count: number
          completed_at: string | null
          claimed_at: string | null
          created_at: string
          failed_at: string | null
          http_options: Json
          id: string
          job_key: string
          last_error_code: string | null
          last_error_message: string | null
          link_id: string
          lease_expires_at: string | null
          max_attempts: number
          queued_at: string
          result_summary: Json | null
          started_at: string | null
          status: string
          trigger_source: string
          updated_at: string
          verification_policy: Json
          workspace_id: string
          worker_id: string | null
          heartbeat_at: string | null
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          claimed_at?: string | null
          created_at?: string
          failed_at?: string | null
          http_options: Json
          id?: string
          job_key: string
          last_error_code?: string | null
          last_error_message?: string | null
          link_id: string
          lease_expires_at?: string | null
          max_attempts?: number
          queued_at: string
          result_summary?: Json | null
          started_at?: string | null
          status?: string
          trigger_source: string
          updated_at?: string
          verification_policy: Json
          workspace_id: string
          worker_id?: string | null
          heartbeat_at?: string | null
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          claimed_at?: string | null
          created_at?: string
          failed_at?: string | null
          http_options?: Json
          id?: string
          job_key?: string
          last_error_code?: string | null
          last_error_message?: string | null
          link_id?: string
          lease_expires_at?: string | null
          max_attempts?: number
          queued_at?: string
          result_summary?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string
          updated_at?: string
          verification_policy?: Json
          workspace_id?: string
          worker_id?: string | null
          heartbeat_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backlink_verification_jobs_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "backlink_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_verification_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_verification_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_verification_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_verification_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_verification_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_workspace_controls: {
        Row: { backlink_outreach_schedule_apply_enabled: boolean; backlinks_enabled: boolean; created_at: string; disabled_reason: string | null; dry_run_only: boolean; last_schedule_apply_attempt_at: string | null; updated_at: string; updated_by: string | null; workspace_id: string }
        Insert: { backlink_outreach_schedule_apply_enabled?: boolean; backlinks_enabled?: boolean; created_at?: string; disabled_reason?: string | null; dry_run_only?: boolean; last_schedule_apply_attempt_at?: string | null; updated_at?: string; updated_by?: string | null; workspace_id: string }
        Update: { backlink_outreach_schedule_apply_enabled?: boolean; backlinks_enabled?: boolean; created_at?: string; disabled_reason?: string | null; dry_run_only?: boolean; last_schedule_apply_attempt_at?: string | null; updated_at?: string; updated_by?: string | null; workspace_id?: string }
        Relationships: []
      }
      backlink_outreach_schedule_apply_locks: {
        Row: {
          acquired_at: string
          created_at: string
          holder_id: string
          lease_expires_at: string
          lock_key: string
          released_at: string | null
          updated_at: string
        }
        Insert: {
          acquired_at: string
          created_at?: string
          holder_id: string
          lease_expires_at: string
          lock_key: string
          released_at?: string | null
          updated_at?: string
        }
        Update: {
          acquired_at?: string
          created_at?: string
          holder_id?: string
          lease_expires_at?: string
          lock_key?: string
          released_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      backlink_outreach_schedule_apply_runs: {
        Row: {
          completed_at: string | null
          conflicts: number
          created_at: string
          existing: number
          failed: number
          id: string
          not_applicable: number
          outreach_scanned: number
          scheduled: number
          started_at: string
          trigger_kind: string
          workspaces_applied: number
          workspaces_failed: number
          workspaces_scanned: number
          workspace_id: string | null
          workspace_results: Json
          workspace_scope: Json
        }
        Insert: {
          completed_at?: string | null
          conflicts?: number
          created_at?: string
          existing?: number
          failed?: number
          id?: string
          not_applicable?: number
          outreach_scanned?: number
          scheduled?: number
          started_at: string
          trigger_kind: string
          workspaces_applied?: number
          workspaces_failed?: number
          workspaces_scanned?: number
          workspace_id?: string | null
          workspace_results?: Json
          workspace_scope?: Json
        }
        Update: {
          completed_at?: string | null
          conflicts?: number
          created_at?: string
          existing?: number
          failed?: number
          id?: string
          not_applicable?: number
          outreach_scanned?: number
          scheduled?: number
          started_at?: string
          trigger_kind?: string
          workspaces_applied?: number
          workspaces_failed?: number
          workspaces_scanned?: number
          workspace_id?: string | null
          workspace_results?: Json
          workspace_scope?: Json
        }
        Relationships: [
          {
            foreignKeyName: "backlink_outreach_schedule_apply_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      automation_runs: {
        Row: { attempt_count: number; cancelled_at: string | null; completed_at: string | null; created_at: string; error_code: string | null; error_message: string | null; failed_at: string | null; heartbeat_at: string | null; id: string; idempotency_key: string; input: Json; lease_expires_at: string | null; max_attempts: number; mode: string; requested_by: string | null; run_kind: string; scheduled_at: string; started_at: string | null; status: string; summary: Json | null; system: string; trigger_source: string; updated_at: string; worker_id: string | null; workspace_id: string }
        Insert: { attempt_count?: number; cancelled_at?: string | null; completed_at?: string | null; created_at?: string; error_code?: string | null; error_message?: string | null; failed_at?: string | null; heartbeat_at?: string | null; id?: string; idempotency_key: string; input?: Json; lease_expires_at?: string | null; max_attempts?: number; mode?: string; requested_by?: string | null; run_kind: string; scheduled_at: string; started_at?: string | null; status?: string; summary?: Json | null; system: string; trigger_source: string; updated_at?: string; worker_id?: string | null; workspace_id: string }
        Update: { attempt_count?: number; cancelled_at?: string | null; completed_at?: string | null; created_at?: string; error_code?: string | null; error_message?: string | null; failed_at?: string | null; heartbeat_at?: string | null; id?: string; idempotency_key?: string; input?: Json; lease_expires_at?: string | null; max_attempts?: number; mode?: string; requested_by?: string | null; run_kind?: string; scheduled_at?: string; started_at?: string | null; status?: string; summary?: Json | null; system?: string; trigger_source?: string; updated_at?: string; worker_id?: string | null; workspace_id?: string }
        Relationships: []
      }
      automation_tasks: {
        Row: { attempt_count: number; available_at: string; backoff_base_seconds: number; cancelled_at: string | null; claimed_at: string | null; completed_at: string | null; created_at: string; depends_on_task_id: string | null; error_code: string | null; error_message: string | null; failed_at: string | null; heartbeat_at: string | null; id: string; input: Json; lease_expires_at: string | null; max_attempts: number; output: Json | null; priority: number; run_id: string; scheduled_at: string; started_at: string | null; status: string; system: string; task_key: string; task_kind: string; updated_at: string; worker_id: string | null; workspace_id: string }
        Insert: { attempt_count?: number; available_at: string; backoff_base_seconds?: number; cancelled_at?: string | null; claimed_at?: string | null; completed_at?: string | null; created_at?: string; depends_on_task_id?: string | null; error_code?: string | null; error_message?: string | null; failed_at?: string | null; heartbeat_at?: string | null; id?: string; input?: Json; lease_expires_at?: string | null; max_attempts?: number; output?: Json | null; priority?: number; run_id: string; scheduled_at: string; started_at?: string | null; status?: string; system: string; task_key: string; task_kind: string; updated_at?: string; worker_id?: string | null; workspace_id: string }
        Update: { attempt_count?: number; available_at?: string; backoff_base_seconds?: number; cancelled_at?: string | null; claimed_at?: string | null; completed_at?: string | null; created_at?: string; depends_on_task_id?: string | null; error_code?: string | null; error_message?: string | null; failed_at?: string | null; heartbeat_at?: string | null; id?: string; input?: Json; lease_expires_at?: string | null; max_attempts?: number; output?: Json | null; priority?: number; run_id?: string; scheduled_at?: string; started_at?: string | null; status?: string; system?: string; task_key?: string; task_kind?: string; updated_at?: string; worker_id?: string | null; workspace_id?: string }
        Relationships: [
          { foreignKeyName: "automation_tasks_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
          { foreignKeyName: "automation_tasks_run_id_fkey"; columns: ["run_id"]; isOneToOne: false; referencedRelation: "automation_runs"; referencedColumns: ["id"] },
          { foreignKeyName: "automation_tasks_depends_on_task_id_fkey"; columns: ["depends_on_task_id"]; isOneToOne: false; referencedRelation: "automation_tasks"; referencedColumns: ["id"] },
        ]
      }
      backlink_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          edited_at: string | null
          id: string
          note_type: string
          opportunity_id: string
          supersedes_note_id: string | null
          visibility: string
          workspace_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          note_type: string
          opportunity_id: string
          supersedes_note_id?: string | null
          visibility?: string
          workspace_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          note_type?: string
          opportunity_id?: string
          supersedes_note_id?: string | null
          visibility?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_notes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "backlink_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_notes_supersedes_note_id_fkey"
            columns: ["supersedes_note_id"]
            isOneToOne: false
            referencedRelation: "backlink_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_opportunities: {
        Row: {
          archived_at: string | null
          asset_id: string
          assigned_to: string | null
          closed_at: string | null
          closed_reason: string | null
          convention_risk: boolean
          created_at: string
          created_by: string | null
          discovery_status: string
          domain_id: string
          editorial_angle: string | null
          editorial_status: string
          evidence_summary: string
          id: string
          last_reviewed_at: string | null
          lifecycle_status: string
          next_review_at: string | null
          opportunity_key: string
          opportunity_type: string
          page_type: string
          priority: string
          qualification_status: string
          target_page_title: string
          target_page_url: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          asset_id: string
          assigned_to?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          convention_risk?: boolean
          created_at?: string
          created_by?: string | null
          discovery_status?: string
          domain_id: string
          editorial_angle?: string | null
          editorial_status?: string
          evidence_summary: string
          id?: string
          last_reviewed_at?: string | null
          lifecycle_status?: string
          next_review_at?: string | null
          opportunity_key: string
          opportunity_type: string
          page_type: string
          priority?: string
          qualification_status?: string
          target_page_title: string
          target_page_url: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          asset_id?: string
          assigned_to?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          convention_risk?: boolean
          created_at?: string
          created_by?: string | null
          discovery_status?: string
          domain_id?: string
          editorial_angle?: string | null
          editorial_status?: string
          evidence_summary?: string
          id?: string
          last_reviewed_at?: string | null
          lifecycle_status?: string
          next_review_at?: string | null
          opportunity_key?: string
          opportunity_type?: string
          page_type?: string
          priority?: string
          qualification_status?: string
          target_page_title?: string
          target_page_url?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_opportunities_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "backlink_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_opportunities_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "backlink_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_opportunity_tags: {
        Row: {
          added_at: string
          added_by: string | null
          opportunity_id: string
          tag_id: string
          workspace_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          opportunity_id: string
          tag_id: string
          workspace_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          opportunity_id?: string
          tag_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_opportunity_tags_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "backlink_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_opportunity_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "backlink_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_opportunity_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_opportunity_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_opportunity_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_opportunity_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_opportunity_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_promotion_applications: {
        Row: {
          candidate_key: string
          domain_disposition: string
          domain_id: string
          id: string
          opportunity_disposition: string
          opportunity_id: string
          promoted_at: string
          promoted_by: string
          promotion_task_id: string
          proposal_key: string
          run_id: string
          source: string
          workspace_id: string
        }
        Insert: {
          candidate_key: string
          domain_disposition: string
          domain_id: string
          id?: string
          opportunity_disposition: string
          opportunity_id: string
          promoted_at?: string
          promoted_by: string
          promotion_task_id: string
          proposal_key: string
          run_id: string
          source?: string
          workspace_id: string
        }
        Update: {
          domain_disposition?: string
          opportunity_disposition?: string
          promoted_at?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_promotion_applications_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "backlink_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_promotion_applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "backlink_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_promotion_applications_promotion_task_id_fkey"
            columns: ["promotion_task_id"]
            isOneToOne: false
            referencedRelation: "automation_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_promotion_applications_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_promotion_applications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_discovery_intake_applications: {
        Row: { asset_id: string; candidate_key: string; created_at: string; discovery_task_id: string; id: string; opportunity_id: string; workspace_id: string }
        Insert: { asset_id: string; candidate_key: string; created_at?: string; discovery_task_id: string; id?: string; opportunity_id: string; workspace_id: string }
        Update: never
        Relationships: [
          { foreignKeyName: "backlink_discovery_intake_applications_asset_id_fkey"; columns: ["asset_id"]; isOneToOne: false; referencedRelation: "backlink_assets"; referencedColumns: ["id"] },
          { foreignKeyName: "backlink_discovery_intake_applications_discovery_task_id_fkey"; columns: ["discovery_task_id"]; isOneToOne: false; referencedRelation: "automation_tasks"; referencedColumns: ["id"] },
          { foreignKeyName: "backlink_discovery_intake_applications_opportunity_id_fkey"; columns: ["opportunity_id"]; isOneToOne: false; referencedRelation: "backlink_opportunities"; referencedColumns: ["id"] },
          { foreignKeyName: "backlink_discovery_intake_applications_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      backlink_outreach: {
        Row: {
          campaign_id: string
          body: string | null
          channel: string
          closed_at: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          current_attempt: number
          first_contact_at: string | null
          id: string
          last_attempt_at: string | null
          last_response_type: string | null
          max_attempts: number
          next_follow_up_at: string | null
          response_deadline_at: string | null
          success_link_id: string | null
          success_link_status: string | null
          success_source_url: string | null
          success_target_url: string | null
          success_verified_at: string | null
          opportunity_id: string
          outreach_key: string
          auto_send_approved_at: string | null
          auto_send_approved_by: string | null
          auto_send_approval_fingerprint: string | null
          auto_send_approved_recipient: string | null
          auto_send_approved_subject: string | null
          auto_send_approved_body: string | null
          auto_send_approved_channel: string | null
          auto_send_approved_target_url: string | null
          auto_send_approved_contact_id: string | null
          auto_send_approved_opportunity_id: string | null
          auto_send_approved_campaign_id: string | null
          status: string
          subject: string | null
          stop_reason: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          body?: string | null
          channel: string
          closed_at?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          current_attempt?: number
          first_contact_at?: string | null
          id?: string
          last_attempt_at?: string | null
          last_response_type?: string | null
          max_attempts?: number
          next_follow_up_at?: string | null
          response_deadline_at?: string | null
          success_link_id?: string | null
          success_link_status?: string | null
          success_source_url?: string | null
          success_target_url?: string | null
          success_verified_at?: string | null
          opportunity_id: string
          outreach_key: string
          auto_send_approved_at?: string | null
          auto_send_approved_by?: string | null
          auto_send_approval_fingerprint?: string | null
          auto_send_approved_recipient?: string | null
          auto_send_approved_subject?: string | null
          auto_send_approved_body?: string | null
          auto_send_approved_channel?: string | null
          auto_send_approved_target_url?: string | null
          auto_send_approved_contact_id?: string | null
          auto_send_approved_opportunity_id?: string | null
          auto_send_approved_campaign_id?: string | null
          status?: string
          subject?: string | null
          stop_reason?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          body?: string | null
          channel?: string
          closed_at?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          current_attempt?: number
          first_contact_at?: string | null
          id?: string
          last_attempt_at?: string | null
          last_response_type?: string | null
          max_attempts?: number
          next_follow_up_at?: string | null
          response_deadline_at?: string | null
          success_link_id?: string | null
          success_link_status?: string | null
          success_source_url?: string | null
          success_target_url?: string | null
          success_verified_at?: string | null
          opportunity_id?: string
          outreach_key?: string
          auto_send_approved_at?: string | null
          auto_send_approved_by?: string | null
          auto_send_approval_fingerprint?: string | null
          auto_send_approved_recipient?: string | null
          auto_send_approved_subject?: string | null
          auto_send_approved_body?: string | null
          auto_send_approved_channel?: string | null
          auto_send_approved_target_url?: string | null
          auto_send_approved_contact_id?: string | null
          auto_send_approved_opportunity_id?: string | null
          auto_send_approved_campaign_id?: string | null
          status?: string
          subject?: string | null
          stop_reason?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_outreach_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "backlink_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "backlink_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "backlink_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_outreach_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_outreach_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_outreach_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_outreach_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_success_link_id_fkey"
            columns: ["success_link_id"]
            isOneToOne: false
            referencedRelation: "backlink_links"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_outreach_attempts: {
        Row: {
          accepted_at: string | null
          actor_user_id: string
          attempt_kind: string
          cancel_reason: string | null
          cancelled_at: string | null
          channel: string
          created_at: string
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          idempotency_key: string
          outreach_id: string
          provider: string
          provider_message_id: string | null
          prepared_at: string | null
          reply_token_hash: string | null
          reply_token_key_version: string | null
          recipient: string
          requested_at: string
          resolved_at: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          actor_user_id: string
          attempt_kind: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          channel: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key: string
          outreach_id: string
          provider: string
          provider_message_id?: string | null
          prepared_at?: string | null
          reply_token_hash?: string | null
          reply_token_key_version?: string | null
          recipient: string
          requested_at?: string
          resolved_at?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          actor_user_id?: string
          attempt_kind?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          channel?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          outreach_id?: string
          provider?: string
          provider_message_id?: string | null
          prepared_at?: string | null
          reply_token_hash?: string | null
          reply_token_key_version?: string | null
          recipient?: string
          requested_at?: string
          resolved_at?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_outreach_attempts_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "backlink_outreach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_attempts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_linkedin_interactions: {
        Row: {
          actor_user_id: string
          contact_id: string
          content_fingerprint: string | null
          created_at: string
          evidence_reference: string | null
          id: string
          idempotency_key: string
          interaction_type: string
          occurred_at: string
          outreach_id: string
          provider_connection_id: string | null
          provider_external_id: string | null
          source: string
          supersedes_interaction_id: string | null
          target_profile_url: string
          workspace_id: string
        }
        Insert: {
          actor_user_id: string
          contact_id: string
          content_fingerprint?: string | null
          created_at?: string
          evidence_reference?: string | null
          id?: string
          idempotency_key: string
          interaction_type: string
          occurred_at: string
          outreach_id: string
          provider_connection_id?: string | null
          provider_external_id?: string | null
          source?: string
          supersedes_interaction_id?: string | null
          target_profile_url: string
          workspace_id: string
        }
        Update: {
          actor_user_id?: string
          contact_id?: string
          content_fingerprint?: string | null
          created_at?: string
          evidence_reference?: string | null
          id?: string
          idempotency_key?: string
          interaction_type?: string
          occurred_at?: string
          outreach_id?: string
          provider_connection_id?: string | null
          provider_external_id?: string | null
          source?: string
          supersedes_interaction_id?: string | null
          target_profile_url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_linkedin_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "backlink_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_linkedin_interactions_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "backlink_outreach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_linkedin_interactions_supersedes_interaction_id_fkey"
            columns: ["supersedes_interaction_id"]
            isOneToOne: false
            referencedRelation: "backlink_linkedin_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_linkedin_interactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_outreach_follow_up_drafts: {
        Row: { attempt_id: string; body: string; created_at: string; follow_up_number: number; id: string; outreach_id: string; prepared_at: string; subject: string; updated_at: string; updated_by: string; workspace_id: string }
        Insert: { attempt_id: string; body: string; created_at?: string; follow_up_number: number; id?: string; outreach_id: string; prepared_at: string; subject: string; updated_at: string; updated_by: string; workspace_id: string }
        Update: { attempt_id?: string; body?: string; created_at?: string; follow_up_number?: number; id?: string; outreach_id?: string; prepared_at?: string; subject?: string; updated_at?: string; updated_by?: string; workspace_id?: string }
        Relationships: [
          { foreignKeyName: "backlink_outreach_follow_up_drafts_attempt_id_fkey"; columns: ["attempt_id"]; isOneToOne: false; referencedRelation: "backlink_outreach_attempts"; referencedColumns: ["id"] },
          { foreignKeyName: "backlink_outreach_follow_up_drafts_outreach_id_fkey"; columns: ["outreach_id"]; isOneToOne: false; referencedRelation: "backlink_outreach"; referencedColumns: ["id"] },
          { foreignKeyName: "backlink_outreach_follow_up_drafts_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      backlink_outreach_attempt_lifecycle_effects: {
        Row: { applied_at: string; attempt_id: string; created_at: string; effect_kind: string; id: string; outreach_id: string; status: string; workspace_id: string }
        Insert: { applied_at: string; attempt_id: string; created_at?: string; effect_kind: string; id?: string; outreach_id: string; status: string; workspace_id: string }
        Update: { applied_at?: string; attempt_id?: string; created_at?: string; effect_kind?: string; id?: string; outreach_id?: string; status?: string; workspace_id?: string }
        Relationships: [
          { foreignKeyName: "backlink_outreach_attempt_lifecycle_effects_attempt_id_fkey"; columns: ["attempt_id"]; isOneToOne: false; referencedRelation: "backlink_outreach_attempts"; referencedColumns: ["id"] },
          { foreignKeyName: "backlink_outreach_attempt_lifecycle_effects_outreach_id_fkey"; columns: ["outreach_id"]; isOneToOne: false; referencedRelation: "backlink_outreach"; referencedColumns: ["id"] },
          { foreignKeyName: "backlink_outreach_attempt_lifecycle_effects_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      backlink_outreach_delivery_events: {
        Row: {
          attempt_id: string
          bounce_type: string | null
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          outreach_id: string
          provider: string
          provider_event_id: string
          provider_message_id: string
          received_at: string
          workspace_id: string
        }
        Insert: {
          attempt_id: string
          bounce_type?: string | null
          created_at?: string
          event_type: string
          id?: string
          occurred_at: string
          outreach_id: string
          provider: string
          provider_event_id: string
          provider_message_id: string
          received_at: string
          workspace_id: string
        }
        Update: {
          attempt_id?: string
          bounce_type?: string | null
          created_at?: string
          event_type?: string
          id?: string
          occurred_at?: string
          outreach_id?: string
          provider?: string
          provider_event_id?: string
          provider_message_id?: string
          received_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_outreach_delivery_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "backlink_outreach_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_delivery_events_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "backlink_outreach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_delivery_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_outreach_delivery_effects: {
        Row: {
          applied_at: string | null
          contact_id: string
          created_at: string
          delivery_event_id: string
          effect_kind: string
          id: string
          outreach_id: string
          status: string
          workspace_id: string
        }
        Insert: {
          applied_at?: string | null
          contact_id: string
          created_at?: string
          delivery_event_id: string
          effect_kind: string
          id?: string
          outreach_id: string
          status: string
          workspace_id: string
        }
        Update: {
          applied_at?: string | null
          contact_id?: string
          created_at?: string
          delivery_event_id?: string
          effect_kind?: string
          id?: string
          outreach_id?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_outreach_delivery_effects_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "backlink_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_delivery_effects_delivery_event_id_fkey"
            columns: ["delivery_event_id"]
            isOneToOne: false
            referencedRelation: "backlink_outreach_delivery_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_delivery_effects_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "backlink_outreach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_delivery_effects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_outreach_inbound_effects: {
        Row: {
          applied_at: string
          contact_id: string
          created_at: string
          effect_kind: string
          id: string
          inbound_message_id: string
          outreach_id: string
          status: string
          workspace_id: string
        }
        Insert: {
          applied_at: string
          contact_id: string
          created_at?: string
          effect_kind: string
          id?: string
          inbound_message_id: string
          outreach_id: string
          status: string
          workspace_id: string
        }
        Update: {
          applied_at?: string
          contact_id?: string
          created_at?: string
          effect_kind?: string
          id?: string
          inbound_message_id?: string
          outreach_id?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_outreach_inbound_effects_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "backlink_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_inbound_effects_inbound_message_id_fkey"
            columns: ["inbound_message_id"]
            isOneToOne: false
            referencedRelation: "backlink_outreach_inbound_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_inbound_effects_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "backlink_outreach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_inbound_effects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_outreach_inbound_reply_classifications: {
        Row: {
          classification: string
          classified_at: string
          classified_by: string
          contact_id: string
          created_at: string
          id: string
          inbound_message_id: string
          outreach_id: string
          workspace_id: string
        }
        Insert: {
          classification: string
          classified_at: string
          classified_by: string
          contact_id: string
          created_at?: string
          id?: string
          inbound_message_id: string
          outreach_id: string
          workspace_id: string
        }
        Update: {
          classification?: string
          classified_at?: string
          classified_by?: string
          contact_id?: string
          created_at?: string
          id?: string
          inbound_message_id?: string
          outreach_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_outreach_inbound_reply_classifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "backlink_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_inbound_reply_classifications_inbound_message_id_fkey"
            columns: ["inbound_message_id"]
            isOneToOne: false
            referencedRelation: "backlink_outreach_inbound_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_inbound_reply_classifications_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "backlink_outreach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_inbound_reply_classifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_outreach_inbound_messages: {
        Row: {
          attempt_id: string | null
          contact_id: string | null
          correlation_method: string | null
          correlation_status: string
          created_at: string
          id: string
          inbound_message_id: string
          in_reply_to: string | null
          occurred_at: string
          outreach_id: string | null
          provider: string
          provider_event_id: string
          received_at: string
          recipient: string
          references_header: string | null
          sender: string
          subject: string | null
          text_body: string | null
          workspace_id: string | null
        }
        Insert: {
          attempt_id?: string | null
          contact_id?: string | null
          correlation_method?: string | null
          correlation_status: string
          created_at?: string
          id?: string
          inbound_message_id: string
          in_reply_to?: string | null
          occurred_at: string
          outreach_id?: string | null
          provider: string
          provider_event_id: string
          received_at: string
          recipient: string
          references_header?: string | null
          sender: string
          subject?: string | null
          text_body?: string | null
          workspace_id?: string | null
        }
        Update: {
          attempt_id?: string | null
          contact_id?: string | null
          correlation_method?: string | null
          correlation_status?: string
          created_at?: string
          id?: string
          inbound_message_id?: string
          in_reply_to?: string | null
          occurred_at?: string
          outreach_id?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          recipient?: string
          references_header?: string | null
          sender?: string
          subject?: string | null
          text_body?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backlink_outreach_inbound_messages_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "backlink_outreach_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_inbound_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "backlink_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_inbound_messages_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "backlink_outreach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlink_outreach_inbound_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backlink_tags: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          tag_group: string | null
          tag_key: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          tag_group?: string | null
          tag_key: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          tag_group?: string | null
          tag_key?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "backlink_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmark_artifacts: {
        Row: {
          aggregation_policy_version: string
          aggregation_window: string
          approval_policy_version: string
          approval_status: string
          approved_for_audit: boolean
          approved_for_internal: boolean
          artifact_contract_version: string
          artifact_key: string | null
          benchmark_type: string
          capacity_band: string
          capacity_scope: string
          capture_period_bucket: string
          city: string
          cohort_definition_version: string
          cohort_policy_version: string
          confidence_level: string
          confidence_policy_version: string
          country: string
          created_at: string
          currency: string
          dominant_observed_days_band: string | null
          dominant_unavailability_rate_band: string | null
          excluded_outlier_count: number
          freshness_policy_version: string
          id: string
          included_sample_size: number
          intended_use: string
          limitations: string[]
          market_cell_key: string
          market_cell_policy_version: string
          median_price: number | null
          observed_days_1_6_count: number | null
          observed_days_14_29_count: number | null
          observed_days_30_59_count: number | null
          observed_days_60_plus_count: number | null
          observed_days_7_13_count: number | null
          outlier_policy_version: string
          p10_price: number | null
          p25_price: number | null
          p75_price: number | null
          p90_price: number | null
          platform: string
          platform_scope: string
          property_scope: string
          property_type: string
          raw_sample_size: number
          source_class_count: number
          source_diversity_band: string
          source_period_end: string
          source_period_start: string
          supersedes_artifact_id: string | null
          unavailability_0_19_count: number | null
          unavailability_20_39_count: number | null
          unavailability_40_59_count: number | null
          unavailability_60_79_count: number | null
          unavailability_80_100_count: number | null
          valid_from: string
          valid_until: string
        }
        Insert: {
          aggregation_policy_version: string
          aggregation_window?: string
          approval_policy_version: string
          approval_status: string
          approved_for_audit?: boolean
          approved_for_internal?: boolean
          artifact_contract_version: string
          artifact_key?: string | null
          benchmark_type: string
          capacity_band: string
          capacity_scope?: string
          capture_period_bucket: string
          city: string
          cohort_definition_version: string
          cohort_policy_version: string
          confidence_level: string
          confidence_policy_version: string
          country: string
          created_at?: string
          currency: string
          dominant_observed_days_band?: string | null
          dominant_unavailability_rate_band?: string | null
          excluded_outlier_count: number
          freshness_policy_version: string
          id?: string
          included_sample_size: number
          intended_use?: string
          limitations?: string[]
          market_cell_key: string
          market_cell_policy_version: string
          median_price?: number | null
          observed_days_1_6_count?: number | null
          observed_days_14_29_count?: number | null
          observed_days_30_59_count?: number | null
          observed_days_60_plus_count?: number | null
          observed_days_7_13_count?: number | null
          outlier_policy_version: string
          p10_price?: number | null
          p25_price?: number | null
          p75_price?: number | null
          p90_price?: number | null
          platform: string
          platform_scope?: string
          property_scope?: string
          property_type: string
          raw_sample_size: number
          source_class_count: number
          source_diversity_band: string
          source_period_end: string
          source_period_start: string
          supersedes_artifact_id?: string | null
          unavailability_0_19_count?: number | null
          unavailability_20_39_count?: number | null
          unavailability_40_59_count?: number | null
          unavailability_60_79_count?: number | null
          unavailability_80_100_count?: number | null
          valid_from: string
          valid_until: string
        }
        Update: {
          aggregation_policy_version?: string
          aggregation_window?: string
          approval_policy_version?: string
          approval_status?: string
          approved_for_audit?: boolean
          approved_for_internal?: boolean
          artifact_contract_version?: string
          artifact_key?: string | null
          benchmark_type?: string
          capacity_band?: string
          capacity_scope?: string
          capture_period_bucket?: string
          city?: string
          cohort_definition_version?: string
          cohort_policy_version?: string
          confidence_level?: string
          confidence_policy_version?: string
          country?: string
          created_at?: string
          currency?: string
          dominant_observed_days_band?: string | null
          dominant_unavailability_rate_band?: string | null
          excluded_outlier_count?: number
          freshness_policy_version?: string
          id?: string
          included_sample_size?: number
          intended_use?: string
          limitations?: string[]
          market_cell_key?: string
          market_cell_policy_version?: string
          median_price?: number | null
          observed_days_1_6_count?: number | null
          observed_days_14_29_count?: number | null
          observed_days_30_59_count?: number | null
          observed_days_60_plus_count?: number | null
          observed_days_7_13_count?: number | null
          outlier_policy_version?: string
          p10_price?: number | null
          p25_price?: number | null
          p75_price?: number | null
          p90_price?: number | null
          platform?: string
          platform_scope?: string
          property_scope?: string
          property_type?: string
          raw_sample_size?: number
          source_class_count?: number
          source_diversity_band?: string
          source_period_end?: string
          source_period_start?: string
          supersedes_artifact_id?: string | null
          unavailability_0_19_count?: number | null
          unavailability_20_39_count?: number | null
          unavailability_40_59_count?: number | null
          unavailability_60_79_count?: number | null
          unavailability_80_100_count?: number | null
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "benchmark_artifacts_supersedes_artifact_id_fkey"
            columns: ["supersedes_artifact_id"]
            isOneToOne: false
            referencedRelation: "benchmark_artifacts"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          stripe_customer_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          stripe_customer_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          stripe_customer_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          billing_reason: string | null
          created_at: string
          currency: string
          hosted_invoice_url: string | null
          id: string
          invoice_pdf: string | null
          metadata: Json
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          plan_code: string | null
          status: string
          stripe_customer_id: string | null
          stripe_invoice_id: string
          stripe_subscription_id: string | null
          subscription_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          billing_reason?: string | null
          created_at?: string
          currency?: string
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          metadata?: Json
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_code?: string | null
          status: string
          stripe_customer_id?: string | null
          stripe_invoice_id: string
          stripe_subscription_id?: string | null
          subscription_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          billing_reason?: string | null
          created_at?: string
          currency?: string
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          metadata?: Json
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_code?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_invoice_id?: string
          stripe_subscription_id?: string | null
          subscription_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount: number
          billing_reason: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          id: string
          metadata: Json
          paid_at: string | null
          payment_type: string
          period_end: string | null
          period_start: string | null
          plan_code: string | null
          product_code: string | null
          source: string
          status: string
          stripe_charge_id: string | null
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          subscription_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          billing_reason?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          metadata?: Json
          paid_at?: string | null
          payment_type: string
          period_end?: string | null
          period_start?: string | null
          plan_code?: string | null
          product_code?: string | null
          source: string
          status: string
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          subscription_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          billing_reason?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          metadata?: Json
          paid_at?: string | null
          payment_type?: string
          period_end?: string | null
          period_start?: string | null
          plan_code?: string | null
          product_code?: string | null
          source?: string
          status?: string
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          subscription_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_price_catalog: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          credits: number | null
          currency: string
          id: string
          payment_type: string
          plan_code: string | null
          product_code: string
        }
        Insert: {
          active?: boolean
          amount: number
          created_at?: string
          credits?: number | null
          currency?: string
          id?: string
          payment_type: string
          plan_code?: string | null
          product_code: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          credits?: number | null
          currency?: string
          id?: string
          payment_type?: string
          plan_code?: string | null
          product_code?: string
        }
        Relationships: []
      }
      billing_webhook_events: {
        Row: {
          error_message: string | null
          event_type: string
          id: string
          livemode: boolean
          payload: Json
          processed: boolean
          processed_at: string | null
          received_at: string
          stripe_event_id: string
        }
        Insert: {
          error_message?: string | null
          event_type: string
          id?: string
          livemode?: boolean
          payload: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          stripe_event_id: string
        }
        Update: {
          error_message?: string | null
          event_type?: string
          id?: string
          livemode?: boolean
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      checkout_intents: {
        Row: {
          completed_at: string | null
          created_at: string
          currency: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          plan_code: string
          price_id: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          plan_code: string
          price_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          plan_code?: string
          price_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_intents_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "checkout_intents_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "checkout_intents_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "checkout_intents_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "checkout_intents_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      intelligence_publishing_artifact_references: {
        Row: {
          artifact_fingerprint: string
          artifact_id: string
          artifact_type: string
          asset_key: string
          asset_version_key: string | null
          created_at: string
          id: string
          metadata: Json
          policy_versions: Json
          reference_key: string
          relationship_type: string
        }
        Insert: {
          artifact_fingerprint: string
          artifact_id: string
          artifact_type: string
          asset_key: string
          asset_version_key?: string | null
          created_at: string
          id?: string
          metadata?: Json
          policy_versions?: Json
          reference_key: string
          relationship_type: string
        }
        Update: {
          artifact_fingerprint?: string
          artifact_id?: string
          artifact_type?: string
          asset_key?: string
          asset_version_key?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          policy_versions?: Json
          reference_key?: string
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_publishing_artifact_references_asset_key_fkey"
            columns: ["asset_key"]
            isOneToOne: false
            referencedRelation: "intelligence_publishing_assets"
            referencedColumns: ["asset_key"]
          },
          {
            foreignKeyName: "intelligence_publishing_artifact_references_asset_version_fk"
            columns: ["asset_key", "asset_version_key"]
            isOneToOne: false
            referencedRelation: "intelligence_publishing_asset_versions"
            referencedColumns: ["asset_key", "asset_version_key"]
          },
        ]
      }
      intelligence_publishing_asset_versions: {
        Row: {
          approved_at: string | null
          asset_key: string
          asset_version_key: string
          confidence_band: string
          content_fingerprint: string
          created_at: string
          id: string
          metadata: Json
          policy_versions: Json
          published_at: string | null
          renderer_fingerprint: string
          source_fingerprint: string
          status: string
          superseded_at: string | null
          template_fingerprint: string
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          asset_key: string
          asset_version_key: string
          confidence_band: string
          content_fingerprint: string
          created_at: string
          id?: string
          metadata?: Json
          policy_versions?: Json
          published_at?: string | null
          renderer_fingerprint: string
          source_fingerprint: string
          status: string
          superseded_at?: string | null
          template_fingerprint: string
          version_number: number
        }
        Update: {
          approved_at?: string | null
          asset_key?: string
          asset_version_key?: string
          confidence_band?: string
          content_fingerprint?: string
          created_at?: string
          id?: string
          metadata?: Json
          policy_versions?: Json
          published_at?: string | null
          renderer_fingerprint?: string
          source_fingerprint?: string
          status?: string
          superseded_at?: string | null
          template_fingerprint?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_publishing_asset_versions_asset_key_fkey"
            columns: ["asset_key"]
            isOneToOne: false
            referencedRelation: "intelligence_publishing_assets"
            referencedColumns: ["asset_key"]
          },
        ]
      }
      intelligence_publishing_assets: {
        Row: {
          active_version_key: string | null
          asset_key: string
          asset_type: string
          available_channels: string[]
          available_locales: string[]
          canonical_id: string
          confidence_affects_visible_content: boolean
          created_at: string
          default_locale: string
          freshness_expiry_behavior: string
          id: string
          metadata: Json
          owner_team: string
          policy_change_affects_visible_content: boolean
          status: string
          template_id: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          active_version_key?: string | null
          asset_key: string
          asset_type: string
          available_channels?: string[]
          available_locales?: string[]
          canonical_id: string
          confidence_affects_visible_content?: boolean
          created_at?: string
          default_locale: string
          freshness_expiry_behavior: string
          id?: string
          metadata?: Json
          owner_team: string
          policy_change_affects_visible_content?: boolean
          status: string
          template_id?: string | null
          updated_at?: string
          visibility: string
        }
        Update: {
          active_version_key?: string | null
          asset_key?: string
          asset_type?: string
          available_channels?: string[]
          available_locales?: string[]
          canonical_id?: string
          confidence_affects_visible_content?: boolean
          created_at?: string
          default_locale?: string
          freshness_expiry_behavior?: string
          id?: string
          metadata?: Json
          owner_team?: string
          policy_change_affects_visible_content?: boolean
          status?: string
          template_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_publishing_assets_active_version_fk"
            columns: ["asset_key", "active_version_key"]
            isOneToOne: false
            referencedRelation: "intelligence_publishing_asset_versions"
            referencedColumns: ["asset_key", "asset_version_key"]
          },
        ]
      }
      intelligence_publishing_channel_variants: {
        Row: {
          asset_key: string
          asset_version_key: string
          channel: string
          content_fingerprint: string
          destination_key: string | null
          id: string
          locale: string
          metadata: Json
          published_at: string | null
          status: string
          updated_at: string
          variant_key: string
        }
        Insert: {
          asset_key: string
          asset_version_key: string
          channel: string
          content_fingerprint: string
          destination_key?: string | null
          id?: string
          locale: string
          metadata?: Json
          published_at?: string | null
          status: string
          updated_at?: string
          variant_key: string
        }
        Update: {
          asset_key?: string
          asset_version_key?: string
          channel?: string
          content_fingerprint?: string
          destination_key?: string | null
          id?: string
          locale?: string
          metadata?: Json
          published_at?: string | null
          status?: string
          updated_at?: string
          variant_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_publishing_channel_variants_asset_key_fkey"
            columns: ["asset_key"]
            isOneToOne: false
            referencedRelation: "intelligence_publishing_assets"
            referencedColumns: ["asset_key"]
          },
          {
            foreignKeyName: "intelligence_publishing_channel_variants_asset_version_fk"
            columns: ["asset_key", "asset_version_key"]
            isOneToOne: false
            referencedRelation: "intelligence_publishing_asset_versions"
            referencedColumns: ["asset_key", "asset_version_key"]
          },
        ]
      }
      intelligence_publishing_freshness_states: {
        Row: {
          asset_key: string
          asset_version_key: string | null
          computed_at: string
          evaluated_at: string
          expired_after: string | null
          freshness_key: string
          id: string
          is_expired: boolean
          is_publishable: boolean
          is_stale: boolean
          publishable_until: string | null
          review_due_at: string | null
          stale_after: string | null
        }
        Insert: {
          asset_key: string
          asset_version_key?: string | null
          computed_at: string
          evaluated_at: string
          expired_after?: string | null
          freshness_key: string
          id?: string
          is_expired: boolean
          is_publishable: boolean
          is_stale: boolean
          publishable_until?: string | null
          review_due_at?: string | null
          stale_after?: string | null
        }
        Update: {
          asset_key?: string
          asset_version_key?: string | null
          computed_at?: string
          evaluated_at?: string
          expired_after?: string | null
          freshness_key?: string
          id?: string
          is_expired?: boolean
          is_publishable?: boolean
          is_stale?: boolean
          publishable_until?: string | null
          review_due_at?: string | null
          stale_after?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_publishing_freshness_states_asset_key_fkey"
            columns: ["asset_key"]
            isOneToOne: false
            referencedRelation: "intelligence_publishing_assets"
            referencedColumns: ["asset_key"]
          },
          {
            foreignKeyName: "intelligence_publishing_freshness_states_asset_version_fk"
            columns: ["asset_key", "asset_version_key"]
            isOneToOne: false
            referencedRelation: "intelligence_publishing_asset_versions"
            referencedColumns: ["asset_key", "asset_version_key"]
          },
        ]
      }
      intelligence_publishing_publication_states: {
        Row: {
          asset_key: string
          asset_version_key: string
          channel: string
          created_at: string
          destination_key: string | null
          id: string
          locale: string
          metadata: Json
          publication_fingerprint: string | null
          publication_key: string
          publication_status: string
          published_at: string | null
          suppressed_at: string | null
          updated_at: string
        }
        Insert: {
          asset_key: string
          asset_version_key: string
          channel: string
          created_at?: string
          destination_key?: string | null
          id?: string
          locale: string
          metadata?: Json
          publication_fingerprint?: string | null
          publication_key: string
          publication_status: string
          published_at?: string | null
          suppressed_at?: string | null
          updated_at?: string
        }
        Update: {
          asset_key?: string
          asset_version_key?: string
          channel?: string
          created_at?: string
          destination_key?: string | null
          id?: string
          locale?: string
          metadata?: Json
          publication_fingerprint?: string | null
          publication_key?: string
          publication_status?: string
          published_at?: string | null
          suppressed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_publishing_publication_states_asset_key_fkey"
            columns: ["asset_key"]
            isOneToOne: false
            referencedRelation: "intelligence_publishing_assets"
            referencedColumns: ["asset_key"]
          },
          {
            foreignKeyName: "intelligence_publishing_publication_states_asset_version_fk"
            columns: ["asset_key", "asset_version_key"]
            isOneToOne: false
            referencedRelation: "intelligence_publishing_asset_versions"
            referencedColumns: ["asset_key", "asset_version_key"]
          },
        ]
      }
      intelligence_publishing_registry_snapshots: {
        Row: {
          asset_count: number
          created_at: string
          fencing_token: number
          generated_at: string
          id: string
          idempotency_key: string
          metadata: Json
          policy_versions: Json
          request_fingerprint: string
          snapshot_fingerprint: string
          snapshot_key: string
          snapshot_payload: Json
          snapshot_version: number
        }
        Insert: {
          asset_count: number
          created_at?: string
          fencing_token: number
          generated_at: string
          id?: string
          idempotency_key: string
          metadata?: Json
          policy_versions?: Json
          request_fingerprint: string
          snapshot_fingerprint: string
          snapshot_key: string
          snapshot_payload: Json
          snapshot_version: number
        }
        Update: {
          asset_count?: number
          created_at?: string
          fencing_token?: number
          generated_at?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          policy_versions?: Json
          request_fingerprint?: string
          snapshot_fingerprint?: string
          snapshot_key?: string
          snapshot_payload?: Json
          snapshot_version?: number
        }
        Relationships: []
      }
      listings: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string
          currency: string | null
          deleted_at: string | null
          id: string
          market_city_override: string | null
          market_country_override: string | null
          price: number | null
          rating: number | null
          raw_payload: Json | null
          reviews_count: number | null
          source_platform: string | null
          source_url: string | null
          title: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by: string
          currency?: string | null
          deleted_at?: string | null
          id?: string
          market_city_override?: string | null
          market_country_override?: string | null
          price?: number | null
          rating?: number | null
          raw_payload?: Json | null
          reviews_count?: number | null
          source_platform?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string
          currency?: string | null
          deleted_at?: string | null
          id?: string
          market_city_override?: string | null
          market_country_override?: string | null
          price?: number | null
          rating?: number | null
          raw_payload?: Json | null
          reviews_count?: number | null
          source_platform?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "listings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "listings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "listings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "listings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      market_comparables: {
        Row: {
          check_in: string | null
          check_out: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nightly_price: number | null
          nights: number | null
          normalized_signature: string | null
          platform: string
          property_type: string | null
          rating: number | null
          raw: Json
          review_count: number | null
          snapshot_id: string
          title: string | null
          total_price: number | null
          url: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nightly_price?: number | null
          nights?: number | null
          normalized_signature?: string | null
          platform?: string
          property_type?: string | null
          rating?: number | null
          raw?: Json
          review_count?: number | null
          snapshot_id: string
          title?: string | null
          total_price?: number | null
          url?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nightly_price?: number | null
          nights?: number | null
          normalized_signature?: string | null
          platform?: string
          property_type?: string | null
          rating?: number | null
          raw?: Json
          review_count?: number | null
          snapshot_id?: string
          title?: string | null
          total_price?: number | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_comparables_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "market_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      market_snapshots: {
        Row: {
          check_in: string | null
          check_out: string | null
          city: string | null
          comparable_count: number
          confidence_score: number | null
          country: string | null
          created_at: string
          id: string
          metadata: Json
          nights: number | null
          platform: string
          property_type: string | null
          query_signature: string | null
          source_url: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          city?: string | null
          comparable_count?: number
          confidence_score?: number | null
          country?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          nights?: number | null
          platform?: string
          property_type?: string | null
          query_signature?: string | null
          source_url?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          city?: string | null
          comparable_count?: number
          confidence_score?: number | null
          country?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          nights?: number | null
          platform?: string
          property_type?: string | null
          query_signature?: string | null
          source_url?: string | null
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          channels: string[]
          created_at: string
          created_by: string | null
          creative_json: Json | null
          id: string
          language: string
          name: string | null
          objective: string
          planner_json: Json | null
          raw_result: Json | null
          social_json: Json | null
          status: string
          timeframe: string
          updated_at: string
          video_json: Json | null
          workspace_id: string
        }
        Insert: {
          channels?: string[]
          created_at?: string
          created_by?: string | null
          creative_json?: Json | null
          id?: string
          language?: string
          name?: string | null
          objective: string
          planner_json?: Json | null
          raw_result?: Json | null
          social_json?: Json | null
          status?: string
          timeframe?: string
          updated_at?: string
          video_json?: Json | null
          workspace_id: string
        }
        Update: {
          channels?: string[]
          created_at?: string
          created_by?: string | null
          creative_json?: Json | null
          id?: string
          language?: string
          name?: string | null
          objective?: string
          planner_json?: Json | null
          raw_result?: Json | null
          social_json?: Json | null
          status?: string
          timeframe?: string
          updated_at?: string
          video_json?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "marketing_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "marketing_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "marketing_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "marketing_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_studio_generation_runs: {
        Row: {
          campaign_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          failed_at: string | null
          heartbeat_at: string | null
          id: string
          input_json: Json
          request_id: string
          started_at: string | null
          status: string
          submission_key: string
          updated_at: string
          worker_id: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          failed_at?: string | null
          heartbeat_at?: string | null
          id?: string
          input_json: Json
          request_id: string
          started_at?: string | null
          status: string
          submission_key: string
          updated_at?: string
          worker_id?: string | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          failed_at?: string | null
          heartbeat_at?: string | null
          id?: string
          input_json?: Json
          request_id?: string
          started_at?: string | null
          status?: string
          submission_key?: string
          updated_at?: string
          worker_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_studio_generation_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_studio_generation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "marketing_studio_generation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "marketing_studio_generation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "marketing_studio_generation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "marketing_studio_generation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_studio_linkedin_connections: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          granted_scopes: string[]
          last_connected_by_email: string | null
          last_connected_by_user_id: string | null
          organization_id: string | null
          organization_urn: string | null
          provider: string
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          granted_scopes?: string[]
          last_connected_by_email?: string | null
          last_connected_by_user_id?: string | null
          organization_id?: string | null
          organization_urn?: string | null
          provider: string
          status: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          granted_scopes?: string[]
          last_connected_by_email?: string | null
          last_connected_by_user_id?: string | null
          organization_id?: string | null
          organization_urn?: string | null
          provider?: string
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_studio_linkedin_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_studio_meta_connections: {
        Row: {
          facebook_page_access_token: string | null
          facebook_page_id: string | null
          facebook_page_name: string | null
          facebook_page_token_obtained_at: string | null
          granted_scopes: string[]
          instagram_business_account_id: string | null
          instagram_username: string | null
          last_connected_by_email: string | null
          last_connected_by_user_id: string | null
          provider: string
          raw_pages_snapshot: Json
          status: string
          updated_at: string
        }
        Insert: {
          facebook_page_access_token?: string | null
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          facebook_page_token_obtained_at?: string | null
          granted_scopes?: string[]
          instagram_business_account_id?: string | null
          instagram_username?: string | null
          last_connected_by_email?: string | null
          last_connected_by_user_id?: string | null
          provider: string
          raw_pages_snapshot?: Json
          status: string
          updated_at?: string
        }
        Update: {
          facebook_page_access_token?: string | null
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          facebook_page_token_obtained_at?: string | null
          granted_scopes?: string[]
          instagram_business_account_id?: string | null
          instagram_username?: string | null
          last_connected_by_email?: string | null
          last_connected_by_user_id?: string | null
          provider?: string
          raw_pages_snapshot?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_studio_tiktok_connections: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          granted_scopes: string[]
          id: number
          last_connected_by_email: string | null
          last_connected_by_user_id: string | null
          open_id: string | null
          provider: string
          refresh_expires_at: string | null
          refresh_token: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          granted_scopes?: string[]
          id?: number
          last_connected_by_email?: string | null
          last_connected_by_user_id?: string | null
          open_id?: string | null
          provider: string
          refresh_expires_at?: string | null
          refresh_token?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          granted_scopes?: string[]
          id?: number
          last_connected_by_email?: string | null
          last_connected_by_user_id?: string | null
          open_id?: string | null
          provider?: string
          refresh_expires_at?: string | null
          refresh_token?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          id: string
          plan_code: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_code?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_code?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string
          metadata: Json | null
          quantity: number | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          metadata?: Json | null
          quantity?: number | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          metadata?: Json | null
          quantity?: number | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "usage_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "usage_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "usage_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "usage_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string | null
          id: string
          name: string
          owner_user_id: string
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          owner_user_id: string
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          owner_user_id?: string
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      monthly_revenue_summary: {
        Row: {
          month_key: string | null
          month_start: string | null
          payments_count: number | null
          plan_code: string | null
          revenue: number | null
        }
        Relationships: []
      }
      plan_catalog_view: {
        Row: {
          amount: number | null
          credits: number | null
          payment_type: string | null
          plan_code: string | null
        }
        Relationships: []
      }
      revenue_kpi_summary: {
        Row: {
          avg_payment: number | null
          paying_workspaces: number | null
          payments_30d: number | null
          payments_7d: number | null
          payments_90d: number | null
          revenue_30d: number | null
          revenue_7d: number | null
          revenue_90d: number | null
        }
        Relationships: []
      }
      top_workspaces_by_revenue: {
        Row: {
          last_payment_at: string | null
          payments_count: number | null
          total_revenue: number | null
          workspace_id: string | null
          workspace_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_plan_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_product_activity_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_summary"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_revenue_with_status"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_plan_summary: {
        Row: {
          audits_count: number | null
          plan_code: string | null
          status: string | null
          workspace_id: string | null
          workspace_name: string | null
        }
        Relationships: []
      }
      workspace_product_activity_summary: {
        Row: {
          audits_count: number | null
          last_activity_at: string | null
          plan_code: string | null
          subscription_status: string | null
          usage_events_count: number | null
          workspace_id: string | null
          workspace_name: string | null
        }
        Relationships: []
      }
      workspace_revenue_summary: {
        Row: {
          audits_count: number | null
          last_payment_at: string | null
          payments_count: number | null
          plan_code: string | null
          revenue_30d: number | null
          revenue_7d: number | null
          revenue_90d: number | null
          subscription_status: string | null
          total_revenue: number | null
          workspace_id: string | null
          workspace_name: string | null
        }
        Relationships: []
      }
      workspace_revenue_with_status: {
        Row: {
          audits_count: number | null
          billing_status: string | null
          last_payment_at: string | null
          payments_count: number | null
          plan_code: string | null
          revenue_30d: number | null
          revenue_7d: number | null
          revenue_90d: number | null
          subscription_status: string | null
          total_revenue: number | null
          workspace_id: string | null
          workspace_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_backlink_promotion_proposal: {
        Args: {
          p_actor_user_id: string
          p_asset_id: string
          p_candidate_key: string
          p_evidence_summary: string
          p_hostname: string
          p_opportunity_type: string
          p_page_type: string
          p_priority: string
          p_promotion_policy_version: string
          p_promotion_task_id: string
          p_proposal_key: string
          p_qualification_confidence: string
          p_qualification_score: number
          p_run_id: string
          p_target_page_title: string
          p_target_page_url: string
          p_workspace_id: string
        }
        Returns: {
          application_id: string
          audit_written: boolean
          domain_disposition: string
          domain_id: string
          opportunity_disposition: string
          opportunity_id: string
        }[]
      }
      reserve_backlink_key: {
        Args: {
          p_kind: string
        }
        Returns: string
      }
      reserve_backlink_outreach_initial_attempt: {
        Args: {
          p_actor_user_id: string
          p_attempt_id: string
          p_idempotency_key: string
          p_outreach_id: string
          p_requested_at: string
          p_reply_token_hash: string
          p_reply_token_key_version: string
          p_workspace_id: string
        }
        Returns: {
          attempt_id: string | null
          disposition: string
          rate_limit_reason: string | null
        }[]
      }
      reserve_backlink_approved_initial_attempt_v2: {
        Args: {
          p_actor_user_id: string
          p_attempt_id: string
          p_campaign_id: string
          p_idempotency_key: string
          p_outreach_id: string
          p_requested_at: string
          p_reply_token_hash: string
          p_reply_token_key_version: string
          p_workspace_id: string
        }
        Returns: {
          attempt_id: string | null
          disposition: string
          rate_limit_reason: string | null
        }[]
      }
      reserve_backlink_outreach_key: {
        Args: { p_workspace_id: string }
        Returns: string
      }
      record_backlink_manual_linkedin_interaction: {
        Args: {
          p_actor_user_id: string
          p_idempotency_key: string
          p_interaction_type: string
          p_outreach_id: string
          p_workspace_id: string
        }
        Returns: {
          attempt_id: string | null
          disposition: string
          interaction_id: string
          occurred_at: string
        }[]
      }
      record_backlink_manual_linkedin_message_sent: {
        Args: {
          p_actor_user_id: string
          p_idempotency_key: string
          p_outreach_id: string
          p_workspace_id: string
        }
        Returns: {
          attempt_id: string | null
          disposition: string
          interaction_id: string
          occurred_at: string
        }[]
      }
      apply_backlink_outreach_follow_up_accepted: {
        Args: {
          p_accepted_at: string
          p_attempt_id: string
          p_outreach_id: string
          p_provider_message_id: string | null
          p_workspace_id: string
        }
        Returns: {
          attempt_status: string
          current_attempt: number
          disposition: string
          last_attempt_at: string | null
          outreach_status: string
        }[]
      }
      mark_backlink_outreach_follow_up_attempt_requested: {
        Args: {
          p_actor_user_id: string
          p_attempt_id: string
          p_outreach_id: string
          p_requested_at: string
          p_workspace_id: string
        }
        Returns: {
          attempt_id: string
          body: string
          disposition: string
          outreach_id: string
          recipient: string
          reply_token_hash: string
          reply_token_key_version: string
          requested_at: string
          subject: string
        }[]
      }
      reconcile_backlink_outreach_follow_up_schedule: {
        Args: {
          p_expected_current_attempt: number
          p_expected_last_attempt_at: string
          p_outreach_id: string
          p_schedule_kind: string
          p_scheduled_at: string
          p_workspace_id: string
        }
        Returns: {
          disposition: string
          next_follow_up_at: string | null
          response_deadline_at: string | null
          schedule_kind: string
          scheduled_at: string
        }[]
      }
      list_backlink_outreach_due_follow_ups: {
        Args: {
          p_limit?: number
          p_now: string
          p_workspace_id: string
        }
        Returns: {
          current_attempt: number
          latest_attempt_id: string
          latest_attempt_status: string
          max_attempts: number
          next_follow_up_at: string
          outreach_id: string
        }[]
      }
      list_backlink_outreach_expired_response_deadlines: {
        Args: {
          p_limit?: number
          p_now: string
          p_workspace_id: string
        }
        Returns: {
          current_attempt: number
          latest_attempt_id: string
          latest_attempt_status: string
          max_attempts: number
          outreach_id: string
          response_deadline_at: string
        }[]
      }
      apply_backlink_outreach_final_no_response: {
        Args: {
          p_applied_at: string
          p_outreach_id: string
          p_workspace_id: string
        }
        Returns: {
          closed_at: string
          disposition: string
          next_follow_up_at: string | null
          outreach_id: string
          outreach_status: string
          response_deadline_at: string | null
          stop_reason: string
        }[]
      }
      reserve_backlink_outreach_follow_up_attempt: {
        Args: {
          p_actor_user_id: string
          p_attempt_id: string
          p_idempotency_key: string
          p_outreach_id: string
          p_reply_token_hash: string
          p_reply_token_key_version: string
          p_reserved_at: string
          p_workspace_id: string
        }
        Returns: {
          attempt_id: string
          attempt_kind: string
          attempt_status: string
          disposition: string
          outreach_id: string
          prepared_at: string | null
          requested_at: string | null
        }[]
      }
      cancel_backlink_outreach_prepared_follow_up_attempt: {
        Args: {
          p_attempt_id: string
          p_cancel_reason: string
          p_cancelled_at: string
          p_outreach_id: string
          p_workspace_id: string
        }
        Returns: {
          attempt_id: string
          attempt_status: string
          cancel_reason: string
          cancelled_at: string
          disposition: string
          outreach_id: string
        }[]
      }
      prepare_backlink_outreach_follow_up_draft: {
        Args: { p_actor_user_id: string; p_attempt_id: string; p_body: string; p_outreach_id: string; p_prepared_at: string; p_subject: string; p_workspace_id: string }
        Returns: { attempt_id: string; body: string; disposition: string; draft_id: string; follow_up_number: number; outreach_id: string; prepared_at: string; subject: string; updated_at: string; updated_by: string }[]
      }
      update_backlink_outreach_follow_up_draft: {
        Args: { p_actor_user_id: string; p_attempt_id: string; p_body: string; p_expected_updated_at: string; p_outreach_id: string; p_subject: string; p_updated_at: string; p_workspace_id: string }
        Returns: { attempt_id: string; body: string; draft_id: string; follow_up_number: number; outreach_id: string; prepared_at: string; subject: string; updated_at: string; updated_by: string }[]
      }
      apply_backlink_outreach_provider_complaint: {
        Args: { p_applied_at?: string; p_delivery_event_id: string }
        Returns: {
          applied_at: string
          contact_id: string
          contact_status: string
          delivery_event_id: string
          disposition: string
          outreach_id: string
          outreach_status: string
        }[]
      }
      apply_backlink_outreach_provider_permanent_bounce: {
        Args: { p_applied_at?: string; p_delivery_event_id: string }
        Returns: {
          applied_at: string
          contact_id: string
          contact_status: string
          delivery_event_id: string
          disposition: string
          outreach_id: string
          outreach_status: string
        }[]
      }
      apply_backlink_outreach_inbound_reply_stop: {
        Args: { p_applied_at: string; p_inbound_message_id: string }
        Returns: {
          applied_at: string
          contact_id: string
          disposition: string
          inbound_message_id: string
          outreach_id: string
          outreach_status: string
        }[]
      }
      classify_backlink_outreach_inbound_reply: {
        Args: {
          p_classification: string
          p_classified_at: string
          p_classified_by: string
          p_inbound_message_id: string
        }
        Returns: {
          classification: string
          classified_at: string
          contact_id: string
          disposition: string
          inbound_message_id: string
          outreach_id: string
          outreach_status: string
        }[]
      }
      resolve_backlink_domain_opportunity: {
        Args: {
          p_asset_id: string
          p_evidence_summary: string
          p_hostname: string
          p_opportunity_type: string
          p_page_type: string
          p_target_page_title: string
          p_target_page_url: string
          p_workspace_id: string
        }
        Returns: {
          domain_disposition: string
          domain_id: string
          domain_key: string
          opportunity_disposition: string
          opportunity_id: string
          opportunity_key: string
          qualification_status: string
        }[]
      }
      record_backlink_discovery_intake_application: {
        Args: { p_asset_id: string; p_candidate_key: string; p_discovery_task_id: string; p_opportunity_id: string; p_workspace_id: string }
        Returns: { application_id: string; opportunity_id: string }[]
      }
      cancel_automation_task: { Args: { p_cancelled_at: string; p_task_id: string; p_worker_id: string; p_workspace_id: string }; Returns: Database["public"]["Tables"]["automation_tasks"]["Row"][] }
      cancel_automation_run: {
        Args: { p_cancelled_at: string; p_reason: string | null; p_run_id: string; p_workspace_id: string }
        Returns: Database["public"]["Tables"]["automation_runs"]["Row"][]
      }
      acquire_backlink_outreach_schedule_apply_lock: {
        Args: {
          p_acquired_at: string
          p_holder_id: string
          p_lease_duration_seconds: number
          p_lock_key: string
        }
        Returns: Database["public"]["Tables"]["backlink_outreach_schedule_apply_locks"]["Row"][]
      }
      release_backlink_outreach_schedule_apply_lock: {
        Args: { p_holder_id: string; p_lock_key: string; p_released_at: string }
        Returns: Database["public"]["Tables"]["backlink_outreach_schedule_apply_locks"]["Row"][]
      }
      claim_backlink_verification_job_by_id: {
        Args: { p_workspace_id: string; p_job_id: string; p_worker_id: string; p_claimed_at: string; p_lease_duration_seconds: number }
        Returns: Database["public"]["Tables"]["backlink_verification_jobs"]["Row"][]
      }
      claim_next_backlink_verification_job: {
        Args: { p_workspace_id: string; p_worker_id: string; p_claimed_at: string; p_lease_duration_seconds: number }
        Returns: Database["public"]["Tables"]["backlink_verification_jobs"]["Row"][]
      }
      claim_next_automation_task: { Args: { p_claimed_at: string; p_lease_duration_seconds: number; p_run_id: string; p_worker_id: string; p_workspace_id: string }; Returns: Database["public"]["Tables"]["automation_tasks"]["Row"][] }
      heartbeat_backlink_verification_job: {
        Args: { p_heartbeat_at: string; p_job_id: string; p_lease_duration_seconds: number; p_worker_id: string }
        Returns: Database["public"]["Tables"]["backlink_verification_jobs"]["Row"][]
      }
      reclaim_expired_backlink_verification_jobs: {
        Args: { p_workspace_id: string; p_reclaimed_at: string; p_limit: number; p_job_id?: string | null }
        Returns: Database["public"]["Tables"]["backlink_verification_jobs"]["Row"][]
      }
      complete_backlink_verification_job: {
        Args: { p_completed_at: string; p_job_id: string; p_result_summary: Json; p_worker_id: string }
        Returns: Database["public"]["Tables"]["backlink_verification_jobs"]["Row"][]
      }
      complete_automation_run: {
        Args: { p_completed_at: string; p_run_id: string; p_summary: Json | null; p_workspace_id: string }
        Returns: Database["public"]["Tables"]["automation_runs"]["Row"][]
      }
      complete_automation_task: { Args: { p_completed_at: string; p_output: Json | null; p_task_id: string; p_worker_id: string; p_workspace_id: string }; Returns: Database["public"]["Tables"]["automation_tasks"]["Row"][] }
      fail_backlink_verification_job: {
        Args: { p_error_code: string; p_error_message: string; p_failed_at: string; p_job_id: string; p_worker_id: string }
        Returns: Database["public"]["Tables"]["backlink_verification_jobs"]["Row"][]
      }
      fail_automation_run: {
        Args: { p_error_code: string; p_error_message: string; p_failed_at: string; p_run_id: string; p_workspace_id: string }
        Returns: Database["public"]["Tables"]["automation_runs"]["Row"][]
      }
      fail_automation_task: { Args: { p_error_code: string; p_error_message: string; p_failed_at: string; p_task_id: string; p_worker_id: string; p_workspace_id: string }; Returns: Database["public"]["Tables"]["automation_tasks"]["Row"][] }
      heartbeat_automation_task: { Args: { p_heartbeat_at: string; p_lease_duration_seconds: number; p_task_id: string; p_worker_id: string; p_workspace_id: string }; Returns: Database["public"]["Tables"]["automation_tasks"]["Row"][] }
      reclaim_expired_automation_tasks: { Args: { p_limit: number; p_reclaimed_at: string; p_run_id: string; p_workspace_id: string }; Returns: Database["public"]["Tables"]["automation_tasks"]["Row"][] }
      start_automation_run: {
        Args: { p_run_id: string; p_started_at: string; p_workspace_id: string }
        Returns: Database["public"]["Tables"]["automation_runs"]["Row"][]
      }
      can_create_audit: {
        Args: { p_workspace_id: string }
        Returns: {
          allowed: boolean
          current_count: number
          limit_count: number
          plan_code: string
          reason: string
        }[]
      }
      claim_marketing_studio_generation_run: {
        Args: { p_worker_id: string }
        Returns: {
          campaign_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          failed_at: string | null
          heartbeat_at: string | null
          id: string
          input_json: Json
          request_id: string
          started_at: string | null
          status: string
          submission_key: string
          updated_at: string
          worker_id: string | null
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "marketing_studio_generation_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enqueue_marketing_studio_generation_run: {
        Args: {
          p_channels: string[]
          p_created_by: string
          p_input_json: Json
          p_language: string
          p_name: string
          p_objective: string
          p_request_id: string
          p_submission_key: string
          p_timeframe: string
          p_workspace_id: string
        }
        Returns: {
          campaign_id: string
          run_id: string
          status: string
          was_created: boolean
        }[]
      }
      finalize_audit_entitlement: {
        Args: {
          p_audit_id: string
          p_listing_id: string
          p_operation_key: string
          p_source_url?: string
          p_usage_source?: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: {
          operation_key: string
          reason_code: string
          reservation_id: string
          source: string
          status: string
        }[]
      }
      has_pending_workspace_invitation: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      heartbeat_marketing_studio_generation_run: {
        Args: { p_run_id: string; p_worker_id: string }
        Returns: boolean
      }
      is_workspace_admin_or_owner: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: { Args: { p_workspace: string }; Returns: boolean }
      release_audit_entitlement: {
        Args: {
          p_failure_code?: string
          p_operation_key: string
          p_workspace_id: string
        }
        Returns: {
          operation_key: string
          reason_code: string
          reservation_id: string
          source: string
          status: string
        }[]
      }
      reserve_audit_entitlement: {
        Args: {
          p_billing_admin_bypass?: boolean
          p_enforce_free_plan_limit?: boolean
          p_operation_key: string
          p_quantity?: number
          p_target_kind: string
          p_target_ref: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: {
          operation_key: string
          reason_code: string
          reservation_id: string
          source: string
          status: string
        }[]
      }
      write_intelligence_publishing_registry_snapshot: {
        Args: { p_snapshot: Json; p_write_options?: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
