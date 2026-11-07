-- ============================================================================
-- 安全加固迁移：登录与管理员验证码全部改为服务端校验
--
-- 应用方式：Supabase Dashboard → SQL Editor →「粘贴本文件的内容」→ Run
--           （注意：粘贴的是文件内容，不是文件路径）
-- 幂等：可重复执行
--
-- 背景（2026-11 审查发现的三处高危）：
--   1. 登录时前端 select('*') 拉取 program_users 整表（含 password_hash），
--      在浏览器本地做 bcrypt 比对 —— 任何匿名访客都能直接读到全部密码哈希。
--   2. Tab4 编辑管理员账号的验证码硬编码在前端源码里。
--   3. 验证码与登录校验完全依赖客户端，可被绕过。
--
-- 迁移后：
--   - 登录改调 verify_login(p_username, p_password) RPC，security definer
--     在库内完成 bcrypt 比对，密码哈希不再出库；
--   - anon 角色被收回 program_users 的 password_hash 列读权限（其余列保留，
--     供 Tab4 按用户名同步账号）；
--   - 管理员验证码改存 app_settings 表（RLS 开启且无 policy，仅函数可读），
--     验证改调 verify_admin(p_code) RPC。
--
-- 前端已内置渐进兼容：RPC 未部署时自动回退旧行为，部署本迁移后新链路生效。
-- 执行完本文件后，前端无需重新部署即可生效（前端已先行上线）。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. 依赖：pgcrypto 提供 crypt()（Supabase 默认已装在 extensions schema）
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

-- 前置检查：给出可读的错误，避免后面报 crypt 不存在
do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';

  if v_schema is null then
    raise exception 'pgcrypto 扩展未安装，请先在 Database → Extensions 中启用 pgcrypto';
  elsif v_schema <> 'extensions' then
    raise exception 'pgcrypto 安装在 % schema 而非 extensions，请把下方函数中的 extensions.crypt 改为 %.crypt 后再执行', v_schema, v_schema;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. 服务端登录校验
--    返回空结果集 = 账号或密码错误；不区分两种错误，避免账号枚举
-- ---------------------------------------------------------------------------
create or replace function public.verify_login(p_username text, p_password text)
returns table (id uuid, username text, role text)
language plpgsql
security definer
-- 空 search_path + 全限定名，避免被调用方 search_path 劫持
set search_path = ''
as $$
declare
  u public.program_users%rowtype;
  v_hash text;
begin
  -- 表必须起别名：否则 username 与返回列名同名，PL/pgSQL 会报 ambiguous
  select * into u
  from public.program_users as pu
  where pu.username = btrim(p_username)
  limit 1;

  if u.id is null then
    return; -- 账号不存在
  end if;

  v_hash := u.password_hash;

  -- bcryptjs 生成的是 $2b$ / $2y$ 前缀，pgcrypto 仅稳定识别 $2a$。
  -- 对普通密码（<72 字节）两者计算结果一致，统一改写成 $2a$ 再比对。
  if v_hash like '$2b$%' or v_hash like '$2y$%' then
    v_hash := '$2a$' || substr(v_hash, 5);
  end if;

  if extensions.crypt(p_password, v_hash) = v_hash then
    return query select u.id, u.username::text, u.role::text;
  end if;
end;
$$;

revoke all on function public.verify_login(text, text) from public;
grant execute on function public.verify_login(text, text) to anon, authenticated;

comment on function public.verify_login(text, text) is
  '服务端登录校验：bcrypt 比对在库内完成，密码哈希不出库';

-- ---------------------------------------------------------------------------
-- 2. anon 收回 password_hash 列读权限
--    整表 revoke 后按列回授：Tab4 仍能按用户名查 id/role 做同步，但读不到哈希
--    桌面版使用 service_role，不受本段影响
-- ---------------------------------------------------------------------------
revoke select on public.program_users from anon;
grant select (id, username, role) on public.program_users to anon;

-- ---------------------------------------------------------------------------
-- 3. 管理员验证码：存 app_settings，RLS 全禁，仅 RPC 可验证
--    首次迁移写入历史值 118814（该值已随旧版前端公开，不构成新泄露）；
--    部署后请执行文末「修改验证码」语句换成新值。
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

alter table public.app_settings enable row level security;
-- 故意不建任何 policy；再叠加一层表级收权，确保 anon / authenticated 读写全禁
revoke all on public.app_settings from anon, authenticated;

insert into public.app_settings (key, value)
values ('admin_verify_code', '118814')
on conflict (key) do nothing;

create or replace function public.verify_admin(p_code text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_settings
    where key = 'admin_verify_code'
      and value = btrim(p_code)
  )
$$;

revoke all on function public.verify_admin(text) from public;
grant execute on function public.verify_admin(text) to anon, authenticated;

comment on function public.verify_admin(text) is
  '管理员验证码校验：验证码存 app_settings，前端不再持有明文';

-- 让 PostgREST 立即刷新 schema cache，新建的 RPC 可马上被前端调用
notify pgrst, 'reload schema';

-- ============================================================================
-- 执行后自检（可选，直接跑下面三条）
-- ============================================================================
-- 1) 正确密码应返回 1 行；错误密码应返回 0 行
--    select * from public.verify_login('admin', 'Aa@123456');
--    select * from public.verify_login('admin', 'wrong-password');
-- 2) 验证码校验应返回 t
--    select public.verify_admin('118814');
-- 3) 用 anon key 请求 /rest/v1/program_users?select=password_hash 应返回 42501 权限不足

-- ============================================================================
-- 修改管理员验证码（部署本迁移后执行一次，把 118814 换成你自己的新值）：
--   update public.app_settings
--      set value = '你的新验证码'
--    where key = 'admin_verify_code';
-- ============================================================================
