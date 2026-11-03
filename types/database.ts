export type AppRole = "super_admin" | "department_admin" | "teacher" | "exam_controller" | "student";
export type AccountStatus = "active" | "suspended" | "disabled";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        { id: string; full_name: string | null; email: string | null; account_status: AccountStatus; created_at: string; updated_at: string },
        { id: string; full_name?: string | null; email?: string | null; account_status?: AccountStatus; created_at?: string; updated_at?: string },
        { full_name?: string | null; updated_at?: string }
      >;
      user_roles: Table<
        { id: string; user_id: string; role: AppRole; department_id: string | null; is_active: boolean; created_at: string },
        { id?: string; user_id: string; role: AppRole; department_id?: string | null; is_active?: boolean; created_at?: string },
        { is_active?: boolean }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      get_dashboard_summary: { Args: Record<string, never>; Returns: Json };
    };
    Enums: {
      app_role: AppRole;
      account_status: AccountStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
