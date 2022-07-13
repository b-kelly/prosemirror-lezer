// @ts-check
import { parser as jsParser } from "@lezer/javascript";
import { GFM, parser as mdParser } from "@lezer/markdown";
import { baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { DOMParser, Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import "prosemirror-view/style/prosemirror.css";
import { highlightPlugin } from "../src/index";
import { schema } from "../src/sample-schema";
import "./demo.css";

var extendedSchema = new Schema({
    nodes: {
        doc: {
            content: "block+",
        },
        text: {
            group: "inline",
        },
        code_block: {
            ...schema.nodes.code_block.spec,
            toDOM(node) {
                return [
                    "pre",
                    { "data-params": node.attrs.params },
                    ["code", 0],
                ];
            },
        },
        paragraph: {
            content: "inline*",
            group: "block",
            parseDOM: [{ tag: "p" }],
            toDOM() {
                return ["p", 0];
            },
        },
    },
    marks: {},
});

let content = document.querySelector("#content");

// create our prosemirror document and attach to window for easy local debugging
// @ts-expect-error
window.view = new EditorView(document.querySelector("#editor"), {
    state: EditorState.create({
        // @ts-expect-error
        doc: DOMParser.fromSchema(extendedSchema).parse(content),
        schema: extendedSchema,
        plugins: [
            keymap(baseKeymap),
            keymap({
                // pressing TAB (naively) inserts four spaces in code_blocks
                Tab: (state, dispatch) => {
                    let { $head } = state.selection;
                    if (!$head.parent.type.spec.code) {
                        return false;
                    }
                    if (dispatch) {
                        dispatch(state.tr.insertText("    ").scrollIntoView());
                    }

                    return true;
                },
            }),
            highlightPlugin({
                javascript: jsParser,
                markdown: mdParser.configure(GFM),
            }),
        ],
    }),
});
