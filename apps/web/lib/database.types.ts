export type Database = {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string;
          device_id: string;
          started_at: string;
          ended_at: string | null;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          started_at?: string;
          ended_at?: string | null;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
        Relationships: [];
      };
      shot_events: {
        Row: {
          id: string;
          session_id: string;
          captured_at: string;
          result: "made" | "missed";
          x: number;
          y: number;
          confidence: number;
          frame_id: string | null;
          swish: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          captured_at?: string;
          result: "made" | "missed";
          x: number;
          y: number;
          confidence: number;
          frame_id?: string | null;
          swish?: boolean | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shot_events"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      session_summaries: {
        Row: {
          session_id: string | null;
          device_id: string | null;
          started_at: string | null;
          last_shot_at: string | null;
          attempts: number | null;
          made: number | null;
          missed: number | null;
          fg_percent: number | null;
          efg_percent: number | null;
          swish_rate: number | null;
          best_streak: number | null;
        };
        Relationships: [];
      };
      overall_analytics: {
        Row: {
          attempts: number | null;
          made: number | null;
          missed: number | null;
          fg_percent: number | null;
          swish_rate: number | null;
          avg_streak: number | null;
          consistency: number | null;
        };
        Relationships: [];
      };
      progress_over_time: {
        Row: {
          session_id: string | null;
          started_at: string | null;
          attempts: number | null;
          made: number | null;
          missed: number | null;
          fg_percent: number | null;
          efg_percent: number | null;
          best_streak: number | null;
        };
        Relationships: [];
      };
      shot_map_points: {
        Row: {
          id: string | null;
          session_id: string | null;
          captured_at: string | null;
          result: string | null;
          x: number | null;
          y: number | null;
          confidence: number | null;
          frame_id: string | null;
          swish: boolean | null;
        };
        Relationships: [];
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
