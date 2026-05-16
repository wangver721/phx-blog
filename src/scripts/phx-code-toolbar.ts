/**
 * 为 Expressive Code 代码块挂载底部工具条（行号 / 折行 / 复制 / 全屏）。
 * 设计要点：
 *  1. 全局 document click 事件委托：避免 init 时机或重复绑定带来的问题；
 *     即使页面切换 / 重新渲染，新生成的工具条也能立刻响应；
 *  2. 全屏时把整个 `.expressive-code` 包装容器 portal 到 <body> 下，避免被
 *     祖先的 transform / filter 吃掉 `position: fixed` 的 containing block；
 *  3. 关闭后通过占位注释节点把容器还原回原位，保持文档流不变。
 */

const TOOLBAR_FLAG = "data-phx-ec-toolbar";
const PLACEHOLDER_KEY = "__phxFsPlaceholder";
const GLOBAL_FLAG = "data-phx-ec-global";

const ICON_LINES =
	'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>';
const ICON_WRAP =
	'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h10M4 18h14"/></svg>';
const ICON_COPY =
	'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>';
const ICON_FS =
	'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
const ICON_FS_EXIT =
	'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2v-4M3 9V5a2 2 0 0 1 2-2h4m6 18h4a2 2 0 0 0 2-2v-4M21 9V5a2 2 0 0 0-2-2h-4"/></svg>';

type Action = "lines" | "wrap" | "copy" | "fs";

function makeButton(action: Action, label: string, svg: string) {
	const b = document.createElement("button");
	b.type = "button";
	b.className = "phx-ec-toolbar__btn";
	b.dataset.action = action;
	b.title = label;
	b.setAttribute("aria-label", label);
	b.innerHTML = `<span class="phx-ec-toolbar__ico" aria-hidden="true">${svg}</span>`;
	return b;
}

function syncButtons(frame: HTMLElement) {
	const btn = (a: Action) =>
		frame.querySelector<HTMLButtonElement>(
			`.phx-ec-toolbar__btn[data-action="${a}"]`,
		);
	const lines = btn("lines");
	const wrap = btn("wrap");
	const fs = btn("fs");
	if (lines) {
		const on = !frame.classList.contains("ec-hide-line-numbers");
		lines.setAttribute("aria-pressed", on ? "true" : "false");
		lines.title = on ? "隐藏行号" : "显示行号";
	}
	if (wrap) {
		const on = !frame.classList.contains("ec-no-wrap");
		wrap.setAttribute("aria-pressed", on ? "true" : "false");
		wrap.title = on ? "关闭折行" : "开启折行";
	}
	if (fs) {
		const on = frame.classList.contains("ec-fullscreen");
		fs.setAttribute("aria-pressed", on ? "true" : "false");
		fs.title = on ? "退出全屏" : "全屏查看";
		const ico = fs.querySelector(".phx-ec-toolbar__ico");
		if (ico) ico.innerHTML = on ? ICON_FS_EXIT : ICON_FS;
	}
}

function decorate(frame: HTMLElement) {
	if (frame.getAttribute(TOOLBAR_FLAG)) return;
	frame.setAttribute(TOOLBAR_FLAG, "1");

	const bar = document.createElement("div");
	bar.className = "phx-ec-toolbar";
	bar.setAttribute("role", "toolbar");
	bar.setAttribute("aria-label", "代码块工具栏");

	const lines = makeButton("lines", "切换行号", ICON_LINES);
	const wrap = makeButton("wrap", "切换折行", ICON_WRAP);
	const copy = makeButton("copy", "复制", ICON_COPY);
	const fs = makeButton("fs", "全屏查看", ICON_FS);

	if (!frame.querySelector(".gutter")) {
		lines.disabled = true;
		lines.title = "此代码块无行号";
	}

	bar.append(lines, wrap, copy, fs);
	frame.appendChild(bar);
	syncButtons(frame);
}

function enterFullscreen(frame: HTMLElement) {
	if (frame.classList.contains("ec-fullscreen")) return;
	exitAllFullscreen();

	const wrapper = frame.closest<HTMLElement>(".expressive-code");
	if (wrapper && !(wrapper as any)[PLACEHOLDER_KEY]) {
		const placeholder = document.createComment("phx-ec-fs");
		wrapper.parentNode?.insertBefore(placeholder, wrapper);
		(wrapper as any)[PLACEHOLDER_KEY] = placeholder;
		document.body.appendChild(wrapper);
		wrapper.classList.add("phx-ec-portal");
	}
	frame.classList.add("ec-fullscreen");
	document.body.classList.add("phx-ec-fullscreen-open");
	syncButtons(frame);
}

function exitFullscreen(frame: HTMLElement) {
	if (!frame.classList.contains("ec-fullscreen")) return;
	frame.classList.remove("ec-fullscreen");

	const wrapper = frame.closest<HTMLElement>(".expressive-code");
	if (wrapper) {
		const placeholder = (wrapper as any)[PLACEHOLDER_KEY] as
			| Comment
			| undefined;
		if (placeholder?.parentNode) {
			placeholder.parentNode.insertBefore(wrapper, placeholder);
			placeholder.parentNode.removeChild(placeholder);
		}
		delete (wrapper as any)[PLACEHOLDER_KEY];
		wrapper.classList.remove("phx-ec-portal");
	}
	if (
		!document.querySelector(".expressive-code figure.frame.ec-fullscreen")
	) {
		document.body.classList.remove("phx-ec-fullscreen-open");
	}
	syncButtons(frame);
}

export function exitAllFullscreen() {
	const list = Array.from(
		document.querySelectorAll<HTMLElement>(
			".expressive-code figure.frame.ec-fullscreen",
		),
	);
	for (const f of list) exitFullscreen(f);
	document.body.classList.remove("phx-ec-fullscreen-open");
}

// 兼容旧名字（Layout.astro 中导入的旧符号）
export const closeAllFullscreen = exitAllFullscreen;

function ensureGlobalHandlers() {
	if (document.documentElement.getAttribute(GLOBAL_FLAG)) return;
	document.documentElement.setAttribute(GLOBAL_FLAG, "1");

	document.addEventListener(
		"click",
		(e) => {
			const target = e.target as Element | null;
			if (!target) return;
			const btn = target.closest<HTMLButtonElement>(".phx-ec-toolbar__btn");
			if (!btn || btn.disabled) return;
			const frame = btn.closest<HTMLElement>("figure.frame");
			if (!frame) return;
			e.preventDefault();
			e.stopPropagation();
			const action = btn.dataset.action as Action | undefined;
			if (action === "lines") {
				frame.classList.toggle("ec-hide-line-numbers");
				syncButtons(frame);
			} else if (action === "wrap") {
				frame.classList.toggle("ec-no-wrap");
				syncButtons(frame);
			} else if (action === "copy") {
				// 复用 Markdown.astro 中已有的全局复制监听器：模拟点击隐藏的 copy-btn
				const orig = frame.querySelector<HTMLButtonElement>("button.copy-btn");
				if (orig) {
					orig.click();
					btn.classList.add("is-success");
					window.setTimeout(() => btn.classList.remove("is-success"), 1200);
				}
			} else if (action === "fs") {
				if (frame.classList.contains("ec-fullscreen")) exitFullscreen(frame);
				else enterFullscreen(frame);
			}
		},
		true,
	);

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") exitAllFullscreen();
	});
}

export function initPhxCodeToolbars() {
	ensureGlobalHandlers();
	for (const el of document.querySelectorAll<HTMLElement>(
		".expressive-code figure.frame",
	)) {
		decorate(el);
	}
}
