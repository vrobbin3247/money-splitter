import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://lynoprblxiffvtfqqfhf.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5bm9wcmJseGlmZnZ0ZnFxZmhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NTUzMTYsImV4cCI6MjA2NTAzMTMxNn0.cf7KOTjSn2k3WH51BsZEGmlDfXGojE-fz1uRE3flFGs";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
