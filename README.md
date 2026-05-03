# PHX Blog

> 一个基于 [Astro](https://astro.build/) + [Fuwari](https://github.com/saicaca/fuwari) 主题构建的 Serverless 静态博客。
> 源码托管在 **GitHub**，部署在 **Cloudflare Pages**，对外访问域名：<https://blog.iphx.io>。

## 特性一览

- ⚡ Astro 5 静态生成，零 JS 也能跑
- 🌗 暗色 / 亮色主题一键切换
- 🔍 [Pagefind](https://pagefind.app/) 内置全文搜索（中文支持）
- 📑 文章右侧自动生成目录（TOC），跟随滚动高亮
- 💬 [Giscus](https://giscus.app/) 评论（基于 GitHub Discussions，免费）
- 📈 Cloudflare Web Analytics（隐私友好、零成本）
- 📰 RSS / Sitemap / OpenGraph / Twitter Card 元数据齐全
- 🎨 横幅图、毛玻璃卡片、流畅过渡动画

## 本地开发

环境要求：Node.js ≥ 20，pnpm ≥ 9。

```bash
# 安装依赖
pnpm install

# 启动开发服务器（默认 http://localhost:4321）
pnpm dev

# 生产构建（产物在 dist/）
pnpm build

# 本地预览生产构建
pnpm preview

# 新建文章
pnpm new-post 我的新文章标题
```

## 目录结构

```
.
├─ src/
│  ├─ assets/images/      # 头像、横幅等图片
│  ├─ components/         # Astro / Svelte 组件（含 Comments.astro）
│  ├─ content/
│  │  ├─ posts/           # ✏️ 在这里写文章（Markdown）
│  │  └─ spec/about.md    # 关于页内容
│  ├─ config.ts           # ⭐ 站点核心配置（标题、导航、评论、统计等）
│  ├─ layouts/            # 页面布局
│  ├─ pages/              # 路由页面
│  └─ styles/             # 全局样式
├─ public/                # 静态资源（直接复制到产物根目录）
├─ astro.config.mjs       # Astro 配置（site URL 等）
└─ README.md
```

## 写文章

新建文章：

```bash
pnpm new-post 我的下一篇
# 在 src/content/posts/ 下生成 .md 文件，编辑即可
```

文章 frontmatter 模板：

```yaml
---
title: 文章标题
published: 2026-05-03
description: 一句话描述（用于摘要与 SEO）
image: ./cover.jpg          # 可选：封面图，与 .md 同目录
tags: [标签一, 标签二]
category: 分类名
draft: false                # true 则不参与构建
---
```

## 部署到 Cloudflare Pages（推荐）

### 一、上传代码到 GitHub

```bash
git init
git add .
git commit -m "init: PHX blog"
gh repo create phx-blog --public --source=. --push
# 或者手动在 GitHub 新建仓库后：
# git remote add origin git@github.com:your-name/phx-blog.git
# git branch -M main && git push -u origin main
```

### 二、在 Cloudflare 创建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 左侧选 **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. 授权并选择刚才的 GitHub 仓库
4. 在「构建设置」填入：

   | 项目             | 值                |
   | ---------------- | ----------------- |
   | Framework preset | **Astro**         |
   | Build command    | `pnpm build`      |
   | Output directory | `dist`            |
   | Node version     | `22`（环境变量 `NODE_VERSION=22`） |

5. 点击 **Save and Deploy**，第一次构建约 2–3 分钟

### 三、绑定自定义域名 `blog.iphx.io`

1. 项目首页 → **Custom domains** → **Set up a custom domain** → 输入 `blog.iphx.io`
2. Cloudflare 会自动在 `iphx.io` 这个域名下添加一条 `CNAME` 记录指向 `<project>.pages.dev`
3. 等待证书签发（通常 1 分钟内），完成 ✅

之后每次 `git push` 到 `main` 分支，Cloudflare Pages 会自动重新构建并发布，约 1–2 分钟生效。

---

## 部署到 GitHub Pages（备选）

如果不想用 Cloudflare Pages，可以走 GitHub Pages：

1. 把 `astro.config.mjs` 的 `site` 保持 `https://blog.iphx.io/`
2. 仓库根目录添加 `.github/workflows/deploy.yml`（参考 [Astro 官方文档](https://docs.astro.build/en/guides/deploy/github/)）
3. GitHub Settings → Pages → Source 选 **GitHub Actions**
4. Settings → Pages → Custom domain 填 `blog.iphx.io`
5. 在 Cloudflare DNS 添加 `CNAME blog → <user>.github.io`

> 🔁 与 Cloudflare Pages 相比，GitHub Pages 国内访问慢一些，且不能用 CF 的 Web Analytics 直接接入，所以推荐方案一。

---

## 启用评论（Giscus）

Giscus 把评论存在 GitHub Discussions 里，零运维、免费、抗封锁。

1. 你的博客仓库 → **Settings** → **General** → 滚到底部勾选 **Discussions** 启用
2. **Settings** → **Discussions** → 新建一个分类（推荐名字 `Announcements` 或 `Comments`，类型选 **Announcement**）
3. 安装 Giscus GitHub App：<https://github.com/apps/giscus> → **Configure** → 选择本博客仓库
4. 打开 <https://giscus.app/zh-CN>，依次填入仓库等信息，页面下方会生成一段 `<script data-repo="..." data-repo-id="..." data-category="..." data-category-id="...">`
5. 把这些值填入本项目 `src/config.ts` 的 `giscusConfig`：

   ```ts
   export const giscusConfig = {
     enable: true,                          // 改成 true
     repo: "your-name/phx-blog",
     repoId: "R_xxxxxxxxxxxxxx",
     category: "Announcements",
     categoryId: "DIC_xxxxxxxxxxxxxx",
     // 其它字段保持默认即可
   };
   ```

6. 提交 push，部署完成后每篇文章底部就会出现评论框

---

## 启用访问统计（Cloudflare Web Analytics）

完全免费、隐私友好，不用 cookie，不影响 Lighthouse 评分。

1. Cloudflare Dashboard → **Analytics & Logs** → **Web Analytics**
2. 点 **Add a site**，输入 `blog.iphx.io`，选择 **Manual installation**
3. 复制生成的 `data-cf-beacon` 中的 `token`（形如 `abc123...`）
4. 编辑 `src/config.ts`：

   ```ts
   export const cloudflareAnalyticsConfig = {
     enable: true,
     token: "abc123...",
   };
   ```

5. 提交 push，几分钟后 CF Dashboard 上就能看到访问数据

> 因为脚本只在 `enable && token` 同时满足时才注入，未填 token 不会留下空脚本，安全可见。

---

## 自定义指南

| 想做的事                           | 改这里                                                            |
| ---------------------------------- | ----------------------------------------------------------------- |
| 站点标题 / 副标题 / 语言           | `src/config.ts` 的 `siteConfig`                                   |
| 主题色（hue）                      | `src/config.ts` 的 `siteConfig.themeColor.hue`（0–360）           |
| 头像                               | 替换 `src/assets/images/demo-avatar.png`，或改 `profileConfig.avatar` |
| 首页大横幅图                       | 替换 `src/assets/images/demo-banner.png`，或改 `siteConfig.banner.src` |
| 顶部导航栏                         | `src/config.ts` 的 `navBarConfig.links`                           |
| 个人简介、社交链接                 | `src/config.ts` 的 `profileConfig`                                |
| 关于页内容                         | `src/content/spec/about.md`                                       |
| 文章版权声明                       | `src/config.ts` 的 `licenseConfig`                                |
| 代码块主题                         | `src/config.ts` 的 `expressiveCodeConfig.theme`                   |

## License

代码（含主题）遵循 [MIT License](./LICENSE)。
文章内容除特别注明外，采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)。
