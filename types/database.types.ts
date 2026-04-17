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
      trips: {
        Row: {
          id: string
          user_id: string
          name: string
          start_date: string
          end_date: string
          is_public: boolean
          cover_image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          start_date: string
          end_date: string
          is_public?: boolean
          cover_image_url?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          start_date?: string
          end_date?: string
          user_id?: string
          is_public?: boolean
          cover_image_url?: string | null
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
        }
        Update: {
          trip_id?: string
          user_id?: string
          image_url?: string
          latitude?: number | null
          longitude?: number | null
          place_name?: string | null
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
