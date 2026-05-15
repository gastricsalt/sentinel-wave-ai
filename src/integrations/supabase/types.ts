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
      access_points: {
        Row: {
          bssid: string
          channel: number | null
          encryption: string | null
          first_seen: string
          id: string
          is_hidden: boolean
          is_rogue: boolean
          last_seen: string
          signal_strength: number | null
          ssid: string | null
          vendor: string | null
        }
        Insert: {
          bssid: string
          channel?: number | null
          encryption?: string | null
          first_seen?: string
          id?: string
          is_hidden?: boolean
          is_rogue?: boolean
          last_seen?: string
          signal_strength?: number | null
          ssid?: string | null
          vendor?: string | null
        }
        Update: {
          bssid?: string
          channel?: number | null
          encryption?: string | null
          first_seen?: string
          id?: string
          is_hidden?: boolean
          is_rogue?: boolean
          last_seen?: string
          signal_strength?: number | null
          ssid?: string | null
          vendor?: string | null
        }
        Relationships: []
      }
      alerts: {
        Row: {
          acknowledged: boolean
          created_at: string
          id: string
          message: string
          severity: Database["public"]["Enums"]["severity_level"]
          threat_id: string | null
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string
          id?: string
          message: string
          severity?: Database["public"]["Enums"]["severity_level"]
          threat_id?: string | null
        }
        Update: {
          acknowledged?: boolean
          created_at?: string
          id?: string
          message?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          threat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_threat_id_fkey"
            columns: ["threat_id"]
            isOneToOne: false
            referencedRelation: "threats"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          associated_bssid: string | null
          first_seen: string
          id: string
          is_random_mac: boolean
          last_seen: string
          mac: string
          packets_seen: number
          signal_strength: number | null
          vendor: string | null
        }
        Insert: {
          associated_bssid?: string | null
          first_seen?: string
          id?: string
          is_random_mac?: boolean
          last_seen?: string
          mac: string
          packets_seen?: number
          signal_strength?: number | null
          vendor?: string | null
        }
        Update: {
          associated_bssid?: string | null
          first_seen?: string
          id?: string
          is_random_mac?: boolean
          last_seen?: string
          mac?: string
          packets_seen?: number
          signal_strength?: number | null
          vendor?: string | null
        }
        Relationships: []
      }
      ingest_events: {
        Row: {
          ap_count: number
          client_count: number
          created_at: string
          id: string
          payload: Json
          sensor_id: string
          threat_count: number
        }
        Insert: {
          ap_count?: number
          client_count?: number
          created_at?: string
          id?: string
          payload: Json
          sensor_id: string
          threat_count?: number
        }
        Update: {
          ap_count?: number
          client_count?: number
          created_at?: string
          id?: string
          payload?: Json
          sensor_id?: string
          threat_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      threats: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          bssid: string | null
          confidence: number
          description: string
          detected_at: string
          id: string
          metadata: Json
          severity: Database["public"]["Enums"]["severity_level"]
          source_mac: string | null
          ssid: string | null
          type: Database["public"]["Enums"]["threat_type"]
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          bssid?: string | null
          confidence?: number
          description: string
          detected_at?: string
          id?: string
          metadata?: Json
          severity?: Database["public"]["Enums"]["severity_level"]
          source_mac?: string | null
          ssid?: string | null
          type: Database["public"]["Enums"]["threat_type"]
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          bssid?: string | null
          confidence?: number
          description?: string
          detected_at?: string
          id?: string
          metadata?: Json
          severity?: Database["public"]["Enums"]["severity_level"]
          source_mac?: string | null
          ssid?: string | null
          type?: Database["public"]["Enums"]["threat_type"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "analyst"
      severity_level: "info" | "warning" | "high" | "critical"
      threat_type:
        | "rogue_ap"
        | "evil_twin"
        | "deauth_flood"
        | "beacon_flood"
        | "mac_spoof"
        | "anomaly"
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
      app_role: ["admin", "analyst"],
      severity_level: ["info", "warning", "high", "critical"],
      threat_type: [
        "rogue_ap",
        "evil_twin",
        "deauth_flood",
        "beacon_flood",
        "mac_spoof",
        "anomaly",
      ],
    },
  },
} as const
