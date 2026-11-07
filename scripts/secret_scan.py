# -*- coding: utf-8 -*-
"""
密钥泄漏扫描：检查仓库中是否混入真实凭证。

规则：
- 飞书应用 App ID      cli_a<16+位小写字母数字>
- 三段式 JWT           eyJxxx.yyy.zzz
- 明文 app_secret      "app_secret": "..."（值过短的占位符豁免）
- service_role 密钥字面量（JWT 的 payload 中 role 为 service_role）

豁免：
- 值命中占位符关键词（your_ / xxx / example / placeholder / here / change / <...> 等）
- Supabase anon key —— Supabase 官方设计允许公开（受 RLS 保护）。
  豁免按「行」生效且要求该行 JWT 的 role 恰为 anon，避免整文件豁免形成盲区。

用法：python scripts/secret_scan.py [仓库根目录]
命中则退出码 1，供 CI 判定失败。
"""
import base64
import json
import os
import re
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ROOT = os.path.abspath(ROOT)

SKIP_DIRS = {'.git', 'node_modules', 'dist', '.workbuddy', '__pycache__', '.idea', '.vscode'}
# 允许出现「service_role」字样的文件（桌面版从环境变量读取时的说明性注释）
ALLOW_SERVICE_ROLE_TEXT = {
    os.path.normpath('desktop/求职者信息录入.py'),
}

PATTERNS = [
    ('飞书 App ID', re.compile(r'cli_a[0-9a-zA-Z]{12,}')),
    ('JWT / service_role key', re.compile(r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}')),
    ('明文 app_secret', re.compile(r'["\']app_secret["\']\s*[:=]\s*["\']([^"\']{6,})["\']')),
]

PLACEHOLDER_HINTS = (
    'your_', 'yourapp', 'xxx', 'example', 'placeholder', 'here', 'change',
    'replace', 'demo', 'test', 'fake', 'sample', '<', '$', '{', '**', 'redacted',
)

# 已知公开的演示项目 anon key（role=anon）。命中这枚具体 key 时豁免并计数，
# 其余任何 JWT（含 service_role）一律报错。
PUBLIC_ANON_KEYS = set()


def is_placeholder(value: str) -> bool:
    low = value.lower()
    return any(h in low for h in PLACEHOLDER_HINTS)


def jwt_role(token: str):
    """解析 JWT payload 的 role 字段；解析不出来返回 None。"""
    parts = token.split('.')
    if len(parts) != 3:
        return None
    payload = parts[1]
    payload += '=' * (-len(payload) % 4)
    try:
        data = json.loads(base64.urlsafe_b64decode(payload).decode('utf-8'))
    except Exception:
        return None
    return data.get('role')


def load_public_anon_keys():
    """从 src/lib/supabase.js 读取被标记为公开演示用的 anon key。"""
    path = os.path.join(ROOT, 'src', 'lib', 'supabase.js')
    if not os.path.isfile(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    for m in re.finditer(r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', text):
        token = m.group(0)
        if jwt_role(token) == 'anon':
            PUBLIC_ANON_KEYS.add(token)


def iter_files():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            rel = os.path.normpath(os.path.relpath(full, ROOT))
            yield full, rel


def main() -> int:
    hits = []
    scanned = 0
    exempt = 0

    load_public_anon_keys()

    for full, rel in iter_files():
        try:
            with open(full, 'r', encoding='utf-8') as f:
                text = f.read()
        except (UnicodeDecodeError, OSError):
            continue  # 二进制或不可读文件跳过
        scanned += 1

        for label, pat in PATTERNS:
            for m in pat.finditer(text):
                value = m.group(1) if m.lastindex else m.group(0)
                if is_placeholder(value):
                    continue
                # 公开 anon key 豁免（仅限 role=anon 的具体 token）
                if value in PUBLIC_ANON_KEYS:
                    exempt += 1
                    continue
                line_no = text[:m.start()].count('\n') + 1
                hits.append((rel, line_no, label, value[:24]))

        # service_role 专用检查：payload 中 role 明确为 service_role 的 JWT
        for m in PATTERNS[1][1].finditer(text):
            token = m.group(0)
            if token in PUBLIC_ANON_KEYS or is_placeholder(token):
                continue
            if jwt_role(token) == 'service_role':
                line_no = text[:m.start()].count('\n') + 1
                hits.append((rel, line_no, 'service_role key', token[:24]))

    print(f'扫描文件数: {scanned}')
    if exempt:
        print(f'ℹ️ 已豁免 {exempt} 处公开 anon key（Supabase 官方允许公开，受 RLS 保护）')
    if not hits:
        print('✅ 未发现硬编码凭证')
        return 0

    print(f'❌ 发现 {len(hits)} 处疑似凭证：')
    for rel, line_no, label, snippet in hits:
        print(f'   {rel}:{line_no}  [{label}]  {snippet}…')
    print('\n请改用环境变量或本地配置文件注入，并轮换已泄露的凭证。')
    return 1


if __name__ == '__main__':
    sys.exit(main())
