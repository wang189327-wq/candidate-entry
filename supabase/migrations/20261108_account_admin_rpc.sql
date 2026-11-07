-- ============================================================================
-- 账号管理迁移：Tab4「新增 / 编辑 / 删除账号」改为服务端函数（单事务）
--
-- 应用方式：Supabase Dashboard → SQL Editor →「粘贴本文件的内容」→ Run
-- 幂等：可重复执行
--
-- 为什么需要这个迁移：
--   program_users 启用了 RLS，但只为 SELECT 建了策略。因此网页版（anon key）
--   Tab4 的写操作一直是被拒绝的：
--     - 新增：先成功写入 feishu_accounts，随后写 program_users 报
--       42501 new row violates row-level security policy —— 留下孤儿记录；
--     - 编辑 / 删除：program_users 侧静默 0 行，账号与登录名不同步。
--   （桌面版用 service_role，不受影响，所以问题此前未被发现。）
--
-- 迁移后：
--   - 账号写操作统一走 security definer 函数，验证码在库内校验；
--   - feishu_accounts 与 program_users 在同一事务内写入，任一失败全部回滚；
--   - 密码在库内用 pgcrypto bcrypt 生成，前端不再接触哈希；
--   - anon 依旧没有 program_users 的直接写权限（越权面不扩大）。
--
-- 执行顺序：先跑 20261108_security_hardening.sql，再跑本文件。
-- ============================================================================

-- 依赖：本文件调用 public.verify_admin，需要先执行 security_hardening 迁移
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'verify_admin'
  ) then
    raise exception '请先执行 20261108_security_hardening.sql（本迁移依赖 verify_admin 函数）';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. 保存账号（新增 / 编辑二合一）
--    p_account_id 为 null → 新增；否则按 id 更新
--    p_password 留空 → 编辑时保持原密码不变
-- ---------------------------------------------------------------------------
create or replace function public.admin_save_account(
  p_code           text,
  p_alias          text,
  p_password       text default null,
  p_account_id     uuid default null,
  p_old_alias      text default null,
  p_app_id_key     text default null,
  p_app_secret_key text default null,
  p_app_token_key  text default null,
  p_role           text default 'guest'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id        uuid;
  v_alias     text := btrim(coalesce(p_alias, ''));
  v_old_alias text := btrim(coalesce(p_old_alias, ''));
  v_pwd_set   boolean := (p_password is not null and btrim(p_password) <> '');
begin
  if not public.verify_admin(p_code) then
    raise exception '管理员验证码错误' using errcode = '28000';
  end if;

  if v_alias = '' then
    raise exception '用户名不能为空' using errcode = '22023';
  end if;

  if p_account_id is null then
    -- ---------------- 新增 ----------------
    if not v_pwd_set then
      raise exception '新增账号必须设置密码' using errcode = '22023';
    end if;

    if exists (select 1 from public.program_users as pu where pu.username = v_alias) then
      raise exception '登录用户名已存在：%', v_alias using errcode = '23505';
    end if;

    insert into public.feishu_accounts (alias, app_id_key, app_secret_key, app_token_key)
    values (v_alias, p_app_id_key, p_app_secret_key, p_app_token_key)
    returning id into v_id;

    insert into public.program_users (username, password_hash, role)
    values (
      v_alias,
      extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
      coalesce(nullif(btrim(coalesce(p_role, '')), ''), 'guest')
    );
  else
    -- ---------------- 编辑 ----------------
    update public.feishu_accounts
       set alias          = v_alias,
           app_id_key     = p_app_id_key,
           app_secret_key = p_app_secret_key,
           app_token_key  = p_app_token_key
     where id = p_account_id
    returning id into v_id;

    if v_id is null then
      raise exception '账号不存在或已被删除' using errcode = 'P0002';
    end if;

    -- 用户名变了：同步改登录名
    if v_old_alias <> '' and v_old_alias <> v_alias then
      if exists (select 1 from public.program_users as pu where pu.username = v_alias) then
        raise exception '登录用户名已存在：%', v_alias using errcode = '23505';
      end if;
      update public.program_users
         set username = v_alias
       where username = v_old_alias;
    end if;

    -- 改了密码：库内重新 bcrypt
    if v_pwd_set then
      update public.program_users
         set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 10))
       where username = v_alias;
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_save_account(text, text, text, uuid, text, text, text, text, text) from public;
grant execute on function public.admin_save_account(text, text, text, uuid, text, text, text, text, text) to anon, authenticated;

comment on function public.admin_save_account(text, text, text, uuid, text, text, text, text, text) is
  'Tab4 账号保存：验证码库内校验，feishu_accounts 与 program_users 单事务写入';

-- ---------------------------------------------------------------------------
-- 2. 删除账号（两张表一起删）
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_account(
  p_code       text,
  p_account_id uuid,
  p_alias      text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alias text := btrim(coalesce(p_alias, ''));
begin
  if not public.verify_admin(p_code) then
    raise exception '管理员验证码错误' using errcode = '28000';
  end if;

  if v_alias = 'admin' then
    raise exception '管理员账号不可删除' using errcode = '22023';
  end if;

  delete from public.feishu_accounts where id = p_account_id;

  if v_alias <> '' then
    delete from public.program_users where username = v_alias;
  end if;
end;
$$;

revoke all on function public.admin_delete_account(text, uuid, text) from public;
grant execute on function public.admin_delete_account(text, uuid, text) to anon, authenticated;

comment on function public.admin_delete_account(text, uuid, text) is
  'Tab4 账号删除：验证码库内校验，同时清理 feishu_accounts 与 program_users';

-- 让 PostgREST 立即刷新 schema cache
notify pgrst, 'reload schema';

-- ============================================================================
-- 执行后自检（可选）
--   1) 错误验证码应报「管理员验证码错误」
--      select public.admin_save_account('000000', 'probe', 'x');
--   2) 正确验证码新增一个测试账号，返回新 id
--      select public.admin_save_account('118814', 'probe', 'Probe@123456');
--   3) 用该账号登录应成功；随后删除
--      select public.admin_delete_account('118814', (select id from public.feishu_accounts where alias='probe'), 'probe');
-- ============================================================================
