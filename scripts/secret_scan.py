# -*- coding: utf-8 -*-
"""
密钥泄漏扫描：检查仓库中是否混入真实凭证。

规则：
- 飞书应用 App ID      cli_a<16+位小写字母数字>
- 三段式 JWT           eyJxxx.yyy.zzz（Supabase service_role key 形态）
- 明文 app_secret      "app_secret": "..."（值过短的占位符豁免）
- service_role 角色标识出现在代码/配置中

豁免：
- src/lib/supabase.js —— 前端公开 anon key，Supabase 官方设计允许公开（受 RLS 保护）
- 值命中占位符关键词（your_ / xxx / example / placeholder / here / change / <...> 等）

用法：python scripts/secret_scan.py [仓库根目录]
命中则退出码 1，供 CI 判定失败。
"""
import os
import re
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ROOT = os.path.abspath(ROOT)

SKIP_DIRS = {'.git', 'node_modules', 'dist', '.workbuddy', '__pycache__', '.idea', '.vscode'}
# 允许包含公开 anon key 的文件
ALLOW_FILES = {
    os.path.normpath('src/lib/supabase.js'),
}
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


def is_placeholder(value: str) -> bool:
    low = value.lower()
    return any(h in low for h in PLACEHOLDER_HINTS)


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

    for full, rel in iter_files():
        if rel in ALLOW_FILES:
            continue
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
                line_no = text[:m.start()].count('\n') + 1
                hits.append((rel, line_no, label, value[:24]))

        if rel not in ALLOW_SERVICE_ROLE_TEXT and 'service_role' in text and 'SUPABASE' in text.upper():
            # 代码中出现了 service_role 字面量，检查是否带真实 key
            for m in PATTERNS[1][1].finditer(text):
                if not is_placeholder(m.group(0)):
                    line_no = text[:m.start()].count('\n') + 1
                    hits.append((rel, line_no, 'service_role key', m.group(0)[:24]))

    print(f'扫描文件数: {scanned}')
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
