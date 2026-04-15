export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      sessions: {
        Row: {
          created_at: string;
          device_id: string;
          ended_at: string | null;
          id: string;
          started_at: string;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          device_id: string;
          ended_at?: string | null;
          id?: string;
          started_at?: string;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          device_id?: string;
          ended_at?: string | null;
          id?: string;
          started_at?: string;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      shot_events: {
        Row: {
          captured_at: string;
          confidence: number;
          created_at: string;
          frame_id: string | null;
          id: string;
          result: string;
          session_id: string;
          swish: boolean | null;
          x: number;
          y: number;
        };
        Insert: {
          captured_at?: string;
          confidence: number;
          created_at?: string;
          frame_id?: string | null;
          id?: string;
          result: string;
          session_id: string;
          swish?: boolean | null;
          x: number;
          y: number;
        };
        Update: {
          captured_at?: string;
          confidence?: number;
          created_at?: string;
          frame_id?: string | null;
          id?: string;
          result?: string;
          session_id?: string;
          swish?: boolean | null;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: "shot_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "progress_over_time";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "shot_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "session_summaries";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "shot_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      overall_analytics: {
        Row: {
          attempts: number | null;
          avg_streak: number | null;
          consistency: number | null;
          fg_percent: number | null;
          made: number | null;
          missed: number | null;
          swish_rate: number | null;
        };
        Relationships: [];
      };
      progress_over_time: {
        Row: {
          attempts: number | null;
          best_streak: number | null;
          efg_percent: number | null;
          fg_percent: number | null;
          made: number | null;
          missed: number | null;
          session_id: string | null;
          started_at: string | null;
        };
        Relationships: [];
      };
      session_streaks: {
        Row: {
          best_streak: number | null;
          session_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "shot_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "progress_over_time";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "shot_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "session_summaries";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "shot_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          }
        ];
      };
      session_summaries: {
        Row: {
          attempts: number | null;
          best_streak: number | null;
          device_id: string | null;
          efg_percent: number | null;
          fg_percent: number | null;
          last_shot_at: string | null;
          made: number | null;
          missed: number | null;
          session_id: string | null;
          started_at: string | null;
          swish_rate: number | null;
        };
        Relationships: [];
      };
      shot_map_points: {
        Row: {
          captured_at: string | null;
          confidence: number | null;
          frame_id: string | null;
          id: string | null;
          result: string | null;
          session_id: string | null;
          swish: boolean | null;
          x: number | null;
          y: number | null;
        };
        Insert: {
          captured_at?: string | null;
          confidence?: number | null;
          frame_id?: string | null;
          id?: string | null;
          result?: string | null;
          session_id?: string | null;
          swish?: boolean | null;
          x?: number | null;
          y?: number | null;
        };
        Update: {
          captured_at?: string | null;
          confidence?: number | null;
          frame_id?: string | null;
          id?: string | null;
          result?: string | null;
          session_id?: string | null;
          swish?: boolean | null;
          x?: number | null;
          y?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "shot_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "progress_over_time";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "shot_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "session_summaries";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "shot_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof DatabaseWithoutInternals, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]
      )
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]
    )[TableName] extends { Row: infer RowType }
    ? RowType
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer RowType;
      }
      ? RowType
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer InsertType;
    }
    ? InsertType
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer InsertType }
      ? InsertType
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer UpdateType;
    }
    ? UpdateType
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer UpdateType }
      ? UpdateType
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {}
  }
} as const;
