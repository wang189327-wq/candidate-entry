import { createClient } from '@supabase/supabase-js'

// Supabase 配置：优先读取环境变量（复制 .env.example 为 .env.local 后填入自己的项目）
// 未配置时回落到内置的公开演示项目，保证「clone 即跑」与线上演示站可用。
//
// 注意：前端只能使用 anon key（公开、只受 RLS 保护）；service_role 密钥严禁进入前端。
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zwzaultkadnoglwkvnrs.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3emF1bHRrYWRub2dsd2t2bnJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MjI1NTMsImV4cCI6MjA5NzA5ODU1M30.UsD4saQktR35VMMSi6AcYH_55jOOBqJMh8bmBdK3qbs'

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
