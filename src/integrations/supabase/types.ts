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
      driver_wallets: {
        Row: {
          balance: number
          created_at: string
          driver_user_id: string
          id: string
          total_earned: number
          total_withdrawn: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          driver_user_id: string
          id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          driver_user_id?: string
          id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
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
          last_sync_at: string | null
          merchant_code: string | null
          merchant_name: string | null
          out_for_delivery_at: string | null
          payment_collected_in_cash: boolean | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          phone_confirmed_at: string | null
          source_channel: string | null
          source_system_id: string | null
          subtotal: number | null
          sync_attempts: number
          sync_error: string | null
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
          last_sync_at?: string | null
          merchant_code?: string | null
          merchant_name?: string | null
          out_for_delivery_at?: string | null
          payment_collected_in_cash?: boolean | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          phone_confirmed_at?: string | null
          source_channel?: string | null
          source_system_id?: string | null
          subtotal?: number | null
          sync_attempts?: number
          sync_error?: string | null
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
          last_sync_at?: string | null
          merchant_code?: string | null
          merchant_name?: string | null
          out_for_delivery_at?: string | null
          payment_collected_in_cash?: boolean | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          phone_confirmed_at?: string | null
          source_channel?: string | null
          source_system_id?: string | null
          subtotal?: number | null
          sync_attempts?: number
          sync_error?: string | null
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
      pwa_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          prompt_frequency_hours: number
          prompt_message: string
          prompt_title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          prompt_frequency_hours?: number
          prompt_message?: string
          prompt_title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          prompt_frequency_hours?: number
          prompt_message?: string
          prompt_title?: string
          updated_at?: string
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
      wallet_settings: {
        Row: {
          created_at: string
          delivery_fee_per_order: number
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_fee_per_order?: number
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_fee_per_order?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by_user_id: string | null
          description: string | null
          driver_user_id: string
          id: string
          order_id: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after?: number
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          driver_user_id: string
          id?: string
          order_id?: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          driver_user_id?: string
          id?: string
          order_id?: string | null
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "driver_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          attempt_count: number | null
          created_at: string
          event_id: string | null
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
          event_id?: string | null
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
          event_id?: string | null
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
      withdrawal_requests: {
        Row: {
          amount: number
          bank_account: string | null
          bank_name: string | null
          created_at: string
          driver_user_id: string
          id: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          wallet_id: string
        }
        Insert: {
          amount: number
          bank_account?: string | null
          bank_name?: string | null
          created_at?: string
          driver_user_id: string
          id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          wallet_id: string
        }
        Update: {
          amount?: number
          bank_account?: string | null
          bank_name?: string | null
          created_at?: string
          driver_user_id?: string
          id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "driver_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_drivers_safe: {
        Args: never
        Returns: {
          active: boolean
          full_name: string
          phone: string
          user_id: string
        }[]
      }
      get_source_systems_safe: {
        Args: never
        Returns: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          notes: string
          updated_at: string
        }[]
      }
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
      wallet_tx_type:
        | "delivery_earning"
        | "withdrawal"
        | "adjustment_add"
        | "adjustment_subtract"
        | "bank_transfer"
      withdrawal_status: "pending" | "approved" | "rejected" | "completed"
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
      wallet_tx_type: [
        "delivery_earning",
        "withdrawal",
        "adjustment_add",
        "adjustment_subtract",
        "bank_transfer",
      ],
      withdrawal_status: ["pending", "approved", "rejected", "completed"],
    },
  },
} as const
