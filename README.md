# prosemirror-lezer

> **Warning**
> This is an **experimental** plugin forked from [b-kelly/prosemirror-highlightjs](https://github.com/b-kelly/prosemirror-highlightjs). In its current state, this **should not be used in production**, as I'm not sure if I'll be maintaining this moving forward.

## Usage

```js
import { parser } from "@lezer/markdown";
import { highlightPlugin } from "prosemirror-lezer";

// parsers are keyed by language or optionally `*` as a fallback
const parsers = {
    "markdown": parser,
};

let state = new EditorView(..., {
  state: EditorState.create({
    doc: ...,
    plugins: [highlightPlugin(parsers)],
  })
});
```

Or import just the decoration parser and write your own plugin:

```js
import { getHighlightDecorations } from "prosemirror-lezer";

let plugin = new Plugin({
    state: {
        init(config, instance) {
            let content = getHighlightDecorations(
                instance.doc,
                parsers,
                blockTypes,
                languageExtractor
            );
            return DecorationSet.create(instance.doc, content);
        },
        apply(tr, set) {
            if (!tr.docChanged) {
                return set.map(tr.mapping, tr.doc);
            }

            let content = getHighlightDecorations(
                tr.doc,
                parsers,
                blockTypes,
                languageExtractor
            );
            return DecorationSet.create(tr.doc, content);
        },
    },
    props: {
        decorations(state) {
            return this.getState(state);
        },
    },
});
```
