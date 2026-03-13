import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mdkiuhjanqmgpyuptvml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ka2l1aGphbnFtZ3B5dXB0dm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTM5MzQsImV4cCI6MjA4ODg4OTkzNH0.s1orbxalZOgX_2vhLNJLnaaJ6x9o33gL9jSITAb_Xb8';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Call this after Firebase login to attach user_id to all requests
export function setSupabaseUser(firebaseUserId) {
  if (!firebaseUserId) return;
  localStorage.setItem('supabase_user_id', firebaseUserId);
}

// Get supabase client with user_id header attached
export function getSupabaseClient() {
  const userId = localStorage.getItem('supabase_user_id');
  if (!userId) return supabase;
  
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        'x-user-id': userId,
      }
    }
  });
}