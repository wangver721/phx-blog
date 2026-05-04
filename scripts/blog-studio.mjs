/**
 * PHX Blog Studio
 *
 * 一个轻量本地博客工作台：
 * - 浏览器图形界面写文章
 * - 自动分配数字 id
 * - 可选封面图
 * - 一键保存 / 构建 / commit / push
 * - 发布前自动调用 process-images 处理 Typora 本地图片路径
 *
 * 运行：
 *   pnpm studio
 */

import { exec, execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "src", "content", "posts");
const PORT = Number(process.env.PHX_STUDIO_PORT || 8787);

function sendJson(res, payload, status = 200) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
	});
	res.end(JSON.stringify(payload));
}

function sendHtml(res, html) {
	res.writeHead(200, {
		"content-type": "text/html; charset=utf-8",
		"cache-control": "no-store",
	});
	res.end(html);
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		let body = "";
		req.setEncoding("utf8");
		req.on("data", (chunk) => {
			body += chunk;
			if (body.length > 20 * 1024 * 1024) {
				reject(new Error("请求体太大，封面图请控制在 20MB 以内"));
				req.destroy();
			}
		});
		req.on("end", () => resolve(body));
		req.on("error", reject);
	});
}

function slugify(input) {
	const raw = String(input || "").trim();
	if (!raw) return `post-${Date.now()}`;
	const ascii = raw
		.toLowerCase()
		.replace(/['"]/g, "")
		.replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return ascii || `post-${Date.now()}`;
}

function escapeYamlString(value) {
	const s = String(value ?? "");
	if (s === "") return "''";
	if (/[:#\n\r]|^\s|\s$|['"]/.test(s)) {
		return `'${s.replace(/'/g, "''")}'`;
	}
	return s;
}

function walkMarkdown(dir = POSTS_DIR) {
	if (!fs.existsSync(dir)) return [];
	const out = [];
	for (const name of fs.readdirSync(dir)) {
		const full = path.join(dir, name);
		const stat = fs.statSync(full);
		if (stat.isDirectory()) out.push(...walkMarkdown(full));
		else if (/\.(md|mdx)$/i.test(name)) out.push(full);
	}
	return out;
}

function parseFrontmatter(text) {
	const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
	if (!match) return { data: {}, body: text, raw: "" };
	const raw = match[1];
	const data = {};
	for (const line of raw.split(/\r?\n/)) {
		const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!m) continue;
		let value = m[2].trim();
		if (
			(value.startsWith("'") && value.endsWith("'")) ||
			(value.startsWith('"') && value.endsWith('"'))
		) {
			value = value.slice(1, -1).replace(/''/g, "'");
		}
		if (/^\d+$/.test(value)) data[m[1]] = Number(value);
		else if (value === "true") data[m[1]] = true;
		else if (value === "false") data[m[1]] = false;
		else data[m[1]] = value;
	}
	return { data, body: text.slice(match[0].length), raw };
}

function readPost(filePath) {
	const text = fs.readFileSync(filePath, "utf8");
	const { data, body } = parseFrontmatter(text);
	const rel = path.relative(POSTS_DIR, filePath).replace(/\\/g, "/");
	return {
		id: Number(data.id || 0),
		title: String(data.title || ""),
		published: String(data.published || ""),
		description: String(data.description || ""),
		image: String(data.image || ""),
		draft: Boolean(data.draft || false),
		body,
		path: rel,
		url: data.id ? `/posts/${data.id}/` : "",
	};
}

function listPosts() {
	return walkMarkdown()
		.map(readPost)
		.sort((a, b) => {
			if (a.id !== b.id) return a.id - b.id;
			return a.title.localeCompare(b.title, "zh-CN");
		});
}

function nextId() {
	return listPosts().reduce((max, p) => Math.max(max, p.id || 0), 0) + 1;
}

function frontmatter(post) {
	const lines = [
		"---",
		`id: ${post.id}`,
		`title: ${escapeYamlString(post.title)}`,
		`published: ${post.published}`,
		`description: ${escapeYamlString(post.description || "")}`,
	];
	if (post.image) lines.push(`image: ${post.image}`);
	if (post.draft) lines.push("draft: true");
	lines.push("---", "");
	return lines.join("\n");
}

function ensureSafeRelativePostPath(rel) {
	const normalized = String(rel || "").replace(/\\/g, "/");
	if (!normalized || normalized.includes("..") || path.isAbsolute(normalized)) {
		throw new Error("非法文章路径");
	}
	if (!/\.(md|mdx)$/i.test(normalized)) throw new Error("文章路径必须是 .md 或 .mdx");
	return normalized;
}

function saveCover(articleDir, cover) {
	if (!cover?.dataUrl) return "";
	const match = cover.dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
	if (!match) throw new Error("封面图格式错误");
	const mime = match[1].toLowerCase();
	const ext =
		mime === "image/png"
			? ".png"
			: mime === "image/webp"
				? ".webp"
				: mime === "image/gif"
					? ".gif"
					: ".jpg";
	const fileName = `cover${ext}`;
	fs.mkdirSync(articleDir, { recursive: true });
	fs.writeFileSync(path.join(articleDir, fileName), Buffer.from(match[2], "base64"));
	return `./${fileName}`;
}

function savePost(payload) {
	const isUpdate = Boolean(payload.path);
	const id = isUpdate ? Number(payload.id) : nextId();
	const title = String(payload.title || "").trim();
	if (!title) throw new Error("标题不能为空");
	const published = String(payload.published || "").trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(published)) {
		throw new Error("发布日期必须是 YYYY-MM-DD");
	}

	let relPath;
	let articleDir;
	if (isUpdate) {
		relPath = ensureSafeRelativePostPath(payload.path);
		articleDir = path.dirname(path.join(POSTS_DIR, relPath));
	} else if (payload.cover?.dataUrl) {
		const slug = slugify(payload.slug || title);
		relPath = `${slug}/index.md`;
		articleDir = path.join(POSTS_DIR, slug);
	} else {
		const slug = slugify(payload.slug || title);
		relPath = `${slug}.md`;
		articleDir = POSTS_DIR;
	}

	const absPath = path.join(POSTS_DIR, relPath);
	if (!isUpdate && fs.existsSync(absPath)) {
		throw new Error(`文章已存在：${relPath}`);
	}

	let image = String(payload.image || "").trim();
	if (payload.cover?.dataUrl) image = saveCover(articleDir, payload.cover);

	const post = {
		id,
		title,
		published,
		description: String(payload.description || ""),
		image,
		draft: Boolean(payload.draft),
	};
	fs.mkdirSync(path.dirname(absPath), { recursive: true });
	fs.writeFileSync(absPath, `${frontmatter(post)}\n${String(payload.body || "")}`, "utf8");
	return { ...post, path: relPath.replace(/\\/g, "/"), url: `/posts/${id}/` };
}

function run(command, args, options = {}) {
	return new Promise((resolve) => {
		const child = execFile(command, args, {
			cwd: ROOT,
			windowsHide: true,
			// Windows 下 pnpm/git 可能通过 .cmd 入口暴露，走 shell 更稳。
			shell: process.platform === "win32",
			maxBuffer: 20 * 1024 * 1024,
			...options,
		});
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (d) => {
			stdout += d;
		});
		child.stderr?.on("data", (d) => {
			stderr += d;
		});
		child.on("close", (code) => {
			resolve({ code, stdout, stderr, output: `${stdout}${stderr}` });
		});
	});
}

