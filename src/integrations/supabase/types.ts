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
      attack_chain_events: {
        Row: {
          bssid: string | null
          description: string
          event_type: string
          id: string
          incident_id: string
          metadata: Json
          occurred_at: string
          sequence: number
          source_mac: string | null
          stage: Database["public"]["Enums"]["kill_chain_stage"]
          target_mac: string | null
          threat_id: string | null
        }
        Insert: {
          bssid?: string | null
          description: string
          event_type: string
          id?: string
          incident_id: string
          metadata?: Json
          occurred_at?: string
          sequence: number
          source_mac?: string | null
          stage: Database["public"]["Enums"]["kill_chain_stage"]
          target_mac?: string | null
          threat_id?: string | null
        }
        Update: {
          bssid?: string | null
          description?: string
          event_type?: string
          id?: string
          incident_id?: string
          metadata?: Json
          occurred_at?: string
          sequence?: number
          source_mac?: string | null
          stage?: Database["public"]["Enums"]["kill_chain_stage"]
          target_mac?: string | null
          threat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attack_chain_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attack_chain_events_threat_id_fkey"
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
      host_cves: {
        Row: {
          created_at: string
          cve_id: string
          cvss: number
          exploit_available: boolean
          host_id: string
          id: string
          port_id: string | null
          product: string | null
          reference_url: string | null
          scan_id: string
          severity: string
          summary: string
          version: string | null
        }
        Insert: {
          created_at?: string
          cve_id: string
          cvss?: number
          exploit_available?: boolean
          host_id: string
          id?: string
          port_id?: string | null
          product?: string | null
          reference_url?: string | null
          scan_id: string
          severity?: string
          summary: string
          version?: string | null
        }
        Update: {
          created_at?: string
          cve_id?: string
          cvss?: number
          exploit_available?: boolean
          host_id?: string
          id?: string
          port_id?: string | null
          product?: string | null
          reference_url?: string | null
          scan_id?: string
          severity?: string
          summary?: string
          version?: string | null
        }
        Relationships: []
      }
      incidents: {
        Row: {
          actor_id: string | null
          affected_bssids: string[]
          affected_clients: string[]
          ai_narrative: string | null
          closed_at: string | null
          created_at: string
          current_stage: Database["public"]["Enums"]["kill_chain_stage"]
          id: string
          last_event_at: string
          severity: Database["public"]["Enums"]["severity_level"]
          started_at: string
          status: Database["public"]["Enums"]["incident_status"]
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          affected_bssids?: string[]
          affected_clients?: string[]
          ai_narrative?: string | null
          closed_at?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["kill_chain_stage"]
          id?: string
          last_event_at?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          started_at?: string
          status?: Database["public"]["Enums"]["incident_status"]
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          affected_bssids?: string[]
          affected_clients?: string[]
          ai_narrative?: string | null
          closed_at?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["kill_chain_stage"]
          id?: string
          last_event_at?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          started_at?: string
          status?: Database["public"]["Enums"]["incident_status"]
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "threat_actors"
            referencedColumns: ["id"]
          },
        ]
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
      network_baseline: {
        Row: {
          approved: boolean
          device_type: string | null
          first_seen: string
          id: string
          ip: string | null
          label: string | null
          last_seen: string
          mac: string | null
          notes: string | null
        }
        Insert: {
          approved?: boolean
          device_type?: string | null
          first_seen?: string
          id?: string
          ip?: string | null
          label?: string | null
          last_seen?: string
          mac?: string | null
          notes?: string | null
        }
        Update: {
          approved?: boolean
          device_type?: string | null
          first_seen?: string
          id?: string
          ip?: string | null
          label?: string | null
          last_seen?: string
          mac?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      network_scans: {
        Row: {
          created_at: string
          duration_ms: number | null
          finished_at: string | null
          high_risk_count: number
          host_count: number
          id: string
          open_port_count: number
          profile: Database["public"]["Enums"]["scan_profile"]
          raw_summary: Json
          sensor_id: string
          started_at: string
          target: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          finished_at?: string | null
          high_risk_count?: number
          host_count?: number
          id?: string
          open_port_count?: number
          profile?: Database["public"]["Enums"]["scan_profile"]
          raw_summary?: Json
          sensor_id: string
          started_at?: string
          target: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          finished_at?: string | null
          high_risk_count?: number
          host_count?: number
          id?: string
          open_port_count?: number
          profile?: Database["public"]["Enums"]["scan_profile"]
          raw_summary?: Json
          sensor_id?: string
          started_at?: string
          target?: string
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
      rssi_observations: {
        Row: {
          channel: number | null
          id: string
          observed_at: string
          rssi: number
          sensor_id: string
          target_bssid: string
        }
        Insert: {
          channel?: number | null
          id?: string
          observed_at?: string
          rssi: number
          sensor_id: string
          target_bssid: string
        }
        Update: {
          channel?: number | null
          id?: string
          observed_at?: string
          rssi?: number
          sensor_id?: string
          target_bssid?: string
        }
        Relationships: []
      }
      scan_hosts: {
        Row: {
          created_at: string
          highest_risk: Database["public"]["Enums"]["port_risk"]
          hostname: string | null
          id: string
          ip: string
          mac: string | null
          open_port_count: number
          os_accuracy: number | null
          os_guess: string | null
          scan_id: string
          status: string
          vendor: string | null
        }
        Insert: {
          created_at?: string
          highest_risk?: Database["public"]["Enums"]["port_risk"]
          hostname?: string | null
          id?: string
          ip: string
          mac?: string | null
          open_port_count?: number
          os_accuracy?: number | null
          os_guess?: string | null
          scan_id: string
          status?: string
          vendor?: string | null
        }
        Update: {
          created_at?: string
          highest_risk?: Database["public"]["Enums"]["port_risk"]
          hostname?: string | null
          id?: string
          ip?: string
          mac?: string | null
          open_port_count?: number
          os_accuracy?: number | null
          os_guess?: string | null
          scan_id?: string
          status?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_hosts_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "network_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_jobs: {
        Row: {
          assigned_sensor: string | null
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          profile: Database["public"]["Enums"]["scan_profile"]
          requested_by: string | null
          scan_id: string | null
          status: Database["public"]["Enums"]["scan_job_status"]
          target: string
          updated_at: string
        }
        Insert: {
          assigned_sensor?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          profile?: Database["public"]["Enums"]["scan_profile"]
          requested_by?: string | null
          scan_id?: string | null
          status?: Database["public"]["Enums"]["scan_job_status"]
          target: string
          updated_at?: string
        }
        Update: {
          assigned_sensor?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          profile?: Database["public"]["Enums"]["scan_profile"]
          requested_by?: string | null
          scan_id?: string | null
          status?: Database["public"]["Enums"]["scan_job_status"]
          target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_jobs_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "network_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_ports: {
        Row: {
          cpe: string | null
          created_at: string
          extra_info: string | null
          host_id: string
          id: string
          port: number
          product: string | null
          protocol: string
          risk: Database["public"]["Enums"]["port_risk"]
          risk_reason: string | null
          scan_id: string
          service: string | null
          state: string
          version: string | null
        }
        Insert: {
          cpe?: string | null
          created_at?: string
          extra_info?: string | null
          host_id: string
          id?: string
          port: number
          product?: string | null
          protocol?: string
          risk?: Database["public"]["Enums"]["port_risk"]
          risk_reason?: string | null
          scan_id: string
          service?: string | null
          state?: string
          version?: string | null
        }
        Update: {
          cpe?: string | null
          created_at?: string
          extra_info?: string | null
          host_id?: string
          id?: string
          port?: number
          product?: string | null
          protocol?: string
          risk?: Database["public"]["Enums"]["port_risk"]
          risk_reason?: string | null
          scan_id?: string
          service?: string | null
          state?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_ports_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "scan_hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_ports_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "network_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      security_recommendations: {
        Row: {
          category: string
          created_at: string
          host_id: string | null
          id: string
          priority: Database["public"]["Enums"]["rec_priority"]
          rationale: string
          scan_id: string | null
          status: Database["public"]["Enums"]["rec_status"]
          threat_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          host_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["rec_priority"]
          rationale: string
          scan_id?: string | null
          status?: Database["public"]["Enums"]["rec_status"]
          threat_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          host_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["rec_priority"]
          rationale?: string
          scan_id?: string | null
          status?: Database["public"]["Enums"]["rec_status"]
          threat_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_scores: {
        Row: {
          computed_at: string
          details: Json
          encryption: number
          id: string
          iot: number
          network: number
          overall: number
          scan_id: string | null
          wireless: number
        }
        Insert: {
          computed_at?: string
          details?: Json
          encryption?: number
          id?: string
          iot?: number
          network?: number
          overall?: number
          scan_id?: string | null
          wireless?: number
        }
        Update: {
          computed_at?: string
          details?: Json
          encryption?: number
          id?: string
          iot?: number
          network?: number
          overall?: number
          scan_id?: string | null
          wireless?: number
        }
        Relationships: []
      }
      sensors: {
        Row: {
          created_at: string
          floor: string
          id: string
          label: string
          last_seen: string
          online: boolean
          sensor_id: string
          x_meters: number
          y_meters: number
        }
        Insert: {
          created_at?: string
          floor?: string
          id?: string
          label: string
          last_seen?: string
          online?: boolean
          sensor_id: string
          x_meters?: number
          y_meters?: number
        }
        Update: {
          created_at?: string
          floor?: string
          id?: string
          label?: string
          last_seen?: string
          online?: boolean
          sensor_id?: string
          x_meters?: number
          y_meters?: number
        }
        Relationships: []
      }
      threat_actors: {
        Row: {
          attack_count: number
          fingerprint: string
          first_seen: string
          id: string
          label: string
          last_seen: string
          notes: string | null
          preferred_channels: number[]
          preferred_types: string[]
          risk_score: number
          source_macs: string[]
        }
        Insert: {
          attack_count?: number
          fingerprint: string
          first_seen?: string
          id?: string
          label: string
          last_seen?: string
          notes?: string | null
          preferred_channels?: number[]
          preferred_types?: string[]
          risk_score?: number
          source_macs?: string[]
        }
        Update: {
          attack_count?: number
          fingerprint?: string
          first_seen?: string
          id?: string
          label?: string
          last_seen?: string
          notes?: string | null
          preferred_channels?: number[]
          preferred_types?: string[]
          risk_score?: number
          source_macs?: string[]
        }
        Relationships: []
      }
      threats: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          actor_id: string | null
          bssid: string | null
          confidence: number
          description: string
          detected_at: string
          id: string
          incident_id: string | null
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
          actor_id?: string | null
          bssid?: string | null
          confidence?: number
          description: string
          detected_at?: string
          id?: string
          incident_id?: string | null
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
          actor_id?: string | null
          bssid?: string | null
          confidence?: number
          description?: string
          detected_at?: string
          id?: string
          incident_id?: string | null
          metadata?: Json
          severity?: Database["public"]["Enums"]["severity_level"]
          source_mac?: string | null
          ssid?: string | null
          type?: Database["public"]["Enums"]["threat_type"]
        }
        Relationships: [
          {
            foreignKeyName: "threats_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "threat_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threats_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
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
      incident_status: "open" | "investigating" | "contained" | "closed"
      kill_chain_stage:
        | "recon"
        | "weaponization"
        | "delivery"
        | "exploitation"
        | "installation"
        | "c2"
        | "actions"
      port_risk: "info" | "low" | "medium" | "high" | "critical"
      rec_priority: "low" | "medium" | "high" | "critical"
      rec_status: "open" | "in_progress" | "resolved" | "dismissed"
      scan_job_status:
        | "queued"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      scan_profile: "discovery" | "quick" | "default" | "intense" | "vuln"
      severity_level: "info" | "warning" | "high" | "critical"
      threat_type:
        | "rogue_ap"
        | "evil_twin"
        | "deauth_flood"
        | "beacon_flood"
        | "mac_spoof"
        | "anomaly"
        | "wps_attack"
        | "karma"
        | "pmkid_capture"
        | "krack"
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
      incident_status: ["open", "investigating", "contained", "closed"],
      kill_chain_stage: [
        "recon",
        "weaponization",
        "delivery",
        "exploitation",
        "installation",
        "c2",
        "actions",
      ],
      port_risk: ["info", "low", "medium", "high", "critical"],
      rec_priority: ["low", "medium", "high", "critical"],
      rec_status: ["open", "in_progress", "resolved", "dismissed"],
      scan_job_status: [
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      scan_profile: ["discovery", "quick", "default", "intense", "vuln"],
      severity_level: ["info", "warning", "high", "critical"],
      threat_type: [
        "rogue_ap",
        "evil_twin",
        "deauth_flood",
        "beacon_flood",
        "mac_spoof",
        "anomaly",
        "wps_attack",
        "karma",
        "pmkid_capture",
        "krack",
      ],
    },
  },
} as const
