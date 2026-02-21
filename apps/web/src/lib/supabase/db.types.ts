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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_table: string | null
          id: number
          metadata: Json
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string | null
          id?: never
          metadata?: Json
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string | null
          id?: never
          metadata?: Json
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: Json | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: Json | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: Json | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          cnpj: string
          created_at: string
          id: string
          legal_name: string
          municipal_registration: string | null
          tenant_id: string
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          id?: string
          legal_name: string
          municipal_registration?: string | null
          tenant_id: string
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          id?: string
          legal_name?: string
          municipal_registration?: string | null
          tenant_id?: string
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_fiscal_settings: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_street: string | null
          address_zip: string | null
          cnae: string | null
          company_id: string
          created_at: string
          default_service_description: string | null
          id: string
          iss_rate: number | null
          municipality_ibge_code: string | null
          municipality_name: string | null
          service_code: string | null
          service_list_item: string | null
          state_uf: string | null
          tax_regime: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zip?: string | null
          cnae?: string | null
          company_id: string
          created_at?: string
          default_service_description?: string | null
          id?: string
          iss_rate?: number | null
          municipality_ibge_code?: string | null
          municipality_name?: string | null
          service_code?: string | null
          service_list_item?: string | null
          state_uf?: string | null
          tax_regime?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zip?: string | null
          cnae?: string | null
          company_id?: string
          created_at?: string
          default_service_description?: string | null
          id?: string
          iss_rate?: number | null
          municipality_ibge_code?: string | null
          municipality_name?: string | null
          service_code?: string | null
          service_list_item?: string | null
          state_uf?: string | null
          tax_regime?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_fiscal_settings_company_fk"
            columns: ["tenant_id", "company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "company_fiscal_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nfse_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          nfse_id: string
          payload: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: never
          nfse_id: string
          payload?: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: never
          nfse_id?: string
          payload?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfse_events_nfse_fk"
            columns: ["tenant_id", "nfse_id"]
            isOneToOne: false
            referencedRelation: "nfses"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "nfse_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nfses: {
        Row: {
          client_id: string | null
          company_id: string
          competence_date: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          issued_at: string | null
          pdf_url: string | null
          provider: string
          provider_nfse_number: string | null
          provider_request_id: string | null
          raw_request: Json | null
          raw_response: Json | null
          service_description: string | null
          service_value: number
          status: string
          tenant_id: string
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          client_id?: string | null
          company_id: string
          competence_date?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          issued_at?: string | null
          pdf_url?: string | null
          provider?: string
          provider_nfse_number?: string | null
          provider_request_id?: string | null
          raw_request?: Json | null
          raw_response?: Json | null
          service_description?: string | null
          service_value?: number
          status?: string
          tenant_id: string
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          client_id?: string | null
          company_id?: string
          competence_date?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          issued_at?: string | null
          pdf_url?: string | null
          provider?: string
          provider_nfse_number?: string | null
          provider_request_id?: string | null
          raw_request?: Json | null
          raw_response?: Json | null
          service_description?: string | null
          service_value?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfses_client_fk"
            columns: ["tenant_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "nfses_company_fk"
            columns: ["tenant_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "nfses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_members: {
        Row: {
          created_at: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          company_id: string | null
          created_at: string
          direction: string
          from_number: string | null
          id: number
          raw: Json
          tenant_id: string
          to_number: string | null
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          direction: string
          from_number?: string | null
          id?: never
          raw?: Json
          tenant_id: string
          to_number?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          direction?: string
          from_number?: string | null
          id?: never
          raw?: Json
          tenant_id?: string
          to_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_company_fk"
            columns: ["tenant_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "whatsapp_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_tenant_admin: { Args: { p_tenant_id: string }; Returns: boolean }
      is_tenant_creator: { Args: { p_tenant_id: string }; Returns: boolean }
      is_tenant_member: { Args: { p_tenant_id: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