async function publish(commitMessage) {
	const steps = [];
	const addStep = (name, result) => {
		steps.push({ name, code: result.code, output: result.output });
		if (result.code !== 0) {
			const err = new Error(`${name} 失败`);
			err.steps = steps;
			throw err;
		}
	};

	addStep("处理图片", await run("node", ["scripts/process-images.mjs", "--from-hook"]));
	addStep("构建检查", await run("pnpm", ["build"]));
	addStep("暂存文件", await run("git", ["add", "."]));
	const status = await run("git", ["status", "--short"]);
	if (!status.stdout.trim()) {
		return { message: "没有需要发布的改动", steps };
	}
	addStep(
		"提交",
		await run("git", ["commit", "-m", commitMessage || `post: ${new Date().toISOString()}`]),
	);
	addStep("推送", await run("git", ["push"]));
	return { message: "发布完成，Cloudflare Pages 正在自动部署", steps };
}

function openBrowser(url) {
	const platform = os.platform();
	if (platform === "win32") exec(`start "" "${url}"`);
	else if (platform === "darwin") exec(`open "${url}"`);
	else exec(`xdg-open "${url}"`);
}

const html = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PHX Blog Studio</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #100708;
      --panel: rgba(255,255,255,.09);
      --panel-2: rgba(255,255,255,.12);
      --border: rgba(255,255,255,.18);
      --text: rgba(255,255,255,.88);
      --muted: rgba(255,255,255,.56);
      --accent: #f05555;
      --accent-2: #ffb36b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      font-family: "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif;
      background:
        radial-gradient(circle at 15% 10%, rgba(150, 0, 10, .40), transparent 34rem),
        radial-gradient(circle at 85% 0%, rgba(255, 130, 70, .16), transparent 30rem),
        linear-gradient(135deg, #090304, #1c090b 55%, #080305);
    }
    .app { display: grid; grid-template-columns: 330px 1fr; min-height: 100vh; gap: 18px; padding: 18px; }
    .glass {
      border: 1px solid var(--border);
      background: var(--panel);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0,0,0,.30);
      border-radius: 18px;
    }
    aside { padding: 18px; overflow: auto; }
    main { padding: 18px; overflow: auto; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    .sub { color: var(--muted); font-size: 13px; margin-bottom: 18px; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
    button {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 10px 14px;
      background: var(--panel-2);
      color: var(--text);
      cursor: pointer;
      font-weight: 700;
    }
    button.primary { background: linear-gradient(135deg, #b91c1c, #ef4444); border-color: rgba(255,255,255,.22); }
    button.gold { background: linear-gradient(135deg, #7c2d12, #d97706); }
    button:hover { filter: brightness(1.08); }
    .post-list { display: grid; gap: 8px; }
    .post-item {
      border: 1px solid transparent;
      border-radius: 14px;
      padding: 10px 12px;
      cursor: pointer;
      background: rgba(255,255,255,.06);
    }
    .post-item.active { border-color: rgba(255,255,255,.28); background: rgba(255,255,255,.13); }
    .post-title { font-weight: 800; margin-bottom: 4px; }
    .post-meta { color: var(--muted); font-size: 12px; display: flex; justify-content: space-between; gap: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    label { display: block; color: var(--muted); font-size: 13px; margin: 0 0 6px; }
    input, textarea {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: rgba(0,0,0,.22);
      color: var(--text);
      padding: 11px 12px;
      outline: none;
      font: inherit;
    }
    textarea { min-height: 46vh; resize: vertical; line-height: 1.7; font-family: "JetBrains Mono", "Microsoft YaHei", monospace; }
    .field { margin-bottom: 12px; }
    .row { display: flex; align-items: center; gap: 10px; }
    .row input[type="checkbox"] { width: auto; }
    .hint { color: var(--muted); font-size: 12px; margin-top: 6px; }
    .status {
      white-space: pre-wrap;
      color: rgba(255,255,255,.78);
      background: rgba(0,0,0,.28);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      margin-top: 14px;
      max-height: 260px;
      overflow: auto;
      font-family: "JetBrains Mono", monospace;
      font-size: 12px;
    }
    @media (max-width: 900px) { .app { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="app">
    <aside class="glass">
      <h1>PHX Blog Studio</h1>
      <div class="sub">图形化写作、保存、构建和发布。</div>
      <div class="toolbar">
        <button class="primary" onclick="newPost()">新文章</button>
        <button onclick="loadPosts()">刷新</button>
      </div>
      <div id="posts" class="post-list"></div>
    </aside>
    <main class="glass">
      <div class="toolbar">
        <button class="primary" onclick="save()">保存文章</button>
        <button class="gold" onclick="publish()">发布到线上</button>
        <button onclick="openOnline()">打开线上地址</button>
      </div>
      <div class="grid">
        <div class="field">
          <label>文件名 / slug（只用于仓库识别，URL 走数字 id）</label>
          <input id="slug" placeholder="night-notes" />
        </div>
        <div class="field">
          <label>数字 id（新文章自动分配）</label>
          <input id="id" readonly placeholder="保存后生成" />
        </div>
      </div>
      <div class="grid">
        <div class="field">
          <label>标题</label>
          <input id="title" placeholder="文章标题" />
        </div>
        <div class="field">
          <label>发布日期</label>
          <input id="published" type="date" />
        </div>
      </div>
      <div class="field">
        <label>简介 description</label>
        <input id="description" placeholder="一句话简介，会显示在首页卡片和 SEO 描述里" />
      </div>
      <div class="grid">
        <div class="field">
          <label>封面图（可选）</label>
          <input id="cover" type="file" accept="image/*" />
          <div class="hint">选择后保存：自动放进文章目录，并写入 image: ./cover.xxx</div>
        </div>
        <div class="field">
          <label>选项</label>
          <div class="row"><input id="draft" type="checkbox" /><span>草稿（线上不显示）</span></div>
          <div class="hint" id="urlHint">URL：保存后显示</div>
        </div>
      </div>
      <div class="field">
        <label>正文 Markdown</label>
        <textarea id="body" placeholder="正文从这里开始。可以直接粘贴 Typora 图片路径，发布前会自动转换。"></textarea>
      </div>
      <div id="status" class="status">准备就绪。</div>
    </main>
  </div>
  <script>
    let currentPath = "";
    let currentUrl = "";

    const $ = (id) => document.getElementById(id);
    const today = () => new Date().toISOString().slice(0, 10);
    const log = (text) => { $("status").textContent = text; };

    async function api(path, options = {}) {
      const res = await fetch(path, {
        headers: { "content-type": "application/json" },
        ...options,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "请求失败");
      return json;
    }

    async function loadPosts() {
      const data = await api("/api/posts");
      $("posts").innerHTML = data.posts.map(p => {
        const active = p.path === currentPath ? "active" : "";
        const safePath = p.path.replace(/'/g, "\\'");
        return [
          '<div class="post-item ' + active + '" onclick="loadPost(\\'' + safePath + '\\')">',
          '<div class="post-title">#' + (p.id || "?") + " " + escapeHtml(p.title || "(无标题)") + "</div>",
          '<div class="post-meta"><span>' + (p.published || "") + "</span><span>" + (p.url || "") + "</span></div>",
          "</div>",
        ].join("");
      }).join("");
    }

    async function loadPost(path) {
      const data = await api("/api/post?path=" + encodeURIComponent(path));
      currentPath = data.post.path;
      currentUrl = data.post.url;
      $("slug").value = data.post.path.replace(/\/index\.md$/, "").replace(/\.md$/, "");
      $("id").value = data.post.id || "";
      $("title").value = data.post.title || "";
      $("published").value = data.post.published || today();
      $("description").value = data.post.description || "";
      $("draft").checked = !!data.post.draft;
      $("body").value = data.post.body || "";
      $("urlHint").textContent = "URL：" + (currentUrl || "保存后显示");
      $("cover").value = "";
      log("已加载：" + data.post.path);
      await loadPosts();
    }

    function newPost() {
      currentPath = "";
      currentUrl = "";
      $("slug").value = "";
      $("id").value = "";
      $("title").value = "";
      $("published").value = today();
      $("description").value = "";
      $("draft").checked = false;
      $("body").value = "";
      $("cover").value = "";
      $("urlHint").textContent = "URL：保存后显示";
      log("新文章模式：填写标题和正文后点击保存。");
      loadPosts();
    }

    function coverAsDataUrl() {
      const file = $("cover").files[0];
      if (!file) return Promise.resolve(null);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, dataUrl: reader.result });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    async function save() {
      try {
        log("保存中...");
        const cover = await coverAsDataUrl();
        const payload = {
          path: currentPath,
          id: Number($("id").value || 0),
          slug: $("slug").value,
          title: $("title").value,
          published: $("published").value,
          description: $("description").value,
          draft: $("draft").checked,
          body: $("body").value,
          cover,
        };
        const data = await api("/api/save", { method: "POST", body: JSON.stringify(payload) });
        currentPath = data.post.path;
        currentUrl = data.post.url;
        $("id").value = data.post.id;
        $("urlHint").textContent = "URL：" + data.post.url;
        $("cover").value = "";
        log("保存成功：" + data.post.path + "\n线上地址：" + data.post.url);
        await loadPosts();
      } catch (e) {
        log("保存失败：\n" + e.message);
      }
    }

    async function publish() {
      try {
        await save();
        const title = $("title").value || "文章更新";
        log("发布中：处理图片 → 构建 → commit → push\n请稍等...");
        const data = await api("/api/publish", {
          method: "POST",
          body: JSON.stringify({ message: "post: " + title }),
        });
        log(data.message + "\n\n" + data.steps.map(s => "## " + s.name + " (code " + s.code + ")\n" + s.output).join("\n"));
      } catch (e) {
        log("发布失败：\n" + e.message);
      }
    }

    function openOnline() {
      if (!currentUrl) return alert("先保存文章");
      window.open("https://blog.iphx.io" + currentUrl, "_blank");
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    loadPosts().then(newPost);
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
	try {
		const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
		if (req.method === "GET" && requestUrl.pathname === "/") {
			return sendHtml(res, html);
		}
		if (req.method === "GET" && requestUrl.pathname === "/api/posts") {
			return sendJson(res, { posts: listPosts() });
		}
		if (req.method === "GET" && requestUrl.pathname === "/api/post") {
			const rel = ensureSafeRelativePostPath(requestUrl.searchParams.get("path"));
			const abs = path.join(POSTS_DIR, rel);
			if (!fs.existsSync(abs)) return sendJson(res, { error: "文章不存在" }, 404);
			return sendJson(res, { post: readPost(abs) });
		}
		if (req.method === "POST" && requestUrl.pathname === "/api/save") {
			const payload = JSON.parse(await readBody(req));
			return sendJson(res, { post: savePost(payload) });
		}
		if (req.method === "POST" && requestUrl.pathname === "/api/publish") {
			const payload = JSON.parse(await readBody(req));
			return sendJson(res, await publish(payload.message));
		}
		return sendJson(res, { error: "接口不存在" }, 404);
	} catch (error) {
		return sendJson(
			res,
			{
				error: error.message,
				steps: error.steps,
				trace: process.env.NODE_ENV === "development" ? error.stack : undefined,
			},
			500,
		);
	}
});

server.listen(PORT, () => {
	const url = `http://localhost:${PORT}/`;
	console.log(`PHX Blog Studio 已启动：${url}`);
	console.log("按 Ctrl+C 退出。");
	openBrowser(url);
});
