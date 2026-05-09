# PHX Blog 文章上传手册

这份手册只讲一件事：**以后怎么写文章、放图片、发布到 `blog.iphx.io`。**

项目路径：

```text
C:\Users\王先生\Desktop\Cursor\PHX_Blog
```

文章目录：

```text
src/content/posts/
```

线上博客：

```text
https://blog.iphx.io
```

---

## 1. 最快发布流程

以后写文章，最常用就是这 4 步：

```powershell
# 1. 新建文章
pnpm new-post night-notes

# 2. 编辑生成的 .md 文件
# 文件在 src/content/posts/ 里面

# 3. 可选：本地预览
pnpm dev

# 4. 发布
git add . ; git commit -m "post: 今夜小记" ; git push
```

`git push` 之后，Cloudflare Pages 会自动构建。一般 **1-2 分钟后**线上生效。

---

## 2. 新建普通文章

运行：

```powershell
pnpm new-post night-notes
```

会生成：

```text
src/content/posts/night-notes.md
```

文件开头长这样：

```markdown
---
id: 4
title: night-notes
published: 2026-05-05
description: ''
---
```

你需要改：

```markdown
---
id: 4
title: 今夜小记
published: 2026-05-05
description: 雨、咖啡和一个突然想清楚的事。
---

正文从这里开始。
```

说明：

- `id` 自动生成，不要手改。
- 线上地址由 `id` 决定，比如 `id: 4` 的地址就是 `/posts/4/`。
- 文件名只用于仓库里识别，不影响线上地址。
- `description` 建议认真写一句，会显示在首页文章卡片上。

---

## 3. 新建带封面图的文章

运行：

```powershell
pnpm new-post photo-diary --cover
```

会生成：

```text
src/content/posts/photo-diary/
├── index.md
└── cover.jpg
```

`index.md` 里会自动带：

```markdown
---
id: 5
title: photo-diary
published: 2026-05-05
description: ''
image: ./cover.jpg
---
```

把 `cover.jpg` 替换成你的真实封面图即可。

封面图建议：

- 横图，比例最好是 **16:9**。
- 分辨率建议至少 **1200 × 675**。
- 文件可以是 `.jpg`、`.png`、`.webp`。
- 如果你用 `cover.png`，就把 frontmatter 改成 `image: ./cover.png`。

---

## 4. 文章 URL 规则

博客使用数字短链：

```text
https://blog.iphx.io/posts/1/
https://blog.iphx.io/posts/2/
https://blog.iphx.io/posts/3/
```

也就是说：

```markdown
---
id: 6
title: 某篇文章
---
```

线上地址就是：

```text
https://blog.iphx.io/posts/6/
```

不要为了改 URL 去改文件名。**URL 只看 `id`。**

---

## 5. Typora 粘贴图片怎么处理

Typora 经常会生成这种路径：

```markdown
![image-20260503224219431](C:\Users\王先生\AppData\Roaming\Typora\typora-user-images\image-20260503224219431.png)
```

这种路径只在你电脑上有效，线上网站打不开。

项目已经做了自动化处理：**每次 commit 前会自动扫描文章，把这种本地绝对路径图片复制到文章目录，并改成相对路径。**

例如原来是：

```markdown
![image](C:\Users\王先生\AppData\Roaming\Typora\typora-user-images\image.png)
```

提交前会自动变成：

```markdown
![image](./image.png)
```

如果文章原本是：

```text
src/content/posts/my-post.md
```

并且里面有 Typora 本地图片，脚本会自动迁移成：

```text
src/content/posts/my-post/
├── index.md
└── image.png
```

这个变化不影响线上地址，因为线上地址只看 `id`。

### 手动处理图片

如果你想发布前先手动处理一遍图片：

```powershell
pnpm fix-images
```

如果只是想看看会处理什么，但不改文件：

```powershell
pnpm fix-images:dry
```

---

## 6. 本地预览

