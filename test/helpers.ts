import { parser as mdParser } from "@lezer/markdown";
import { parser as jsParser } from "@lezer/javascript";
import { DOMParser, Node } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { highlightPlugin } from "../src/index";
import { schema } from "../src/sample-schema";

export function escapeHtml(html: string) {
    return html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
}

export function createDoc(input: { code: string; language?: string }[]): Node {
    const doc = document.createElement("div");

    doc.innerHTML = input.reduce((p, n) => {
        return (
            p +
            `<pre data-params="${n.language || ""}"><code>${escapeHtml(
                n.code
            )}</code></pre>`
        );
    }, "");

    return DOMParser.fromSchema(schema).parse(doc);
}

export function createStateImpl(
    input: { code: string; language?: string }[],
    addPlugins = true
): EditorState {
    return EditorState.create({
        doc: createDoc(input),
        schema: schema,
        plugins: addPlugins
            ? [
                  highlightPlugin({
                      javascript: jsParser,
                      markdown: mdParser,
                  }),
              ]
            : [],
    });
}

export function createState(
    code: string,
    language?: string,
    addPlugins = true
): EditorState {
    return createStateImpl(
        [
            {
                code,
                language,
            },
        ],
        addPlugins
    );
}
