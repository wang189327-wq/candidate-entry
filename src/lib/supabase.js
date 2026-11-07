import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zwzaultkadnoglwkvnrs.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3emF1bHRrYWRub2dsd2t2bnJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MjI1NTMsImV4cCI6MjA5NzA5ODU1M30.UsD4saQktR35VMMSi6AcYH_55jOOBqJMh8bmBdK3qbs'

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