写完文章后，如果想先看效果：

```powershell
pnpm dev
```

浏览器打开：

```text
http://localhost:4321/
```

修改文章并保存后，页面会自动刷新。

停止预览：

```text
Ctrl + C
```

---

## 7. 发布文章

写完并保存后，在项目根目录运行：

```powershell
git add . ; git commit -m "post: 文章标题" ; git push
```

发布过程中会自动做这些事：

1. 检查并转换 Typora 本地图片路径。
2. 把新增图片一起加入 git。
3. 提交文章。
4. 推送到 GitHub。
5. Cloudflare Pages 自动构建上线。

常见提交信息：

```powershell
git add . ; git commit -m "post: 今夜小记" ; git push
```

修改旧文章：

```powershell
git add . ; git commit -m "update: 修改今夜小记" ; git push
```

修错字：

```powershell
git add . ; git commit -m "fix: 修正错字" ; git push
```

---

## 8. 草稿

如果一篇文章暂时不想上线，在 frontmatter 加：

```markdown
draft: true
```

完整示例：

```markdown
---
id: 7
title: 暂时不发布
published: 2026-05-05
description: 这是一篇草稿。
draft: true
---
```

效果：

- 本地 `pnpm dev` 能看到。
- 线上构建不会发布。

注意：草稿文件如果 push 到 GitHub，源码仍然是公开的。真正不想公开的内容，不要 push。

---

## 9. 修改已发布文章

直接打开对应 `.md` 或 `index.md` 修改，然后：

```powershell
git add . ; git commit -m "update: 文章标题" ; git push
```

只要 `id` 不变，文章 URL 就不变。

---

## 10. 删除文章

推荐做法：先改成草稿。

```markdown
draft: true
```

如果确定要删：

```powershell
git rm src/content/posts/文件名.md
git commit -m "remove: 文章标题"
git push
```

如果是子目录文章：

```powershell
git rm -r src/content/posts/文件夹名
git commit -m "remove: 文章标题"
git push
```

删除后对应 URL 会变成 404。已经用过的 `id` 不建议复用。

---

## 11. Markdown 常用写法

### 标题

```markdown
## 二级标题

### 三级标题
```

不要在正文里用 `# 一级标题`，因为文章标题已经是一级标题。

### 加粗、斜体、删除线

```markdown
**加粗**
*斜体*
~~删除线~~
```

### 链接

```markdown
[iPHX.io](https://iphx.io)
```

### 图片

```markdown
![图片说明](./image.png)
```

控制宽度：

```html
<img src="./image.png" alt="图片说明" width="500" />
```

### 引用

```markdown
> 在忘记前记下。
```

### 代码块

````markdown
```bash
pnpm build
```
````

### 分隔线

```markdown
---
```

---

## 12. 常见问题

### push 之后网站没更新

等 1-2 分钟。如果还是没更新，去 Cloudflare Pages 看部署状态。

### 构建失败

常见原因：

- frontmatter 格式写错。
- 图片路径不存在。
- Markdown 里有不完整的代码块。

先本地跑：

```powershell
pnpm build
```

如果本地也失败，把报错复制出来看。

### 图片线上不显示

先手动跑：

```powershell
pnpm fix-images
```

再发布：

```powershell
git add . ; git commit -m "fix: 修复图片路径" ; git push
```

### commit 时自动处理图片了，但文件结构变了

这是正常的。

例如：

```text
my-post.md
```

变成：

```text
my-post/index.md
my-post/image.png
```

线上 URL 不会变，因为 URL 只看 `id`。

---

## 13. 一句话总结

普通文章：

```powershell
pnpm new-post 标题
```

带封面文章：

```powershell
pnpm new-post 标题 --cover
```

发布：

```powershell
git add . ; git commit -m "post: 标题" ; git push
```

本地预览：

```powershell
pnpm dev
```

图片修复：

```powershell
pnpm fix-images
```

