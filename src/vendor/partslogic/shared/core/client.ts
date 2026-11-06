import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@partslogic/db-types';

// The Supabase client every wrapper takes, typed from the generated database types.
export type Client = SupabaseClient<Database>;
