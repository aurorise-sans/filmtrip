/**
 * 之後可用 Supabase CLI：`supabase gen types typescript` 覆寫此檔。
 * 先放最小結構，避免模組警告。
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          avatar_url: string | null
          display_name: string | null
          email: string | null
          city: string | null
          country: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          avatar_url?: string | null
          display_name?: string | null
          email?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          email?: string | null
          city?: string | null
          country?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          id: string
          user_id: string
          name: string
          start_date: string
          end_date: string
          is_public: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          start_date: string
          end_date: string
          is_public?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          start_date?: string
          end_date?: string
          user_id?: string
          is_public?: boolean
        }
        Relationships: []
      }
      photos: {
        Row: {
          id: string
          trip_id: string
          user_id: string
          image_url: string
          latitude: number | null
          longitude: number | null
          place_name: string | null
          created_at: string
          sort_order: number
        }
        Insert: {
          id?: string
          trip_id: string
          user_id: string
          image_url: string
          latitude?: number | null
          longitude?: number | null
          place_name?: string | null
          created_at?: string
          sort_order: number
        }
        Update: {
          trip_id?: string
          user_id?: string
          image_url?: string
          latitude?: number | null
          longitude?: number | null
          place_name?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      likes: {
        Row: {
          id: string
          user_id: string
          photo_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          photo_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          photo_id?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
