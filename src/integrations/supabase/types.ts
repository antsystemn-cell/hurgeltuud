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
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number | null
          order_id: string
          product_name_snapshot: string
          quantity: number
          sku_snapshot: string | null
          unit_price: number | null
          variant_snapshot: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number | null
          order_id: string
          product_name_snapshot: string
          quantity?: number
          sku_snapshot?: string | null
          unit_price?: number | null
          variant_snapshot?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number | null
          order_id?: string
          product_name_snapshot?: string
          quantity?: number
          sku_snapshot?: string | null
          unit_price?: number | null
          variant_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_text: string | null
          alternate_phone: string | null
          assigned_driver_user_id: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by_user_id: string | null
          customer_name: string
          customer_note: string | null
          delivered_at: string | null
          delivery_fee: number | null
          delivery_note: string | null
          district: string | null
          external_order_id: string | null
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"]
          id: string
          idempotency_key: string | null
          internal_note: string | null
          internal_order_number: string
          out_for_delivery_at: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          phone_confirmed_at: string | null
          source_channel: string | null
          source_system_id: string | null
          subtotal: number | null
          total_amount: number | null
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          address_text?: string | null
          alternate_phone?: string | null
          assigned_driver_user_id?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_name: string
          customer_note?: string | null
          delivered_at?: string | null
          delivery_fee?: number | null
          delivery_note?: string | null
          district?: string | null
          external_order_id?: string | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          id?: string
          idempotency_key?: string | null
          internal_note?: string | null
          internal_order_number: string
          out_for_delivery_at?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          phone_confirmed_at?: string | null
          source_channel?: string | null
          source_system_id?: string | null
          subtotal?: number | null
          total_amount?: number | null
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          address_text?: string | null
          alternate_phone?: string | null
          assigned_driver_user_id?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_name?: string
          customer_note?: string | null
          delivered_at?: string | null
          delivery_fee?: number | null
          delivery_note?: string | null
          district?: string | null
          external_order_id?: string | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          id?: string
          idempotency_key?: string | null
          internal_note?: string | null
          internal_order_number?: string
          out_for_delivery_at?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          phone_confirmed_at?: string | null
          source_channel?: string | null
          source_system_id?: string | null
          subtotal?: number | null
          total_amount?: number | null
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_source_system_id_fkey"
            columns: ["source_system_id"]
            isOneToOne: false
            referencedRelation: "source_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      source_systems: {
        Row: {
          active: boolean
          api_key: string | null
          code: string
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          active?: boolean
          api_key?: string | null
          code: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          active?: boolean
          api_key?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          attempt_count: number | null
          created_at: string
          event_type: string
          id: string
          next_retry_at: string | null
          order_id: string | null
          payload: Json | null
          response_body: string | null
          response_status: number | null
          source_system_id: string | null
          success: boolean | null
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string
          event_type: string
          id?: string
          next_retry_at?: string | null
          order_id?: string | null
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          source_system_id?: string | null
          success?: boolean | null
        }
        Update: {
          attempt_count?: number | null
          created_at?: string
          event_type?: string
          id?: string
          next_retry_at?: string | null
          order_id?: string | null
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          source_system_id?: string | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_source_system_id_fkey"
            columns: ["source_system_id"]
            isOneToOne: false
            referencedRelation: "source_systems"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "main_admin" | "operator" | "driver"
      fulfillment_status:
        | "confirmed"
        | "phone_confirmed"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      payment_status: "unpaid" | "cash_on_delivery" | "paid" | "refunded"
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
    Enums: {
      app_role: ["main_admin", "operator", "driver"],
      fulfillment_status: [
        "confirmed",
        "phone_confirmed",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      payment_status: ["unpaid", "cash_on_delivery", "paid", "refunded"],
    },
  },
} as const
