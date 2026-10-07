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
    PostgrestVersion: "14.5"
  }
  catalogue: {
    Tables: {
      brand_aliases: {
        Row: {
          alias: string
          alias_key: string
          brand_id: number
          created_at: string
        }
        Insert: {
          alias: string
          alias_key: string
          brand_id: number
          created_at?: string
        }
        Update: {
          alias?: string
          alias_key?: string
          brand_id?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_aliases_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          id: number
          is_system: boolean
          kind: Database["catalogue"]["Enums"]["brand_kind"]
          name: string
          name_key: string | null
          parent_brand_id: number | null
          tecdoc_id: number | null
        }
        Insert: {
          created_at?: string
          id?: never
          is_system?: boolean
          kind?: Database["catalogue"]["Enums"]["brand_kind"]
          name: string
          name_key?: string | null
          parent_brand_id?: number | null
          tecdoc_id?: number | null
        }
        Update: {
          created_at?: string
          id?: never
          is_system?: boolean
          kind?: Database["catalogue"]["Enums"]["brand_kind"]
          name?: string
          name_key?: string | null
          parent_brand_id?: number | null
          tecdoc_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_parent_brand_id_fkey"
            columns: ["parent_brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: number
          name: string
          parent_id: number | null
          path: unknown
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          parent_id?: number | null
          path: unknown
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          parent_id?: number | null
          path?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_aliases: {
        Row: {
          alias: string
          alias_key: string
          category_id: number
          created_at: string
        }
        Insert: {
          alias: string
          alias_key: string
          category_id: number
          created_at?: string
        }
        Update: {
          alias?: string
          alias_key?: string
          category_id?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_aliases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          barcode_id: number | null
          batch_id: string | null
          fact_id: number | null
          fitment_id: number | null
          id: number
          link_id: number | null
          manual_by: string | null
          observed_at: string
          row_number: number | null
          source_id: number | null
        }
        Insert: {
          barcode_id?: number | null
          batch_id?: string | null
          fact_id?: number | null
          fitment_id?: number | null
          id?: never
          link_id?: number | null
          manual_by?: string | null
          observed_at?: string
          row_number?: number | null
          source_id?: number | null
        }
        Update: {
          barcode_id?: number | null
          batch_id?: string | null
          fact_id?: number | null
          fitment_id?: number | null
          id?: never
          link_id?: number | null
          manual_by?: string | null
          observed_at?: string
          row_number?: number | null
          source_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_barcode_id_fkey"
            columns: ["barcode_id"]
            isOneToOne: false
            referencedRelation: "part_barcodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "part_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_fitment_id_fkey"
            columns: ["fitment_id"]
            isOneToOne: false
            referencedRelation: "part_fitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "part_links"
            referencedColumns: ["id"]
          },
        ]
      }
      external_refs: {
        Row: {
          created_at: string
          entity_id: number
          entity_type: string
          id: number
          system: string
          value: string
        }
        Insert: {
          created_at?: string
          entity_id: number
          entity_type: string
          id?: never
          system: string
          value: string
        }
        Update: {
          created_at?: string
          entity_id?: number
          entity_type?: string
          id?: never
          system?: string
          value?: string
        }
        Relationships: []
      }
      integrity_runs: {
        Row: {
          id: number
          report: Json
          run_at: string
        }
        Insert: {
          id?: never
          report: Json
          run_at?: string
        }
        Update: {
          id?: never
          report?: Json
          run_at?: string
        }
        Relationships: []
      }
      link_proposals: {
        Row: {
          batch_id: string | null
          created_at: string
          link_id: number
          row_number: number | null
          source_id: number
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          link_id: number
          row_number?: number | null
          source_id: number
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          link_id?: number
          row_number?: number | null
          source_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "link_proposals_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "part_links"
            referencedColumns: ["id"]
          },
        ]
      }
      oe_number_formats: {
        Row: {
          distinctive: boolean
          example: string | null
          family: string
          id: number
          lead_make: string
          make_keys: string[]
          note: string | null
          on_key: boolean
          pattern: string
        }
        Insert: {
          distinctive?: boolean
          example?: string | null
          family: string
          id?: never
          lead_make: string
          make_keys: string[]
          note?: string | null
          on_key?: boolean
          pattern: string
        }
        Update: {
          distinctive?: boolean
          example?: string | null
          family?: string
          id?: never
          lead_make?: string
          make_keys?: string[]
          note?: string | null
          on_key?: boolean
          pattern?: string
        }
        Relationships: []
      }
      oe_numbering_groups: {
        Row: {
          brand_key: string
          confidence: number
          created_at: string
          evidence: string
          group_code: string
        }
        Insert: {
          brand_key: string
          confidence: number
          created_at?: string
          evidence: string
          group_code: string
        }
        Update: {
          brand_key?: string
          confidence?: number
          created_at?: string
          evidence?: string
          group_code?: string
        }
        Relationships: []
      }
      part_barcodes: {
        Row: {
          evidence_count: number
          first_seen_at: string
          gtin14: string
          id: number
          last_seen_at: string
          part_id: number
          source_count: number
          state: Database["catalogue"]["Enums"]["claim_state"]
        }
        Insert: {
          evidence_count?: number
          first_seen_at?: string
          gtin14: string
          id?: never
          last_seen_at?: string
          part_id: number
          source_count?: number
          state?: Database["catalogue"]["Enums"]["claim_state"]
        }
        Update: {
          evidence_count?: number
          first_seen_at?: string
          gtin14?: string
          id?: never
          last_seen_at?: string
          part_id?: number
          source_count?: number
          state?: Database["catalogue"]["Enums"]["claim_state"]
        }
        Relationships: [
          {
            foreignKeyName: "part_barcodes_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      part_facts: {
        Row: {
          evidence_count: number
          field: string
          first_seen_at: string
          id: number
          last_seen_at: string
          part_id: number
          source_count: number
          state: Database["catalogue"]["Enums"]["claim_state"]
          value: Json
          value_hash: string | null
        }
        Insert: {
          evidence_count?: number
          field: string
          first_seen_at?: string
          id?: never
          last_seen_at?: string
          part_id: number
          source_count?: number
          state?: Database["catalogue"]["Enums"]["claim_state"]
          value: Json
          value_hash?: string | null
        }
        Update: {
          evidence_count?: number
          field?: string
          first_seen_at?: string
          id?: never
          last_seen_at?: string
          part_id?: number
          source_count?: number
          state?: Database["catalogue"]["Enums"]["claim_state"]
          value?: Json
          value_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_facts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      part_fitments: {
        Row: {
          evidence_count: number
          first_seen_at: string
          id: number
          last_seen_at: string
          part_id: number
          qualifiers: Json
          source_count: number
          state: Database["catalogue"]["Enums"]["claim_state"]
          vehicle_id: number | null
          vehicle_text: string | null
          vehicle_text_key: string | null
        }
        Insert: {
          evidence_count?: number
          first_seen_at?: string
          id?: never
          last_seen_at?: string
          part_id: number
          qualifiers?: Json
          source_count?: number
          state?: Database["catalogue"]["Enums"]["claim_state"]
          vehicle_id?: number | null
          vehicle_text?: string | null
          vehicle_text_key?: string | null
        }
        Update: {
          evidence_count?: number
          first_seen_at?: string
          id?: never
          last_seen_at?: string
          part_id?: number
          qualifiers?: Json
          source_count?: number
          state?: Database["catalogue"]["Enums"]["claim_state"]
          vehicle_id?: number | null
          vehicle_text?: string | null
          vehicle_text_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_fitments_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_fitments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      part_images: {
        Row: {
          batch_id: string | null
          created_at: string
          id: number
          licence: string
          part_id: number
          position: number
          row_number: number | null
          size: string
          source_id: number | null
          url: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: never
          licence?: string
          part_id: number
          position?: number
          row_number?: number | null
          size?: string
          source_id?: number | null
          url: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: never
          licence?: string
          part_id?: number
          position?: number
          row_number?: number | null
          size?: string
          source_id?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_images_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      part_links: {
        Row: {
          confidence: number
          evidence_count: number
          first_seen_at: string
          from_part_id: number
          id: number
          last_seen_at: string
          link_type: Database["catalogue"]["Enums"]["link_type"]
          notes: Json
          source_count: number
          state: Database["catalogue"]["Enums"]["claim_state"]
          to_part_id: number
          updated_at: string
        }
        Insert: {
          confidence?: number
          evidence_count?: number
          first_seen_at?: string
          from_part_id: number
          id?: never
          last_seen_at?: string
          link_type: Database["catalogue"]["Enums"]["link_type"]
          notes?: Json
          source_count?: number
          state?: Database["catalogue"]["Enums"]["claim_state"]
          to_part_id: number
          updated_at?: string
        }
        Update: {
          confidence?: number
          evidence_count?: number
          first_seen_at?: string
          from_part_id?: number
          id?: never
          last_seen_at?: string
          link_type?: Database["catalogue"]["Enums"]["link_type"]
          notes?: Json
          source_count?: number
          state?: Database["catalogue"]["Enums"]["claim_state"]
          to_part_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_links_from_part_id_fkey"
            columns: ["from_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_links_to_part_id_fkey"
            columns: ["to_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      part_merges: {
        Row: {
          from_part_id: number
          id: number
          into_part_id: number
          merged_at: string
          merged_by: string | null
          reason: string
        }
        Insert: {
          from_part_id: number
          id?: never
          into_part_id: number
          merged_at?: string
          merged_by?: string | null
          reason: string
        }
        Update: {
          from_part_id?: number
          id?: never
          into_part_id?: number
          merged_at?: string
          merged_by?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_merges_from_part_id_fkey"
            columns: ["from_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_merges_into_part_id_fkey"
            columns: ["into_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      part_number_aliases: {
        Row: {
          alias: string
          alias_key: string
          batch_id: string | null
          brand_id: number
          created_at: string
          kind: string
          part_id: number
          row_number: number | null
          source_id: number | null
        }
        Insert: {
          alias: string
          alias_key: string
          batch_id?: string | null
          brand_id: number
          created_at?: string
          kind?: string
          part_id: number
          row_number?: number | null
          source_id?: number | null
        }
        Update: {
          alias?: string
          alias_key?: string
          batch_id?: string | null
          brand_id?: number
          created_at?: string
          kind?: string
          part_id?: number
          row_number?: number | null
          source_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "part_number_aliases_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_number_aliases_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          attributes: Json
          brand_id: number
          category_id: number | null
          created_at: string
          description: string | null
          id: number
          kind: Database["catalogue"]["Enums"]["part_kind"]
          merged_into_id: number | null
          number: string
          number_key: string | null
          search_text: unknown
          status: Database["catalogue"]["Enums"]["part_status"]
          tecdoc_alias: string | null
          updated_at: string
        }
        Insert: {
          attributes?: Json
          brand_id: number
          category_id?: number | null
          created_at?: string
          description?: string | null
          id?: never
          kind: Database["catalogue"]["Enums"]["part_kind"]
          merged_into_id?: number | null
          number: string
          number_key?: string | null
          search_text?: unknown
          status?: Database["catalogue"]["Enums"]["part_status"]
          tecdoc_alias?: string | null
          updated_at?: string
        }
        Update: {
          attributes?: Json
          brand_id?: number
          category_id?: number | null
          created_at?: string
          description?: string | null
          id?: never
          kind?: Database["catalogue"]["Enums"]["part_kind"]
          merged_into_id?: number | null
          number?: string
          number_key?: string | null
          search_text?: unknown
          status?: Database["catalogue"]["Enums"]["part_status"]
          tecdoc_alias?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      search_synonyms: {
        Row: {
          created_at: string
          expands_to: string
          term: string
          term_key: string
        }
        Insert: {
          created_at?: string
          expands_to: string
          term: string
          term_key: string
        }
        Update: {
          created_at?: string
          expands_to?: string
          term?: string
          term_key?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          description: string
          key: string
          updated_at: string
          value: number
        }
        Insert: {
          description: string
          key: string
          updated_at?: string
          value: number
        }
        Update: {
          description?: string
          key?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      unattributed_oe_numbers: {
        Row: {
          batch_id: string | null
          created_at: string
          number: string
          number_key: string
          part_id: number
          resolved_oe_id: number | null
          row_number: number | null
          source_id: number | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          number: string
          number_key: string
          part_id: number
          resolved_oe_id?: number | null
          row_number?: number | null
          source_id?: number | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          number?: string
          number_key?: string
          part_id?: number
          resolved_oe_id?: number | null
          row_number?: number | null
          source_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "unattributed_oe_numbers_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unattributed_oe_numbers_resolved_oe_id_fkey"
            columns: ["resolved_oe_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_make_links: {
        Row: {
          confidence: number
          created_at: string
          evidence: string
          make_key_a: string
          make_key_b: string
        }
        Insert: {
          confidence: number
          created_at?: string
          evidence: string
          make_key_a: string
          make_key_b: string
        }
        Update: {
          confidence?: number
          created_at?: string
          evidence?: string
          make_key_a?: string
          make_key_b?: string
        }
        Relationships: []
      }
      vehicle_makes: {
        Row: {
          created_at: string
          id: number
          name: string
          name_key: string | null
          oe_brand_id: number | null
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          name_key?: string | null
          oe_brand_id?: number | null
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          name_key?: string | null
          oe_brand_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_makes_oe_brand_id_fkey"
            columns: ["oe_brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_models: {
        Row: {
          created_at: string
          id: number
          make_id: number
          name: string
          name_key: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          make_id: number
          name: string
          name_key?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          make_id?: number
          name?: string
          name_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_models_make_id_fkey"
            columns: ["make_id"]
            isOneToOne: false
            referencedRelation: "vehicle_makes"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_text_matches: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          method: string
          score: number
          state: Database["catalogue"]["Enums"]["claim_state"]
          vehicle_id: number
          vehicle_text_key: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: never
          method: string
          score?: number
          state?: Database["catalogue"]["Enums"]["claim_state"]
          vehicle_id: number
          vehicle_text_key: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: never
          method?: string
          score?: number
          state?: Database["catalogue"]["Enums"]["claim_state"]
          vehicle_id?: number
          vehicle_text_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_text_matches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          body: string | null
          created_at: string
          drivetrain: string | null
          engine_cc: number | null
          engine_code: string | null
          engine_code_keys: string[] | null
          engine_codes: string[]
          external_ids: Json
          fuel: string | null
          generation: string | null
          id: number
          ktype: number | null
          model_id: number
          month_from: number | null
          month_to: number | null
          ntype: number | null
          platform: string | null
          platform_code: string | null
          power_kw: number | null
          power_ps: number | null
          source_list: string | null
          type_name: string | null
          updated_at: string
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          drivetrain?: string | null
          engine_cc?: number | null
          engine_code?: string | null
          engine_code_keys?: string[] | null
          engine_codes?: string[]
          external_ids?: Json
          fuel?: string | null
          generation?: string | null
          id?: never
          ktype?: number | null
          model_id: number
          month_from?: number | null
          month_to?: number | null
          ntype?: number | null
          platform?: string | null
          platform_code?: string | null
          power_kw?: number | null
          power_ps?: number | null
          source_list?: string | null
          type_name?: string | null
          updated_at?: string
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          body?: string | null
          created_at?: string
          drivetrain?: string | null
          engine_cc?: number | null
          engine_code?: string | null
          engine_code_keys?: string[] | null
          engine_codes?: string[]
          external_ids?: Json
          fuel?: string | null
          generation?: string | null
          id?: never
          ktype?: number | null
          model_id?: number
          month_from?: number | null
          month_to?: number | null
          ntype?: number | null
          platform?: string | null
          platform_code?: string | null
          power_kw?: number | null
          power_ps?: number | null
          source_list?: string | null
          type_name?: string | null
          updated_at?: string
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "vehicle_models"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fitment_resolved: {
        Row: {
          confidence: number | null
          fitment_id: number | null
          match_method: string | null
          match_score: number | null
          part_id: number | null
          state: Database["catalogue"]["Enums"]["claim_state"] | null
          vehicle_id: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_brand_alias: {
        Args: { p_alias: string; p_brand: string }
        Returns: string
      }
      assert_barcode: {
        Args: {
          p_batch?: string
          p_code: string
          p_manual_by?: string
          p_part: number
          p_row?: number
          p_source?: number
        }
        Returns: number
      }
      assert_category_trail: {
        Args: {
          p_batch?: string
          p_names: string[]
          p_part: number
          p_row?: number
          p_source?: number
        }
        Returns: number
      }
      assert_fact: {
        Args: {
          p_batch?: string
          p_field: string
          p_manual_by?: string
          p_part: number
          p_row?: number
          p_source?: number
          p_value: Json
        }
        Returns: number
      }
      assert_fitment: {
        Args: {
          p_batch?: string
          p_manual_by?: string
          p_part: number
          p_qualifiers?: Json
          p_row?: number
          p_source?: number
          p_vehicle?: number
          p_vehicle_text?: string
        }
        Returns: number
      }
      assert_link: {
        Args: {
          p_batch?: string
          p_from: number
          p_manual_by?: string
          p_row?: number
          p_source?: number
          p_to: number
          p_type: Database["catalogue"]["Enums"]["link_type"]
        }
        Returns: number
      }
      auto_match_vehicle_text: {
        Args: { p_make?: string; p_refresh?: boolean; p_text: string }
        Returns: number
      }
      category_names: { Args: { p_category: number }; Returns: string[] }
      claim_confidence: {
        Args: {
          p_sources: number
          p_state: Database["catalogue"]["Enums"]["claim_state"]
        }
        Returns: number
      }
      clean_number: {
        Args: { p_raw: string; p_strict?: boolean }
        Returns: Json
      }
      create_placeholder: { Args: never; Returns: number }
      ensure_category_path: { Args: { p_names: string[] }; Returns: number }
      evidence_origin: {
        Args: { p_manual_by: string; p_source: number }
        Returns: string
      }
      find_brand: { Args: { p_name: string }; Returns: number }
      find_or_create_brand: {
        Args: {
          p_kind?: Database["catalogue"]["Enums"]["brand_kind"]
          p_name: string
        }
        Returns: number
      }
      find_or_create_part: {
        Args: { p_brand: number; p_number: string }
        Returns: number
      }
      guard_hubs: {
        Args: {
          p_oe_threshold?: number
          p_only?: number[]
          p_xref_threshold?: number
        }
        Returns: number
      }
      heal_by_attribution: { Args: { p_oes: number[] }; Returns: number }
      heal_oe_links: { Args: { p_part: number }; Returns: number }
      import_vehicle_list: { Args: { p_list: string }; Returns: Json }
      infer_oe_equivalence: { Args: { p_article: number }; Returns: number }
      link_inferred: {
        Args: {
          p_basis?: string
          p_confidence: number
          p_from: number
          p_to: number
          p_type?: Database["catalogue"]["Enums"]["link_type"]
        }
        Returns: number
      }
      link_shared_oe_numbers: { Args: { p_part: number }; Returns: number }
      match_vehicle_text: {
        Args: { p_make?: string; p_text: string }
        Returns: {
          ktype: number
          label: string
          score: number
          vehicle_id: number
        }[]
      }
      match_weight: {
        Args: {
          p_method: string
          p_score: number
          p_state: Database["catalogue"]["Enums"]["claim_state"]
        }
        Returns: number
      }
      merge_parts: {
        Args: {
          p_by?: string
          p_from: number
          p_into: number
          p_reason: string
        }
        Returns: number
      }
      name_keys: { Args: { p: string[] }; Returns: string[] }
      oe_format_check: {
        Args: { p_make: string; p_number: string }
        Returns: Json
      }
      parse_autodoc_oe_label: { Args: { p_label: string }; Returns: Json }
      parse_oe_reference: { Args: { p_text: string }; Returns: Json }
      parse_vehicle_text: { Args: { p_text: string }; Returns: Json }
      part_display_name: { Args: { p_part: number }; Returns: string }
      promote_placeholder: { Args: { p_placeholder: number }; Returns: number }
      recalculate_link: { Args: { p_link: number }; Returns: undefined }
      reconcile_anchor: { Args: { p_part: number }; Returns: number }
      refresh_golden_record: {
        Args: { p_field: string; p_part: number }
        Returns: undefined
      }
      register_number_alias: {
        Args: {
          p_alias: string
          p_batch?: string
          p_kind?: string
          p_part: number
          p_row?: number
          p_source?: number
        }
        Returns: string
      }
      relink_shared_oe_numbers: { Args: { p_group?: string }; Returns: number }
      rematch_vehicle_texts: { Args: { p_limit?: number }; Returns: number }
      resolve_part: { Args: { p_part: number }; Returns: number }
      run_integrity_check: { Args: never; Returns: Json }
      set_link_state: {
        Args: {
          p_by: string
          p_link: number
          p_state: Database["catalogue"]["Enums"]["claim_state"]
        }
        Returns: undefined
      }
      setting: { Args: { p_key: string }; Returns: number }
      text_tokens: { Args: { p_text: string }; Returns: string[] }
      upsert_vehicle: { Args: { p: Json }; Returns: number }
      vehicle_fitments: {
        Args: { p_vehicle: number }
        Returns: {
          confidence: number
          part_id: number
          state: Database["catalogue"]["Enums"]["claim_state"]
        }[]
      }
      vehicle_satisfies: {
        Args: { q: Json; v: Database["catalogue"]["Tables"]["vehicles"]["Row"] }
        Returns: boolean
      }
    }
    Enums: {
      brand_kind:
        | "vehicle_manufacturer"
        | "aftermarket"
        | "private_label"
        | "unknown"
      claim_state:
        | "asserted"
        | "inferred"
        | "verified"
        | "rejected"
        | "conflict"
      link_type:
        | "oe_reference"
        | "cross_reference"
        | "supersedes"
        | "equivalent_oe"
        | "kit_component"
      part_kind: "oe" | "aftermarket" | "oe_placeholder"
      part_status: "active" | "merged" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  ingest: {
    Tables: {
      api_budgets: {
        Row: {
          credit_limit: number
          period_start: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          credit_limit: number
          period_start?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          credit_limit?: number
          period_start?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_credit_ledger: {
        Row: {
          created_at: string
          credits: number
          id: number
          provider: string
          reason: string
          target_id: number | null
        }
        Insert: {
          created_at?: string
          credits: number
          id?: never
          provider: string
          reason: string
          target_id?: number | null
        }
        Update: {
          created_at?: string
          credits?: number
          id?: never
          provider?: string
          reason?: string
          target_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_credit_ledger_provider_fkey"
            columns: ["provider"]
            isOneToOne: false
            referencedRelation: "api_budgets"
            referencedColumns: ["provider"]
          },
        ]
      }
      batches: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error: string | null
          file_name: string
          file_path: string
          file_sha256: string
          id: string
          profile_id: number | null
          row_count: number | null
          rows_applied: number
          rows_quarantined: number
          rows_warning: number
          source_id: number
          started_at: string | null
          status: Database["ingest"]["Enums"]["batch_status"]
          summary: Json
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          file_name: string
          file_path: string
          file_sha256: string
          id?: string
          profile_id?: number | null
          row_count?: number | null
          rows_applied?: number
          rows_quarantined?: number
          rows_warning?: number
          source_id: number
          started_at?: string | null
          status?: Database["ingest"]["Enums"]["batch_status"]
          summary?: Json
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          file_name?: string
          file_path?: string
          file_sha256?: string
          id?: string
          profile_id?: number | null
          row_count?: number | null
          rows_applied?: number
          rows_quarantined?: number
          rows_warning?: number
          source_id?: number
          started_at?: string | null
          status?: Database["ingest"]["Enums"]["batch_status"]
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "batches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      data_issues: {
        Row: {
          barcode: string | null
          batch_id: string | null
          catalogue_scope: boolean
          created_at: string
          details: Json
          id: number
          kind: Database["ingest"]["Enums"]["issue_kind"]
          link_id: number | null
          part_id: number | null
          resolution: Json | null
          resolved_at: string | null
          resolved_by: string | null
          row_number: number | null
          severity: number
          status: Database["ingest"]["Enums"]["issue_status"]
        }
        Insert: {
          barcode?: string | null
          batch_id?: string | null
          catalogue_scope?: boolean
          created_at?: string
          details?: Json
          id?: never
          kind: Database["ingest"]["Enums"]["issue_kind"]
          link_id?: number | null
          part_id?: number | null
          resolution?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          row_number?: number | null
          severity?: number
          status?: Database["ingest"]["Enums"]["issue_status"]
        }
        Update: {
          barcode?: string | null
          batch_id?: string | null
          catalogue_scope?: boolean
          created_at?: string
          details?: Json
          id?: never
          kind?: Database["ingest"]["Enums"]["issue_kind"]
          link_id?: number | null
          part_id?: number | null
          resolution?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          row_number?: number | null
          severity?: number
          status?: Database["ingest"]["Enums"]["issue_status"]
        }
        Relationships: [
          {
            foreignKeyName: "data_issues_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_issues_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_progress"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      enrichment_targets: {
        Row: {
          attempts: number
          batch_id: string | null
          created_at: string
          credits_spent: number
          id: number
          last_error: string | null
          part_id: number
          priority: number
          product_url: string | null
          provider: string
          reason: string
          row_number: number | null
          status: Database["ingest"]["Enums"]["enrichment_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          batch_id?: string | null
          created_at?: string
          credits_spent?: number
          id?: never
          last_error?: string | null
          part_id: number
          priority?: number
          product_url?: string | null
          provider: string
          reason: string
          row_number?: number | null
          status?: Database["ingest"]["Enums"]["enrichment_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          batch_id?: string | null
          created_at?: string
          credits_spent?: number
          id?: never
          last_error?: string | null
          part_id?: number
          priority?: number
          product_url?: string | null
          provider?: string
          reason?: string
          row_number?: number | null
          status?: Database["ingest"]["Enums"]["enrichment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_targets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_targets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_progress"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          created_at: string
          finished_at: string | null
          id: number
          kind: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          run_after: string
          status: Database["ingest"]["Enums"]["job_status"]
        }
        Insert: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: never
          kind: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          run_after?: string
          status?: Database["ingest"]["Enums"]["job_status"]
        }
        Update: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: never
          kind?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          run_after?: string
          status?: Database["ingest"]["Enums"]["job_status"]
        }
        Relationships: []
      }
      landing_bga: {
        Row: {
          ABS: string | null
          "Apec Braking": string | null
          Barcode: string | null
          "BGA Ref": string | null
          "Borg & Beck": string | null
          Brand: string | null
          "BRT Bearings": string | null
          "CALORSTAT by Vernet": string | null
          COMLINE: string | null
          "Commodity Code": string | null
          CONTI: string | null
          Contitech: string | null
          Corteco: string | null
          Dayco: string | null
          Delphi: string | null
          Description: string | null
          EAN: string | null
          Elring: string | null
          "Example of Brand": string | null
          "Example of Model": string | null
          FAG: string | null
          "FAI AutoParts": string | null
          "FEBI BILSTEIN": string | null
          "First Line": string | null
          Gates: string | null
          INA: string | null
          "Invoice Price": string | null
          NAKATA: string | null
          Napa: string | null
          "Net Price": string | null
          NISSENS: string | null
          NRF: string | null
          "ODM-MULTIPARTS": string | null
          OE: string | null
          "OE Number": string | null
          OPTIMAL: string | null
          "Part No": string | null
          "Part Number": string | null
          "Product Group": string | null
          "QH Talbros": string | null
          Rank: string | null
          "Rolling Co": string | null
          row_id: number
          RUVILLE: string | null
          "SERCK AUTOMOTIVE": string | null
          "SERCK-MARSTON": string | null
          Shaftec: string | null
          SKF: string | null
          SWAG: string | null
          TRUPART: string | null
          "Ultra Parts": string | null
          "VICTOR REINZ": string | null
        }
        Insert: {
          ABS?: string | null
          "Apec Braking"?: string | null
          Barcode?: string | null
          "BGA Ref"?: string | null
          "Borg & Beck"?: string | null
          Brand?: string | null
          "BRT Bearings"?: string | null
          "CALORSTAT by Vernet"?: string | null
          COMLINE?: string | null
          "Commodity Code"?: string | null
          CONTI?: string | null
          Contitech?: string | null
          Corteco?: string | null
          Dayco?: string | null
          Delphi?: string | null
          Description?: string | null
          EAN?: string | null
          Elring?: string | null
          "Example of Brand"?: string | null
          "Example of Model"?: string | null
          FAG?: string | null
          "FAI AutoParts"?: string | null
          "FEBI BILSTEIN"?: string | null
          "First Line"?: string | null
          Gates?: string | null
          INA?: string | null
          "Invoice Price"?: string | null
          NAKATA?: string | null
          Napa?: string | null
          "Net Price"?: string | null
          NISSENS?: string | null
          NRF?: string | null
          "ODM-MULTIPARTS"?: string | null
          OE?: string | null
          "OE Number"?: string | null
          OPTIMAL?: string | null
          "Part No"?: string | null
          "Part Number"?: string | null
          "Product Group"?: string | null
          "QH Talbros"?: string | null
          Rank?: string | null
          "Rolling Co"?: string | null
          row_id?: never
          RUVILLE?: string | null
          "SERCK AUTOMOTIVE"?: string | null
          "SERCK-MARSTON"?: string | null
          Shaftec?: string | null
          SKF?: string | null
          SWAG?: string | null
          TRUPART?: string | null
          "Ultra Parts"?: string | null
          "VICTOR REINZ"?: string | null
        }
        Update: {
          ABS?: string | null
          "Apec Braking"?: string | null
          Barcode?: string | null
          "BGA Ref"?: string | null
          "Borg & Beck"?: string | null
          Brand?: string | null
          "BRT Bearings"?: string | null
          "CALORSTAT by Vernet"?: string | null
          COMLINE?: string | null
          "Commodity Code"?: string | null
          CONTI?: string | null
          Contitech?: string | null
          Corteco?: string | null
          Dayco?: string | null
          Delphi?: string | null
          Description?: string | null
          EAN?: string | null
          Elring?: string | null
          "Example of Brand"?: string | null
          "Example of Model"?: string | null
          FAG?: string | null
          "FAI AutoParts"?: string | null
          "FEBI BILSTEIN"?: string | null
          "First Line"?: string | null
          Gates?: string | null
          INA?: string | null
          "Invoice Price"?: string | null
          NAKATA?: string | null
          Napa?: string | null
          "Net Price"?: string | null
          NISSENS?: string | null
          NRF?: string | null
          "ODM-MULTIPARTS"?: string | null
          OE?: string | null
          "OE Number"?: string | null
          OPTIMAL?: string | null
          "Part No"?: string | null
          "Part Number"?: string | null
          "Product Group"?: string | null
          "QH Talbros"?: string | null
          Rank?: string | null
          "Rolling Co"?: string | null
          row_id?: never
          RUVILLE?: string | null
          "SERCK AUTOMOTIVE"?: string | null
          "SERCK-MARSTON"?: string | null
          Shaftec?: string | null
          SKF?: string | null
          SWAG?: string | null
          TRUPART?: string | null
          "Ultra Parts"?: string | null
          "VICTOR REINZ"?: string | null
        }
        Relationships: []
      }
      landing_fps: {
        Row: {
          "Account Number": string | null
          Barcode: string | null
          "Box Qty": string | null
          Brand: string | null
          "Campaign End Date": string | null
          "Campaign Price": string | null
          "Campaign Start Date": string | null
          Code: string | null
          "Country of Origin": string | null
          Description: string | null
          "FPS Part No": string | null
          "Invoice Price": string | null
          "List Price": string | null
          "MFG Code": string | null
          "Min Order": string | null
          "Min Order - NDC": string | null
          "PDC Code": string | null
          "PDisc%": string | null
          "Price Unit": string | null
          "Quantity Break %": string | null
          "Quantity Break Price": string | null
          "Quantity Break Unit": string | null
          row_id: number
          "Special Net Price": string | null
          "Supplier Part Number": string | null
          "Unit Cost": string | null
          "Unit of Issue": string | null
          Weight: string | null
          "While Stocks Last": string | null
        }
        Insert: {
          "Account Number"?: string | null
          Barcode?: string | null
          "Box Qty"?: string | null
          Brand?: string | null
          "Campaign End Date"?: string | null
          "Campaign Price"?: string | null
          "Campaign Start Date"?: string | null
          Code?: string | null
          "Country of Origin"?: string | null
          Description?: string | null
          "FPS Part No"?: string | null
          "Invoice Price"?: string | null
          "List Price"?: string | null
          "MFG Code"?: string | null
          "Min Order"?: string | null
          "Min Order - NDC"?: string | null
          "PDC Code"?: string | null
          "PDisc%"?: string | null
          "Price Unit"?: string | null
          "Quantity Break %"?: string | null
          "Quantity Break Price"?: string | null
          "Quantity Break Unit"?: string | null
          row_id?: never
          "Special Net Price"?: string | null
          "Supplier Part Number"?: string | null
          "Unit Cost"?: string | null
          "Unit of Issue"?: string | null
          Weight?: string | null
          "While Stocks Last"?: string | null
        }
        Update: {
          "Account Number"?: string | null
          Barcode?: string | null
          "Box Qty"?: string | null
          Brand?: string | null
          "Campaign End Date"?: string | null
          "Campaign Price"?: string | null
          "Campaign Start Date"?: string | null
          Code?: string | null
          "Country of Origin"?: string | null
          Description?: string | null
          "FPS Part No"?: string | null
          "Invoice Price"?: string | null
          "List Price"?: string | null
          "MFG Code"?: string | null
          "Min Order"?: string | null
          "Min Order - NDC"?: string | null
          "PDC Code"?: string | null
          "PDisc%"?: string | null
          "Price Unit"?: string | null
          "Quantity Break %"?: string | null
          "Quantity Break Price"?: string | null
          "Quantity Break Unit"?: string | null
          row_id?: never
          "Special Net Price"?: string | null
          "Supplier Part Number"?: string | null
          "Unit Cost"?: string | null
          "Unit of Issue"?: string | null
          Weight?: string | null
          "While Stocks Last"?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: number
          is_active: boolean
          source_id: number | null
          spec: Json
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: never
          is_active?: boolean
          source_id?: number | null
          spec: Json
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: never
          is_active?: boolean
          source_id?: number | null
          spec?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_rows: {
        Row: {
          batch_id: string
          cells: Json
          row_number: number
        }
        Insert: {
          batch_id: string
          cells: Json
          row_number: number
        }
        Update: {
          batch_id?: string
          cells?: Json
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "raw_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_progress"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      sources: {
        Row: {
          created_at: string
          id: number
          kind: Database["ingest"]["Enums"]["source_kind"]
          licence_notes: string | null
          name: string
          origin: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          kind?: Database["ingest"]["Enums"]["source_kind"]
          licence_notes?: string | null
          name: string
          origin?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          kind?: Database["ingest"]["Enums"]["source_kind"]
          licence_notes?: string | null
          name?: string
          origin?: string | null
        }
        Relationships: []
      }
      staged_rows: {
        Row: {
          applied_at: string | null
          batch_id: string
          issues: Json
          mapped: Json
          part_id: number | null
          row_number: number
          status: Database["ingest"]["Enums"]["row_status"]
        }
        Insert: {
          applied_at?: string | null
          batch_id: string
          issues?: Json
          mapped?: Json
          part_id?: number | null
          row_number: number
          status?: Database["ingest"]["Enums"]["row_status"]
        }
        Update: {
          applied_at?: string | null
          batch_id?: string
          issues?: Json
          mapped?: Json
          part_id?: number | null
          row_number?: number
          status?: Database["ingest"]["Enums"]["row_status"]
        }
        Relationships: [
          {
            foreignKeyName: "staged_rows_batch_id_row_number_fkey"
            columns: ["batch_id", "row_number"]
            isOneToOne: true
            referencedRelation: "raw_rows"
            referencedColumns: ["batch_id", "row_number"]
          },
        ]
      }
      vehicle_list_landing: {
        Row: {
          body_category: string | null
          drivetrain: string | null
          engine_cc: string | null
          engine_codes: string | null
          engine_hp: string | null
          engine_kw: string | null
          fuel_type: string | null
          is_update: string | null
          ktype: string | null
          make: string | null
          model: string | null
          platform_code: string | null
          row_id: number
          type: string | null
          year_from: string | null
          year_to: string | null
        }
        Insert: {
          body_category?: string | null
          drivetrain?: string | null
          engine_cc?: string | null
          engine_codes?: string | null
          engine_hp?: string | null
          engine_kw?: string | null
          fuel_type?: string | null
          is_update?: string | null
          ktype?: string | null
          make?: string | null
          model?: string | null
          platform_code?: string | null
          row_id?: never
          type?: string | null
          year_from?: string | null
          year_to?: string | null
        }
        Update: {
          body_category?: string | null
          drivetrain?: string | null
          engine_cc?: string | null
          engine_codes?: string | null
          engine_hp?: string | null
          engine_kw?: string | null
          fuel_type?: string | null
          is_update?: string | null
          ktype?: string | null
          make?: string | null
          model?: string | null
          platform_code?: string | null
          row_id?: never
          type?: string | null
          year_from?: string | null
          year_to?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      import_progress: {
        Row: {
          applied_through_row: number | null
          batch_id: string | null
          completed_at: string | null
          file_name: string | null
          pct_done: number | null
          rows_applied: number | null
          rows_in_file: number | null
          rows_quarantined: number | null
          rows_staged: number | null
          rows_warning: number | null
          started_at: string | null
          status: Database["ingest"]["Enums"]["batch_status"] | null
        }
        Insert: {
          applied_through_row?: never
          batch_id?: string | null
          completed_at?: string | null
          file_name?: string | null
          pct_done?: never
          rows_applied?: number | null
          rows_in_file?: number | null
          rows_quarantined?: number | null
          rows_staged?: never
          rows_warning?: number | null
          started_at?: string | null
          status?: Database["ingest"]["Enums"]["batch_status"] | null
        }
        Update: {
          applied_through_row?: never
          batch_id?: string | null
          completed_at?: string | null
          file_name?: string | null
          pct_done?: never
          rows_applied?: number | null
          rows_in_file?: number | null
          rows_quarantined?: number | null
          rows_staged?: never
          rows_warning?: number | null
          started_at?: string | null
          status?: Database["ingest"]["Enums"]["batch_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_landing_columns: {
        Args: { p_headers: string[]; p_landing: unknown }
        Returns: string[]
      }
      apply_batch_chunk: {
        Args: { p_batch: string; p_from_row: number; p_to_row: number }
        Returns: Json
      }
      apply_enrichment: {
        Args: { p_batch: string; p_row: number; p_target: number }
        Returns: Json
      }
      apply_next_chunk: { Args: { p_chunk?: number }; Returns: Json }
      apply_staged_row: {
        Args: { p_batch: string; p_row: number }
        Returns: Json
      }
      canonical_autodoc: {
        Args: { p_doc: Json; p_provider: string }
        Returns: Json
      }
      claim_enrichment_targets: {
        Args: { p_limit?: number; p_provider: string }
        Returns: {
          attempts: number
          batch_id: string | null
          created_at: string
          credits_spent: number
          id: number
          last_error: string | null
          part_id: number
          priority: number
          product_url: string | null
          provider: string
          reason: string
          row_number: number | null
          status: Database["ingest"]["Enums"]["enrichment_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "enrichment_targets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_job: {
        Args: { p_kinds?: string[]; p_worker: string }
        Returns: {
          attempts: number
          created_at: string
          finished_at: string | null
          id: number
          kind: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          run_after: string
          status: Database["ingest"]["Enums"]["job_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_job: { Args: { p_job: number }; Returns: undefined }
      enqueue_job: {
        Args: { p_kind: string; p_payload?: Json; p_run_after?: string }
        Returns: number
      }
      enrichment_no_match_since: { Args: { p_part: number }; Returns: string }
      fail_job: { Args: { p_error: string; p_job: number }; Returns: undefined }
      finish_enrichment: {
        Args: {
          p_error?: string
          p_status: Database["ingest"]["Enums"]["enrichment_status"]
          p_target: number
        }
        Returns: undefined
      }
      map_batch: { Args: { p_batch: string }; Returns: Json }
      map_next_chunk: {
        Args: { p_budget?: string; p_chunk?: number }
        Returns: Json
      }
      map_row: {
        Args: { p_brand_columns?: Json; p_cells: Json; p_spec: Json }
        Returns: Json
      }
      map_rows: {
        Args: {
          p_batch: string
          p_brand_columns: Json
          p_from: number
          p_spec: Json
          p_to: number
        }
        Returns: Json
      }
      oe_sibling_enriched: {
        Args: { p_part: number; p_provider: string }
        Returns: boolean
      }
      open_issue: {
        Args: {
          p_barcode?: string
          p_batch?: string
          p_details?: Json
          p_kind: Database["ingest"]["Enums"]["issue_kind"]
          p_link?: number
          p_part?: number
          p_row?: number
          p_severity?: number
        }
        Returns: number
      }
      parse_image_list: { Args: { p_images: Json }; Returns: Json }
      publish_price: {
        Args: {
          p_anomaly_pct?: number
          p_batch?: string
          p_cost: number
          p_currency?: string
          p_list?: number
          p_pack?: number
          p_part: number
          p_row?: number
          p_source: number
          p_surcharge?: number
          p_surcharge_code?: string
        }
        Returns: number
      }
      queue_enrichment: {
        Args: { p_limit?: number; p_provider: string }
        Returns: number
      }
      record_supplier_code: {
        Args: {
          p_batch?: string
          p_by?: string
          p_code: string
          p_part: number
          p_source: number
        }
        Returns: undefined
      }
      record_vrm_lookup: {
        Args: {
          p_engine_cc: number
          p_first_registered: string
          p_fuel: string
          p_make: string
          p_model: string
          p_provider: string
          p_response: Json
          p_user?: string
          p_vrm: string
        }
        Returns: number
      }
      requeue_stale_jobs: { Args: { p_older_than?: string }; Returns: number }
      resolve_issues: {
        Args: {
          p_kind: Database["ingest"]["Enums"]["issue_kind"]
          p_part: number
          p_resolution?: Json
        }
        Returns: number
      }
      rule_value: { Args: { p_cells: Json; p_rule: Json }; Returns: string }
      spec_brand_columns: {
        Args: { p_headers: string[]; p_spec: Json }
        Returns: Json
      }
      spec_missing_fields: {
        Args: { p_headers: string[]; p_spec: Json }
        Returns: Json
      }
      spec_used_headers: { Args: { p_spec: Json }; Returns: string[] }
      spend_credits: {
        Args: {
          p_credits: number
          p_provider: string
          p_reason: string
          p_target?: number
        }
        Returns: number
      }
      stage_landing: {
        Args: { p_file_name: string; p_landing: unknown; p_profile: string }
        Returns: Json
      }
      start_api_batch: { Args: { p_provider: string }; Returns: string }
      start_import: {
        Args: { p_file_name: string; p_profile: string }
        Returns: Json
      }
      store_api_response: {
        Args: { p_batch: string; p_doc: Json }
        Returns: number
      }
      transform_value: {
        Args: { p_step: Json; p_value: string }
        Returns: string
      }
    }
    Enums: {
      batch_status:
        | "uploaded"
        | "parsing"
        | "mapping"
        | "resolving"
        | "linking"
        | "publishing"
        | "completed"
        | "failed"
      enrichment_status:
        | "queued"
        | "in_progress"
        | "applied"
        | "no_match"
        | "mismatch"
        | "failed"
        | "skipped"
      issue_kind:
        | "missing_oe"
        | "unknown_brand"
        | "invalid_barcode"
        | "barcode_conflict"
        | "link_conflict"
        | "unmatched_vehicle"
        | "price_anomaly"
        | "merge_review"
        | "quarantined_row"
        | "enrichment_mismatch"
        | "vehicle_conflict"
      issue_status: "open" | "in_review" | "resolved" | "dismissed"
      job_status: "queued" | "running" | "done" | "failed"
      row_status: "pending" | "ok" | "warning" | "quarantined" | "applied"
      source_kind: "price_list" | "catalogue_feed" | "manual" | "stocktake"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bins: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          is_system: boolean
          location_id: number | null
          parent_bin_id: number | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: never
          is_active?: boolean
          is_system?: boolean
          location_id?: number | null
          parent_bin_id?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: never
          is_active?: boolean
          is_system?: boolean
          location_id?: number | null
          parent_bin_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bins_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bins_parent_bin_id_fkey"
            columns: ["parent_bin_id"]
            isOneToOne: false
            referencedRelation: "bin_places"
            referencedColumns: ["bin_id"]
          },
          {
            foreignKeyName: "bins_parent_bin_id_fkey"
            columns: ["parent_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error: string | null
          file_path: string | null
          filters: Json
          id: string
          profile_id: number
          row_count: number | null
          status: Database["ingest"]["Enums"]["job_status"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          file_path?: string | null
          filters?: Json
          id?: string
          profile_id: number
          row_count?: number | null
          status?: Database["ingest"]["Enums"]["job_status"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          file_path?: string | null
          filters?: Json
          id?: string
          profile_id?: number
          row_count?: number | null
          status?: Database["ingest"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "export_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      export_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          format: Database["public"]["Enums"]["export_format"]
          id: number
          name: string
          spec: Json
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          format?: Database["public"]["Enums"]["export_format"]
          id?: never
          name: string
          spec: Json
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          format?: Database["public"]["Enums"]["export_format"]
          id?: never
          name?: string
          spec?: Json
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      inventory_item_stats: {
        Row: {
          best_cost: number | null
          best_price_since: string | null
          best_source_id: number | null
          on_hand: number
          part_id: number
          updated_at: string
        }
        Insert: {
          best_cost?: number | null
          best_price_since?: string | null
          best_source_id?: number | null
          on_hand?: number
          part_id: number
          updated_at?: string
        }
        Update: {
          best_cost?: number | null
          best_price_since?: string | null
          best_source_id?: number | null
          on_hand?: number
          part_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_stats_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: true
            referencedRelation: "inventory_items"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "inventory_item_stats_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: true
            referencedRelation: "inventory_rows"
            referencedColumns: ["part_id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          description_override: string | null
          id: number
          is_stocked: boolean
          own_sku: string | null
          part_id: number
          reorder_level: number | null
          surcharge: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_override?: string | null
          id?: never
          is_stocked?: boolean
          own_sku?: string | null
          part_id: number
          reorder_level?: number | null
          surcharge?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_override?: string | null
          id?: never
          is_stocked?: boolean
          own_sku?: string | null
          part_id?: number
          reorder_level?: number | null
          surcharge?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_labels: {
        Row: {
          code_key: string
          created_at: string
          created_by: string | null
          label_type: string
          part_id: number
        }
        Insert: {
          code_key: string
          created_at?: string
          created_by?: string | null
          label_type?: string
          part_id: number
        }
        Update: {
          code_key?: string
          created_at?: string
          created_by?: string | null
          label_type?: string
          part_id?: number
        }
        Relationships: []
      }
      inventory_location_levels: {
        Row: {
          location_id: number
          max_qty: number | null
          min_qty: number
          part_id: number
          updated_at: string
        }
        Insert: {
          location_id: number
          max_qty?: number | null
          min_qty?: number
          part_id: number
          updated_at?: string
        }
        Update: {
          location_id?: number
          max_qty?: number | null
          min_qty?: number
          part_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_location_levels_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_location_levels_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "inventory_location_levels_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "inventory_rows"
            referencedColumns: ["part_id"]
          },
        ]
      }
      inventory_prices: {
        Row: {
          active_from: string
          active_to: string | null
          created_at: string
          created_by: string | null
          id: number
          min_qty: number
          part_id: number
          price: number
          tier: Database["public"]["Enums"]["price_tier"]
          updated_at: string
        }
        Insert: {
          active_from?: string
          active_to?: string | null
          created_at?: string
          created_by?: string | null
          id?: never
          min_qty?: number
          part_id: number
          price: number
          tier: Database["public"]["Enums"]["price_tier"]
          updated_at?: string
        }
        Update: {
          active_from?: string
          active_to?: string | null
          created_at?: string
          created_by?: string | null
          id?: never
          min_qty?: number
          part_id?: number
          price?: number
          tier?: Database["public"]["Enums"]["price_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_prices_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "inventory_prices_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "inventory_rows"
            referencedColumns: ["part_id"]
          },
        ]
      }
      locations: {
        Row: {
          code: string
          created_at: string
          id: number
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: never
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: never
          name?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          brand_id: number | null
          category_id: number | null
          id: number
          min_margin: number | null
          part_id: number | null
          retail_margin: number | null
          trade_margin: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand_id?: number | null
          category_id?: number | null
          id?: never
          min_margin?: number | null
          part_id?: number | null
          retail_margin?: number | null
          trade_margin?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand_id?: number | null
          category_id?: number | null
          id?: never
          min_margin?: number | null
          part_id?: number | null
          retail_margin?: number | null
          trade_margin?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "pricing_rules_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "inventory_rows"
            referencedColumns: ["part_id"]
          },
        ]
      }
      search_log: {
        Row: {
          created_at: string
          id: number
          query: string
          results: number
          user_id: string | null
          vehicle_id: number | null
        }
        Insert: {
          created_at?: string
          id?: never
          query: string
          results: number
          user_id?: string | null
          vehicle_id?: number | null
        }
        Update: {
          created_at?: string
          id?: never
          query?: string
          results?: number
          user_id?: string | null
          vehicle_id?: number | null
        }
        Relationships: []
      }
      stock_document_lines: {
        Row: {
          bin_id: number | null
          client_line_id: string
          created_at: string
          document_id: string
          id: number
          part_id: number | null
          qty: number
          scanned_code: string | null
          status: Database["public"]["Enums"]["count_status"]
          unit_cost: number | null
        }
        Insert: {
          bin_id?: number | null
          client_line_id: string
          created_at?: string
          document_id: string
          id?: never
          part_id?: number | null
          qty: number
          scanned_code?: string | null
          status?: Database["public"]["Enums"]["count_status"]
          unit_cost?: number | null
        }
        Update: {
          bin_id?: number | null
          client_line_id?: string
          created_at?: string
          document_id?: string
          id?: never
          part_id?: number | null
          qty?: number
          scanned_code?: string | null
          status?: Database["public"]["Enums"]["count_status"]
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_document_lines_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bin_places"
            referencedColumns: ["bin_id"]
          },
          {
            foreignKeyName: "stock_document_lines_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_document_lines_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "stock_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_document_types: {
        Row: {
          code: string
          description: string | null
          next_number: number
          prefix: string
        }
        Insert: {
          code: string
          description?: string | null
          next_number?: number
          prefix: string
        }
        Update: {
          code?: string
          description?: string | null
          next_number?: number
          prefix?: string
        }
        Relationships: []
      }
      stock_documents: {
        Row: {
          continues_id: string | null
          created_at: string
          created_by: string | null
          device_id: string | null
          doc_type: string
          id: string
          location_id: number | null
          needs_review: boolean
          notes: string | null
          number: string
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          reverses_document_id: string | null
          reverses_stocktake_id: string | null
          source_id: number | null
          status: string
        }
        Insert: {
          continues_id?: string | null
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          doc_type: string
          id?: string
          location_id?: number | null
          needs_review?: boolean
          notes?: string | null
          number: string
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          reverses_document_id?: string | null
          reverses_stocktake_id?: string | null
          source_id?: number | null
          status?: string
        }
        Update: {
          continues_id?: string | null
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          doc_type?: string
          id?: string
          location_id?: number | null
          needs_review?: boolean
          notes?: string | null
          number?: string
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          reverses_document_id?: string | null
          reverses_stocktake_id?: string | null
          source_id?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_documents_continues_id_fkey"
            columns: ["continues_id"]
            isOneToOne: false
            referencedRelation: "stock_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_documents_doc_type_fkey"
            columns: ["doc_type"]
            isOneToOne: false
            referencedRelation: "stock_document_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "stock_documents_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_documents_reverses_document_id_fkey"
            columns: ["reverses_document_id"]
            isOneToOne: false
            referencedRelation: "stock_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_documents_reverses_stocktake_id_fkey"
            columns: ["reverses_stocktake_id"]
            isOneToOne: false
            referencedRelation: "stocktakes"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_levels: {
        Row: {
          bin_id: number
          part_id: number
          qty: number
          updated_at: string
        }
        Insert: {
          bin_id: number
          part_id: number
          qty?: number
          updated_at?: string
        }
        Update: {
          bin_id?: number
          part_id?: number
          qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bin_places"
            referencedColumns: ["bin_id"]
          },
          {
            foreignKeyName: "stock_levels_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          bin_code: string | null
          bin_id: number | null
          created_at: string
          created_by: string | null
          document_id: string | null
          id: number
          location_code: string | null
          part_id: number
          qty_delta: number
          reason: Database["public"]["Enums"]["movement_reason"]
          reference: string | null
          stocktake_id: string | null
          unit_cost: number | null
        }
        Insert: {
          bin_code?: string | null
          bin_id?: number | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          id?: never
          location_code?: string | null
          part_id: number
          qty_delta: number
          reason: Database["public"]["Enums"]["movement_reason"]
          reference?: string | null
          stocktake_id?: string | null
          unit_cost?: number | null
        }
        Update: {
          bin_code?: string | null
          bin_id?: number | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          id?: never
          location_code?: string | null
          part_id?: number
          qty_delta?: number
          reason?: Database["public"]["Enums"]["movement_reason"]
          reference?: string | null
          stocktake_id?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bin_places"
            referencedColumns: ["bin_id"]
          },
          {
            foreignKeyName: "stock_movements_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
        ]
      }
      stocktake_bins: {
        Row: {
          bin_id: number | null
          bin_place: string
          counted_at: string
          counted_by: string | null
          id: number
          stocktake_id: string
        }
        Insert: {
          bin_id?: number | null
          bin_place: string
          counted_at?: string
          counted_by?: string | null
          id?: never
          stocktake_id: string
        }
        Update: {
          bin_id?: number | null
          bin_place?: string
          counted_at?: string
          counted_by?: string | null
          id?: never
          stocktake_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stocktake_bins_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bin_places"
            referencedColumns: ["bin_id"]
          },
          {
            foreignKeyName: "stocktake_bins_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_bins_stocktake_id_fkey"
            columns: ["stocktake_id"]
            isOneToOne: false
            referencedRelation: "stocktakes"
            referencedColumns: ["id"]
          },
        ]
      }
      stocktake_counts: {
        Row: {
          bin_id: number | null
          bin_place: string
          client_count_id: string
          counted_at: string
          counted_by: string | null
          device_id: string | null
          id: number
          part_id: number | null
          qty: number
          scanned_code: string | null
          status: Database["public"]["Enums"]["count_status"]
          stocktake_id: string
        }
        Insert: {
          bin_id?: number | null
          bin_place: string
          client_count_id: string
          counted_at?: string
          counted_by?: string | null
          device_id?: string | null
          id?: never
          part_id?: number | null
          qty: number
          scanned_code?: string | null
          status?: Database["public"]["Enums"]["count_status"]
          stocktake_id: string
        }
        Update: {
          bin_id?: number | null
          bin_place?: string
          client_count_id?: string
          counted_at?: string
          counted_by?: string | null
          device_id?: string | null
          id?: never
          part_id?: number | null
          qty?: number
          scanned_code?: string | null
          status?: Database["public"]["Enums"]["count_status"]
          stocktake_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stocktake_counts_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bin_places"
            referencedColumns: ["bin_id"]
          },
          {
            foreignKeyName: "stocktake_counts_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_counts_stocktake_id_fkey"
            columns: ["stocktake_id"]
            isOneToOne: false
            referencedRelation: "stocktakes"
            referencedColumns: ["id"]
          },
        ]
      }
      stocktake_expected: {
        Row: {
          bin_id: number | null
          bin_place: string
          expected_qty: number
          id: number
          part_id: number
          stocktake_id: string
        }
        Insert: {
          bin_id?: number | null
          bin_place: string
          expected_qty: number
          id?: never
          part_id: number
          stocktake_id: string
        }
        Update: {
          bin_id?: number | null
          bin_place?: string
          expected_qty?: number
          id?: never
          part_id?: number
          stocktake_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stocktake_expected_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bin_places"
            referencedColumns: ["bin_id"]
          },
          {
            foreignKeyName: "stocktake_expected_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_expected_stocktake_id_fkey"
            columns: ["stocktake_id"]
            isOneToOne: false
            referencedRelation: "stocktakes"
            referencedColumns: ["id"]
          },
        ]
      }
      stocktakes: {
        Row: {
          bin_ids: number[] | null
          created_at: string
          created_by: string | null
          device_id: string | null
          id: string
          is_blind: boolean
          kind: string
          location_id: number
          name: string
          needs_review: boolean
          partial: boolean
          posted_at: string | null
          posted_by: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["stocktake_status"]
        }
        Insert: {
          bin_ids?: number[] | null
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: string
          is_blind?: boolean
          kind?: string
          location_id: number
          name: string
          needs_review?: boolean
          partial?: boolean
          posted_at?: string | null
          posted_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["stocktake_status"]
        }
        Update: {
          bin_ids?: number[] | null
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: string
          is_blind?: boolean
          kind?: string
          location_id?: number
          name?: string
          needs_review?: boolean
          partial?: boolean
          posted_at?: string | null
          posted_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["stocktake_status"]
        }
        Relationships: [
          {
            foreignKeyName: "stocktakes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_codes: {
        Row: {
          batch_id: string | null
          code: string
          code_key: string | null
          created_at: string
          created_by: string | null
          id: number
          part_id: number
          source_id: number
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          code: string
          code_key?: string | null
          created_at?: string
          created_by?: string | null
          id?: never
          part_id: number
          source_id: number
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          code?: string
          code_key?: string | null
          created_at?: string
          created_by?: string | null
          id?: never
          part_id?: number
          source_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      supplier_prices: {
        Row: {
          batch_id: string | null
          cost: number
          currency: string
          id: number
          list_price: number | null
          pack_qty: number | null
          part_id: number
          source_id: number
          surcharge: number | null
          surcharge_code: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          batch_id?: string | null
          cost: number
          currency?: string
          id?: never
          list_price?: number | null
          pack_qty?: number | null
          part_id: number
          source_id: number
          surcharge?: number | null
          surcharge_code?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          batch_id?: string | null
          cost?: number
          currency?: string
          id?: never
          list_price?: number | null
          pack_qty?: number | null
          part_id?: number
          source_id?: number
          surcharge?: number | null
          surcharge_code?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
      vrm_lookups: {
        Row: {
          chosen_at: string | null
          chosen_by: string | null
          engine_cc: number | null
          first_registered: string | null
          fuel: string | null
          id: number
          looked_up_at: string
          looked_up_by: string | null
          make: string | null
          model: string | null
          provider: string
          response: Json
          vehicle_id: number | null
          vrm_key: string
        }
        Insert: {
          chosen_at?: string | null
          chosen_by?: string | null
          engine_cc?: number | null
          first_registered?: string | null
          fuel?: string | null
          id?: never
          looked_up_at?: string
          looked_up_by?: string | null
          make?: string | null
          model?: string | null
          provider?: string
          response?: Json
          vehicle_id?: number | null
          vrm_key: string
        }
        Update: {
          chosen_at?: string | null
          chosen_by?: string | null
          engine_cc?: number | null
          first_registered?: string | null
          fuel?: string | null
          id?: never
          looked_up_at?: string
          looked_up_by?: string | null
          make?: string | null
          model?: string | null
          provider?: string
          response?: Json
          vehicle_id?: number | null
          vrm_key?: string
        }
        Relationships: []
      }
      workspace: {
        Row: {
          created_at: string
          currency: string
          id: boolean
          name: string
          price_rounding: string
          retail_includes_vat: boolean
          surcharge_uplift: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: boolean
          name: string
          price_rounding?: string
          retail_includes_vat?: boolean
          surcharge_uplift?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: boolean
          name?: string
          price_rounding?: string
          retail_includes_vat?: boolean
          surcharge_uplift?: number
          vat_rate?: number
        }
        Relationships: []
      }
    }
    Views: {
      bin_places: {
        Row: {
          bin_code: string | null
          bin_id: number | null
          is_active: boolean | null
          is_system: boolean | null
          location_code: string | null
          location_id: number | null
          location_name: string | null
          place: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bins_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_rows: {
        Row: {
          below_reorder: boolean | null
          best_cost: number | null
          best_currency: string | null
          best_source_id: number | null
          best_source_name: string | null
          brand_id: number | null
          brand_name: string | null
          category_id: number | null
          category_name: string | null
          eans: string[] | null
          enriched_at: string | null
          is_stocked: boolean | null
          kind: Database["catalogue"]["Enums"]["part_kind"] | null
          name: string | null
          on_hand: number | null
          part_id: number | null
          part_number: string | null
          pricing: Json | null
          reorder_level: number | null
          sell_price: number | null
          sku: string | null
          stock: Json | null
          updated_at: string | null
        }
        Relationships: []
      }
      inventory_summary: {
        Row: {
          below_min_margin: number | null
          below_reorder: number | null
          currency: string | null
          in_stock: number | null
          in_stock_without_price: number | null
          items: number | null
          out_of_stock: number | null
          stock_value: number | null
          stocked: number | null
        }
        Relationships: []
      }
      scan_codes: {
        Row: {
          bin_id: number | null
          code_key: string | null
          kind: string | null
          label: string | null
          location_code: string | null
          part_id: number | null
          rank: number | null
        }
        Relationships: []
      }
      stock_movement_history: {
        Row: {
          bin_id: number | null
          bin_total: number | null
          brand_name: string | null
          created_at: string | null
          created_by: string | null
          id: number | null
          part_id: number | null
          part_number: string | null
          part_total: number | null
          place: string | null
          qty_delta: number | null
          reason: Database["public"]["Enums"]["movement_reason"] | null
          reference: string | null
          stocktake_id: string | null
          unit_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bin_places"
            referencedColumns: ["bin_id"]
          },
          {
            foreignKeyName: "stock_movements_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
        ]
      }
      unmapped_categories: {
        Row: {
          parts: number | null
          source_category: string | null
        }
        Relationships: []
      }
      unmatched_vehicle_texts: {
        Row: {
          last_seen: string | null
          parts: number | null
          vehicle_text: string | null
          vehicle_text_key: string | null
        }
        Relationships: []
      }
      zero_result_searches: {
        Row: {
          last_searched_at: string | null
          query: string | null
          searches: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_brand_alias: {
        Args: { p_alias: string; p_brand: number }
        Returns: undefined
      }
      add_inventory_part: { Args: { p: Json }; Returns: Json }
      add_kit_component: {
        Args: { p_component: number; p_kit: number; p_qty?: number }
        Returns: number
      }
      add_part_core: { Args: { p: Json; p_by: string }; Returns: Json }
      adjust_stock: {
        Args: {
          p_bin: number
          p_part: number
          p_qty_delta: number
          p_reason: Database["public"]["Enums"]["movement_reason"]
          p_reference?: string
          p_unit_cost?: number
        }
        Returns: number
      }
      alias_brand_name: {
        Args: { p_alias: string; p_brand: number }
        Returns: undefined
      }
      apply_resolved_count: { Args: { p_count: number }; Returns: Json }
      brand_options: {
        Args: { p_limit?: number; p_query?: string }
        Returns: {
          alias: string
          brand_id: number
          kind: Database["catalogue"]["Enums"]["brand_kind"]
          match: string
          name: string
          parts: number
          score: number
        }[]
      }
      cancel_stale_bin_counts: { Args: never; Returns: number }
      cancel_stocktake: { Args: { p_stocktake: string }; Returns: undefined }
      catalogue_settings: {
        Args: never
        Returns: {
          description: string
          key: string
          updated_at: string
          value: number
        }[]
      }
      check_brands: {
        Args: { p_names: string[] }
        Returns: {
          brand: string
          brand_id: number
          name: string
          suggestions: Json
          via_alias: boolean
        }[]
      }
      choose_vehicle_for_vrm: {
        Args: { p_lookup: number; p_vehicle: number }
        Returns: undefined
      }
      claim_sources: {
        Args: { p_id: number; p_kind: string }
        Returns: {
          batch_id: string
          evidence_id: number
          file_name: string
          kind: string
          manual_by: string
          observed_at: string
          row_number: number
          source: string
          source_id: number
          source_kind: Database["ingest"]["Enums"]["source_kind"]
        }[]
      }
      close_issue: {
        Args: {
          p_issue: number
          p_note?: string
          p_status: Database["ingest"]["Enums"]["issue_status"]
        }
        Returns: undefined
      }
      close_stale_receipts: { Args: never; Returns: number }
      close_stock_document: { Args: { p_document: string }; Returns: Json }
      commit_bin_count: {
        Args: { p_confirm_empty?: boolean; p_stocktake: string }
        Returns: Json
      }
      create_bins: {
        Args: { p_codes: string[]; p_location: number }
        Returns: Json
      }
      create_brand: {
        Args: { p_confirm?: boolean; p_name: string }
        Returns: number
      }
      create_category_path: { Args: { p_names: string[] }; Returns: number }
      create_supplier: { Args: { p_name: string }; Returns: number }
      current_sell_price: {
        Args: {
          p_on?: string
          p_part: number
          p_qty?: number
          p_tier?: Database["public"]["Enums"]["price_tier"]
        }
        Returns: number
      }
      effective_sell_price: {
        Args: {
          p_part: number
          p_qty?: number
          p_tier?: Database["public"]["Enums"]["price_tier"]
        }
        Returns: number
      }
      enrichment_activity: {
        Args: { p_limit?: number }
        Returns: {
          brand: string
          credits: number
          last_error: string
          number: string
          part_id: number
          product_url: string
          status: Database["ingest"]["Enums"]["enrichment_status"]
          target_id: number
          updated_at: string
        }[]
      }
      enrichment_apply: {
        Args: { p_doc: Json; p_target: number }
        Returns: Json
      }
      enrichment_begin: {
        Args: { p_by: string; p_force?: boolean; p_part: number }
        Returns: Json
      }
      enrichment_budget: { Args: never; Returns: Json }
      enrichment_finish: {
        Args: {
          p_error?: string
          p_status: Database["ingest"]["Enums"]["enrichment_status"]
          p_target: number
        }
        Returns: undefined
      }
      enrichment_pick_card: {
        Args: { p_cards: Json; p_target: number }
        Returns: string
      }
      enrichment_preview: { Args: { p_part: number }; Returns: Json }
      enrichment_refund: {
        Args: { p_credits: number; p_reason: string; p_target: number }
        Returns: undefined
      }
      enrichment_spend: {
        Args: { p_credits: number; p_reason: string; p_target: number }
        Returns: number
      }
      ensure_bin: {
        Args: { p_code: string; p_location: number }
        Returns: Json
      }
      find_parts_to_add: {
        Args: { max_results?: number; q: string }
        Returns: {
          brand: string
          description: string
          display_name: string
          has_barcode: boolean
          image_url: string
          in_inventory: boolean
          is_stocked: boolean
          kind: Database["catalogue"]["Enums"]["part_kind"]
          match_type: string
          number: string
          on_hand: number
          part_id: number
          score: number
          sku: string
        }[]
      }
      finish_counting: { Args: { p_stocktake: string }; Returns: undefined }
      floor_activity: {
        Args: { p_before?: string; p_kind?: string; p_limit?: number }
        Returns: Json
      }
      floor_document: { Args: { p_id: string; p_kind: string }; Returns: Json }
      floor_rows: {
        Args: {
          p_before?: string
          p_id?: string
          p_kind?: string
          p_limit?: number
        }
        Returns: Json[]
      }
      floor_unresolved: {
        Args: { p_limit?: number }
        Returns: {
          code: string
          counts: number
          last_seen: string
          lines: number
          qty: number
          receipts: number
          sources: string[]
        }[]
      }
      freeze_stocktake_expected: {
        Args: { p_stocktake: string }
        Returns: number
      }
      gtin14: { Args: { value: string }; Returns: string }
      has_role: {
        Args: { minimum?: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      heal_unresolved_code: {
        Args: { p_code: string; p_part: number }
        Returns: Json
      }
      import_append_rows: {
        Args: { p_batch: string; p_first_row: number; p_rows: Json }
        Returns: number
      }
      import_batches: {
        Args: { p_limit?: number }
        Returns: {
          applied_through: number
          completed_at: string
          created_at: string
          created_by: string
          error: string
          file_name: string
          id: string
          kind: string
          mapped_through: number
          row_count: number
          rows_applied: number
          rows_quarantined: number
          source: string
          source_id: number
          status: string
        }[]
      }
      import_begin: {
        Args: {
          p_file_name: string
          p_headers: string[]
          p_row_count: number
          p_sha256: string
          p_source: number
        }
        Returns: string
      }
      import_cancel: { Args: { p_batch: string }; Returns: undefined }
      import_finish: { Args: { p_batch: string }; Returns: Json }
      import_preview: { Args: { p_rows: Json; p_spec: Json }; Returns: Json }
      import_profile: { Args: { p_source: number }; Returns: Json }
      import_quarantined: {
        Args: { p_batch: string; p_limit?: number; p_offset?: number }
        Returns: {
          cells: Json
          reasons: Json
          row_number: number
          stage: string
          total: number
        }[]
      }
      import_report: {
        Args: { p_batch: string; p_details?: boolean }
        Returns: Json
      }
      inventory_filter_options: { Args: never; Returns: Json }
      is_catalogue_curator: { Args: never; Returns: boolean }
      is_restricted_gtin: { Args: { value: string }; Returns: boolean }
      item_pricing: {
        Args: { p_part: number }
        Returns: {
          below_min_margin: boolean
          margin: number
          min_margin: number
          sell_price: number
          sell_price_source: string
          trade_price: number
        }[]
      }
      item_surcharge: {
        Args: { p_part: number }
        Returns: {
          supplier_surcharge: number
          supplier_surcharge_code: string
          surcharge: number
          surcharge_source: string
          surcharge_uplift: number
        }[]
      }
      ktypes_for_part: {
        Args: {
          include_inferred?: boolean
          include_sister_makes?: boolean
          include_via_alternative?: boolean
          max_results?: number
          min_confidence?: number
          p_part: number
        }
        Returns: {
          confidence: number
          ktype: number
          vehicle_id: number
          verdict: string
        }[]
      }
      link_floor_code: {
        Args: { p_code: string; p_part: number }
        Returns: Json
      }
      list_inventory: {
        Args: {
          p_below_margin?: boolean
          p_below_reorder?: boolean
          p_bin_id?: number
          p_brand_id?: number
          p_category_id?: number
          p_in_stock?: boolean
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_sort?: string
          p_source_id?: number
        }
        Returns: {
          below_reorder: boolean
          best_cost: number
          best_currency: string
          best_source_id: number
          best_source_name: string
          brand_id: number
          brand_name: string
          category_id: number
          category_name: string
          eans: string[]
          enriched_at: string
          is_stocked: boolean
          kind: Database["catalogue"]["Enums"]["part_kind"]
          name: string
          on_hand: number
          part_id: number
          part_number: string
          pricing: Json
          reorder_level: number
          sell_price: number
          sku: string
          stock: Json
          total_count: number
          updated_at: string
        }[]
      }
      location_bins: {
        Args: { p_location: number }
        Returns: {
          bin_id: number
          code: string
          description: string
          is_active: boolean
          is_system: boolean
          parts: number
          units: number
        }[]
      }
      location_overview: {
        Args: never
        Returns: {
          active_bins: number
          bins: number
          code: string
          created_at: string
          location_id: number
          name: string
          parts: number
          stocked_bins: number
          units: number
        }[]
      }
      log_search: {
        Args: { p_query: string; p_results: number; p_vehicle?: number }
        Returns: undefined
      }
      lookup: { Args: { q: string }; Returns: Json }
      map_category_alias: {
        Args: { p_alias: string; p_category: number }
        Returns: number
      }
      mark_bin_counted: {
        Args: { p_bin: number; p_stocktake: string }
        Returns: undefined
      }
      mark_floor_reviewed: {
        Args: { p_id: string; p_kind: string }
        Returns: undefined
      }
      member_labels: {
        Args: never
        Returns: {
          email: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      next_stock_document_number: { Args: { p_type: string }; Returns: string }
      normalise_name_key: { Args: { value: string }; Returns: string }
      normalise_part_number: { Args: { value: string }; Returns: string }
      open_bin_count: {
        Args: {
          p_bin: number
          p_device?: string
          p_started_at?: string
          p_stocktake: string
        }
        Returns: Json
      }
      part_alternatives: {
        Args: { min_confidence?: number; p_part: number }
        Returns: {
          brand: string
          confidence: number
          kind: Database["catalogue"]["Enums"]["part_kind"]
          number: string
          part_id: number
          relation: string
          via: string
        }[]
      }
      part_alternatives_with_stock: {
        Args: { min_confidence?: number; p_part: number }
        Returns: {
          best_cost: number
          brand: string
          confidence: number
          in_range: boolean
          kind: Database["catalogue"]["Enums"]["part_kind"]
          margin: number
          number: string
          on_hand: number
          part_id: number
          relation: string
          sell_price: number
          via: string
        }[]
      }
      part_card: { Args: { p_part: number }; Returns: Json }
      part_detail: { Args: { p_part: number }; Returns: Json }
      part_fitments_for: {
        Args: { min_confidence?: number; p_part: number }
        Returns: {
          confidence: number
          engine_cc: number
          fuel: string
          generation: string
          ktype: number
          make: string
          match_method: string
          model: string
          power_kw: number
          state: Database["catalogue"]["Enums"]["claim_state"]
          type_name: string
          vehicle_id: number
          year_from: number
          year_to: number
        }[]
      }
      part_fits_vehicle: {
        Args: { min_confidence?: number; p_part: number; p_vehicle: number }
        Returns: Json
      }
      part_kit: { Args: { p_part: number }; Returns: Json }
      part_margins: {
        Args: { p_part: number }
        Returns: {
          min_from: string
          min_margin: number
          retail_from: string
          retail_margin: number
          trade_from: string
          trade_margin: number
        }[]
      }
      part_pricing_rules: { Args: { p_part: number }; Returns: Json }
      part_references: { Args: { p_part: number }; Returns: Json }
      part_specs: {
        Args: { p_part: number }
        Returns: {
          evidence: number
          fact_id: number
          field: string
          first_seen: string
          last_seen: string
          sources: number
          state: Database["catalogue"]["Enums"]["claim_state"]
          value: Json
        }[]
      }
      part_vehicle_texts: {
        Args: { p_part: number }
        Returns: {
          first_seen: string
          fitment_id: number
          matched_vehicles: number
          qualifiers: Json
          sources: number
          state: Database["catalogue"]["Enums"]["claim_state"]
          vehicle_text: string
        }[]
      }
      parts_below_min_margin: {
        Args: never
        Returns: {
          best_cost: number
          margin: number
          min_margin: number
          part_id: number
          price: number
          tier: Database["public"]["Enums"]["price_tier"]
        }[]
      }
      parts_for_vehicle: {
        Args: {
          max_results?: number
          min_confidence?: number
          p_category?: string
          p_query?: string
          p_vehicle: number
        }
        Returns: {
          brand: string
          confidence: number
          description: string
          number: string
          part_id: number
          verdict: string
          your_stock: number
        }[]
      }
      pending_put_away: {
        Args: never
        Returns: {
          bin_id: number
          location_id: number
          parts: number
          place: string
          units: number
        }[]
      }
      post_stocktake: { Args: { p_stocktake: string }; Returns: Json }
      put_away: {
        Args: {
          p_bin: number
          p_document?: string
          p_part: number
          p_qty: number
          p_reference?: string
          p_stocktake?: string
        }
        Returns: Json
      }
      quick_add_part: { Args: { p: Json }; Returns: Json }
      record_count: {
        Args: {
          p_bin: number
          p_client_count_id: string
          p_code: string
          p_device?: string
          p_qty: number
          p_stocktake: string
        }
        Returns: Json
      }
      record_counts: {
        Args: { p_bin: number; p_lines: Json; p_stocktake: string }
        Returns: Json
      }
      record_receipt_lines: {
        Args: {
          p_device?: string
          p_document: string
          p_lines: Json
          p_location: number
        }
        Returns: Json
      }
      recount_bin: {
        Args: { p_bin: number; p_stocktake: string }
        Returns: number
      }
      refresh_all_item_stats: { Args: never; Returns: number }
      refresh_item_stats: { Args: { p_part: number }; Returns: undefined }
      register_label: {
        Args: { p_code: string; p_label_type?: string; p_part: number }
        Returns: undefined
      }
      remove_kit_component: { Args: { p_link: number }; Returns: undefined }
      remove_supplier_code: {
        Args: { p_code: string; p_source: number }
        Returns: undefined
      }
      reorder_suggestions: {
        Args: never
        Returns: {
          best_cost: number
          best_source: string
          brand: string
          location_code: string
          location_id: number
          max_level: number
          number: string
          on_hand: number
          part_id: number
          reorder_level: number
          suggested_qty: number
        }[]
      }
      request_export: {
        Args: { p_filters?: Json; p_profile: number }
        Returns: string
      }
      require_role: {
        Args: { minimum: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      reset_api_budget_period: {
        Args: { p_provider?: string }
        Returns: undefined
      }
      resolve_code_to_part: { Args: { p_code: string }; Returns: number }
      resolve_count: {
        Args: { p_count: number; p_part: number }
        Returns: undefined
      }
      resolve_scan: {
        Args: { p_code: string; p_location?: number }
        Returns: Json
      }
      return_to_pool: {
        Args: {
          p_bin: number
          p_document?: string
          p_part: number
          p_qty: number
          p_reference?: string
          p_stocktake?: string
        }
        Returns: number
      }
      reverse_floor_change: {
        Args: { p_id: string; p_kind: string; p_reason: string }
        Returns: Json
      }
      review_link: {
        Args: {
          p_decision: Database["catalogue"]["Enums"]["claim_state"]
          p_link: number
        }
        Returns: undefined
      }
      review_merge: {
        Args: { p_from: number; p_into: number; p_reason: string }
        Returns: number
      }
      round_sell_price: {
        Args: {
          p_price: number
          p_tier: Database["public"]["Enums"]["price_tier"]
        }
        Returns: number
      }
      rule_sell_price: {
        Args: {
          p_part: number
          p_tier?: Database["public"]["Enums"]["price_tier"]
        }
        Returns: number
      }
      runner_claim_enrichment: { Args: { p_worker: string }; Returns: Json }
      runner_finish_job: {
        Args: { p_error?: string; p_job: number; p_outcome: string }
        Returns: undefined
      }
      save_import_profile: {
        Args: { p_source: number; p_spec: Json }
        Returns: Json
      }
      scan_index: {
        Args: { p_after?: string; p_limit?: number }
        Returns: {
          code_key: string
          entries: Json
        }[]
      }
      scan_index_version: { Args: never; Returns: string }
      search_parts: {
        Args: { max_results?: number; q: string }
        Returns: {
          brand: string
          description: string
          kind: Database["catalogue"]["Enums"]["part_kind"]
          match_type: string
          number: string
          part_id: number
          score: number
        }[]
      }
      set_api_budget: {
        Args: { p_credit_limit: number; p_provider: string }
        Returns: undefined
      }
      set_sell_price: {
        Args: {
          p_part: number
          p_price: number
          p_tier?: Database["public"]["Enums"]["price_tier"]
        }
        Returns: undefined
      }
      set_stock_count: {
        Args: {
          p_bin: number
          p_part: number
          p_qty: number
          p_reference?: string
        }
        Returns: number
      }
      set_supplier_code: {
        Args: { p_code: string; p_part: number; p_source: number }
        Returns: undefined
      }
      set_vehicle_text_match: {
        Args: {
          p_state: Database["catalogue"]["Enums"]["claim_state"]
          p_text: string
          p_vehicle: number
        }
        Returns: undefined
      }
      sku_available: { Args: { p_part?: number; p_sku: string }; Returns: Json }
      start_ingestion: {
        Args: {
          p_file_name: string
          p_file_path: string
          p_profile: number
          p_sha256: string
          p_source: number
        }
        Returns: string
      }
      start_stocktake: { Args: { p_stocktake: string }; Returns: number }
      stock_valuation: {
        Args: never
        Returns: {
          cost_basis: string
          number: string
          on_hand: number
          part_id: number
          unit_cost: number
          value: number
        }[]
      }
      stocktake_variances: {
        Args: { p_stocktake: string }
        Returns: {
          bin_code: string
          bin_id: number
          counted: number
          expected: number
          part_id: number
          part_number: string
          variance: number
        }[]
      }
      supplier_options: {
        Args: never
        Returns: {
          has_profile: boolean
          kind: string
          last_upload: Json
          name: string
          source_id: number
        }[]
      }
      transfer_stock: {
        Args: {
          p_from_bin: number
          p_part: number
          p_qty: number
          p_reference?: string
          p_to_bin: number
        }
        Returns: undefined
      }
      try_uuid: { Args: { value: string }; Returns: string }
      unlocated_stock: {
        Args: { p_limit?: number; p_location?: number }
        Returns: {
          bin_id: number
          brand: string
          number: string
          part_id: number
          place: string
          qty: number
        }[]
      }
      unlocated_stock_summary: { Args: { p_location?: number }; Returns: Json }
      vehicle_candidates_for_vrm: {
        Args: { p_lookup: number }
        Returns: {
          chosen: boolean
          ktype: number
          label: string
          score: number
          vehicle_id: number
        }[]
      }
      void_count: { Args: { p_count: number }; Returns: undefined }
      void_floor_code: { Args: { p_code: string }; Returns: Json }
      write_off_unlocated: {
        Args: { p_bin: number; p_parts: number[] }
        Returns: Json
      }
      xref_oe_agreement: {
        Args: never
        Returns: {
          agreement: number
          confirmed: number
          contradicted: number
          pending: number
          proposed: number
          recommendation: string
          rejected: number
          source: string
          source_id: number
        }[]
      }
    }
    Enums: {
      app_role: "viewer" | "counter" | "editor" | "admin" | "owner"
      count_status: "counted" | "unresolved" | "void"
      export_format: "csv" | "tsv" | "xlsx" | "json"
      movement_reason:
        | "opening"
        | "receipt"
        | "sale"
        | "adjustment"
        | "stocktake"
        | "transfer_in"
        | "transfer_out"
        | "customer_return"
        | "supplier_return"
      price_tier: "trade" | "retail"
      stocktake_status: "draft" | "counting" | "review" | "posted" | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  catalogue: {
    Enums: {
      brand_kind: [
        "vehicle_manufacturer",
        "aftermarket",
        "private_label",
        "unknown",
      ],
      claim_state: ["asserted", "inferred", "verified", "rejected", "conflict"],
      link_type: [
        "oe_reference",
        "cross_reference",
        "supersedes",
        "equivalent_oe",
        "kit_component",
      ],
      part_kind: ["oe", "aftermarket", "oe_placeholder"],
      part_status: ["active", "merged", "rejected"],
    },
  },
  ingest: {
    Enums: {
      batch_status: [
        "uploaded",
        "parsing",
        "mapping",
        "resolving",
        "linking",
        "publishing",
        "completed",
        "failed",
      ],
      enrichment_status: [
        "queued",
        "in_progress",
        "applied",
        "no_match",
        "mismatch",
        "failed",
        "skipped",
      ],
      issue_kind: [
        "missing_oe",
        "unknown_brand",
        "invalid_barcode",
        "barcode_conflict",
        "link_conflict",
        "unmatched_vehicle",
        "price_anomaly",
        "merge_review",
        "quarantined_row",
        "enrichment_mismatch",
        "vehicle_conflict",
      ],
      issue_status: ["open", "in_review", "resolved", "dismissed"],
      job_status: ["queued", "running", "done", "failed"],
      row_status: ["pending", "ok", "warning", "quarantined", "applied"],
      source_kind: ["price_list", "catalogue_feed", "manual", "stocktake"],
    },
  },
  public: {
    Enums: {
      app_role: ["viewer", "counter", "editor", "admin", "owner"],
      count_status: ["counted", "unresolved", "void"],
      export_format: ["csv", "tsv", "xlsx", "json"],
      movement_reason: [
        "opening",
        "receipt",
        "sale",
        "adjustment",
        "stocktake",
        "transfer_in",
        "transfer_out",
        "customer_return",
        "supplier_return",
      ],
      price_tier: ["trade", "retail"],
      stocktake_status: ["draft", "counting", "review", "posted", "cancelled"],
    },
  },
} as const
