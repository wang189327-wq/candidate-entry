# -*- coding: utf-8 -*-
"""
门店候选人信息录入工具
功能页1:信息识别(粘贴聊天记录 → 解析 → 写入飞书)
功能页2:SAP代码(管理SAP代码与岗位名称对应关系)
功能页3:图片库(店长电话截图、常用图片预览/复制/上传/删除)
"""

import re, sys, os, json, shutil, functools, atexit
import ctypes
from ctypes import wintypes
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from PIL import Image, ImageTk
import urllib.request
import urllib.error
import io
import csv
from datetime import datetime
import bcrypt
from supabase import create_client, Client

# ============================================================
# Supabase 配置
# 敏感凭证已从代码中移除，请通过环境变量注入：
#   set SUPABASE_URL=https://xxxx.supabase.co
#   set SUPABASE_SERVICE_KEY=eyJhbGci...（service_role key，切勿提交到仓库）
# ============================================================
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
# service_role key 绕过 RLS，内网桌面程序可信环境使用

# ============================================================
# 本地模式配置（云端启用时 USE_LOCAL_AUTH = False）
# ============================================================
USE_LOCAL_AUTH = True
LOCAL_USERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "program_users.json")
LOCAL_BINDINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "user_feishu_bindings.json")

# 程序初始内置账号（密码：Aa@123456）
BUILTIN_USERS = [{
    "id": "00000000-0000-0000-0000-000000000001",
    "username": "admin",
    "password_hash": bcrypt.hashpw("Aa@123456".encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
    "role": "admin",
}]

def _load_local_users():
    if not os.path.exists(LOCAL_USERS_FILE):
        with open(LOCAL_USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(BUILTIN_USERS, f, ensure_ascii=False, indent=2)
        return BUILTIN_USERS[:]
    with open(LOCAL_USERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def _save_local_users(users):
    with open(LOCAL_USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def _load_local_bindings():
    if not os.path.exists(LOCAL_BINDINGS_FILE):
        with open(LOCAL_BINDINGS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)
        return []
    with open(LOCAL_BINDINGS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def _save_local_bindings(bindings):
    with open(LOCAL_BINDINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(bindings, f, ensure_ascii=False, indent=2)

# ============================================================
# 登录窗口
# ============================================================
class LoginWindow:
    def __init__(self, master):
        self.cancelled = False
        self.login_info = None
        self._build_window(master)

    def _init_supabase(self):
        try:
            self.sb = create_client(self.sb_url, self.sb_key)
        except Exception as e:
            print(f"[LoginWindow] Supabase 初始化失败: {e}")
            self.sb = None

    def _build_window(self, master):
        self.win = tk.Toplevel(master)
        self.win.title("门店求职者信息录入 - 登录")
        self.win.configure(bg=STYLE_BG)
        self.win.resizable(False, False)

        # 居中
        self.win.update_idletasks()
        w, h = 420, 320
        sw = self.win.winfo_screenwidth()
        sh = self.win.winfo_screenheight()
        x = (sw - w) // 2
        y = (sh - h) // 2
        self.win.geometry(f"{w}x{h}+{x}+{y}")

        # 顶部标题
        tk.Label(self.win, text="门店求职者信息录入",
                 bg=STYLE_BG, font=("微软雅黑", 16, "bold"),
                 fg="#2E7D32").pack(pady=(24, 4))
        tk.Label(self.win, text="请输入账号密码登录",
                 bg=STYLE_BG, font=("微软雅黑", 9),
                 fg="#666").pack(pady=(0, 20))

        # 表单区域
        form_bg = tk.Frame(self.win, bg="white", relief="solid", bd=1)
        form_bg.pack(padx=40, fill="x")

        # 用户名
        row_user = tk.Frame(form_bg, bg=STYLE_ENTRY, relief="solid", bd=1)
        row_user.pack(fill="x", padx=12, pady=(12, 6))
        tk.Label(row_user, text="用户名", bg=STYLE_BG, font=("微软雅黑", 10),
                 anchor="e", width=8).pack(side="left", padx=(4, 0), pady=4)
        self._entry_user = tk.Entry(row_user, font=("微软雅黑", 11),
                                    bg=STYLE_ENTRY, relief="flat", bd=0)
        self._entry_user.pack(side="left", fill="x", expand=True, padx=(2, 4), pady=4)

        # 密码
        row_pwd = tk.Frame(form_bg, bg=STYLE_ENTRY, relief="solid", bd=1)
        row_pwd.pack(fill="x", padx=12, pady=(0, 12))
        tk.Label(row_pwd, text="密码", bg=STYLE_BG, font=("微软雅黑", 10),
                 anchor="e", width=8).pack(side="left", padx=(4, 0), pady=4)
        self._entry_pwd = tk.Entry(row_pwd, font=("微软雅黑", 11),
                                    bg=STYLE_ENTRY, relief="flat", bd=0, show="•")
        self._entry_pwd.pack(side="left", fill="x", expand=True, padx=(2, 4), pady=4)
        self._entry_pwd.bind("<Return>", lambda e: self._on_login())

        # 登录按钮
        tk.Button(self.win, text="登 录", bg=STYLE_BTN, relief="flat",
                  font=("微软雅黑", 12, "bold"), command=self._on_login,
                  activebackground="#8BC78F", cursor="hand2").pack(
                      pady=(16, 4), fill="x", padx=40)

        # 状态提示
        self._status_lbl = tk.Label(self.win, text="", bg=STYLE_BG,
                                    font=("微软雅黑", 9), fg="#CC0000")
        self._status_lbl.pack(pady=(4, 0))

        self._entry_user.focus()
        self.win.protocol("WM_DELETE_WINDOW", self._on_close)

    def _on_close(self):
        self.cancelled = True
        self.win.destroy()

    def _on_login(self):
        username = self._entry_user.get().strip()
        password = self._entry_pwd.get()
        if not username or not password:
            self._status_lbl.configure(text="用户名和密码不能为空", fg="#CC0000")
            return

        self._status_lbl.configure(text="登录中...", fg="#666")
        self.win.update()

        try:
            users = _load_local_users()
            user_row = None
            for u in users:
                if u["username"] == username:
                    user_row = u
                    break

            if not user_row:
                self._status_lbl.configure(text="用户名或密码错误", fg="#CC0000")
                return

            # 验证密码（bcrypt）
            stored_hash = user_row["password_hash"]
            if not bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8")):
                self._status_lbl.configure(text="用户名或密码错误", fg="#CC0000")
                return

            # 登录成功
            self.login_info = {
                "user_id": user_row["id"],
                "username": user_row["username"],
                "role": user_row["role"],
            }
            self._status_lbl.configure(text="登录成功！", fg="#2E7D32")
            self.win.after(400, self.win.destroy)

        except Exception as e:
            self._status_lbl.configure(text=f"登录异常: {str(e)}", fg="#CC0000")

    def get_login_info(self):
        return self.login_info

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 数据目录：优先使用环境变量指定，其次沿用桌面「数据」目录（生产环境），
# 若不存在则回退到脚本同级的「数据」目录（开源副本开箱即用）
DATA_DIR = os.environ.get("APP_DATA_DIR") or os.path.join(os.path.expanduser("~"), "Desktop", "数据")
if not os.path.isdir(DATA_DIR):
    DATA_DIR = os.path.join(BASE_DIR, "数据")
IMG_LIBRARY_DIR = os.path.join(DATA_DIR, "SAP图片库")
FIXED_IMG_DIR = os.path.join(DATA_DIR, "固定图片")
# 门店门面图：界面文案已更名为「门店门面」，但磁盘文件沿用旧名「超级仓门面.jpg」。
# 这里同时兼容两种文件名，避免老用户升级后图片丢失。
STOREFRONT_IMG_NAMES = ("门店门面.jpg", "超级仓门面.jpg")
SAP_CONFIG_FILE = os.path.join(DATA_DIR, "sap_config.json")
LAYOUT_CONFIG_FILE = os.path.join(DATA_DIR, "layout_config.json")
INTEGRATION_FILE = os.path.join(DATA_DIR, "integration_config.json")
STYLE_BG    = "#C7EDCC"
STYLE_BG2   = "#D5EDD8"
STYLE_BTN   = "#A8D4A8"
STYLE_ENTRY = "#E8F5E9"
BTN_CANCEL  = "#FFCCCC"
FIELD_BG    = "#E8F5E9"
LABEL_BG    = "#C7EDCC"

# 飞书配置（占位符：请在 数据/feishu_accounts.json 中配置真实凭证，
# 或在飞书开放平台 https://open.feishu.cn 创建应用后填入以下默认值）
FEISHU_APP_ID     = "cli_xxxxxxxxxxxxxxxx"
FEISHU_APP_SECRET = "your_app_secret_here"
FEISHU_APP_TOKEN  = "your_bitable_app_token_here"
FEISHU_TABLE_ID   = "tblxxxxxxxxxxxxxx"
FEISHU_TABLE_NAME = "台账"
FEISHU_BASE_URL   = "https://open.feishu.cn/open-apis"
FEISHU_ACCOUNTS_FILE = os.path.join(DATA_DIR, "feishu_accounts.json")

class App(tk.Tk):
    def __init__(self, login_info=None):
        super().__init__()
        # 登录信息（来自 LoginWindow）
        self._login_info = login_info or {"username": "未登录", "role": "user"}
        self.title(f"门店求职者信息录入 - {self._login_info.get('username', '')} ({'管理员' if self._login_info.get('role') == 'admin' else '普通用户'})")
        self._configure_style()
        self._layout = {}
        self.sap_config = self._load_sap_config()
        self._build_ui()
        self._build_tab1()
        self._build_tab2()
        self._load_common_img_thumb()
        self._load_super_cang_thumb()
        self._build_tab3()
        self._load_feishu_accounts()
        self._build_tab4()
        # 写入目标决定 Tab1 按钮文案
        self._btn_feishu.configure(text=self._write_button_text())
        w, h = 1200, 820
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        self.state("zoomed")
        self.bind("<Configure>", self._on_window_resize)
        self.after(500, self._refresh_img_lib_list)
        self._load_layout_config()

    def _configure_style(self):
        style = ttk.Style(self)
        for name in ("TFrame", "TLabelframe", "TLabelframe.Label"):
            try: style.configure(name, background=STYLE_BG)
            except: pass
        self.configure(bg=STYLE_BG)

    def _on_window_resize(self, event):
        # 仅响应窗口根级的Configure事件（忽略子控件）
        if event.widget != self:
            return
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        if self.state() == "zoomed":
            new_w, new_h = sw, sh
        else:
            new_w, new_h = event.width, event.height
        scale = min(new_w / 1200, new_h / 820)
        # Tab1 paned sash
        if hasattr(self, "_tab1_paned"):
            try:
                self._tab1_paned.sashpos(0, int(1200 * scale * 0.52))
            except: pass
        # Tab3 paned sash
        if hasattr(self, "_tab3_paned"):
            try:
                self._tab3_paned.sashpos(0, int(1200 * scale * 0.36))
            except: pass
        # Tab4 paned sash
        if hasattr(self, "_tab4_paned"):
            try:
                self._tab4_paned.sashpos(0, int(1200 * scale * 0.40))
            except: pass

    def _load_layout_config(self):
        try:
            with open(LAYOUT_CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                self._layout = cfg
        except:
            self._layout = {}
        # Restore sash positions after window is rendered
        self._sash_restored = set()
        self.after(200, self._restore_sash_positions)

    def _restore_sash_positions(self):
        if not hasattr(self, "_sash_restored"):
            self._sash_restored = set()
        if "tab1" not in self._sash_restored and hasattr(self, "_tab1_paned") and self._tab1_paned.winfo_viewable():
            v = self._layout.get("tab1_sash")
            if v is not None:
                try:
                    self._tab1_paned.sashpos(0, int(v))
                    self._sash_restored.add("tab1")
                except: pass
        if "tab3" not in self._sash_restored and hasattr(self, "_tab3_paned") and self._tab3_paned.winfo_width() > 1:
            v = self._layout.get("tab3_sash")
            if v is not None:
                try:
                    self._tab3_paned.sashpos(0, int(v))
                    self._sash_restored.add("tab3")
                except: pass
        if "tab4" not in self._sash_restored and hasattr(self, "_tab4_paned") and self._tab4_paned.winfo_width() > 1:
            v = self._layout.get("tab4_sash")
            if v is not None:
                try:
                    self._tab4_paned.sashpos(0, int(v))
                    self._sash_restored.add("tab4")
                except: pass
        if len(self._sash_restored) < 3:
            self.after(50, self._restore_sash_positions)

    def _save_layout_config(self):
        self._sash_restored = set()
        try:
            with open(LAYOUT_CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(self._layout, f, ensure_ascii=False, indent=2)
            messagebox.showinfo("保存成功", "布局配置已保存")
        except Exception as e:
            messagebox.showerror("保存失败", str(e))

    def _load_sap_config(self):
        try:
            with open(SAP_CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return {}

    def _save_sap_config(self):
        try:
            with open(SAP_CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(self.sap_config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            messagebox.showerror("保存失败", str(e))

    def _on_save_layout(self):
        # Tab1 paned sash
        if hasattr(self, "_tab1_paned"):
            try:
                self._layout["tab1_sash"] = self._tab1_paned.sashpos(0)
            except: pass
        # Tab2 column widths
        if hasattr(self, "_tree"):
            col_map = {"序号": "col_width_序号", "岗位城市": "col_width_岗位城市",
                       "岗位名称": "col_width_岗位名称", "SAP代码": "col_width_SAP代码",
                       "是否发布": "col_width_是否发布", "备注": "col_width_备注"}
            for col, key in col_map.items():
                try:
                    self._layout[key] = self._tree.column(col, option="width")
                except: pass
        # Tab3 paned sash
        if hasattr(self, "_tab3_paned"):
            try:
                self._layout["tab3_sash"] = self._tab3_paned.sashpos(0)
            except: pass
        # Tab4 paned sash
        if hasattr(self, "_tab4_paned"):
            try:
                self._layout["tab4_sash"] = self._tab4_paned.sashpos(0)
            except: pass
        self._save_layout_config()

    # ----------- UI框架 ----------
    def _build_ui(self):
        nb = ttk.Notebook(self, style="TWildcard1.TNotebook")
        style_nb = ttk.Style()
        style_nb.configure("TWildcard1.TNotebook", background=STYLE_BG, tabposition="n")
        nb.pack(fill="both", expand=True, padx=8, pady=6)
        self.nb = nb
        self._tab1 = ttk.Frame(nb, style="TFrame")
        self._tab2 = ttk.Frame(nb, style="TFrame")
        self._tab3 = ttk.Frame(nb, style="TFrame")
        self._tab4 = ttk.Frame(nb, style="TFrame")
        nb.add(self._tab1, text="　信息识别　")
        nb.add(self._tab2, text="　SAP代码管理　")
        nb.add(self._tab3, text="　图片库　")
        nb.add(self._tab4, text="　飞书账号　")
        nb.bind('<<NotebookTabChanged>>', lambda e: self._on_tab_changed())

    def _on_tab_changed(self):
        if self.nb.index('current') == 2:  # Tab3
            self._restore_sash_positions()
        elif self.nb.index('current') == 3:  # Tab4
            self._restore_sash_positions()

    # ==================== Tab1 ====================
    def _build_tab1(self):
        fr = self._tab1
        header = tk.Frame(fr, bg=STYLE_BG)
        header.pack(fill="x", padx=12, pady=(10,0))
        tk.Label(header, text="信息识别区", bg=STYLE_BG, font=("微软雅黑",10,"bold"), fg="#7755CC").pack(side="left")
        right_hdr = tk.Frame(header, bg=STYLE_BG)
        right_hdr.pack(side="right")
        tk.Label(right_hdr, text="信息确认区", bg=STYLE_BG, font=("微软雅黑",10,"bold"), fg="#7755CC").pack(side="left", padx=(0,12))
        tk.Button(right_hdr, text="保存", bg=STYLE_BTN, relief="flat", font=("微软雅黑",9),
                  command=self._on_save_layout).pack(side="left")
        paned = ttk.PanedWindow(fr, orient="horizontal")
        paned.pack(fill="both", expand=True, padx=12, pady=(6,8))

        # 左
        left = tk.Frame(paned, bg="white", bd=1, relief="solid")
        paned.add(left)

        self._tab1_paned = paned
        tk.Label(left, text="粘贴聊天记录文本", bg="#F0EDFF", font=("微软雅黑",9,"bold"), anchor="w", padx=10, pady=6).pack(fill="x")
        txt_frm = tk.Frame(left, bg="white")
        txt_frm.pack(fill="both", expand=True, padx=8, pady=(0,6))
        self._txt = tk.Text(txt_frm, wrap="word", font=("微软雅黑", 10), bg="white", relief="flat", bd=0)
        vsb = ttk.Scrollbar(txt_frm, command=self._txt.yview)
        self._txt.configure(yscrollcommand=vsb.set)
        self._txt.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")
        btn_row = tk.Frame(left, bg="white")
        btn_row.pack(fill="x", padx=8, pady=(0,8))
        self._btn_parse = tk.Button(btn_row, text="识别候选人", bg=STYLE_BTN, relief="flat", width=13, font=("微软雅黑",12), command=self._on_parse)
        self._btn_parse.pack(side="left", padx=(0,6), pady=6)
        self._btn_cancel = tk.Button(btn_row, text="取消", bg=BTN_CANCEL, relief="flat", width=10, font=("微软雅黑",12), command=self._on_cancel)
        self._btn_cancel.pack(side="left", pady=6)

        # 右
        right = tk.Frame(paned, bg="white", bd=1, relief="solid")
        paned.add(right)
        tk.Label(right, text="已识别的求职者信息", bg="#F0EDFF", font=("微软雅黑",9,"bold"), anchor="w", padx=10, pady=6).pack(fill="x")
        self._field_entries = {}

        # 每行一个字段，从上到下依次排列
        self._make_field(right, "姓名", 14)
        self._make_field(right, "联系方式", 14)
        self._make_field(right, "年龄", 14)

        # 性别（单选）
        sex_row = tk.Frame(right, bg="white")
        sex_row.pack(fill="x", pady=2)
        tk.Label(sex_row, text="性别：", font=("微软雅黑",12), bg=LABEL_BG, anchor="e", width=14, padx=5, pady=3).pack(side="left", pady=0)
        sex_opts = tk.Frame(sex_row, bg="white")
        sex_opts.pack(side="left", fill="x", expand=True, padx=(3,0))
        self._sex_var = tk.StringVar(value="女")
        for opt, val in [("女", "女"), ("男", "男")]:
            rb = tk.Radiobutton(sex_opts, text=opt, variable=self._sex_var, value=val,
                                font=("微软雅黑",12), bg="white", fg="black",
                                activebackground="#FFE066", selectcolor="#FFE066",
                                relief="solid", bd=1, width=6, anchor="center",
                                indicatoron=False)
            rb.pack(side="left", padx=(0,8), ipady=2)

        self._make_field(right, "SAP代码", 14)

        # 意向岗位（单选）
        job_row = tk.Frame(right, bg="white")
        job_row.pack(fill="x", pady=2)
        tk.Label(job_row, text="意向岗位：", font=("微软雅黑",12), bg=LABEL_BG, anchor="e", width=14, padx=5, pady=3).pack(side="left", pady=0)
        job_opts = tk.Frame(job_row, bg="white")
        job_opts.pack(side="left", fill="x", expand=True, padx=(3,0))
        self._job_var = tk.StringVar(value="全职")
        for opt, val in [("全职", "全职"), ("兼职", "兼职"), ("店长", "店长")]:
            rb = tk.Radiobutton(job_opts, text=opt, variable=self._job_var, value=val,
                                font=("微软雅黑",12), bg="white", fg="black",
                                activebackground="#A8C8FF", selectcolor="#A8C8FF",
                                relief="solid", bd=1, width=7, anchor="center",
                                indicatoron=False)
            rb.pack(side="left", padx=(0,8), ipady=2)

        self._make_field(right, "门店名称", 14)
        self._make_img_field(right, "店长手机号", 14, "shop_phone")
        self._make_img_field(right, "常用图片", 14, "common_img")
        self._make_img_field(right, "门店门面", 14, "super_cang_img")

        confirm_row = tk.Frame(right, bg="white")
        confirm_row.pack(fill="x", padx=8, pady=(6,8))
        self._btn_feishu = tk.Button(confirm_row, text="写入飞书", bg=STYLE_BTN, relief="flat", width=12, font=("微软雅黑",12), command=self._on_write_feishu, state="normal")
        self._btn_feishu.pack(side="left", padx=(0,6), pady=6)
        self._btn_clear = tk.Button(confirm_row, text="清空", bg=BTN_CANCEL, relief="flat", width=10, font=("微软雅黑",12), command=self._on_clear)
        self._btn_clear.pack(side="left", pady=6)
        self._parsed_data = {}

    def _make_field(self, parent, key, label_w):
        row = tk.Frame(parent, bg="white")
        row.pack(fill="x", pady=1)
        lbl = tk.Label(row, text=key+"：", font=("微软雅黑",12), bg=LABEL_BG, anchor="e", width=label_w, padx=5, pady=3)
        lbl.pack(side="left", pady=0)
        ent = tk.Entry(row, font=("微软雅黑",12), bg=FIELD_BG, relief="solid", bd=1)
        ent.pack(side="left", fill="x", expand=True, padx=(3,0))
        self._field_entries[key] = ent

    def _make_img_field(self, parent, key, label_w, attr_name):
        row = tk.Frame(parent, bg="white")
        row.pack(fill="x", pady=2)
        lbl = tk.Label(row, text=key+"：", font=("微软雅黑",12), bg=LABEL_BG, anchor="e", width=label_w, padx=5, pady=3)
        lbl.pack(side="left", pady=0)
        content = tk.Frame(row, bg="white")
        content.pack(side="left", fill="x", expand=True, padx=(3,0), anchor="w")
        # 创建20px高的灰色占位图，与Entry行高对齐
        ph_img = Image.new("RGB", (100, 20), "#DDDDDD")
        ph_tk = ImageTk.PhotoImage(ph_img)
        setattr(self, f"_{attr_name}_ph_tk", ph_tk)
        thumb = tk.Label(content, image=ph_tk, text="（无图片）", compound="center", font=("微软雅黑",7), fg="#999", bg="#DDDDDD", relief="solid", bd=1)
        thumb.pack(side="left", padx=(0,8), pady=3)
        thumb.bind("<Button-1>", lambda e, a=attr_name: self._on_thumb_click(a))
        setattr(self, f"_{attr_name}_thumb", thumb)
        setattr(self, f"_{attr_name}_fpath", None)
        setattr(self, f"_{attr_name}_tk", None)
        btn_text = "复制图片" if attr_name in ("common_img", "super_cang_img") else "复制手机号"
        btn = tk.Button(content, text=btn_text, bg=STYLE_BTN, relief="flat", width=9, font=("微软雅黑",8), state="disabled", command=lambda a=attr_name: self._on_copy_img(a))
        btn.pack(side="left", padx=0)
        setattr(self, f"_{attr_name}_btn", btn)

    def _on_parse(self):
        text = self._txt.get("1.0", "end").strip()
        if not text:
            messagebox.showwarning("提示", "请先粘贴聊天记录文本")
            return
        result = self._parse_text(text)
        if result:
            self._parsed_data = result
            self._update_confirm_fields(result)
            self._btn_feishu.configure(state="normal")
        else:
            self._clear_confirm_fields()
            self._btn_feishu.configure(state="disabled")
            messagebox.showwarning("提示", "未能识别候选人信息，请检查格式是否正确")

    def _on_write_feishu(self):
        name = self._field_entries["姓名"].get().strip()
        if not name:
            messagebox.showwarning("提示", "请填写姓名")
            return
        self._btn_feishu.configure(state="disabled", text="写入中...")
        self.update()
        try:
            write_data = dict(self._parsed_data) if self._parsed_data else {}
            target_label = self._do_write_record(write_data)
            self._txt.delete("1.0", "end")
            self._parsed_data = {}
            messagebox.showinfo("成功", f"候选人信息已{target_label}")
        except Exception as e:
            messagebox.showerror("写入失败", str(e))
        finally:
            self._btn_feishu.configure(state="normal", text=self._write_button_text())

    # ==================== 多目标写入 ====================
    def _on_target_changed(self):
        """切换写入目标时启用/禁用相关输入项"""
        target = self._target_var.get()
        is_webhook = (target == "webhook")
        self._target_mode_box.configure(state="readonly" if is_webhook else "disabled")
        self._target_url_entry.configure(state="normal" if is_webhook else "disabled")
        self._target_proxy_entry.configure(state="normal" if is_webhook else "disabled")
        hints = {
            "feishu": "飞书多维表格：使用当前活跃账号的凭证写入",
            "webhook": "Webhook：generic=通用JSON，feishu/dingtalk/wecom=群机器人报文",
            "csv": "本地 CSV：追加保存到本地文件，可用 Excel 打开",
        }
        self._target_hint.configure(text=hints.get(target, ""))
        if hasattr(self, "_btn_feishu"):
            self._btn_feishu.configure(text=self._write_button_text())

    def _on_save_target(self):
        cfg = self._load_integration()
        cfg["target"] = self._target_var.get()
        cfg["webhook"] = {
            "url": self._target_url_entry.get().strip(),
            "mode": self._target_mode_var.get(),
            "proxy": self._target_proxy_entry.get().strip(),
        }
        cfg["csv"] = {"path": self._target_csv_var.get().strip() or os.path.join(DATA_DIR, "候选人记录.csv")}
        try:
            self._save_integration(cfg)
        except Exception as e:
            messagebox.showerror("保存失败", str(e))
            return
        self._on_target_changed()
        messagebox.showinfo("成功", f"写入目标已保存：{self._target_var.get()}")

    def _on_test_target(self):
        target = self._target_var.get()
        if target == "feishu":
            try:
                token = self._get_tenant_access_token()
            except Exception as e:
                messagebox.showerror("连接失败", str(e))
                return
            messagebox.showinfo("连接正常", "飞书凭证有效" if token else "飞书认证失败")
            return
        if target == "csv":
            path = self._target_csv_var.get().strip() or os.path.join(DATA_DIR, "候选人记录.csv")
            messagebox.showinfo("本地导出", f"记录将追加到：\n{path}")
            return
        url = self._target_url_entry.get().strip()
        if not url:
            messagebox.showwarning("提示", "请先填写接口地址")
            return
        try:
            self._write_via_webhook(
                {"姓名": "测试", "意向岗位": "连通性测试"},
                {"url": url, "mode": self._target_mode_var.get(), "proxy": self._target_proxy_entry.get().strip()},
            )
            messagebox.showinfo("连接正常", "接口已收到测试请求")
        except Exception as e:
            messagebox.showerror("连接失败", str(e))

    def _load_integration(self):
        """读取写入目标配置（飞书 / Webhook / 本地CSV）"""
        cfg = {
            "target": "feishu",
            "webhook": {"url": "", "mode": "generic", "proxy": ""},
            "csv": {"path": os.path.join(DATA_DIR, "候选人记录.csv")},
        }
        try:
            if os.path.exists(INTEGRATION_FILE):
                with open(INTEGRATION_FILE, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                cfg["target"] = saved.get("target", cfg["target"])
                for k in ("webhook", "csv"):
                    if isinstance(saved.get(k), dict):
                        cfg[k].update(saved[k])
        except Exception:
            pass
        return cfg

    def _save_integration(self, cfg):
        with open(INTEGRATION_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)

    def _write_button_text(self):
        target = self._load_integration()["target"]
        return {"feishu": "写入飞书", "webhook": "发送接口", "csv": "导出CSV"}.get(target, "写入飞书")

    def _do_write_record(self, data):
        """按配置的写入目标分发，返回给用户看的结果描述"""
        cfg = self._load_integration()
        target = cfg["target"]
        if target == "webhook":
            self._write_via_webhook(data, cfg["webhook"])
            return "发送到 Webhook 接口"
        if target == "csv":
            path = self._write_to_csv(data, cfg["csv"])
            return f"已追加保存到 {os.path.basename(path)}"
        self._do_write_feishu(data)
        return "写入飞书多维表格"

    def _write_via_webhook(self, data, wh):
        """POST 到任意 HTTP 接口：支持通用 JSON / 飞书机器人 / 钉钉机器人 / 企业微信机器人"""
        url = (wh.get("url") or "").strip()
        if not url:
            raise Exception("请先在「Tab4 · 写入目标」中填写接口地址")
        mode = wh.get("mode", "generic")
        proxy = (wh.get("proxy") or "").strip()
        if proxy:
            url = proxy.rstrip("/") + url

        fields = ["姓名", "年龄", "性别", "联系方式", "SAP代码", "意向岗位", "门店名称"]
        text = "｜".join(f"{k}：{data[k]}" for k in fields if data.get(k))
        if mode == "feishu":
            body = {"msg_type": "text", "content": {"text": f"【新人登记】{text}"}}
        elif mode == "dingtalk":
            body = {"msgtype": "text", "text": {"content": f"【新人登记】{text}"}}
        elif mode == "wecom":
            body = {"msgtype": "text", "text": {"content": f"【新人登记】{text}"}}
        else:
            body = {k: data[k] for k in fields if data.get(k)}
            body["source"] = "candidate-entry"

        req = urllib.request.Request(url, data=json.dumps(body, ensure_ascii=False).encode("utf-8"), method="POST")
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            raise Exception(f"接口返回 HTTP {e.code}：{e.read().decode('utf-8', 'ignore')[:200]}")
        code = result.get("code", result.get("errcode"))
        if code not in (None, 0):
            raise Exception(f"接口返回错误：{code} {result.get('msg') or result.get('errmsg') or ''}")

    def _write_to_csv(self, data, csv_cfg):
        """追加写入本地 CSV（Excel 可直接打开）"""
        path = (csv_cfg.get("path") or "").strip() or os.path.join(DATA_DIR, "候选人记录.csv")
        if not os.path.isabs(path):
            path = os.path.join(BASE_DIR, path)
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        fields = ["录入时间", "姓名", "年龄", "性别", "联系方式", "SAP代码", "意向岗位", "门店名称"]
        exists = os.path.exists(path)
        with open(path, "a", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            if not exists:
                writer.writerow(fields)
            writer.writerow([
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                data.get("姓名", ""), data.get("年龄", ""), data.get("性别", ""),
                data.get("联系方式", ""), data.get("SAP代码", ""),
                data.get("意向岗位", ""), data.get("门店名称", ""),
            ])
        return path

    def _do_write_feishu(self, data):
        # 1. 认证
        token = self._get_tenant_access_token()
        if not token:
            raise Exception("飞书认证失败，请检查 App ID 和 App Secret")

        # 2. 查表ID（直接用已知table_id，避免再次查询）
        table_id = FEISHU_TABLE_ID

        # 3. 使用当前活跃账号的 app_token 写入记录
        acc = self._get_active_account()
        app_token = acc["app_token"] if acc else FEISHU_APP_TOKEN
        url = f"{FEISHU_BASE_URL}/bitable/v1/apps/{app_token}/tables/{table_id}/records"
        # 联系方式格式：手机号xxx；微信号yyy
        contact_raw = data.get("联系方式", "")
        feishu_contact = ""
        if "手机号" in contact_raw or "微信号" in contact_raw:
            parts = []
            if "手机号" in contact_raw:
                m = re.search(r"手机号([^/]+)", contact_raw)
                if m: parts.append(f"手机号{m.group(1)}")
            if "微信号" in contact_raw:
                m = re.search(r"微信号([^/]+)", contact_raw)
                if m: parts.append(f"微信号{m.group(1)}")
            feishu_contact = "；".join(parts)

        fields = {
            "姓名": self._field_entries["姓名"].get().strip(),
            "年龄": self._field_entries["年龄"].get().strip(),
            "联系方式": feishu_contact,
            "SAP代码": self._field_entries["SAP代码"].get().strip(),
            "性别": self._sex_var.get(),
            "意向岗位": self._job_var.get(),
        }
        payload = {"fields": fields}
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            if result.get("code") != 0:
                raise Exception(f"写入失败：{result.get('msg')}")

    def _get_tenant_access_token(self):
        acc = self._get_active_account()
        if not acc:
            raise Exception("没有可用的飞书账号，请先在Tab4中添加账号")
        url = f"{FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal"
        payload = json.dumps({"app_id": acc["app_id"], "app_secret": acc["app_secret"]}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, method="POST")
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read())
                if result.get("code") != 0:
                    return None
                return result.get("tenant_access_token")
        except Exception as e:
            raise Exception(f"连接飞书失败：{e}")

    def _on_cancel(self):
        self._txt.delete("1.0", "end")

    def _on_clear(self):
        self._clear_confirm_fields()
        self._btn_feishu.configure(state="disabled")
        self._parsed_data = {}
        self._sex_var.set("女")
        self._job_var.set("全职")

    def _update_confirm_fields(self, data):
        print("DEBUG _update_confirm_fields, data =", data)
        print("DEBUG _field_entries keys =", list(self._field_entries.keys()))
        # 填充所有文字字段（姓名、联系方式、性别、意向岗位）
        for key, ent in self._field_entries.items():
            val = data.get(key, "")
            ent.configure(state="normal")
            ent.delete(0, "end")
            if val:
                ent.insert(0, val)
        age_val = data.get("年龄", "")
        age_ent = self._field_entries.get("年龄")
        if age_val:
            try:
                age = int(re.search(r"\d+", age_val).group())
                if 18 <= age <= 40:
                    age_ent.configure(fg="#228B22", readonlybackground="#F0FFF0")
                else:
                    age_ent.configure(fg="#CC2222", readonlybackground="#FFF0F0")
            except:
                age_ent.configure(fg="black", readonlybackground=FIELD_BG)
        else:
            age_ent.configure(fg="black", readonlybackground=FIELD_BG)
        store_name = data.get("门店名称", "")
        sap_code = self._lookup_sap_by_store(store_name)
        self._field_entries["门店名称"].configure(state="normal")
        self._field_entries["门店名称"].delete(0, "end")
        self._field_entries["门店名称"].insert(0, store_name)
        if sap_code:
            self._field_entries["SAP代码"].configure(state="normal")
            self._field_entries["SAP代码"].delete(0, "end")
            self._field_entries["SAP代码"].insert(0, sap_code)
            self._load_shop_phone_thumb(sap_code)
        else:
            self._field_entries["SAP代码"].configure(state="normal")
            self._field_entries["SAP代码"].delete(0, "end")
            self._clear_img_field("shop_phone")
        self._load_common_img_thumb()
        self._load_super_cang_thumb()

    def _clear_confirm_fields(self):
        for key, ent in self._field_entries.items():
            ent.configure(state="normal")
            ent.delete(0, "end")
            ent.configure(state="normal", fg="black", readonlybackground=FIELD_BG)
        self._clear_img_field("shop_phone")
        self._load_common_img_thumb()
        self._load_super_cang_thumb()

    def _clear_img_field(self, attr_name):
        thumb = getattr(self, f"_{attr_name}_thumb")
        ph_tk = getattr(self, f"_{attr_name}_ph_tk", None)
        if ph_tk:
            thumb.configure(image=ph_tk, text="", bg="#DDDDDD")
        else:
            thumb.configure(image="", text="（无图片）", bg="#DDDDDD", fg="#999")
        setattr(self, f"_{attr_name}_fpath", None)
        btn = getattr(self, f"_{attr_name}_btn")
        btn.configure(state="disabled")

    def _load_shop_phone_thumb(self, sap_code):
        self._clear_img_field("shop_phone")
        if not os.path.isdir(IMG_LIBRARY_DIR):
            return
        try:
            files = sorted([f for f in os.listdir(IMG_LIBRARY_DIR) if f.lower().endswith((".png",".jpg",".jpeg",".bmp",".gif"))])
        except:
            files = []
        matched = [f for f in files if sap_code in f]
        if not matched: matched = files
        if not matched: return
        fpath = os.path.join(IMG_LIBRARY_DIR, matched[0])
        self._shop_phone_fpath = fpath
        self._set_thumb_image("shop_phone", fpath)

    def _load_common_img_thumb(self):
        fpath = os.path.join(FIXED_IMG_DIR, "1.png")
        if os.path.isfile(fpath):
            self._common_img_fpath = fpath
            self._set_thumb_image("common_img", fpath)
            btn = getattr(self, "_common_img_btn")
            btn.configure(state="normal")

    def _load_super_cang_thumb(self):
        for fname in STOREFRONT_IMG_NAMES:
            fpath = os.path.join(FIXED_IMG_DIR, fname)
            if os.path.isfile(fpath):
                self._super_cang_img_fpath = fpath
                self._set_thumb_image("super_cang_img", fpath)
                btn = getattr(self, "_super_cang_img_btn")
                btn.configure(state="normal")
                return

    def _set_thumb_image(self, attr_name, fpath):
        thumb = getattr(self, f"_{attr_name}_thumb")
        btn = getattr(self, f"_{attr_name}_btn")
        try:
            img = Image.open(fpath)
            thumb_img = img.copy()
            thumb_img.thumbnail((500, 20), Image.LANCZOS)
            tk_thumb = ImageTk.PhotoImage(thumb_img)
            setattr(self, f"_{attr_name}_tk", tk_thumb)
            thumb.configure(image=tk_thumb, text="", bg="white")
            btn.configure(state="normal")
        except:
            thumb.configure(image="", text="（加载失败）", bg="#DDDDDD", fg="#999")
            btn.configure(state="disabled")

    def _on_thumb_click(self, attr_name):
        fpath = getattr(self, f"_{attr_name}_fpath")
        if not fpath: return
        self._show_image_window(fpath)

    def _show_image_window(self, fpath):
        # 关闭已打开的放大窗口
        if hasattr(self, '_img_win') and self._img_win is not None:
            try:
                self._img_win.destroy()
            except:
                pass
        self._img_win = tk.Toplevel(self)
        self._img_win.title("查看图片")
        self._img_win.resizable(False, False)
        try:
            img = Image.open(fpath)
            img_w, img_h = img.size
            max_w, max_h = 700, 550
            ratio = min(max_w/img_w, max_h/img_h, 1)
            disp_w, disp_h = int(img_w*ratio), int(img_h*ratio)
            disp_img = img.resize((disp_w, disp_h), Image.LANCZOS)
            self._img_tk = ImageTk.PhotoImage(disp_img)
            canvas = tk.Canvas(self._img_win, bg="#222", width=disp_w, height=disp_h, highlightthickness=0, cursor="hand2")
            canvas.pack()
            canvas.create_image(disp_w//2, disp_h//2, image=self._img_tk)
            canvas.bind("<Button-1>", lambda e: self._img_win.destroy())
            self._img_win.geometry(f"{disp_w}x{disp_h}")
            self._img_win.transient(self)
            self._img_win.grab_set()
            self._img_win.lift()
            self._img_win.focus_force()
            # 点击画布任意位置关闭
            self._img_win.bind("<Escape>", lambda e: self._img_win.destroy())
        except Exception as e:
            tk.Label(self._img_win, text=f"加载失败：{e}", fg="red", bg="#333", font=("微软雅黑",10)).pack(padx=20, pady=20)
            self._img_win.geometry("400x60")

    def _on_copy_img(self, attr_name):
        fpath = getattr(self, f"_{attr_name}_fpath")
        if not fpath: return
        try:
            import subprocess
            subprocess.run([
                "powershell", "-Command",
                f"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile('{fpath}'))"
            ], check=True, capture_output=True)
            messagebox.showinfo("已复制", "图片已复制到剪贴板")
        except Exception as e:
            messagebox.showwarning("复制失败", f"无法复制图片：\n{e}")

    def _lookup_sap_by_store(self, store_name):
        if not store_name: return ""
        for pos, cfg in self.sap_config.items():
            if str(pos).startswith("col_width"): continue
            m = re.search(r"（([^）]+)）", pos)
            if m and m.group(1) == store_name:
                if isinstance(cfg, dict):
                    return cfg.get("sap", "")
                return cfg
        return ""

    def _parse_text(self, text):
        lines = text.split("\n")
        data = {}

        # 手机号 / 微信号：按3行块解析
        phone_block = None
        wechat_block = None
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if "的手机号：" in line:
                # 手机号块：第1行含关键词，第2行是内容
                if i + 1 < len(lines):
                    phone_block = lines[i + 1].strip()
                i += 3  # 跳过 关键词行 + 内容行 + 复制按钮行
            elif "的微信号：" in line:
                if i + 1 < len(lines):
                    wechat_block = lines[i + 1].strip()
                i += 3
            else:
                i += 1

        # 联系方式合并显示
        contact_parts = []
        if phone_block:
            contact_parts.append(f"手机号{phone_block}")
        if wechat_block:
            contact_parts.append(f"微信号{wechat_block}")
        if contact_parts:
            data["联系方式"] = "/".join(contact_parts)

        # 年龄
        m = re.search(r"(\d{1,3})\s*岁", text)
        if m: data["年龄"] = m.group(1)

        # 姓名：第一个非空且不含关键词的行
        for line in lines:
            s = line.strip()
            if s and "的手机号：" not in s and "的微信号：" not in s and s != "复制手机号" and s != "复制微信号":
                data["姓名"] = s
                break

        # 门店名称
        m = re.search(r"沟通职位[：:]\s*(.+?)(?=\n|$)", text)
        if m:
            job_text = m.group(1).strip()
            m2 = re.search(r"（([^）]+)）", job_text)
            if m2: data["门店名称"] = m2.group(1)

        return data if data else None

    def _on_backup_row(self, pos):
        """备份指定岗位的配置到 sap_config 的备份区"""
        if pos not in self.sap_config:
            messagebox.showwarning("提示", "未找到该岗位的配置")
            return
        cfg = self.sap_config[pos]
        backup_key = f"_backup_{pos}"
        self.sap_config[backup_key] = cfg
        self._save_sap_config()
        messagebox.showinfo("备份成功", f"岗位「{pos}」的配置已备份")

    # ==================== Tab2 ====================
    def _build_tab2(self):
        fr = self._tab2
        frm = tk.Frame(fr, bg=STYLE_BG)
        frm.pack(fill="both", expand=True, padx=8, pady=8)

        self._editing_item = None  # 当前正在编辑的 Treeview 行（双击回填时设置）

        # 左面板
        left = tk.Frame(frm, bg=STYLE_BG)
        left.pack(side="left", fill="y", padx=(0, 8))

        # 发布数量统计
        top_row = tk.Frame(left, bg=STYLE_BG)
        top_row.pack(fill="x", pady=(0,4))
        self._lbl_pub_count = tk.Label(
            top_row, text="岗位发布数：0", bg=STYLE_BG,
            font=("微软雅黑", 11, "bold"), fg="#3366CC"
        )
        self._lbl_pub_count.pack(side="left")
        tk.Button(top_row, text="保存", bg=STYLE_BTN, relief="flat", font=("微软雅黑",9),
                  command=self._on_save_layout).pack(side="right")

        # 筛选行
        filter_row = tk.Frame(left, bg=STYLE_BG)
        filter_row.pack(fill="x", pady=(0,4))
        tk.Label(filter_row, text="城市筛选：", bg=STYLE_BG, font=("微软雅黑", 10)).pack(side="left", padx=(0,4))
        self._city_filter = ttk.Combobox(filter_row, width=12, font=("微软雅黑", 10), state="readonly")
        self._city_filter.pack(side="left", padx=(0,8))
        self._city_filter.bind("<<ComboboxSelected>>", lambda e: self._filter_tab2_tree())
        tk.Label(filter_row, text="是否发布：", bg=STYLE_BG, font=("微软雅黑", 10)).pack(side="left", padx=(0,4))
        self._pub_filter = ttk.Combobox(filter_row, width=7, font=("微软雅黑", 10), state="readonly", values=["全部", "是", "否"])
        self._pub_filter.pack(side="left")
        self._pub_filter.current(0)
        self._pub_filter.bind("<<ComboboxSelected>>", lambda e: self._filter_tab2_tree())

        # 岗位城市（同行排列）
        row_city = tk.Frame(left, bg=STYLE_BG)
        row_city.pack(fill="x", pady=(0,4))
        tk.Label(row_city, text="岗位城市：", bg=STYLE_BG, font=("微软雅黑", 10), anchor="e", width=8).pack(side="left")
        self._ent_city = tk.Entry(row_city, bg=STYLE_ENTRY, relief="solid", bd=1, width=16)
        self._ent_city.pack(side="left", fill="x", expand=True)

        # 岗位名称（同行排列）
        row_pos = tk.Frame(left, bg=STYLE_BG)
        row_pos.pack(fill="x", pady=(0,4))
        tk.Label(row_pos, text="岗位名称：", bg=STYLE_BG, font=("微软雅黑", 10), anchor="e", width=8).pack(side="left")
        self._ent_pos = tk.Entry(row_pos, bg=STYLE_ENTRY, relief="solid", bd=1, width=16)
        self._ent_pos.pack(side="left", fill="x", expand=True)

        # SAP代码（同行排列）
        row_sap = tk.Frame(left, bg=STYLE_BG)
        row_sap.pack(fill="x", pady=(0,4))
        tk.Label(row_sap, text="SAP代码：", bg=STYLE_BG, font=("微软雅黑", 10), anchor="e", width=8).pack(side="left")
        self._ent_sap = tk.Entry(row_sap, bg=STYLE_ENTRY, relief="solid", bd=1, width=16)
        self._ent_sap.pack(side="left", fill="x", expand=True)

        # 备注（同行排列）
        row_note = tk.Frame(left, bg=STYLE_BG)
        row_note.pack(fill="x", pady=(0,4))
        tk.Label(row_note, text="备注：", bg=STYLE_BG, font=("微软雅黑", 10), anchor="e", width=8).pack(side="left")
        self._ent_note = tk.Entry(row_note, bg=STYLE_ENTRY, relief="solid", bd=1, width=16)
        self._ent_note.pack(side="left", fill="x", expand=True)

        # 是否发布
        tk.Label(left, text="是否发布：", bg=STYLE_BG, font=("微软雅黑", 10)).pack(anchor="w", pady=(0,2))
        self._pub_var = tk.StringVar(value="是")
        pub_row = tk.Frame(left, bg=STYLE_BG)
        pub_row.pack(anchor="w", pady=(0,6))
        tk.Radiobutton(pub_row, text="是", variable=self._pub_var, value="是",
                       bg=STYLE_BG, font=("微软雅黑", 10)).pack(side="left", padx=(0,10))
        tk.Radiobutton(pub_row, text="否", variable=self._pub_var, value="否",
                       bg=STYLE_BG, font=("微软雅黑", 10)).pack(side="left")

        # 按钮行
        btn_row = tk.Frame(left, bg=STYLE_BG)
        btn_row.pack(fill="x", pady=(0,4))
        self._btn_add = tk.Button(btn_row, text="添加/保存", bg=STYLE_BTN, relief="flat", width=10, command=self._on_add_or_update_sap)
        self._btn_add.pack(side="left", padx=(0,4))
        self._btn_del = tk.Button(btn_row, text="删除选中", bg=BTN_CANCEL, relief="flat", width=10, command=self._on_del_sap)
        self._btn_del.pack(side="left")

        # 分隔线
        sep = tk.Frame(frm, bg=STYLE_BG2, width=1, bd=0)
        sep.pack(side="left", fill="y", padx=(0,8))

        # 右表格
        right = tk.Frame(frm, bg="white", bd=1, relief="solid")
        right.pack(side="left", fill="both", expand=True)
        cols = ("序号", "岗位城市", "岗位名称", "SAP代码", "是否发布", "备注")
        self._tree = ttk.Treeview(right, columns=cols, show="headings", height=20, style="Custom.Treeview")
        # 表头样式：居中、11pt、#3366CC、加粗、浅灰背景
        style_tree = ttk.Style()
        style_tree.configure("Custom.Treeview.Heading", font=("微软雅黑", 11, "bold"), foreground="#3366CC", background="#E8E8E8")
        # 内容行样式：10pt、不加粗
        style_tree.configure("Custom.Treeview", font=("微软雅黑", 10))
        for col in cols:
            self._tree.heading(col, text=col, anchor="center")
        self._tree.column("序号", width=45, minwidth=35, stretch=False, anchor="center")
        self._tree.column("岗位城市", width=100, minwidth=60, anchor="center")
        self._tree.column("岗位名称", width=150, minwidth=80, anchor="center")
        self._tree.column("SAP代码", width=90, minwidth=60, anchor="center")
        self._tree.column("是否发布", width=70, minwidth=50, stretch=False, anchor="center")
        self._tree.column("备注", width=120, minwidth=60, anchor="center")
        vsb = ttk.Scrollbar(right, command=self._tree.yview)
        self._tree.configure(yscrollcommand=vsb.set)
        self._tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")
        self._tree.bind("<Double-Button-1>", lambda e: self._on_tree_double(e))
        self._tree.bind("<Configure>", lambda e: self._restore_col_widths())
        self._tree_right_frame = right
        self._tree.bind("<Button-1>", lambda e: self._on_tree_click(e))
        self._load_sap_data()
        self._city_filter.set("全部")

    def _on_tree_click(self, e):
        """点击 Treeview 行：若点在行间空白则取消选中；点在行上则放行让 Treeview 自然处理"""
        if not self._tree.identify_row(e.y):
            self._tree.selection_remove(*self._tree.selection())

    def _on_add_or_update_sap(self):
        city = self._ent_city.get().strip()
        pos = self._ent_pos.get().strip()
        sap = self._ent_sap.get().strip()
        note = self._ent_note.get().strip()
        published = self._pub_var.get()
        if not pos or not sap:
            messagebox.showwarning("提示", "岗位名称和SAP代码都不能为空")
            return
        # 修改模式：更新原行
        if self._editing_item is not None:
            seq = self._tree.item(self._editing_item, "values")[0]
            old_pos = self._tree.item(self._editing_item, "values")[2]
            self._tree.item(self._editing_item, values=(seq, city, pos, sap, published, note))
            if old_pos in self.sap_config:
                del self.sap_config[old_pos]
            self.sap_config[pos] = {"sap": sap, "city": city, "published": published, "note": note}
            self._save_sap_config()
            self._filter_tab2_tree()
            self._reset_form()
            return
        # 新增模式
        for item in self._tree.get_children():
            if self._tree.item(item, "values")[1] == pos:
                seq = self._tree.item(item, "values")[0]
                self._tree.item(item, values=(seq, city, pos, sap, published, note))
                self.sap_config[pos] = {"sap": sap, "city": city, "published": published, "note": note}
                self._save_sap_config()
                self._filter_tab2_tree()
                self._reset_form()
                return
        self.sap_config[pos] = {"sap": sap, "city": city, "published": published, "note": note}
        self._save_sap_config()
        self._filter_tab2_tree()
        self._reset_form()

    def _reset_form(self):
        """清空表单并恢复新增模式"""
        self._editing_item = None
        self._ent_city.delete(0, "end")
        self._ent_pos.delete(0, "end")
        self._ent_sap.delete(0, "end")
        self._ent_note.delete(0, "end")
        self._pub_var.set("是")
        self._btn_add.configure(text="添加/保存")

    def _on_del_sap(self):
        sel = self._tree.selection()
        if not sel: return
        for item in sel:
            pos = self._tree.item(item, "values")[1]
            self._tree.delete(item)
            if pos in self.sap_config:
                del self.sap_config[pos]
        self._save_sap_config()
        self._filter_tab2_tree()
        if self._editing_item in sel:
            self._reset_form()

    def _on_tree_double(self, e):
        item = self._tree.identify_row(e.y)
        if not item: return
        col_id = self._tree.identify_column(e.x)
        vals = self._tree.item(item, "values")
        # col_id is #N where N is column index (1-based)
        # #1=序号, #2=岗位城市, #3=岗位名称, #4=SAP代码, #5=是否发布, #6=备注
        city, pos, sap, published, note = vals[1], vals[2], vals[3], vals[4], vals[5]
        self._ent_city.delete(0, "end")
        self._ent_city.insert(0, city)
        self._ent_pos.delete(0, "end")
        self._ent_pos.insert(0, pos)
        self._ent_sap.delete(0, "end")
        self._ent_sap.insert(0, sap)
        self._ent_note.delete(0, "end")
        self._ent_note.insert(0, note)
        self._pub_var.set(published)
        self._editing_item = item
        self._btn_add.configure(text="保存修改")

    def _load_sap_data(self):
        for item in self._tree.get_children():
            self._tree.delete(item)
        idx = 0
        cities = set()
        for pos, cfg in sorted(self.sap_config.items()):
            if str(pos).startswith("col_width"):
                continue
            idx += 1
            # 兼容旧格式：cfg 可能是字符串（老数据）
            if isinstance(cfg, str):
                cfg = {"sap": cfg, "city": "", "published": "否", "note": ""}
            city = cfg.get("city", "")
            sap = cfg.get("sap", "")
            published = cfg.get("published", "否")
            note = cfg.get("note", "")
            if city:
                cities.add(city)
            seq = idx
            self._tree.insert("", "end", values=(seq, city, pos, sap, published, note))
        self._restore_col_widths()
        self._update_pub_count()
        self._city_filter["values"] = ["全部"] + sorted(cities)

    def _restore_col_widths(self):
        col_map = {"序号": "col_width_序号", "岗位城市": "col_width_岗位城市",
                   "岗位名称": "col_width_岗位名称", "SAP代码": "col_width_SAP代码",
                   "是否发布": "col_width_是否发布", "备注": "col_width_备注"}
        for col, key in col_map.items():
            if key in self._layout:
                try:
                    self._tree.column(col, width=int(self._layout[key]))
                except: pass

    def _update_pub_count(self):
        count = 0
        for pos, cfg in self.sap_config.items():
            if str(pos).startswith("col_width"):
                continue
            if isinstance(cfg, dict) and cfg.get("published") == "是":
                count += 1
        self._lbl_pub_count.configure(text=f"岗位发布数：{count}")

    def _filter_tab2_tree(self):
        city_sel = self._city_filter.get()
        pub_sel  = self._pub_filter.get()
        # 清空树，重新插入符合条件的行
        for item in self._tree.get_children():
            self._tree.delete(item)
        idx = 0
        cities = set()
        for pos, cfg in sorted(self.sap_config.items()):
            if str(pos).startswith("col_width"):
                continue
            if isinstance(cfg, str):
                cfg = {"sap": cfg, "city": "", "published": "否", "note": ""}
            city      = cfg.get("city", "")
            sap       = cfg.get("sap", "")
            published = cfg.get("published", "否")
            note      = cfg.get("note", "")
            city_ok   = (city_sel == "全部" or city == city_sel)
            pub_ok    = (pub_sel  == "全部" or published == pub_sel)
            if city_ok and pub_ok:
                idx += 1
                self._tree.insert("", "end", values=(idx, city, pos, sap, published, note))
            if city:
                cities.add(city)
        # 更新城市下拉选项
        self._city_filter["values"] = ["全部"] + sorted(cities)
        self._update_pub_count()

    # ==================== Tab3 ====================
    def _build_tab3(self):
        fr = self._tab3
        paned = ttk.PanedWindow(fr, orient="horizontal")
        paned.pack(fill="both", expand=True, padx=8, pady=8)
        self._tab3_paned = paned
        left_frm = tk.Frame(paned, bg=STYLE_BG2, relief="solid", bd=1)
        paned.add(left_frm)
        hdr = tk.Frame(left_frm, bg=STYLE_BG2)
        hdr.pack(fill="x", padx=4, pady=(4,2))
        tk.Label(hdr, text="图片列表", bg=STYLE_BG2, font=("微软雅黑", 9, "bold")).pack(side="left")
        tk.Button(hdr, text="保存", bg=STYLE_BTN, relief="flat", font=("微软雅黑",8),
                  command=self._on_save_layout).pack(side="right")
        list_frm = tk.Frame(left_frm, bg="white")
        list_frm.pack(fill="both", expand=True, padx=4, pady=(0,4))
        self._lib_canvas = tk.Canvas(list_frm, bg="white", highlightthickness=0)
        lib_vsb = ttk.Scrollbar(list_frm, command=self._lib_canvas.yview)
        self._lib_canvas.configure(yscrollcommand=lib_vsb.set)
        self._lib_canvas.pack(side="left", fill="both", expand=True)
        lib_vsb.pack(side="right", fill="y")
        self._lib_inner = tk.Frame(self._lib_canvas, bg="white")
        self._lib_canvas.create_window((0,0), window=self._lib_inner, anchor="nw")
        self._lib_inner.bind("<Configure>", lambda e: self._lib_canvas.configure(scrollregion=self._lib_canvas.bbox("all")))
        self._lib_canvas.bind("<Enter>", lambda e: self._lib_canvas.unbind_all("<MouseWheel>"))
        self._lib_canvas.bind("<Leave>", lambda e: self._lib_canvas.bind_all("<MouseWheel>", lambda e: self._lib_canvas.yview_scroll(int(-1*(e.delta/120)), "units")))
        right_frm = tk.Frame(paned, bg="white", relief="solid", bd=1)
        paned.add(right_frm)
        prev_hdr = tk.Frame(right_frm, bg=STYLE_BG2)
        prev_hdr.pack(fill="x", padx=4, pady=(4,2))
        tk.Label(prev_hdr, text="详情描述", bg=STYLE_BG2, font=("微软雅黑", 9, "bold")).pack(side="left")
        tk.Button(prev_hdr, text="保存", bg=STYLE_BTN, relief="flat", font=("微软雅黑",8),
                  command=self._on_save_layout).pack(side="right")
        prev_frm = tk.Frame(right_frm, bg="white")
        prev_frm.pack(fill="both", expand=True, padx=4, pady=(0,4))
        # 用 Label 替代 Canvas，彻底避免尺寸/scrollregion 问题
        self._prev_label = tk.Label(prev_frm, bg="white", anchor="center")
        self._prev_label.pack(fill="both", expand=True)
        self._prev_label.bind("<Button-1>", lambda e: self._toggle_preview_full() if self._sel_file else None)
        self._prev_label.configure(cursor="hand2")
        self._detail_frm = tk.Frame(right_frm, bg="white", height=60)
        self._detail_frm.pack(fill="x", padx=4, pady=(0,4))
        self._detail_label = tk.Label(self._detail_frm, text="", bg="white", font=("微软雅黑", 8), anchor="w", justify="left", wraplength=320)
        self._detail_label.pack(fill="both", expand=True, padx=2, pady=2)
        tk.Label(right_frm, text="← 点击预览区图片放大查看", bg=STYLE_BG2, font=("微软雅黑", 7), fg="#888").pack(fill="x", padx=4, pady=(0,2))
        btn_row = tk.Frame(right_frm, bg=STYLE_BG2)
        btn_row.pack(fill="x", padx=4, pady=4)
        self._btn_copy_path = tk.Button(btn_row, text="复制路径", bg=STYLE_BTN, relief="flat", width=9, command=self._on_copy_path)
        self._btn_copy_path.pack(side="left", padx=2)
        self._btn_copy_img = tk.Button(btn_row, text="复制图片", bg=STYLE_BTN, relief="flat", width=9, command=self._on_copy_img_file)
        self._btn_copy_img.pack(side="left", padx=2)
        self._btn_upload = tk.Button(btn_row, text="上传", bg=STYLE_BTN, relief="flat", width=9, command=self._on_upload)
        self._btn_upload.pack(side="left", padx=2)
        self._btn_delete = tk.Button(btn_row, text="删除", bg=BTN_CANCEL, relief="flat", width=9, command=self._on_delete_lib)
        self._btn_delete.pack(side="left", padx=2)
        self._sel_file = None
        self._prev_full = False
        self._sel_btn = None
        self._lib_buttons = []
        self._tk_images = {}
        self._prev_fpath = None  # 当前预览图片路径（缩略）
        self._prev_full_fpath = None  # 全尺寸图片路径

    def _refresh_img_lib_list(self):
        for w in self._lib_inner.winfo_children():
            w.destroy()
        self._lib_buttons = []
        self._tk_images.clear()

        # 常用图片 & 门店门面（置顶）
        pinned_path = os.path.join(FIXED_IMG_DIR, "1.png")
        hdr = tk.Frame(self._lib_inner, bg=STYLE_BG)
        hdr.pack(fill="x", padx=2, pady=(2, 1))
        btn = tk.Button(hdr, text="常用图片", bg=STYLE_ENTRY, relief="flat", anchor="w", font=("微软雅黑", 8), justify="left", command=lambda: self._on_lib_item_click(pinned_path, btn))
        btn.pack(fill="x", padx=2, pady=1)
        self._lib_buttons.append((btn, pinned_path))

        sc_path = ""
        for fname in STOREFRONT_IMG_NAMES:
            candidate = os.path.join(FIXED_IMG_DIR, fname)
            if os.path.isfile(candidate):
                sc_path = candidate
                break
        btn_sc = tk.Button(hdr, text="门店门面", bg=STYLE_ENTRY, relief="flat", anchor="w", font=("微软雅黑", 8), justify="left")
        btn_sc.configure(command=lambda p=sc_path, b=btn_sc: self._on_lib_item_click(p, b))
        btn_sc.pack(fill="x", padx=2, pady=1)
        self._lib_buttons.append((btn_sc, sc_path))

        # 图片库其他图片（序号 + SAP码 + 店铺名称）
        if os.path.isdir(IMG_LIBRARY_DIR):
            try:
                files = sorted([f for f in os.listdir(IMG_LIBRARY_DIR) if f.lower().endswith((".png",".jpg",".jpeg",".bmp",".gif")) and f not in ("1.png",) + STOREFRONT_IMG_NAMES])
            except:
                files = []
            sep = tk.Frame(self._lib_inner, bg="#CCCCCC", height=1)
            sep.pack(fill="x", padx=2, pady=(4, 2))
            for idx, fname in enumerate(files, 1):
                fpath = os.path.join(IMG_LIBRARY_DIR, fname)
                sap_code = fname.split(".")[0]
                btn2 = tk.Button(self._lib_inner,
                                 text=f"{idx}. {sap_code}",
                                 bg=STYLE_ENTRY, relief="flat",
                                 anchor="w", font=("微软雅黑", 8), justify="left")
                btn2.configure(command=lambda p=fpath, b=btn2: self._on_lib_item_click(p, b))
                btn2.pack(fill="x", padx=2, pady=1)
                self._lib_buttons.append((btn2, fpath))

        self.update_idletasks()
        if self._lib_buttons:
            self._on_lib_item_click(self._lib_buttons[0][1], self._lib_buttons[0][0])

    def _on_lib_item_click(self, fpath, btn):
        if self._sel_btn:
            self._sel_btn.configure(bg=STYLE_ENTRY, relief="flat")
        btn.configure(bg=STYLE_BTN, relief="solid")
        self._sel_btn = btn
        self._sel_file = fpath
        # 延迟一点确保窗口已渲染完毕
        self.after(20, lambda: self._show_preview(fpath))
        self._update_detail_panel(fpath)

    def _show_preview(self, fpath):
        self._prev_full = False
        self._prev_fpath = fpath
        self.update_idletasks()
        try:
            img = Image.open(fpath)
            img_w, img_h = img.size
            max_w, max_h = 580, 500
            ratio = min(max_w/img_w, max_h/img_h, 1)
            disp_w, disp_h = int(img_w*ratio), int(img_h*ratio)
            disp_img = img.resize((disp_w, disp_h), Image.LANCZOS)
            self._tk_images["preview"] = ImageTk.PhotoImage(disp_img)
            self._current_preview_img = self._tk_images["preview"]
            self._prev_label.configure(image=self._current_preview_img, text="")
            self.update_idletasks()
        except Exception as e:
            import traceback, pathlib
            log = pathlib.Path(r"C:\Users\32155\qclaw\preview_err.txt")
            log.write_text(f"fpath={fpath}\n{traceback.format_exc()}", encoding="utf-8")
            self._prev_label.configure(image="", text=f"预览失败: {e}")

    def _toggle_preview_full(self):
        if not self._sel_file: return
        # 全尺寸显示：打开独立窗口，图片按原始比例填满
        self._show_image_window(self._sel_file)

    def _update_detail_panel(self, fpath):
        desktop_1png = os.path.join(IMG_LIBRARY_DIR, "1.png")
        if os.path.normpath(fpath) == os.path.normpath(desktop_1png):
            self._detail_label.configure(text="")
            return
        sap_code = os.path.splitext(os.path.basename(fpath))[0]
        shops = []
        for pos, cfg in self.sap_config.items():
            if cfg.get("sap") == sap_code:
                l = pos.rfind("（")
                r = pos.rfind("）")
                if l != -1 and r != -1 and r > l:
                    name = pos[l+1:r]
                    if name and name not in shops:
                        shops.append(name)
        self._detail_label.configure(text="、".join(shops))

    def _on_copy_path(self):
        if self._sel_file:
            self.clipboard_clear()
            self.clipboard_append(self._sel_file)
            messagebox.showinfo("复制路径", f"路径已复制：\n{self._sel_file}")

    def _on_upload(self):
        paths = filedialog.askopenfilenames(
            title="选择图片",
            filetypes=[
                ("图片文件", "*.png *.jpg *.jpeg *.bmp *.gif"),
                ("PNG", "*.png"),
                ("JPEG", "*.jpg *.jpeg"),
                ("BMP", "*.bmp"),
                ("GIF", "*.gif"),
                ("所有文件", "*")
            ]
        )
        if not paths:
            return
        os.makedirs(IMG_LIBRARY_DIR, exist_ok=True)
        copied = []
        for src in paths:
            fname = os.path.basename(src)
            dst = os.path.join(IMG_LIBRARY_DIR, fname)
            try:
                shutil.copy2(src, dst)
                copied.append(fname)
            except Exception as e:
                messagebox.showerror("复制失败", f"文件复制失败：{fname}\n{e}")
                return
        self._refresh_img_lib_list()
        messagebox.showinfo("上传成功", f"已上传 {len(copied)} 张图片到图片库")

    def _on_delete_lib(self):
        if not self._sel_file: return
        if messagebox.askyesno("确认删除", f"删除图片？\n{os.path.basename(self._sel_file)}"):
            try:
                os.remove(self._sel_file)
                self._refresh_img_lib_list()
            except Exception as e:
                messagebox.showerror("删除失败", str(e))

    # ==================== Tab4 ====================
    def _load_feishu_accounts(self):
        """加载飞书账号列表（本地缓存，启动后 Tab4 会从 Supabase 刷新）"""
        default_accounts = [
            {
                "alias": "默认账号（请在Tab4中配置真实凭证）",
                "app_id": FEISHU_APP_ID,
                "app_secret": FEISHU_APP_SECRET,
                "app_token": FEISHU_APP_TOKEN,
                "active": True
            }
        ]
        try:
            with open(FEISHU_ACCOUNTS_FILE, "r", encoding="utf-8") as f:
                accounts = json.load(f)
                for acc in accounts:
                    if "alias" not in acc:
                        acc["alias"] = acc.get("app_id", "未命名")[:12]
                self._feishu_accounts = accounts
        except:
            self._feishu_accounts = default_accounts
            self._save_feishu_accounts()
        active = [a for a in self._feishu_accounts if a.get("active")]
        if not active and self._feishu_accounts:
            self._feishu_accounts[0]["active"] = True
            self._save_feishu_accounts()

    def _load_feishu_accounts_from_sb(self):
        """从 Supabase 加载飞书账号列表，按角色过滤（本地模式时从文件加载）"""
        if USE_LOCAL_AUTH:
            self._load_feishu_accounts()
            return
        try:
            sb = create_client(SUPABASE_URL, SUPABASE_KEY)
            is_admin = self._login_info.get("role") == "admin"
            user_id = self._login_info.get("user_id")

            if is_admin:
                # 管理员：加载全部账号
                resp = sb.table("feishu_accounts").select("*").execute()
                self._feishu_accounts = []
                for row in resp.data:
                    acc = {
                        "sb_id": row["id"],
                        "alias": row["alias"],
                        "app_id": row["app_id"],
                        "app_secret": row["app_secret"],
                        "app_token": row["app_token"],
                        "active": False,
                    }
                    # 检查是否绑定了当前管理员
                    if user_id:
                        bind_resp = sb.table("user_feishu_binding").select("feishu_account_id").eq("user_id", user_id).execute()
                        if bind_resp.data and bind_resp.data[0]["feishu_account_id"] == row["id"]:
                            acc["active"] = True
                    self._feishu_accounts.append(acc)
                # 如果没有任何活跃，激活第一个
                if not any(a.get("active") for a in self._feishu_accounts) and self._feishu_accounts:
                    self._feishu_accounts[0]["active"] = True
            else:
                # 普通用户：只加载自己绑定的账号
                if not user_id:
                    self._feishu_accounts = []
                    return
                bind_resp = sb.table("user_feishu_binding").select("feishu_account_id").eq("user_id", user_id).execute()
                if not bind_resp.data:
                    self._feishu_accounts = []
                    return
                feishu_id = bind_resp.data[0]["feishu_account_id"]
                acc_resp = sb.table("feishu_accounts").select("*").eq("id", feishu_id).execute()
                if acc_resp.data:
                    row = acc_resp.data[0]
                    self._feishu_accounts = [{
                        "sb_id": row["id"],
                        "alias": row["alias"],
                        "app_id": row["app_id"],
                        "app_secret": row["app_secret"],
                        "app_token": row["app_token"],
                        "active": True,
                    }]
        except Exception as e:
            import traceback
            print(f"[_load_feishu_accounts_from_sb] 错误: {e}\n{traceback.format_exc()}")

    def _save_feishu_accounts(self):
        # 本地持久化备份
        try:
            with open(FEISHU_ACCOUNTS_FILE, "w", encoding="utf-8") as f:
                json.dump(self._feishu_accounts, f, ensure_ascii=False, indent=2)
        except Exception as e:
            messagebox.showerror("本地保存失败", str(e))

    def _sb_save_account(self, acc, is_new=False):
        """保存单个账号到 Supabase 或本地文件（admin 专用）"""
        if USE_LOCAL_AUTH:
            try:
                with open(FEISHU_ACCOUNTS_FILE, "r", encoding="utf-8") as f:
                    all_accounts = json.load(f)
            except:
                all_accounts = []
            if is_new:
                acc["sb_id"] = str(len(all_accounts) + 1)
                all_accounts.append(acc)
            else:
                # 重新读取文件（_on_save_account 已更新 self._feishu_accounts）
                try:
                    with open(FEISHU_ACCOUNTS_FILE, "r", encoding="utf-8") as f:
                        all_accounts = json.load(f)
                except:
                    all_accounts = []
                sb_id = acc.get("sb_id")
                for i, a in enumerate(all_accounts):
                    if a.get("sb_id") == sb_id:
                        all_accounts[i] = acc
                        break
            with open(FEISHU_ACCOUNTS_FILE, "w", encoding="utf-8") as f:
                json.dump(all_accounts, f, ensure_ascii=False, indent=2)
            return
        try:
            sb = create_client(SUPABASE_URL, SUPABASE_KEY)
            is_admin = self._login_info.get("role") == "admin"
            if not is_admin:
                return  # 普通用户不允许直接保存账号
            data = {
                "alias": acc["alias"],
                "app_id": acc["app_id"],
                "app_secret": acc["app_secret"],
                "app_token": acc["app_token"],
            }
            if is_new:
                data["created_by"] = self._login_info.get("user_id")
                sb.table("feishu_accounts").insert(data).execute()
            else:
                sb_id = acc.get("sb_id")
                if sb_id:
                    sb.table("feishu_accounts").update(data).eq("id", sb_id).execute()
        except Exception as e:
            import traceback
            print(f"[_sb_save_account] 错误: {e}\n{traceback.format_exc()}")
            messagebox.showerror("Supabase 保存失败", str(e))

    def _sb_delete_account(self, sb_id):
        """从 Supabase 或本地文件删除账号（admin 专用）"""
        if USE_LOCAL_AUTH:
            try:
                with open(FEISHU_ACCOUNTS_FILE, "r", encoding="utf-8") as f:
                    all_accounts = json.load(f)
                all_accounts = [a for a in all_accounts if a.get("sb_id") != sb_id]
                with open(FEISHU_ACCOUNTS_FILE, "w", encoding="utf-8") as f:
                    json.dump(all_accounts, f, ensure_ascii=False, indent=2)
            except Exception as e:
                messagebox.showerror("本地删除失败", str(e))
            return
        try:
            sb = create_client(SUPABASE_URL, SUPABASE_KEY)
            sb.table("feishu_accounts").delete().eq("id", sb_id).execute()
        except Exception as e:
            messagebox.showerror("Supabase 删除失败", str(e))

    def _sb_bind_account(self, feishu_account_id):
        """将飞书账号绑定到当前用户"""
        if USE_LOCAL_AUTH:
            try:
                bindings = _load_local_bindings()
                user_id = self._login_info.get("user_id")
                bindings = [b for b in bindings if b.get("user_id") != user_id]
                bindings.append({"user_id": user_id, "feishu_account_id": feishu_account_id})
                _save_local_bindings(bindings)
            except Exception as e:
                messagebox.showerror("绑定失败", str(e))
            return
        try:
            sb = create_client(SUPABASE_URL, SUPABASE_KEY)
            user_id = self._login_info.get("user_id")
            if not user_id:
                return
            # 删除旧绑定
            sb.table("user_feishu_binding").delete().eq("user_id", user_id).execute()
            # 创建新绑定
            sb.table("user_feishu_binding").insert({
                "user_id": user_id,
                "feishu_account_id": feishu_account_id,
            }).execute()
        except Exception as e:
            messagebox.showerror("绑定失败", str(e))

    def _sb_unbind_account(self):
        """解除当前用户的飞书账号绑定"""
        if USE_LOCAL_AUTH:
            try:
                user_id = self._login_info.get("user_id")
                bindings = _load_local_bindings()
                bindings = [b for b in bindings if b.get("user_id") != user_id]
                _save_local_bindings(bindings)
            except Exception as e:
                messagebox.showerror("解绑失败", str(e))
            return
        try:
            sb = create_client(SUPABASE_URL, SUPABASE_KEY)
            user_id = self._login_info.get("user_id")
            if user_id:
                sb.table("user_feishu_binding").delete().eq("user_id", user_id).execute()
        except Exception as e:
            messagebox.showerror("解绑失败", str(e))

    def _sb_reset_user_password(self, target_user_id, new_password_hash):
        """管理员重置用户密码（本地模式或 Supabase）"""
        if USE_LOCAL_AUTH:
            try:
                users = _load_local_users()
                for u in users:
                    if u["id"] == target_user_id:
                        u["password_hash"] = new_password_hash
                        break
                _save_local_users(users)
            except Exception as e:
                messagebox.showerror("密码重置失败", str(e))
            return
        try:
            sb = create_client(SUPABASE_URL, SUPABASE_KEY)
            sb.table("program_users").update({"password_hash": new_password_hash}).eq("id", target_user_id).execute()
        except Exception as e:
            messagebox.showerror("密码重置失败", str(e))

    def _get_active_account(self):
        for acc in self._feishu_accounts:
            if acc.get("active"):
                return acc
        return self._feishu_accounts[0] if self._feishu_accounts else None

    def _build_tab4(self):
        fr = self._tab4
        is_admin = self._login_info.get("role") == "admin"
        username = self._login_info.get("username", "")
        role_label = "管理员" if is_admin else "普通用户"

        # 顶部用户信息栏
        hdr_bar = tk.Frame(fr, bg=STYLE_BG, height=36)
        hdr_bar.pack(fill="x", padx=8, pady=(6, 0))
        hdr_bar.pack_propagate(False)
        tk.Label(hdr_bar, text=f"当前账号：{username}（{role_label}）",
                 bg=STYLE_BG, font=("微软雅黑", 9),
                 fg="#444").pack(side="left", pady=6)
        tk.Button(hdr_bar, text="退出登录", bg=BTN_CANCEL, relief="flat",
                  font=("微软雅黑", 9), command=self._on_logout,
                  cursor="hand2").pack(side="right", pady=4)
        if is_admin:
            tk.Button(hdr_bar, text="用户管理", bg=STYLE_BTN, relief="flat",
                      font=("微软雅黑", 9), command=self._on_open_user_admin,
                      cursor="hand2").pack(side="right", padx=(0, 4), pady=4)

        # 写入目标配置条：飞书多维表格 / 任意 Webhook / 本地 CSV
        integ = self._load_integration()
        self._target_var = tk.StringVar(value=integ["target"])
        self._target_mode_var = tk.StringVar(value=integ["webhook"].get("mode", "generic"))
        self._target_proxy_var = tk.StringVar(value=integ["webhook"].get("proxy", ""))
        self._target_csv_var = tk.StringVar(value=integ["csv"].get("path", ""))

        target_bar = tk.Frame(fr, bg=STYLE_BG2, relief="solid", bd=1)
        target_bar.pack(fill="x", padx=8, pady=(6, 0))
        tk.Label(target_bar, text="写入目标：", bg=STYLE_BG2, font=("微软雅黑", 9, "bold")).pack(side="left", padx=(6, 4))
        for text, val in (("飞书多维表格", "feishu"), ("Webhook 接口", "webhook"), ("本地 CSV", "csv")):
            tk.Radiobutton(target_bar, text=text, value=val, variable=self._target_var,
                           bg=STYLE_BG2, font=("微软雅黑", 9), activebackground=STYLE_BG2,
                           command=self._on_target_changed).pack(side="left", padx=2)

        tk.Label(target_bar, text="报文", bg=STYLE_BG2, font=("微软雅黑", 9)).pack(side="left", padx=(10, 2))
        self._target_mode_box = ttk.Combobox(target_bar, textvariable=self._target_mode_var, width=16, state="readonly",
                                             values=("generic", "feishu", "dingtalk", "wecom"))
        self._target_mode_box.pack(side="left")

        tk.Label(target_bar, text="接口地址", bg=STYLE_BG2, font=("微软雅黑", 9)).pack(side="left", padx=(10, 2))
        self._target_url_entry = tk.Entry(target_bar, width=42, font=("微软雅黑", 9))
        self._target_url_entry.insert(0, integ["webhook"].get("url", ""))
        self._target_url_entry.pack(side="left")

        tk.Label(target_bar, text="代理前缀", bg=STYLE_BG2, font=("微软雅黑", 9)).pack(side="left", padx=(10, 2))
        self._target_proxy_entry = tk.Entry(target_bar, width=20, font=("微软雅黑", 9))
        self._target_proxy_entry.insert(0, integ["webhook"].get("proxy", ""))
        self._target_proxy_entry.pack(side="left")

        tk.Button(target_bar, text="保存配置", bg=STYLE_BTN, relief="flat", font=("微软雅黑", 9),
                  command=self._on_save_target, cursor="hand2").pack(side="left", padx=8, pady=4)
        tk.Button(target_bar, text="测试连接", bg=STYLE_BTN, relief="flat", font=("微软雅黑", 9),
                  command=self._on_test_target, cursor="hand2").pack(side="left", pady=4)
        self._target_hint = tk.Label(target_bar, text="", bg=STYLE_BG2, font=("微软雅黑", 8), fg="#555")
        self._target_hint.pack(side="left", padx=6)
        self._on_target_changed()

        paned = ttk.PanedWindow(fr, orient="horizontal")
        paned.pack(fill="both", expand=True, padx=8, pady=8)
        self._tab4_paned = paned

        # 左侧：账号列表
        left_frm = tk.Frame(paned, bg=STYLE_BG2, relief="solid", bd=1)
        paned.add(left_frm)
        hdr = tk.Frame(left_frm, bg=STYLE_BG2)
        hdr.pack(fill="x", padx=4, pady=(4, 2))
        tk.Label(hdr, text="账号列表", bg=STYLE_BG2, font=("微软雅黑", 9, "bold")).pack(side="left")
        list_frm = tk.Frame(left_frm, bg="white")
        list_frm.pack(fill="both", expand=True, padx=4, pady=(0, 4))
        self._acct_list_canvas = tk.Canvas(list_frm, bg="white", highlightthickness=0)
        acct_vsb = ttk.Scrollbar(list_frm, command=self._acct_list_canvas.yview)
        self._acct_list_canvas.configure(yscrollcommand=acct_vsb.set)
        self._acct_list_canvas.pack(side="left", fill="both", expand=True)
        acct_vsb.pack(side="right", fill="y")
        self._acct_list_inner = tk.Frame(self._acct_list_canvas, bg="white")
        self._acct_list_canvas.create_window((0, 0), window=self._acct_list_inner, anchor="nw")
        self._acct_list_inner.bind("<Configure>",
            lambda e: self._acct_list_canvas.configure(scrollregion=self._acct_list_canvas.bbox("all")))
        self._acct_list_canvas.bind("<Enter>",
            lambda e: self._acct_list_canvas.unbind_all("<MouseWheel>"))
        self._acct_list_canvas.bind("<Leave>",
            lambda e: self._acct_list_canvas.bind_all("<MouseWheel>",
                lambda ev: self._acct_list_canvas.yview_scroll(int(-1 * (ev.delta / 120)), "units")))
        self._acct_btns = []
        self._acct_selected_btn = None

        # 底部按钮行：新增账号 + 保存页面布局
        btn_add_row = tk.Frame(left_frm, bg=STYLE_BG2)
        btn_add_row.pack(fill="x", padx=4, pady=(0, 4))
        self._btn_new_account = tk.Button(btn_add_row, text="+ 新增账号",
            bg=STYLE_BTN, relief="flat", font=("微软雅黑", 9),
            command=self._on_add_account)
        self._btn_new_account.pack(side="left", fill="x", expand=True, padx=2, pady=2)
        self._btn_save_layout_tab4 = tk.Button(btn_add_row, text="保存页面布局",
            bg=STYLE_BTN, relief="flat", font=("微软雅黑", 9),
            command=self._on_save_layout)
        self._btn_save_layout_tab4.pack(side="left", fill="x", expand=True, padx=2, pady=2)

        # 右侧：账号详情表单
        right_frm = tk.Frame(paned, bg="white", relief="solid", bd=1)
        paned.add(right_frm)
        self._acct_right_frm = right_frm

        form_frm = tk.Frame(right_frm, bg="white")
        form_frm.pack(fill="x", padx=12, pady=(12, 0))

        # 账号名称（标签行 + 输入框行，分离）
        tk.Label(form_frm, text="账号名称：", font=("微软雅黑", 10), bg=LABEL_BG,
                 anchor="e", width=12, padx=5).pack(anchor="w", pady=(0, 2))
        row_name = tk.Frame(form_frm, bg=STYLE_ENTRY, relief="solid", bd=1)
        row_name.pack(fill="x", pady=(0, 8))
        self._acct_alias = tk.Entry(row_name, font=("微软雅黑", 10),
                                    bg=STYLE_ENTRY, relief="flat", bd=0)
        self._acct_alias.pack(side="left", fill="x", expand=True, padx=(4, 2), pady=3)
        tk.Button(row_name, text="复制", bg=STYLE_ENTRY, relief="flat",
                 font=("微软雅黑", 8), command=lambda: self._on_copy_entry(self._acct_alias)).pack(side="right", padx=4, pady=3)

        # App ID（标签行 + 输入框行，分离）
        tk.Label(form_frm, text="App ID：", font=("微软雅黑", 10), bg=LABEL_BG,
                 anchor="e", width=12, padx=5).pack(anchor="w", pady=(0, 2))
        row_appid = tk.Frame(form_frm, bg=STYLE_ENTRY, relief="solid", bd=1)
        row_appid.pack(fill="x", pady=(0, 6))
        self._acct_appid = tk.Entry(row_appid, font=("微软雅黑", 10),
                                    bg=STYLE_ENTRY, relief="flat", bd=0)
        self._acct_appid.pack(side="left", fill="x", expand=True, padx=(4, 2), pady=3)
        tk.Button(row_appid, text="复制", bg=STYLE_ENTRY, relief="flat",
                 font=("微软雅黑", 8), command=lambda: self._on_copy_entry(self._acct_appid)).pack(side="right", padx=(4, 2), pady=3)
        self._btn_toggle_appid = tk.Button(row_appid, text="隐藏", bg=STYLE_ENTRY, relief="flat",
                 font=("微软雅黑", 8), command=self._on_toggle_appid_echo)
        self._btn_toggle_appid.pack(side="right", padx=(2, 4), pady=3)

        # App Secret（标签行 + 输入框行，分离）
        tk.Label(form_frm, text="App Secret：", font=("微软雅黑", 10), bg=LABEL_BG,
                 anchor="e", width=12, padx=5).pack(anchor="w", pady=(0, 2))
        row_secret = tk.Frame(form_frm, bg=STYLE_ENTRY, relief="solid", bd=1)
        row_secret.pack(fill="x", pady=(0, 6))
        self._acct_secret = tk.Entry(row_secret, font=("微软雅黑", 10),
                                     bg=STYLE_ENTRY, relief="flat", bd=0, show="*")
        self._acct_secret.pack(side="left", fill="x", expand=True, padx=(4, 2), pady=3)
        tk.Button(row_secret, text="复制", bg=STYLE_ENTRY, relief="flat",
                 font=("微软雅黑", 8), command=lambda: self._on_copy_entry(self._acct_secret)).pack(side="right", padx=(4, 2), pady=3)
        self._btn_toggle_secret = tk.Button(row_secret, text="显示", bg=STYLE_ENTRY, relief="flat",
                 font=("微软雅黑", 8), command=self._on_toggle_secret_echo)
        self._btn_toggle_secret.pack(side="right", padx=(2, 4), pady=3)

        # App Token（标签行 + 输入框行，分离）
        tk.Label(form_frm, text="App Token：", font=("微软雅黑", 10), bg=LABEL_BG,
                 anchor="e", width=12, padx=5).pack(anchor="w", pady=(0, 2))
        row_token = tk.Frame(form_frm, bg=STYLE_ENTRY, relief="solid", bd=1)
        row_token.pack(fill="x", pady=(0, 6))
        self._acct_token = tk.Entry(row_token, font=("微软雅黑", 10),
                                    bg=STYLE_ENTRY, relief="flat", bd=0)
        self._acct_token.pack(side="left", fill="x", expand=True, padx=(4, 2), pady=3)
        tk.Button(row_token, text="复制", bg=STYLE_ENTRY, relief="flat",
                 font=("微软雅黑", 8), command=lambda: self._on_copy_entry(self._acct_token)).pack(side="right", padx=(4, 2), pady=3)
        self._btn_toggle_token = tk.Button(row_token, text="隐藏", bg=STYLE_ENTRY, relief="flat",
                 font=("微软雅黑", 8), command=self._on_toggle_token_echo)
        self._btn_toggle_token.pack(side="right", padx=(2, 4), pady=3)

        # 活跃状态提示
        self._acct_active_lbl = tk.Label(form_frm, text="",
                                         font=("微软雅黑", 9), bg="white", fg="#228B22")
        self._acct_active_lbl.pack(anchor="w", pady=(0, 8))

        # 按钮行（白色背景）
        btn_row = tk.Frame(right_frm, bg="white")
        btn_row.pack(fill="x", padx=12, pady=8)
        self._btn_save_account = tk.Button(btn_row, text="保存",
            bg=STYLE_BTN, relief="flat", width=10,
            command=self._on_save_account)
        self._btn_save_account.pack(side="left", padx=2)
        self._btn_del_account = tk.Button(btn_row, text="删除",
            bg=BTN_CANCEL, relief="flat", width=10,
            command=self._on_delete_account)
        self._btn_del_account.pack(side="left", padx=2)
        self._btn_set_active = tk.Button(btn_row, text="设为活跃",
            bg=STYLE_BTN, relief="flat", width=10,
            command=self._on_set_active_account)
        self._btn_set_active.pack(side="left", padx=2)
        self._btn_test_conn = tk.Button(btn_row, text="测试连接",
            bg=STYLE_BTN, relief="flat", width=10,
            command=self._on_test_connection)
        self._btn_test_conn.pack(side="left", padx=2)

        # 提示说明（按角色区分）
        if is_admin:
            hint_text = "提示：管理员可管理所有账号，普通用户只能查看和切换自己的绑定账号"
        else:
            hint_text = "提示：您的账号已绑定到「" + (self._feishu_accounts[0].get("alias", "") if self._feishu_accounts else "") + "」，如需更换请联系管理员"
        hint = tk.Label(right_frm,
            text=hint_text,
            font=("微软雅黑", 8), bg="white", fg="#888", anchor="w", justify="left",
            wraplength=400)
        hint.pack(fill="x", padx=12, pady=(0, 8))

        # 初始加载（从 Supabase 刷新）
        self._load_feishu_accounts_from_sb()
        self._refresh_feishu_account_list()

        # 普通用户：隐藏管理类按钮
        if not is_admin:
            self._btn_new_account.configure(state="disabled", text="（无权限新增）")
            self._btn_del_account.configure(state="disabled")
            self._acct_alias.configure(state="readonly")
            self._acct_appid.configure(state="readonly")
            self._acct_secret.configure(state="readonly")
            self._acct_token.configure(state="readonly")

    def _refresh_feishu_account_list(self):
        for w in self._acct_list_inner.winfo_children():
            w.destroy()
        self._acct_btns = []
        active_account = self._get_active_account()
        for acc in self._feishu_accounts:
            alias = acc.get("alias", "未命名")
            app_id = acc.get("app_id", "")
            masked = app_id[:10] + "***" if len(app_id) > 10 else app_id
            is_active = acc.get("active", False)
            prefix = "✓ " if is_active else "  "
            bg = STYLE_BTN if is_active else STYLE_ENTRY
            btn = tk.Button(self._acct_list_inner,
                           text=f"{prefix}{alias}",
                           bg=bg, relief="solid" if is_active else "flat",
                           anchor="w", font=("微软雅黑", 9), justify="left",
                           command=lambda a=acc: self._on_account_list_click(a))
            btn.pack(fill="x", padx=2, pady=1, ipady=4)
            self._acct_btns.append((btn, acc))

    def _on_account_list_click(self, acc):
        # 高亮选中
        for btn, a in self._acct_btns:
            is_active = a.get("active", False)
            btn.configure(bg=STYLE_BTN if is_active else STYLE_ENTRY,
                          relief="solid" if is_active else "flat")
        self._acct_selected_btn = acc
        # 回填表单
        self._acct_alias.configure(state="normal")
        self._acct_alias.delete(0, "end")
        self._acct_alias.insert(0, acc.get("alias", ""))
        self._acct_appid.delete(0, "end")
        self._acct_appid.insert(0, acc.get("app_id", ""))
        self._acct_secret.delete(0, "end")
        self._acct_secret.insert(0, acc.get("app_secret", ""))
        self._acct_token.delete(0, "end")
        self._acct_token.insert(0, acc.get("app_token", ""))
        # 重置显示/隐藏按钮状态
        self._acct_secret.configure(show="*")
        self._btn_toggle_secret.configure(text="显示")
        self._acct_token.configure(show="")
        self._btn_toggle_token.configure(text="隐藏")
        if acc.get("active", False):
            self._acct_active_lbl.configure(text="★ 当前活跃账号")
        else:
            self._acct_active_lbl.configure(text="")

    def _on_add_account(self):
        self._acct_selected_btn = None
        self._acct_alias.configure(state="normal")
        self._acct_alias.delete(0, "end")
        self._acct_appid.delete(0, "end")
        self._acct_secret.delete(0, "end")
        self._acct_token.delete(0, "end")
        self._acct_secret.configure(show="*")
        self._btn_toggle_secret.configure(text="显示")
        self._acct_token.configure(show="")
        self._btn_toggle_token.configure(text="隐藏")
        self._acct_active_lbl.configure(text="")

    def _on_save_account(self):
        is_admin = self._login_info.get("role") == "admin"
        alias = self._acct_alias.get().strip()
        app_id = self._acct_appid.get().strip()
        app_secret = self._acct_secret.get().strip()
        app_token = self._acct_token.get().strip()
        if not alias:
            messagebox.showwarning("提示", "账号名称不能为空")
            return
        if not app_id or not app_secret or not app_token:
            messagebox.showwarning("提示", "App ID、App Secret、App Token 均不能为空")
            return
        if self._acct_selected_btn is not None:
            # 更新现有账号
            for acc in self._feishu_accounts:
                if acc is self._acct_selected_btn:
                    acc["alias"] = alias
                    acc["app_id"] = app_id
                    acc["app_secret"] = app_secret
                    acc["app_token"] = app_token
                    break
            messagebox.showinfo("保存成功", f"账号「{alias}」已更新")
            # 管理员同步到 Supabase
            if is_admin and self._acct_selected_btn.get("sb_id"):
                self._sb_save_account(self._acct_selected_btn, is_new=False)
        else:
            # 新增账号（仅管理员）
            if not is_admin:
                messagebox.showwarning("提示", "普通用户无权新增账号")
                return
            new_acc = {
                "alias": alias,
                "app_id": app_id,
                "app_secret": app_secret,
                "app_token": app_token,
                "active": False,
            }
            self._feishu_accounts.append(new_acc)
            messagebox.showinfo("保存成功", f"账号「{alias}」已添加")
            # 管理员同步到 Supabase
            if is_admin:
                self._sb_save_account(new_acc, is_new=True)
        self._save_feishu_accounts()
        self._refresh_feishu_account_list()

    def _on_delete_account(self):
        is_admin = self._login_info.get("role") == "admin"
        if self._acct_selected_btn is None:
            messagebox.showwarning("提示", "请先在左侧列表选中要删除的账号")
            return
        alias = self._acct_selected_btn.get("alias", "")
        was_active = self._acct_selected_btn.get("active", False)
        sb_id = self._acct_selected_btn.get("sb_id")
        if not is_admin:
            # 普通用户：解绑
            if not messagebox.askyesno("确认解绑", "确定要解除当前账号绑定吗？"):
                return
            self._sb_unbind_account()
            self._feishu_accounts = []
            messagebox.showinfo("解绑成功", "账号已解除绑定，请联系管理员重新分配")
        else:
            # 管理员：删除账号
            if not messagebox.askyesno("确认删除", f"确定要删除账号「{alias}」吗？"):
                return
            self._feishu_accounts = [a for a in self._feishu_accounts if a is not self._acct_selected_btn]
            if was_active and self._feishu_accounts:
                self._feishu_accounts[0]["active"] = True
            if not self._feishu_accounts:
                self._feishu_accounts = [{
                    "alias": "默认账号",
                    "app_id": "", "app_secret": "", "app_token": "", "active": True
                }]
            if sb_id:
                self._sb_delete_account(sb_id)
            messagebox.showinfo("删除成功", "账号已删除")
        self._save_feishu_accounts()
        self._refresh_feishu_account_list()
        self._on_add_account()

    def _on_set_active_account(self):
        is_admin = self._login_info.get("role") == "admin"
        if self._acct_selected_btn is None:
            messagebox.showwarning("提示", "请先在左侧列表选中要设为活跃的账号")
            return
        sb_id = self._acct_selected_btn.get("sb_id")
        alias = self._acct_selected_btn.get("alias", "")
        if is_admin:
            # 管理员：更新本地 active 状态 + 同步绑定到 Supabase
            for acc in self._feishu_accounts:
                acc["active"] = (acc is self._acct_selected_btn)
            if sb_id:
                self._sb_bind_account(sb_id)
            messagebox.showinfo("设置成功", f"账号「{alias}」已设为当前活跃账号")
        else:
            # 普通用户：绑定账号
            if sb_id:
                self._sb_bind_account(sb_id)
                messagebox.showinfo("绑定成功", f"已绑定到账号「{alias}」")
            else:
                messagebox.showwarning("提示", "该账号尚未同步到服务器，请联系管理员")
                return
        self._save_feishu_accounts()
        self._refresh_feishu_account_list()
        self._acct_active_lbl.configure(text="★ 当前活跃账号")

    def _on_test_connection(self):
        app_id = self._acct_appid.get().strip()
        app_secret = self._acct_secret.get().strip()
        if not app_id or not app_secret:
            messagebox.showwarning("提示", "App ID 和 App Secret 不能为空")
            return
        self._btn_test_conn.configure(state="disabled", text="测试中...")
        self.update()
        try:
            url = f"{FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal"
            payload = json.dumps({"app_id": app_id, "app_secret": app_secret}).encode("utf-8")
            req = urllib.request.Request(url, data=payload, method="POST")
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read())
                if result.get("code") == 0:
                    messagebox.showinfo("连接成功", f"Token 获取成功！\n有效期约2小时")
                else:
                    messagebox.showerror("连接失败", f"错误码：{result.get('code')}\n{result.get('msg')}")
        except Exception as e:
            messagebox.showerror("连接失败", str(e))
        finally:
            self._btn_test_conn.configure(state="normal", text="测试连接")

    def _on_toggle_appid_echo(self):
        """App ID 切换显示/隐藏，按钮文字跟随状态"""
        current = self._acct_appid.cget("show")
        is_hidden = (current == "*")
        self._acct_appid.configure(show="" if is_hidden else "*")
        self._btn_toggle_appid.configure(text="隐藏" if is_hidden else "显示")

    def _on_toggle_secret_echo(self):
        """App Secret 显示/隐藏切换"""
        current = self._acct_secret.cget("show")
        is_hidden = (current == "*")
        self._acct_secret.configure(show="" if is_hidden else "*")
        self._btn_toggle_secret.configure(text="隐藏" if is_hidden else "显示")

    def _on_toggle_token_echo(self):
        """App Token 显示/隐藏切换"""
        current = self._acct_token.cget("show")
        is_hidden = (current == "*")
        self._acct_token.configure(show="" if is_hidden else "*")
        self._btn_toggle_token.configure(text="隐藏" if is_hidden else "显示")

    def _on_copy_entry(self, entry):
        """复制 Entry 内容到剪贴板"""
        val = entry.get().strip()
        if val:
            self.clipboard_clear()
            self.clipboard_append(val)
            messagebox.showinfo("已复制", "内容已复制到剪贴板")
        else:
            messagebox.showwarning("提示", "当前内容为空")

    def _on_logout(self):
        """退出登录并重新启动程序"""
        if not messagebox.askyesno("确认退出", "确定要退出登录吗？"):
            return
        try:
            import subprocess, sys
            python = sys.executable
            script = os.path.abspath(__file__)
            subprocess.Popen([python, script])
            self.destroy()
        except Exception as e:
            messagebox.showerror("错误", f"重启失败: {e}")

    def _on_open_user_admin(self):
        """管理员：打开用户管理窗口"""
        is_admin = self._login_info.get("role") == "admin"
        if not is_admin:
            messagebox.showwarning("提示", "仅管理员可访问用户管理")
            return
        win = tk.Toplevel(self)
        win.title("用户管理 - 管理员")
        win.configure(bg=STYLE_BG)
        win.geometry("700x450")
        win.transient(self)
        win.grab_set()

        # 顶部
        tk.Label(win, text="用户列表", bg=STYLE_BG,
                 font=("微软雅黑", 11, "bold"), fg="#2E7D32").pack(pady=(12, 6))
        # 列表区域
        list_frm = tk.Frame(win, bg="white", relief="solid", bd=1)
        list_frm.pack(fill="both", expand=True, padx=16, pady=(0, 8))

        # 表头
        cols = [("用户名", 140), ("角色", 80), ("操作", 200)]
        hdr_row = tk.Frame(list_frm, bg="#DDD")
        hdr_row.pack(fill="x")
        for txt, w in cols:
            tk.Label(hdr_row, text=txt, bg="#DDD", font=("微软雅黑", 9, "bold"),
                     width=w//7, anchor="w", padx=8).pack(side="left")
        canvas = tk.Canvas(list_frm, bg="white", highlightthickness=0, height=300)
        scrollbar = ttk.Scrollbar(list_frm, command=canvas.yview)
        canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        canvas.pack(fill="both", expand=True)
        inner = tk.Frame(canvas, bg="white")
        canvas.create_window((0, 0), window=inner, anchor="nw")
        inner.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))

        def _load_users():
            for w in inner.winfo_children():
                w.destroy()
            try:
                if USE_LOCAL_AUTH:
                    users = _load_local_users()
                else:
                    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
                    resp = sb.table("program_users").select("id,username,role").execute()
                    users = resp.data
                for row in users:
                    row_frm = tk.Frame(inner, bg="white", relief="solid", bd=0)
                    row_frm.pack(fill="x", padx=0, pady=0)
                    role_txt = "管理员" if row["role"] == "admin" else "普通用户"
                    tk.Label(row_frm, text=row["username"], bg="white", font=("微软雅黑", 9),
                             width=18, anchor="w", padx=8).pack(side="left")
                    tk.Label(row_frm, text=role_txt, bg="white", font=("微软雅黑", 9),
                             width=10, anchor="w", padx=4).pack(side="left")
                    btn_frm = tk.Frame(row_frm, bg="white")
                    btn_frm.pack(side="left")
                    tk.Button(btn_frm, text="重置密码", bg=STYLE_BTN, relief="flat",
                              font=("微软雅黑", 8),
                              command=lambda rid, rname=row["username"]:
                                  _on_reset_pwd(rid, rname)).pack(side="left", padx=2)
                    tk.Button(btn_frm, text="删除", bg=BTN_CANCEL, relief="flat",
                              font=("微软雅黑", 8),
                              command=lambda rid, rname=row["username"]:
                                  _on_del_user(rid, rname)).pack(side="left", padx=2)
            except Exception as e:
                tk.Label(inner, text=f"加载失败: {e}", bg="white",
                         font=("微软雅黑", 9), fg="red").pack()

        def _on_reset_pwd(uid, uname):
            if not messagebox.askyesno("确认重置", f"确定要将「{uname}」的密码重置为「Aa@123456」吗？"):
                return
            try:
                pwd_hash = bcrypt.hashpw("Aa@123456".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
                if USE_LOCAL_AUTH:
                    users = _load_local_users()
                    for u in users:
                        if u["id"] == uid:
                            u["password_hash"] = pwd_hash
                            break
                    _save_local_users(users)
                else:
                    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
                    sb.table("program_users").update({"password_hash": pwd_hash}).eq("id", uid).execute()
                messagebox.showinfo("成功", f"「{uname}」的密码已重置为「Aa@123456」")
                _load_users()
            except Exception as e:
                messagebox.showerror("错误", f"重置失败: {e}")

        def _on_del_user(uid, uname):
            if uname == self._login_info.get("username"):
                messagebox.showwarning("提示", "不能删除自己")
                return
            if not messagebox.askyesno("确认删除", f"确定要删除用户「{uname}」吗？"):
                return
            try:
                if USE_LOCAL_AUTH:
                    users = _load_local_users()
                    users = [u for u in users if u["id"] != uid]
                    _save_local_users(users)
                else:
                    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
                    sb.table("program_users").delete().eq("id", uid).execute()
                messagebox.showinfo("成功", f"用户「{uname}」已删除")
                _load_users()
            except Exception as e:
                messagebox.showerror("错误", f"删除失败: {e}")

        def _on_add_user():
            top = tk.Toplevel(win)
            top.title("新建用户")
            top.configure(bg=STYLE_BG)
            top.geometry("320x220")
            top.transient(win)
            top.grab_set()
            tk.Label(top, text="用户名：", bg=STYLE_BG, font=("微软雅黑", 10),
                     anchor="e", width=10).place(x=10, y=20)
            e_user = tk.Entry(top, font=("微软雅黑", 10), bg=STYLE_ENTRY, width=20)
            e_user.place(x=110, y=20)
            tk.Label(top, text="初始密码：", bg=STYLE_BG, font=("微软雅黑", 10),
                     anchor="e", width=10).place(x=10, y=58)
            tk.Label(top, text="Aa@123456（固定）", bg=STYLE_BG,
                     font=("微软雅黑", 9), fg="#666").place(x=110, y=60)
            tk.Label(top, text="角色：", bg=STYLE_BG, font=("微软雅黑", 10),
                     anchor="e", width=10).place(x=10, y=96)
            role_var = tk.StringVar(value="user")
            tk.Radiobutton(top, text="普通用户", variable=role_var, value="user",
                           bg=STYLE_BG, font=("微软雅黑", 9)).place(x=110, y=96)
            tk.Radiobutton(top, text="管理员", variable=role_var, value="admin",
                           bg=STYLE_BG, font=("微软雅黑", 9)).place(x=210, y=96)
            def _do_add():
                username = e_user.get().strip()
                if not username:
                    messagebox.showwarning("提示", "用户名不能为空", parent=top)
                    return
                try:
                    pwd_hash = bcrypt.hashpw("Aa@123456".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
                    if USE_LOCAL_AUTH:
                        users = _load_local_users()
                        if any(u["username"] == username for u in users):
                            messagebox.showwarning("提示", "用户名已存在", parent=top)
                            return
                        import uuid
                        users.append({
                            "id": str(uuid.uuid4()),
                            "username": username,
                            "password_hash": pwd_hash,
                            "role": role_var.get(),
                        })
                        _save_local_users(users)
                    else:
                        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
                        check = sb.table("program_users").select("id").eq("username", username).execute()
                        if check.data:
                            messagebox.showwarning("提示", "用户名已存在", parent=top)
                            return
                        sb.table("program_users").insert({
                            "username": username,
                            "password_hash": pwd_hash,
                            "role": role_var.get(),
                        }).execute()
                    messagebox.showinfo("成功", f"用户「{username}」已创建，密码为「Aa@123456」", parent=top)
                    top.destroy()
                    _load_users()
                except Exception as e:
                    messagebox.showerror("错误", f"创建失败: {e}", parent=top)
            tk.Button(top, text="创建", bg=STYLE_BTN, relief="flat",
                      font=("微软雅黑", 10, "bold"), command=_do_add,
                      width=8).place(x=90, y=148)
            tk.Button(top, text="取消", bg=BTN_CANCEL, relief="flat",
                      font=("微软雅黑", 10), command=top.destroy,
                      width=8).place(x=185, y=148)

        # 底部按钮
        btn_row = tk.Frame(win, bg=STYLE_BG)
        btn_row.pack(fill="x", padx=16, pady=(0, 12))
        tk.Button(btn_row, text="+ 新建用户", bg=STYLE_BTN, relief="flat",
                  font=("微软雅黑", 10, "bold"), command=_on_add_user).pack(side="left")
        tk.Button(btn_row, text="刷新", bg=STYLE_BTN, relief="flat",
                  font=("微软雅黑", 10), command=_load_users).pack(side="left", padx=8)
        tk.Button(btn_row, text="关闭", bg=BTN_CANCEL, relief="flat",
                  font=("微软雅黑", 10), command=win.destroy).pack(side="right")

        _load_users()

    def _on_copy_img_file(self):
        """Tab3：复制当前选中的图片文件到剪贴板（可粘贴）"""
        if not self._sel_file or not os.path.exists(self._sel_file):
            messagebox.showwarning("提示", "请先在左侧选择一张图片")
            return
        try:
            img = Image.open(self._sel_file)
            # 统一转为 PNG 字节流
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            png_bytes = buf.getvalue()
            buf.close()

            import win32clipboard
            win32clipboard.OpenClipboard()
            try:
                win32clipboard.EmptyClipboard()
                # 用 RegisterClipboardFormat("PNG") 放入原始 PNG 数据
                # 微信/QQ/飞书等现代应用都支持直接粘贴 PNG
                png_format = win32clipboard.RegisterClipboardFormat("PNG")
                win32clipboard.SetClipboardData(png_format, png_bytes)
            finally:
                win32clipboard.CloseClipboard()

            messagebox.showinfo("复制图片", f"图片已复制（可直接粘贴）：\n{os.path.basename(self._sel_file)}")
        except Exception as e:
            messagebox.showerror("复制失败", f"图片复制失败：\n{e}\n\n已降级为复制文件路径。")
            self.clipboard_clear()
            self.clipboard_append(self._sel_file)


def _is_pid_running(pid):
    """检查给定 PID 进程是否仍在运行（Windows）"""
    kernel32 = ctypes.windll.kernel32
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if handle:
        kernel32.CloseHandle(handle)
        return True
    return False


def _bring_window_to_front(pid):
    """根据 PID 找到窗口并激活到最前"""
    user32 = ctypes.windll.user32
    @ctypes.WINFUNCTYPE(ctypes.c_int, wintypes.HWND, wintypes.LPARAM)
    def callback(hwnd, _):
        if not user32.IsWindowVisible(hwnd):
            return 1
        pid_from_wnd = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid_from_wnd))
        if pid_from_wnd.value != pid:
            return 1
        # 获取当前前台线程以便 AttachThreadInput
        fore_wnd = user32.GetForegroundWindow()
        if fore_wnd:
            fore_pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(fore_wnd, ctypes.byref(fore_pid))
            user32.AttachThreadInput(fore_pid.value, pid_from_wnd.value, True)
            user32.SetForegroundWindow(hwnd)
            user32.AttachThreadInput(fore_pid.value, pid_from_wnd.value, False)
        else:
            user32.SetForegroundWindow(hwnd)
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE
        return 0
    user32.EnumWindows(callback, pid)


def _single_instance_check():
    """单实例检查。返回 True 表示继续启动，返回 False 表示已有实例在运行（已激活窗口）。"""
    lock_dir = os.path.join(os.environ["LOCALAPPDATA"], "求职者信息录入")
    os.makedirs(lock_dir, exist_ok=True)
    lock_file = os.path.join(lock_dir, "instance.lock")
    _log = lambda msg: open(os.path.join(lock_dir, "single_instance.log"), "a", encoding="utf-8").write(msg + "\n")
    _log(f"[检查] lock_file={lock_file}")
    if os.path.exists(lock_file):
        try:
            old_pid = int(open(lock_file, "r", encoding="utf-8").read().strip())
            _log(f"[检查] 旧 PID={old_pid}, 当前 PID={os.getpid()}")
            _log(f"[检查] 旧进程是否在运行={_is_pid_running(old_pid)}")
            if _is_pid_running(old_pid):
                _log(f"[检查] 呼起旧窗口")
                _bring_window_to_front(old_pid)
                return False
        except Exception as e:
            _log(f"[检查] 出错={e}")
            pass
    _log(f"[检查] 写入当前 PID={os.getpid()}")
    with open(lock_file, "w", encoding="utf-8") as f:
        f.write(str(os.getpid()))
    atexit.register(lambda: os.remove(lock_file) if os.path.exists(lock_file) else None)
    return True


if __name__ == "__main__":
    _debug_file = os.path.join(os.environ["LOCALAPPDATA"], "求职者信息录入", "debug_startup.txt")
    os.makedirs(os.path.dirname(_debug_file), exist_ok=True)
    with open(_debug_file, "w", encoding="utf-8") as f:
        f.write(f"当前 PID: {os.getpid()}\n")
        result = _single_instance_check()
        f.write(f"单实例检查结果: {result}\n")
        if not result:
            f.write("已有实例在运行，退出\n")
            sys.exit(0)
        f.write("继续启动主程序\n")
    import threading
    mutex = threading.Lock()
    with mutex:
        # ---- 登录流程 ----
        root = tk.Tk()
        root.withdraw()
        login_win = LoginWindow(root)
        root.wait_window(login_win.win)
        if login_win.cancelled or login_win.login_info is None:
            root.destroy()
            sys.exit(0)
        login_info = login_win.get_login_info()
        root.destroy()
        # ---- 启动主程序 ----
        try:
            app = App(login_info)
            app.mainloop()
        except Exception as e:
            import traceback
            messagebox.showerror("程序崩溃", traceback.format_exc())
