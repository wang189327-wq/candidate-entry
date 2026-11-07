# -*- coding: utf-8 -*-
"""
校验 GitHub Actions 工作流配置。

GitHub Actions 的 schema 有几处硬性约束，违反时**整个工作流在解析阶段就失败**，
表现为「run 显示为 failure 但没有任何 job」——排查成本很高。本脚本把这些约束前移到本地：

1. YAML 必须能解析
2. 每个 step 不能同时出现 `uses:` 与 `run:`（GitHub schema 禁止）
3. `jobs.<job_id>.if` 的可用上下文只有 github / needs / vars / inputs，
   使用 `env.` 或 `secrets.` 会导致工作流解析失败
4. `concurrency` / `permissions` 建议显式声明（不强制，仅提示）

用法：python scripts/validate_workflows.py
有问题时退出码 1，供 CI 判定失败。
"""
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
WF_DIR = os.path.join(ROOT, '.github', 'workflows')


def load_yaml(path):
    """优先用 PyYAML；没有则退化到极简解析（本脚本只做结构校验，够用）。"""
    try:
        import yaml  # type: ignore
        with open(path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f), None
    except ImportError:
        pass
    except Exception as e:  # noqa: BLE001
        return None, f'YAML 解析失败: {e}'

    # 退化方案：仅提取顶层键名与 steps 的关键字段做正则校验
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    if '\t' in text:
        return None, 'YAML 含制表符缩进（GitHub Actions 不允许）'
    return {'__raw__': text}, None


def validate_step(step, where, errors):
    if not isinstance(step, dict):
        return
    has_uses = 'uses' in step
    has_run = 'run' in step
    if has_uses and has_run:
        errors.append(f'{where}: step「{step.get("name", "(未命名)")}」同时包含 uses: 与 run:（GitHub schema 禁止，会导致整个工作流解析失败）')
    if not has_uses and not has_run:
        errors.append(f'{where}: step「{step.get("name", "(未命名)")}」既无 uses: 也无 run:')


def validate_job(name, job, errors, warnings, has_top_permissions=False):
    if not isinstance(job, dict):
        return
    if 'if' in job:
        cond = str(job['if'])
        if re.search(r'\bsecrets\.', cond):
            errors.append(f'job「{name}」: job 级 if 使用了 secrets.（不可用上下文，会导致解析失败）')
        if re.search(r'\benv\.', cond):
            errors.append(f'job「{name}」: job 级 if 使用了 env.（不可用上下文，会导致解析失败）')
    for idx, step in enumerate(job.get('steps') or []):
        validate_step(step, f'job「{name}」第 {idx + 1} 步', errors)
    if 'permissions' not in job and not has_top_permissions:
        warnings.append(f'job「{name}」未声明 permissions（建议显式最小化）')


def main() -> int:
    if not os.path.isdir(WF_DIR):
        print(f'❌ 未找到工作流目录: {WF_DIR}')
        return 1

    files = sorted(f for f in os.listdir(WF_DIR) if f.endswith(('.yml', '.yaml')))
    if not files:
        print('❌ 未找到任何工作流文件')
        return 1

    errors = []
    warnings = []

    for fn in files:
        path = os.path.join(WF_DIR, fn)
        doc, err = load_yaml(path)
        if err:
            errors.append(f'{fn}: {err}')
            continue

        if '__raw__' in doc:
            # 退化模式：只做原始文本检查
            raw = doc['__raw__']
            print(f'⚠️  {fn}: 未安装 PyYAML，仅做基础检查（建议 pip install pyyaml）')
            if not re.search(r'^name:', raw, re.M):
                errors.append(f'{fn}: 缺少顶层 name: 字段')
            continue

        wf_name = doc.get('name')
        if not wf_name:
            errors.append(f'{fn}: 缺少顶层 name: 字段')
        print(f'✅ {fn}  name={wf_name}')

        for jn, job in (doc.get('jobs') or {}).items():
            validate_job(jn, job, errors, warnings, has_top_permissions='permissions' in doc)

    for w in warnings:
        print(f'⚠️  {w}')
    if errors:
        print(f'\n❌ 发现 {len(errors)} 处工作流配置问题：')
        for e in errors:
            print(f'   {e}')
        print('\nGitHub Actions 在 schema 违规时会在解析阶段直接失败（无任何 job 产出），请务必修复。')
        return 1

    print('\n✅ 所有工作流配置校验通过')
    return 0


if __name__ == '__main__':
    sys.exit(main())
