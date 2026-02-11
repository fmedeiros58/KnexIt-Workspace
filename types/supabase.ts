export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      knexchat_directory: {
        Row: {
          email: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          email: string;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string;
          name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      knexchat_threads: {
        Row: {
          id: string;
          kind: string;
          title: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          last_message_at: string | null;
        };
        Insert: {
          id?: string;
          kind?: string;
          title?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          last_message_at?: string | null;
        };
        Update: {
          id?: string;
          kind?: string;
          title?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          last_message_at?: string | null;
        };
        Relationships: [];
      };
      knexchat_thread_participants: {
        Row: {
          thread_id: string;
          email: string;
          role: string;
          joined_at: string;
        };
        Insert: {
          thread_id: string;
          email: string;
          role?: string;
          joined_at?: string;
        };
        Update: {
          thread_id?: string;
          email?: string;
          role?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
      knexchat_messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_email: string;
          body: string | null;
          kind: string;
          media_url: string | null;
          media_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          sender_email: string;
          body?: string | null;
          kind?: string;
          media_url?: string | null;
          media_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          sender_email?: string;
          body?: string | null;
          kind?: string;
          media_url?: string | null;
          media_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      knexchat_profiles: {
        Row: {
          user_id: string;
          nickname: string;
          nickname_normalized: string;
          display_name: string | null;
          terms_accepted_at: string | null;
          activated_at: string | null;
          nickname_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          nickname: string;
          nickname_normalized: string;
          display_name?: string | null;
          terms_accepted_at?: string | null;
          activated_at?: string | null;
          nickname_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          nickname?: string;
          nickname_normalized?: string;
          display_name?: string | null;
          terms_accepted_at?: string | null;
          activated_at?: string | null;
          nickname_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      knexchat_reserved_nicknames: {
        Row: {
          nickname_normalized: string;
        };
        Insert: {
          nickname_normalized: string;
        };
        Update: {
          nickname_normalized?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
