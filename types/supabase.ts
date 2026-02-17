export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      auth_email_otps: {
        Row: {
          created_at: string
          email: string
          id: string
          kind: string
          request_ip: string | null
          token_hash: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          kind: string
          request_ip?: string | null
          token_hash?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          kind?: string
          request_ip?: string | null
          token_hash?: string | null
        }
        Relationships: []
      }
      knexchat_direct_threads: {
        Row: {
          created_at: string
          thread_id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          thread_id: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          thread_id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "knexchat_direct_threads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: true
            referencedRelation: "knexchat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      knexchat_directory: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          name: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          name?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          name?: string | null
        }
        Relationships: []
      }
      knexchat_media_objects: {
        Row: {
          bucket: string
          checksum: string | null
          created_at: string
          duration_ms: number | null
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["knexchat_media_kind"]
          mime_type: string | null
          object_path: string
          owner_user_id: string
          size_bytes: number | null
          width: number | null
        }
        Insert: {
          bucket: string
          checksum?: string | null
          created_at?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          kind: Database["public"]["Enums"]["knexchat_media_kind"]
          mime_type?: string | null
          object_path: string
          owner_user_id: string
          size_bytes?: number | null
          width?: number | null
        }
        Update: {
          bucket?: string
          checksum?: string | null
          created_at?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["knexchat_media_kind"]
          mime_type?: string | null
          object_path?: string
          owner_user_id?: string
          size_bytes?: number | null
          width?: number | null
        }
        Relationships: []
      }
      knexchat_memberships: {
        Row: {
          activated_at: string | null
          created_at: string
          email_normalized: string | null
          email_verified_at: string | null
          knexchat_email: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          email_normalized?: string | null
          email_verified_at?: string | null
          knexchat_email?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          email_normalized?: string | null
          email_verified_at?: string | null
          knexchat_email?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knexchat_message_attachments: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["knexchat_media_kind"]
          media_id: string
          message_id: string
          sort_order: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["knexchat_media_kind"]
          media_id: string
          message_id: string
          sort_order?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["knexchat_media_kind"]
          media_id?: string
          message_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "knexchat_message_attachments_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "knexchat_media_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knexchat_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "knexchat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      knexchat_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knexchat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "knexchat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      knexchat_message_receipts: {
        Row: {
          delivered_at: string | null
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          delivered_at?: string | null
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          delivered_at?: string | null
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knexchat_message_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "knexchat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      knexchat_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          media_name: string | null
          media_url: string | null
          sender_email: string
          thread_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          media_name?: string | null
          media_url?: string | null
          sender_email: string
          thread_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          media_name?: string | null
          media_url?: string | null
          sender_email?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knexchat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "knexchat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      knexchat_profile_photos: {
        Row: {
          created_at: string
          is_current: boolean
          media_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_current?: boolean
          media_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_current?: boolean
          media_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knexchat_profile_photos_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "knexchat_media_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      knexchat_profiles: {
        Row: {
          activated_at: string | null
          avatar_updated_at: string
          created_at: string
          current_avatar_media_id: string | null
          display_name: string | null
          nickname: string
          nickname_normalized: string
          nickname_updated_at: string | null
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          avatar_updated_at?: string
          created_at?: string
          current_avatar_media_id?: string | null
          display_name?: string | null
          nickname: string
          nickname_normalized: string
          nickname_updated_at?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          avatar_updated_at?: string
          created_at?: string
          current_avatar_media_id?: string | null
          display_name?: string | null
          nickname?: string
          nickname_normalized?: string
          nickname_updated_at?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knexchat_profiles_current_avatar_media_id_fkey"
            columns: ["current_avatar_media_id"]
            isOneToOne: false
            referencedRelation: "knexchat_media_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      knexchat_reserved_nicknames: {
        Row: {
          nickname_normalized: string
        }
        Insert: {
          nickname_normalized: string
        }
        Update: {
          nickname_normalized?: string
        }
        Relationships: []
      }
      knexchat_thread_participants: {
        Row: {
          email: string
          joined_at: string
          role: string
          thread_id: string
        }
        Insert: {
          email: string
          joined_at?: string
          role?: string
          thread_id: string
        }
        Update: {
          email?: string
          joined_at?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knexchat_thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "knexchat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      knexchat_threads: {
        Row: {
          created_at: string
          created_by: string
          id: string
          kind: string
          last_message_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          kind: string
          last_message_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          last_message_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      knexchat_verification_tokens: {
        Row: {
          attempts: number
          consumed_at: string | null
          created_at: string
          destination_email: string
          expires_at: string
          id: string
          ip_address: string | null
          last_sent_at: string | null
          max_attempts: number
          purpose: string
          sent_count: number
          token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          consumed_at?: string | null
          created_at?: string
          destination_email: string
          expires_at: string
          id: string
          ip_address?: string | null
          last_sent_at?: string | null
          max_attempts?: number
          purpose: string
          sent_count?: number
          token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          consumed_at?: string | null
          created_at?: string
          destination_email?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_sent_at?: string | null
          max_attempts?: number
          purpose?: string
          sent_count?: number
          token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          last_login_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_login_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      knexchat_auth_can_access_message: {
        Args: { target_message_id: string }
        Returns: boolean
      }
      knexchat_auth_email: { Args: never; Returns: string }
      knexchat_auth_is_message_sender: {
        Args: { target_message_id: string }
        Returns: boolean
      }
      knexchat_auth_participates_thread: {
        Args: { target_thread_id: string }
        Returns: boolean
      }
      knexchat_can_access_private_object: {
        Args: { object_name: string }
        Returns: boolean
      }
      knexchat_is_own_public_object_path: {
        Args: { object_name: string }
        Returns: boolean
      }
      knexchat_is_private_attachment_path: {
        Args: { object_name: string }
        Returns: boolean
      }
      knexchat_profile_email: { Args: { actor_id: string }; Returns: string }
      knexchat_storage_message_id: {
        Args: { object_name: string }
        Returns: string
      }
      knexchat_storage_thread_id: {
        Args: { object_name: string }
        Returns: string
      }
    }
    Enums: {
      knexchat_media_kind: "image" | "video" | "audio" | "file"
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
      knexchat_media_kind: ["image", "video", "audio", "file"],
    },
  },
} as const

