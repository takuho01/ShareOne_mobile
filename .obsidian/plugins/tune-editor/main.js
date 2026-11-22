const { Plugin, Notice, Platform } = require("obsidian");
const PANEL_SCALE = 1;

// CSS側では body または :root に定義してください。
const ITEMS = [
  { name: "tune-editor-font-size", label: "文字サイズ", fallback: "16px", step: 0.5 },
  { name: "tune-editor-line-height", label: "行の高さ", fallback: "1.6", step: 0.05 },
  { name: "tune-editor-editor-width", label: "エディター幅", fallback: "100%", step: 2, unit: "%" },
];

module.exports = class EditorTune extends Plugin {
  async onload() {
    this.values = (await this.loadData()) || {};
    this.originals = new Map();
    this.saveQueue = Promise.resolve();

    for (const item of ITEMS) {
      const key = `--${item.name}`;
      this.originals.set(key, {
        value: document.body.style.getPropertyValue(key),
        priority: document.body.style.getPropertyPriority(key),
      });
      if (item.unit === "%") {
        const value = this.values[item.name] ?? getComputedStyle(document.body).getPropertyValue(key).trim();
        const parsed = typeof value === "string" ? this.parse(value) : null;
        // 幅は%専用。旧版のpx保存値などは80%に切り替える。
        this.values[item.name] = parsed?.unit === "%" ? value : item.fallback;
      }
      if (typeof this.values[item.name] === "string" && this.parse(this.values[item.name])) {
        this.apply(item, this.values[item.name]);
      }
    }

    this.addCommand({
      id: "open-editortune",
      name: "open-editortune",
      callback: () => this.openPanel(),
    });
    const fontSize = ITEMS.find((item) => item.name === "val-font-size");
    this.addCommand({
      id: "tune-increase-font-size",
      name: "文字サイズを1ステップ増やす",
      callback: () => this.changeValue(fontSize, 1, fontSize.step),
    });
    this.addCommand({
      id: "tune-decrease-font-size",
      name: "文字サイズを1ステップ減らす",
      callback: () => this.changeValue(fontSize, -1, fontSize.step),
    });
    this.registerDomEvent(document, "keydown", (event) => {
      if (event.key === "Escape") this.closePanel();
    });
    const reposition = () => this.positionPanel();
    this.registerEvent(this.app.workspace.on("active-leaf-change", reposition));
    this.registerEvent(this.app.workspace.on("layout-change", reposition));
    this.registerDomEvent(window, "resize", reposition);
    if (window.visualViewport) {
      this.registerDomEvent(window.visualViewport, "resize", reposition);
      this.registerDomEvent(window.visualViewport, "scroll", reposition);
    }
  }

  parse(value) {
    const match = value.trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+))(px|em|rem|%|vw|vh|ch)?$/i);
    if (!match || !Number.isFinite(Number(match[1]))) return null;
    return { number: Number(match[1]), unit: match[2] || "" };
  }

  apply(item, value) {
    document.body.style.setProperty(`--${item.name}`, value, "important");
    const output = this.panel?.querySelector(`output[data-item="${item.name}"]`);
    if (output) output.textContent = value;
  }

  readValue(item) {
    const value = getComputedStyle(document.body).getPropertyValue(`--${item.name}`).trim() || item.fallback;
    return item.unit && this.parse(value)?.unit !== item.unit ? item.fallback : value;
  }

  changeValue(item, direction, requestedStep) {
    const current = this.parse(this.readValue(item));
    if (!current) {
      new Notice(`--${item.name} は単純な数値で指定してください（例: 16px、1.6）。`);
      return;
    }
    // パネルではem/remを0.1刻み、直接コマンドでは指定のstep刻みにする。
    const step = requestedStep ?? (/^(em|rem)$/i.test(current.unit) ? 0.1 : item.step);
    const number = Math.max(step, Math.round((current.number + direction * step) * 1000) / 1000);
    const value = `${number}${current.unit}`;
    this.apply(item, value);
    this.values[item.name] = value;
    const snapshot = { ...this.values };
    this.saveQueue = this.saveQueue.then(() => this.saveData(snapshot)).catch(() => {
      new Notice("Editor Tune: 設定を保存できませんでした。");
    });
  }

  openPanel() {
    if (this.panel) {
      this.positionPanel();
      this.focusPanelOnMobile();
      return;
    }
    const panel = document.createElement("div");
    this.panel = panel;
    panel.tabIndex = -1;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Editor Tune");
    panel.style.cssText = `
      position: fixed; z-index: 10000;
      top: 0; left: 0; width: 310px;
      transform: scale(${PANEL_SCALE}); transform-origin: top left;
      overflow: auto; box-sizing: border-box;
      padding: 12px; border-radius: 12px;
      background: var(--background-primary); color: var(--text-normal);
      border: 1px solid var(--background-modifier-border);
      box-shadow: 0 6px 24px #0004; font-size: 14px;
    `;

    const button = (parent, text, label, action) => {
      const element = document.createElement("button");
      element.type = "button";
      element.textContent = text;
      element.setAttribute("aria-label", label);
      element.style.cssText = "min-width:44px;min-height:44px;padding:0 10px;touch-action:manipulation;";
      element.addEventListener("click", action);
      parent.appendChild(element);
      return element;
    };

    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";
    const title = document.createElement("strong");
    title.textContent = "Editor Tune";
    header.appendChild(title);
    button(header, "×", "閉じる", () => this.closePanel());
    panel.appendChild(header);

    for (const item of ITEMS) {
      const row = document.createElement("div");
      row.style.cssText = "display:grid;grid-template-columns:1fr 44px 76px 44px;gap:4px;align-items:center;margin-top:8px;";
      const label = document.createElement("span");
      label.textContent = item.label;
      label.title = `--${item.name}`;
      row.appendChild(label);
      const output = document.createElement("output");
      output.dataset.item = item.name;
      output.style.cssText = "text-align:center;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;";
      output.setAttribute("aria-live", "polite");
      output.textContent = this.readValue(item);
      const change = (direction) => this.changeValue(item, direction);

      button(row, "−", `${item.label}を減らす`, () => change(-1));
      row.appendChild(output);
      button(row, "＋", `${item.label}を増やす`, () => change(1));
      panel.appendChild(row);
    }
    document.body.appendChild(panel);
    this.positionPanel();
    this.focusPanelOnMobile();
  }

  focusPanelOnMobile() {
    if (!Platform.isMobile) return;
    this.cancelPanelFocus();

    const panel = this.panel;
    const leaf = this.app.workspace.activeLeaf;
    if (!panel || panel.hidden || !panel.isConnected) return;

    const moveFocus = () => {
      if (this.panel !== panel || panel.hidden || !panel.isConnected ||
          this.app.workspace.activeLeaf !== leaf) return;
      // 選択範囲には触れず、入力フォーカスだけをパネルへ移す。
      if (!panel.contains(document.activeElement)) {
        document.activeElement?.blur?.();
        panel.focus({ preventScroll: true });
      }
    };

    moveFocus();
    // コマンドパレットを閉じる際のフォーカス復帰にも対応する。
    this.panelFocusFrame = window.requestAnimationFrame(() => {
      this.panelFocusFrame = null;
      moveFocus();
    });
  }

  cancelPanelFocus() {
    if (this.panelFocusFrame != null) {
      window.cancelAnimationFrame(this.panelFocusFrame);
      this.panelFocusFrame = null;
    }
  }

  positionPanel() {
    if (!this.panel) return;
    const view = this.app.workspace.activeLeaf?.view;
    const editor = view?.getViewType() === "markdown"
      ? view.containerEl.querySelector(".view-content")
      : null;
    this.panel.hidden = !editor;
    if (!editor) return;

    if (this.anchor !== editor) {
      this.resizeObserver?.disconnect();
      this.anchor = editor;
      this.resizeObserver = new ResizeObserver(() => this.positionPanel());
      this.resizeObserver.observe(editor);
    }

    // 表示中のエディタ下端から高さの10%分上に配置。
    const rect = editor.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    this.panel.style.maxWidth = `${Math.max(1, width - 8) / PANEL_SCALE}px`;
    this.panel.style.maxHeight = `${Math.max(1, height - 8) / PANEL_SCALE}px`;
    const panelWidth = this.panel.offsetWidth * PANEL_SCALE;
    const panelHeight = this.panel.offsetHeight * PANEL_SCALE;
    this.panel.style.left = `${Math.max(left + 4, Math.min(rect.right - panelWidth - 4, left + width - panelWidth - 4))}px`;
    const visibleBottom = Math.min(rect.bottom, top + height);
    const visibleHeight = Math.max(0, visibleBottom - Math.max(rect.top, top));
    this.panel.style.top = `${Math.max(top + 4, visibleBottom - visibleHeight * 0.1 - panelHeight - 4)}px`;
  }

  closePanel() {
    this.cancelPanelFocus();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.anchor = null;
    this.panel?.remove();
    this.panel = null;
  }

  onunload() {
    this.closePanel();
    for (const [key, original] of this.originals || []) {
      if (original.value) document.body.style.setProperty(key, original.value, original.priority);
      else document.body.style.removeProperty(key);
    }
  }
};
