export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      categories: {
        Row: {
          color: string;
          created_at: string;
          default_assignee_id: string | null;
          icon: string;
          id: string;
          is_active: boolean;
          municipality_id: string;
          name: NonNullable<Json>;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          color?: string;
          created_at?: string;
          default_assignee_id?: string | null;
          icon?: string;
          id?: string;
          is_active?: boolean;
          municipality_id: string;
          name: NonNullable<Json>;
          sort_order?: number;
        };
        Update: {
          color?: string;
          created_at?: string;
          default_assignee_id?: string | null;
          icon?: string;
          id?: string;
          is_active?: boolean;
          municipality_id?: string;
          name?: NonNullable<Json>;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "categories_default_assignee_id_fkey";
            columns: ["default_assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "categories_municipality_id_fkey";
            columns: ["municipality_id"];
            isOneToOne: false;
            referencedRelation: "municipalities";
            referencedColumns: ["id"];
          },
        ];
      };
      content_flags: {
        Row: {
          comment_id: string | null;
          created_at: string;
          id: string;
          reason: string | null;
          report_id: string;
          reporter_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          reason?: string | null;
          report_id: string;
          reporter_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: {
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          reason?: string | null;
          report_id?: string;
          reporter_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "content_flags_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "report_comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_flags_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_flags_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_flags_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      municipalities: {
        Row: {
          boundary: unknown;
          center_lat: number;
          center_lng: number;
          contact_email: string | null;
          created_at: string;
          default_map_style: string;
          default_zoom: number;
          id: string;
          is_active: boolean;
          is_official: boolean;
          logo_path: string | null;
          name: string;
          primary_color: string;
          report_seq: number;
          slug: string;
          website_url: string | null;
        };
        ComputedFields: never;
        Insert: {
          boundary?: unknown;
          center_lat: number;
          center_lng: number;
          contact_email?: string | null;
          created_at?: string;
          default_map_style?: string;
          default_zoom?: number;
          id?: string;
          is_active?: boolean;
          is_official?: boolean;
          logo_path?: string | null;
          name: string;
          primary_color?: string;
          report_seq?: number;
          slug: string;
          website_url?: string | null;
        };
        Update: {
          boundary?: unknown;
          center_lat?: number;
          center_lng?: number;
          contact_email?: string | null;
          created_at?: string;
          default_map_style?: string;
          default_zoom?: number;
          id?: string;
          is_active?: boolean;
          is_official?: boolean;
          logo_path?: string | null;
          name?: string;
          primary_color?: string;
          report_seq?: number;
          slug?: string;
          website_url?: string | null;
        };
        Relationships: [];
      };
      municipality_members: {
        Row: {
          created_at: string;
          job_title: string | null;
          municipality_id: string;
          notify_category_ids: string[];
          notify_comments: boolean;
          role: Database["public"]["Enums"]["member_role"];
          status: Database["public"]["Enums"]["member_status"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          job_title?: string | null;
          municipality_id: string;
          notify_category_ids?: string[];
          notify_comments?: boolean;
          role?: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          job_title?: string | null;
          municipality_id?: string;
          notify_category_ids?: string[];
          notify_comments?: boolean;
          role?: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "municipality_members_municipality_id_fkey";
            columns: ["municipality_id"];
            isOneToOne: false;
            referencedRelation: "municipalities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "municipality_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          comment_notifications: boolean;
          created_at: string;
          email_notifications: boolean;
          full_name: string | null;
          id: string;
          is_platform_admin: boolean;
          locale: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          comment_notifications?: boolean;
          created_at?: string;
          email_notifications?: boolean;
          full_name?: string | null;
          id: string;
          is_platform_admin?: boolean;
          locale?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          comment_notifications?: boolean;
          created_at?: string;
          email_notifications?: boolean;
          full_name?: string | null;
          id?: string;
          is_platform_admin?: boolean;
          locale?: string | null;
        };
        Relationships: [];
      };
      rate_limit_events: {
        Row: {
          created_at: string;
          kind: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          kind: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          kind?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rate_limit_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      report_comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          is_hidden: boolean;
          is_official: boolean;
          parent_id: string | null;
          photos: string[];
          report_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          is_hidden?: boolean;
          is_official?: boolean;
          parent_id?: string | null;
          photos?: string[];
          report_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          is_hidden?: boolean;
          is_official?: boolean;
          parent_id?: string | null;
          photos?: string[];
          report_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "report_comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_comments_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
        ];
      };
      report_events: {
        Row: {
          actor_id: string | null;
          assignee_id: string | null;
          created_at: string;
          from_status_id: string | null;
          id: string;
          note: string | null;
          report_id: string;
          to_status_id: string | null;
          type: Database["public"]["Enums"]["report_event_type"];
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          assignee_id?: string | null;
          created_at?: string;
          from_status_id?: string | null;
          id?: string;
          note?: string | null;
          report_id: string;
          to_status_id?: string | null;
          type: Database["public"]["Enums"]["report_event_type"];
        };
        Update: {
          actor_id?: string | null;
          assignee_id?: string | null;
          created_at?: string;
          from_status_id?: string | null;
          id?: string;
          note?: string | null;
          report_id?: string;
          to_status_id?: string | null;
          type?: Database["public"]["Enums"]["report_event_type"];
        };
        Relationships: [
          {
            foreignKeyName: "report_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_events_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_events_from_status_id_fkey";
            columns: ["from_status_id"];
            isOneToOne: false;
            referencedRelation: "statuses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_events_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_events_to_status_id_fkey";
            columns: ["to_status_id"];
            isOneToOne: false;
            referencedRelation: "statuses";
            referencedColumns: ["id"];
          },
        ];
      };
      report_forwards: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          message: string | null;
          recipient_email: string | null;
          report_id: string;
          sent_by: string | null;
          token: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          message?: string | null;
          recipient_email?: string | null;
          report_id: string;
          sent_by?: string | null;
          token?: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          message?: string | null;
          recipient_email?: string | null;
          report_id?: string;
          sent_by?: string | null;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_forwards_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_forwards_sent_by_fkey";
            columns: ["sent_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      report_subscriptions: {
        Row: {
          created_at: string;
          report_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          report_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          report_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_subscriptions_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      report_votes: {
        Row: {
          created_at: string;
          report_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          report_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          report_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_votes_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          address: string | null;
          assignee_id: string | null;
          author_id: string;
          category_id: string;
          comment_count: number;
          created_at: string;
          description: string;
          duplicate_of: string | null;
          id: string;
          is_hidden: boolean;
          lat: number;
          lng: number;
          location: unknown;
          municipality_id: string;
          number: number;
          photos: string[];
          status_id: string;
          title: string | null;
          updated_at: string;
          vote_count: number;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          assignee_id?: string | null;
          author_id: string;
          category_id: string;
          comment_count?: number;
          created_at?: string;
          description: string;
          duplicate_of?: string | null;
          id?: string;
          is_hidden?: boolean;
          lat: number;
          lng: number;
          location?: never;
          municipality_id: string;
          number: number;
          photos?: string[];
          status_id: string;
          title?: string | null;
          updated_at?: string;
          vote_count?: number;
        };
        Update: {
          address?: string | null;
          assignee_id?: string | null;
          author_id?: string;
          category_id?: string;
          comment_count?: number;
          created_at?: string;
          description?: string;
          duplicate_of?: string | null;
          id?: string;
          is_hidden?: boolean;
          lat?: number;
          lng?: number;
          location?: never;
          municipality_id?: string;
          number?: number;
          photos?: string[];
          status_id?: string;
          title?: string | null;
          updated_at?: string;
          vote_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "reports_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_duplicate_of_fkey";
            columns: ["duplicate_of"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_municipality_id_fkey";
            columns: ["municipality_id"];
            isOneToOne: false;
            referencedRelation: "municipalities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_status_id_fkey";
            columns: ["status_id"];
            isOneToOne: false;
            referencedRelation: "statuses";
            referencedColumns: ["id"];
          },
        ];
      };
      statuses: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          is_active: boolean;
          is_closed: boolean;
          is_duplicate: boolean;
          is_initial: boolean;
          municipality_id: string;
          name: NonNullable<Json>;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_closed?: boolean;
          is_duplicate?: boolean;
          is_initial?: boolean;
          municipality_id: string;
          name: NonNullable<Json>;
          sort_order?: number;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_closed?: boolean;
          is_duplicate?: boolean;
          is_initial?: boolean;
          municipality_id?: string;
          name?: NonNullable<Json>;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "statuses_municipality_id_fkey";
            columns: ["municipality_id"];
            isOneToOne: false;
            referencedRelation: "municipalities";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      consume_rate_limit: {
        Args: { p_kind: string; p_limits: Json };
        Returns: undefined;
      };
      get_forwarded_report: { Args: { p_token: string }; Returns: Json };
      is_municipality_admin: { Args: { mid: string }; Returns: boolean };
      is_municipality_staff: { Args: { mid: string }; Returns: boolean };
      is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      merge_report: {
        Args: { p_duplicate_id: string; p_target_number: number };
        Returns: number;
      };
      municipality_at: {
        Args: { p_lat: number; p_lng: number };
        Returns: {
          boundary: unknown;
          center_lat: number;
          center_lng: number;
          contact_email: string | null;
          created_at: string;
          default_map_style: string;
          default_zoom: number;
          id: string;
          is_active: boolean;
          is_official: boolean;
          logo_path: string | null;
          name: string;
          primary_color: string;
          report_seq: number;
          slug: string;
          website_url: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "municipalities";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      municipality_boundary_geojson: {
        Args: { p_municipality_id: string };
        Returns: Json;
      };
      nearby_reports: {
        Args: {
          p_category_id?: string;
          p_lat: number;
          p_lng: number;
          p_municipality_id: string;
          p_radius_m?: number;
        };
        Returns: {
          category_id: string;
          created_at: string;
          description: string;
          distance_m: number;
          id: string;
          number: number;
          photos: string[];
          status_id: string;
          title: string;
          vote_count: number;
        }[];
      };
      point_in_municipality: {
        Args: { p_lat: number; p_lng: number; p_municipality_id: string };
        Returns: boolean;
      };
      recent_vote_counts: {
        Args: { p_days?: number; p_municipality_id: string };
        Returns: {
          report_id: string;
          votes: number;
        }[];
      };
      set_comment_hidden: {
        Args: { p_comment_id: string; p_hidden: boolean };
        Returns: undefined;
      };
      set_municipality_boundary: {
        Args: { p_geojson: Json; p_municipality_id: string };
        Returns: undefined;
      };
      set_notification_preferences: {
        Args: {
          p_category_ids: string[];
          p_comments: boolean;
          p_municipality_id: string;
        };
        Returns: undefined;
      };
      user_emails: {
        Args: { p_user_ids: string[] };
        Returns: {
          email: string;
          id: string;
        }[];
      };
      user_id_by_email: { Args: { p_email: string }; Returns: string };
    };
    Enums: {
      member_role: "admin" | "staff";
      member_status: "pending" | "approved" | "rejected";
      report_event_type:
        "created" | "status_changed" | "assigned" | "forwarded";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      member_role: ["admin", "staff"],
      member_status: ["pending", "approved", "rejected"],
      report_event_type: ["created", "status_changed", "assigned", "forwarded"],
    },
  },
} as const;
