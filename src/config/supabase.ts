import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config(); // ✅ Loads .env

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("❌ Supabase credentials missing in .env");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
