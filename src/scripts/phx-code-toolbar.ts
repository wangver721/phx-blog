/**
 * 为 Expressive Code 代码块挂载底部工具条（行号 / 折行 / 复制 / 全屏），
 * 交互风格参考常见 hljs 代码块插件，与 Swup 页面切换兼容。
 */
const KBD_ATTR = "data-phx-ec-kbd";

export function closeAllFullscreen() {
	for (const f of document.querySelectorAll(
		".expressive-code figure.frame.ec-fullscreen",
	)) {
		f.classList.remove("ec-fullscreen");
	}
	document.body.classList.remove("phx-ec-fullscreen-open");
}

function ensureEscapeListener() {
	if (document.documentElement.hasAttribute(KBD_ATTR)) return;
	document.documentElement.setAttribute(KBD_ATTR, "1");
	document.addEventListener("keydown", (e) => {
		if (e.key !== "Escape") return;
		closeAllFullscreen();
	});
}

function iconList() {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`;
}

function iconWrap() {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h10M4 18h14"/></svg>`;
}

function iconCopy() {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>`;
}

function iconFullscreen() {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
}

function mkBtn(action: string, title: string, svg: string) {
	const b = document.createElement("button");
	b.type = "button";
	b.className = "phx-ec-toolbar__btn";
	b.dataset.action = action;
	b.title = title;
	b.innerHTML = `<span class="phx-ec-toolbar__ico" aria-hidden="true">${svg}</span>`;
	return b;
}

function syncLineBtn(frame: HTMLElement, btn: HTMLButtonElement) {
	const on = !frame.classList.contains("ec-hide-line-numbers");
	btn.setAttribute("aria-pressed", on ? "true" : "false");
	btn.title = on ? "隐藏行号" : "显示行号";
}

function syncWrapBtn(frame: HTMLElement, btn: HTMLButtonElement, pre: HTMLPreElement) {
	const wrapped = !frame.classList.contains("ec-no-wrap");
	btn.setAttribute("aria-pressed", wrapped ? "true" : "false");
	btn.title = wrapped ? "关闭折行" : "开启折行";
	void pre;
}

function syncFsBtn(frame: HTMLElement, btn: HTMLButtonElement) {
	const on = frame.classList.contains("ec-fullscreen");
	btn.setAttribute("aria-pressed", on ? "true" : "false");
	btn.title = on ? "退出全屏" : "全屏查看";
}

export function initPhxCodeToolbars() {
	ensureEscapeListener();

	for (const el of document.querySelectorAll(".expressive-code figure.frame")) {
		const frame = el as HTMLElement;
		if (frame.dataset.phxEcToolbar) continue;
		frame.dataset.phxEcToolbar = "1";

		const pre = frame.querySelector("pre");
		if (!pre) continue;

		const bar = document.createElement("div");
		bar.className = "phx-ec-toolbar";
		bar.setAttribute("role", "toolbar");
		bar.setAttribute("aria-label", "代码块工具栏");

		const btnLines = mkBtn("lines", "隐藏行号", iconList());
		const btnWrap = mkBtn("wrap", "关闭折行", iconWrap());
		const btnCopy = mkBtn("copy", "复制", iconCopy());
		const btnFs = mkBtn("fs", "全屏查看", iconFullscreen());

		const hasGutter = frame.querySelector(".ec-line .gutter") !== null;
		if (!hasGutter) {
			btnLines.disabled = true;
			btnLines.title = "此代码块无行号";
		}

		syncLineBtn(frame, btnLines);
		syncWrapBtn(frame, btnWrap, pre);
		syncFsBtn(frame, btnFs);

		bar.append(btnLines, btnWrap, btnCopy, btnFs);
		frame.appendChild(bar);

		bar.addEventListener("click", (e) => {
			const t = (e.target as HTMLElement).closest(
				"button[data-action]",
			) as HTMLButtonElement | null;
			if (!t || !bar.contains(t)) return;
			const action = t.dataset.action;
			if (action === "lines" && hasGutter) {
				frame.classList.toggle("ec-hide-line-numbers");
				syncLineBtn(frame, btnLines);
			} else if (action === "wrap") {
				frame.classList.toggle("ec-no-wrap");
				syncWrapBtn(frame, btnWrap, pre);
			} else if (action === "copy") {
				frame.querySelector<HTMLButtonElement>("button.copy-btn")?.click();
			} else if (action === "fs") {
				const next = !frame.classList.contains("ec-fullscreen");
				closeAllFullscreen();
				if (next) {
					frame.classList.add("ec-fullscreen");
					document.body.classList.add("phx-ec-fullscreen-open");
				}
				syncFsBtn(frame, btnFs);
			}
		});
	}
}
