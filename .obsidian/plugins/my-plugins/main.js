const { Plugin, editor, MarkdownView } = require("obsidian");
const { EditorView } = require("@codemirror/view");


module.exports = class MyPlugin extends Plugin {
    
    onload() {
        // ---- Increase/Decrease Editor Width ----
        const delta_editor_width = 2;
        this.addCommand({
            id: "myplugins-increase-editor-width",
            name: "myplugins : increase editor width",
            editorCallback: (editor) => {
                this.mod_editor_width(delta_editor_width);
            },
        });

        this.addCommand({
            id: "myplugins-decrease-editor-width",
            name: "myplugins : decrease editor width",
            editorCallback: (editor) => {
                this.mod_editor_width(-delta_editor_width);
            },
        });
        
        // ---- Increase/Decrease Line Height ----
        const delta_line_height = 0.1;

        this.addCommand({
            id: "myplugins-increase-line-height",
            name: "myplugins : increase line height",
            editorCallback: (editor) => {
                this.mod_line_height(delta_line_height);
            },
        });

        this.addCommand({
            id: "myplugins-decrease-line-height",
            name: "myplugins : decrease line height",
            editorCallback: (editor) => {
                this.mod_line_height(-delta_line_height);
            },
        });
    }
    
    mod_editor_width(delta) {
        const current = getComputedStyle(document.body)
            .getPropertyValue("--editor-width")
            .trim();

        const match = current.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
        if (!match) return;

        const value = Number(match[1]);
        const unit = match[2]; // %, px など

        document.body.style.setProperty(
            "--editor-width",
            `${value + delta}${unit}`
        );
    }

    mod_line_height(delta) {
        const current = getComputedStyle(document.body)
            .getPropertyValue("--line-height")
            .trim();

        const match = current.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
        if (!match) return;

        const value = Number(match[1]);
        const unit = match[2]; // %, px など

        document.body.style.setProperty(
            "--line-height",
            `${value + delta}${unit}`
        );
    }
    
    
};