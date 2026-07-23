import { createClient } from "@supabase/supabase-js";

// Grab these from your new project's Settings > API in the Supabase Dashboard
const supabaseUrl = "https://kolsrsmzhpnwznducctd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbHNyc216aHBud3puZHVjY3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3OTI5MTAsImV4cCI6MjEwMDM2ODkxMH0.C6VErDdbuR4Mf5u9SZIm1yUf6fdP2tMv54YvPYqEB1E";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);