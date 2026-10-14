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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          contact_email: string
          contact_phone: string
          id: number
          updated_at: string
        }
        Insert: {
          contact_email?: string
          contact_phone?: string
          id?: number
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_phone?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          created_at: string
          created_by: string | null
          dock_id: number | null
          ends_at: string
          id: string
          kind: string
          reason: string
          recurrence: string
          recurrence_until: string | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dock_id?: number | null
          ends_at: string
          id?: string
          kind: string
          reason: string
          recurrence?: string
          recurrence_until?: string | null
          starts_at: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dock_id?: number | null
          ends_at?: string
          id?: string
          kind?: string
          reason?: string
          recurrence?: string
          recurrence_until?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_dock_id_fkey"
            columns: ["dock_id"]
            isOneToOne: false
            referencedRelation: "docks"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          phone: string | null
          status: string
          tax_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string
          tax_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string
          tax_id?: string
        }
        Relationships: []
      }
      company_link_requests: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_new_company: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_new_company?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_new_company?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_link_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      docks: {
        Row: {
          active: boolean
          id: number
          name: string
        }
        Insert: {
          active?: boolean
          id: number
          name: string
        }
        Update: {
          active?: boolean
          id?: number
          name?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          day: string
          is_open: boolean
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          day: string
          is_open?: boolean
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          day?: string
          is_open?: boolean
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          can_scan_qr: boolean
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_internal: boolean
          language: string
          must_change_password: boolean
          status: string
          username: string | null
        }
        Insert: {
          can_scan_qr?: boolean
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_internal?: boolean
          language?: string
          must_change_password?: boolean
          status?: string
          username?: string | null
        }
        Update: {
          can_scan_qr?: boolean
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_internal?: boolean
          language?: string
          must_change_password?: boolean
          status?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_audit: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json
          created_at: string
          id: string
          reservation_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          id?: string
          reservation_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          id?: string
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_audit_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_orders: {
        Row: {
          id: string
          order_number: string
          pallets: number
          reservation_id: string
          supplier: string
        }
        Insert: {
          id?: string
          order_number: string
          pallets: number
          reservation_id: string
          supplier: string
        }
        Update: {
          id?: string
          order_number?: string
          pallets?: number
          reservation_id?: string
          supplier?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_orders_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          arrived_at: string | null
          cancel_reason: string | null
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          departed_at: string | null
          dock_id: number | null
          dock_released_at: string | null
          driver_doc: string | null
          driver_name: string
          ends_at: string
          id: string
          penalty: boolean
          qr_token: string
          qr_valid: boolean
          rescheduled: boolean
          service_date: string | null
          shift_code: string | null
          starts_at: string
          status: string
          total_pallets: number
          tractor_plate: string
          trailer_plate: string | null
          unload_ended_at: string | null
          unload_started_at: string | null
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          cancel_reason?: string | null
          code?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          departed_at?: string | null
          dock_id?: number | null
          dock_released_at?: string | null
          driver_doc?: string | null
          driver_name: string
          ends_at: string
          id?: string
          penalty?: boolean
          qr_token?: string
          qr_valid?: boolean
          rescheduled?: boolean
          service_date?: string | null
          shift_code?: string | null
          starts_at: string
          status?: string
          total_pallets: number
          tractor_plate: string
          trailer_plate?: string | null
          unload_ended_at?: string | null
          unload_started_at?: string | null
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          cancel_reason?: string | null
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          departed_at?: string | null
          dock_id?: number | null
          dock_released_at?: string | null
          driver_doc?: string | null
          driver_name?: string
          ends_at?: string
          id?: string
          penalty?: boolean
          qr_token?: string
          qr_valid?: boolean
          rescheduled?: boolean
          service_date?: string | null
          shift_code?: string | null
          starts_at?: string
          status?: string
          total_pallets?: number
          tractor_plate?: string
          trailer_plate?: string | null
          unload_ended_at?: string | null
          unload_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_dock_id_fkey"
            columns: ["dock_id"]
            isOneToOne: false
            referencedRelation: "docks"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_capacity_overrides: {
        Row: {
          max_pallets: number
          service_date: string
          shift_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          max_pallets: number
          service_date: string
          shift_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          max_pallets?: number
          service_date?: string
          shift_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_capacity_overrides_shift_code_fkey"
            columns: ["shift_code"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["code"]
          },
        ]
      }
      shifts: {
        Row: {
          code: string
          default_max_pallets: number
          end_min: number
          sort: number
          start_min: number
        }
        Insert: {
          code: string
          default_max_pallets: number
          end_min: number
          sort: number
          start_min: number
        }
        Update: {
          code?: string
          default_max_pallets?: number
          end_min?: number
          sort?: number
          start_min?: number
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_cancel_reservation: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      admin_delete_block: { Args: { _id: string }; Returns: undefined }
      admin_save_block: {
        Args: {
          _dock: number
          _end: string
          _id: string
          _kind: string
          _reason: string
          _recurrence: string
          _start: string
          _until: string
        }
        Returns: string
      }
      admin_set_capacity_override: {
        Args: { _code: string; _date: string; _max: number }
        Returns: undefined
      }
      admin_set_holiday_open: {
        Args: { _day: string; _open: boolean }
        Returns: undefined
      }
      admin_set_shift_default: {
        Args: { _code: string; _max: number }
        Returns: undefined
      }
      admin_update_reservation: {
        Args: {
          _date: string
          _driver_doc: string
          _driver_name: string
          _id: string
          _orders: Json
          _time: string
          _tractor_plate: string
          _trailer_plate: string
        }
        Returns: undefined
      }
      admin_update_settings: {
        Args: { _email: string; _phone: string }
        Returns: undefined
      }
      admin_update_user: {
        Args: { _can_scan: boolean; _status: string; _user_id: string }
        Returns: undefined
      }
      block_affected: {
        Args: {
          _dock: number
          _end: string
          _recurrence: string
          _start: string
          _until: string
        }
        Returns: {
          code: string
          id: string
          starts_at: string
        }[]
      }
      block_hits: {
        Args: {
          _b: Database["public"]["Tables"]["blocks"]["Row"]
          _e: string
          _s: string
        }
        Returns: boolean
      }
      calendar_summary: {
        Args: { _from: string; _to: string }
        Returns: {
          blocks: number
          day: string
          holiday_name: string
          holiday_open: boolean
          max_pallets: number
          shift_code: string
          used: number
        }[]
      }
      can_gate: { Args: { _user_id: string }; Returns: boolean }
      carrier_available_slots: {
        Args: { _date: string; _pallets: number }
        Returns: string[]
      }
      carrier_cancel_reservation: {
        Args: { _id: string; _reason: string }
        Returns: boolean
      }
      carrier_company: { Args: never; Returns: string }
      carrier_create_reservation: {
        Args: {
          _date: string
          _driver_doc: string
          _driver_name: string
          _orders: Json
          _time: string
          _tractor_plate: string
          _trailer_plate: string
        }
        Returns: string
      }
      carrier_update_driver: {
        Args: {
          _driver_doc: string
          _driver_name: string
          _id: string
          _tractor_plate: string
          _trailer_plate: string
        }
        Returns: undefined
      }
      check_capacity: {
        Args: {
          _end: string
          _exclude: string
          _pallets: number
          _start: string
        }
        Returns: undefined
      }
      complete_password_change: { Args: never; Returns: undefined }
      free_docks: { Args: { _id: string }; Returns: number[] }
      gate_lookup: {
        Args: { _token: string }
        Returns: {
          code: string
          company: string
          driver_doc: string
          driver_name: string
          ends_at: string
          id: string
          starts_at: string
          status: string
          tractor_plate: string
          trailer_plate: string
          valid: boolean
        }[]
      }
      gate_register_arrival: { Args: { _token: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_status: { Args: { _s: string }; Returns: boolean }
      is_staff_manager: { Args: { _user_id: string }; Returns: boolean }
      pallets_duration_min: { Args: { _pallets: number }; Returns: number }
      review_link_request: {
        Args: { _approve: boolean; _request_id: string }
        Returns: undefined
      }
      shift_at: { Args: { _t: string }; Returns: Record<string, unknown> }
      shift_max_pallets: {
        Args: { _code: string; _date: string }
        Returns: number
      }
      staff_advance: {
        Args: { _action: string; _id: string }
        Returns: undefined
      }
      staff_assign_dock: {
        Args: { _dock: number; _id: string }
        Returns: undefined
      }
      submit_company_registration: {
        Args: { _name: string; _phone: string; _tax_id: string }
        Returns: string
      }
      validate_orders_json: { Args: { _orders: Json }; Returns: number }
    }
    Enums: {
      app_role:
        | "admin"
        | "administrativo"
        | "transportista"
        | "bascula"
        | "almacen"
        | "control_accesos"
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
  public: {
    Enums: {
      app_role: [
        "admin",
        "administrativo",
        "transportista",
        "bascula",
        "almacen",
        "control_accesos",
      ],
    },
  },
} as const
