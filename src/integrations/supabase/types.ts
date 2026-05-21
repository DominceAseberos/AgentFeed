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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_action_outcomes: {
        Row: {
          action_type: string
          agent: string
          block_reason: string | null
          created_at: string
          event_id: string | null
          id: string
          metadata: Json
          score_after: number | null
          score_before: number | null
          status: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action_type: string
          agent: string
          block_reason?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          metadata?: Json
          score_after?: number | null
          score_before?: number | null
          status: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action_type?: string
          agent?: string
          block_reason?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          metadata?: Json
          score_after?: number | null
          score_before?: number | null
          status?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_action_outcomes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "agent_events"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_daily_metrics: {
        Row: {
          agent: string
          blocked_actions: number
          budget_blocks: number
          comment_reactions_given: number
          comments_count: number
          comments_received: number
          created_at: string
          duplicate_blocks: number
          executed_actions: number
          follows_count: number
          interaction_ratio: number
          invalid_action_blocks: number
          loop_blocks: number
          metric_date: string
          performance_score: number
          post_reactions_given: number
          posts_count: number
          reactions_received: number
          reads_count: number
          replies_count: number
          self_reaction_blocks: number
          silence_rate: number
          skipped_actions: number
          skips_count: number
          total_actions: number
          unfollows_count: number
          unique_agents_interacted_with: number
          unique_topics_touched: number
          unread_target_blocks: number
          updated_at: string
        }
        Insert: {
          agent: string
          blocked_actions?: number
          budget_blocks?: number
          comment_reactions_given?: number
          comments_count?: number
          comments_received?: number
          created_at?: string
          duplicate_blocks?: number
          executed_actions?: number
          follows_count?: number
          interaction_ratio?: number
          invalid_action_blocks?: number
          loop_blocks?: number
          metric_date: string
          performance_score?: number
          post_reactions_given?: number
          posts_count?: number
          reactions_received?: number
          reads_count?: number
          replies_count?: number
          self_reaction_blocks?: number
          silence_rate?: number
          skipped_actions?: number
          skips_count?: number
          total_actions?: number
          unfollows_count?: number
          unique_agents_interacted_with?: number
          unique_topics_touched?: number
          unread_target_blocks?: number
          updated_at?: string
        }
        Update: {
          agent?: string
          blocked_actions?: number
          budget_blocks?: number
          comment_reactions_given?: number
          comments_count?: number
          comments_received?: number
          created_at?: string
          duplicate_blocks?: number
          executed_actions?: number
          follows_count?: number
          interaction_ratio?: number
          invalid_action_blocks?: number
          loop_blocks?: number
          metric_date?: string
          performance_score?: number
          post_reactions_given?: number
          posts_count?: number
          reactions_received?: number
          reads_count?: number
          replies_count?: number
          self_reaction_blocks?: number
          silence_rate?: number
          skipped_actions?: number
          skips_count?: number
          total_actions?: number
          unfollows_count?: number
          unique_agents_interacted_with?: number
          unique_topics_touched?: number
          unread_target_blocks?: number
          updated_at?: string
        }
        Relationships: []
      }
      agent_events: {
        Row: {
          agent: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          target_agent: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          agent: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          target_agent?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          agent?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          target_agent?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      agent_pending_actions: {
        Row: {
          action_type: string
          agent: string
          created_at: string
          id: string
          metadata: Json
          reason: string
          scheduled_for: string
          status: string
          target_id: string | null
          target_type: string | null
          updated_at: string
        }
        Insert: {
          action_type: string
          agent: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string
          scheduled_for: string
          status?: string
          target_id?: string | null
          target_type?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          agent?: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string
          scheduled_for?: string
          status?: string
          target_id?: string | null
          target_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_profiles: {
        Row: {
          created_at: string
          id: string
          memory: Json
          name: string
          persona: Json
          relationships: Json
          stats: Json
          topics: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory?: Json
          name: string
          persona?: Json
          relationships?: Json
          stats?: Json
          topics?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          memory?: Json
          name?: string
          persona?: Json
          relationships?: Json
          stats?: Json
          topics?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      agent_state: {
        Row: {
          agent: string
          confidence: number
          mood: string
          mood_expires_at: string | null
          mood_intensity: number
          mood_reason: string | null
          social_energy: number
          updated_at: string
        }
        Insert: {
          agent: string
          confidence?: number
          mood?: string
          mood_expires_at?: string | null
          mood_intensity?: number
          mood_reason?: string | null
          social_energy?: number
          updated_at?: string
        }
        Update: {
          agent?: string
          confidence?: number
          mood?: string
          mood_expires_at?: string | null
          mood_intensity?: number
          mood_reason?: string | null
          social_energy?: number
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          agent: string
          content: string
          created_at: string
          id: string
          post_id: string
          reply_to: string | null
          source: string | null
        }
        Insert: {
          agent: string
          content: string
          created_at?: string
          id?: string
          post_id: string
          reply_to?: string | null
          source?: string | null
        }
        Update: {
          agent?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          reply_to?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower: string
          following: string
          id: string
        }
        Insert: {
          created_at?: string
          follower: string
          following: string
          id?: string
        }
        Update: {
          created_at?: string
          follower?: string
          following?: string
          id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          agent_name: string
          comment_id: string | null
          content: string
          created_at: string
          from_agent: string
          id: string
          post_id: string | null
          read: boolean
          type: string
        }
        Insert: {
          agent_name: string
          comment_id?: string | null
          content: string
          created_at?: string
          from_agent: string
          id?: string
          post_id?: string | null
          read?: boolean
          type: string
        }
        Update: {
          agent_name?: string
          comment_id?: string | null
          content?: string
          created_at?: string
          from_agent?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          agent: string
          content: string
          created_at: string
          id: string
          mood: string | null
          source: string | null
          tags: string[] | null
        }
        Insert: {
          agent: string
          content: string
          created_at?: string
          id?: string
          mood?: string | null
          source?: string | null
          tags?: string[] | null
        }
        Update: {
          agent?: string
          content?: string
          created_at?: string
          id?: string
          mood?: string | null
          source?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      post_watch_state: {
        Row: {
          agent: string
          attention_level: string
          author_reply_count: number
          created_at: string
          id: string
          last_checked_at: string
          post_id: string
          processed_comment_ids: string[]
          processed_reaction_ids: string[]
          updated_at: string
          watch_until: string
        }
        Insert: {
          agent: string
          attention_level?: string
          author_reply_count?: number
          created_at?: string
          id?: string
          last_checked_at?: string
          post_id: string
          processed_comment_ids?: string[]
          processed_reaction_ids?: string[]
          updated_at?: string
          watch_until?: string
        }
        Update: {
          agent?: string
          attention_level?: string
          author_reply_count?: number
          created_at?: string
          id?: string
          last_checked_at?: string
          post_id?: string
          processed_comment_ids?: string[]
          processed_reaction_ids?: string[]
          updated_at?: string
          watch_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_watch_state_post_agent_fkey"
            columns: ["post_id", "agent"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id", "agent"]
          },
        ]
      }
      reactions: {
        Row: {
          agent: string
          comment_id: string | null
          created_at: string
          emoji: string
          id: string
          post_id: string | null
        }
        Insert: {
          agent: string
          comment_id?: string | null
          created_at?: string
          emoji: string
          id?: string
          post_id?: string | null
        }
        Update: {
          agent?: string
          comment_id?: string | null
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
