/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DecorationSet } from "prosemirror-view";
import { createState, createStateImpl } from "./helpers";
import { TreeFragmentCache } from "../src";
import { schema } from "../src/sample-schema";
import { TextSelection, EditorState } from "prosemirror-state";

/** Helper function to "illegally" get the private contents of a DecorationCache */
function getCacheContents(cache: TreeFragmentCache) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error We don't want to expose .cache publicly, but... I don't care. I wrote it.
    return cache.cache;
}

function getDecorationsFromPlugin(editorState: EditorState) {
    const pluginState = editorState.plugins[0].getState(editorState) as {
        decorations: DecorationSet;
    };
    return pluginState.decorations;
}

describe("TreeFragmentCache", () => {
    it("should do basic CRUD operations", () => {
        // init with a pre-filled cache and check
        const initial = {
            0: {
                node: schema.node("code_block", { params: "test0" }),
                decorations: [],
            },
        };
        const cache = new TreeFragmentCache(initial);
        expect(getCacheContents(cache)).toStrictEqual(initial);

        // get existing
        expect(cache.get(0)).toStrictEqual(initial[0]);

        // get non-existing
        expect(cache.get(-1)).toBeNull();

        // set non-existing
        let node = schema.node("code_block", { params: "test10" });
        cache.set(10, node, []);
        expect(cache.get(10)).toStrictEqual({ node, decorations: [] });

        // set existing
        node = schema.node("code_block", { params: "test10 again" });
        cache.set(10, node, []);
        expect(cache.get(10)).toStrictEqual({ node, decorations: [] });

        // replace existing
        node = schema.node("code_block", { params: "test20" });
        cache.replace(10, 20, node, []);
        expect(cache.get(20)).toStrictEqual({ node, decorations: [] });

        // replace non-existing
        node = schema.node("code_block", { params: "test30" });
        cache.replace(-1, 30, node, []);
        expect(cache.get(30)).toStrictEqual({ node, decorations: [] });

        // remove existing
        cache.remove(30);
        expect(cache.get(30)).toBeNull();

        // remove non-existing
        expect(() => {
            cache.remove(-1);
        }).not.toThrow();
    });

    it("should not invalidate on a transaction that does not change the doc", () => {
        const state = createState(`**Hello** _world_!`, "javascript");
        const doc = state.doc;
        let tr = state.tr;

        const cache = new TreeFragmentCache({
            0: { node: doc.nodeAt(0)!, fragments: [] },
        });

        // add a transaction that doesn't alter the doc
        tr = tr.setSelection(TextSelection.create(tr.doc, 1, 5));

        // ensure the docs have not changed
        expect(tr.doc.eq(doc)).toBe(true);
        expect(tr.docChanged).toBe(false);

        // "invalidate" the cache
        const updatedCache = cache.invalidate(tr);

        expect(updatedCache.get(0)).toStrictEqual(cache.get(0));
    });

    it("should invalidate on a transaction that changes the doc", () => {
        const state = createState(`**Hello** _world_!`, "javascript");
        const doc = state.doc;
        let tr = state.tr;

        const cache = new TreeFragmentCache({
            0: { node: doc.nodeAt(0)!, decorations: [] },
        });

        // add a transaction that alters the doc
        tr = tr.insert(
            0,
            schema.node(
                "code_block",
                { params: "cpp" },
                schema.text(`cout << "hello world";`)
            )
        );

        // ensure the docs have changed
        expect(tr.doc.eq(doc)).toBe(false);
        expect(tr.docChanged).toBe(true);

        // invalidate the cache
        const updatedCache = cache.invalidate(tr);
        // get the new position of the old block from the transaction
        const newPos = tr.mapping.map(0);

        expect(updatedCache.get(newPos)).toStrictEqual(cache.get(0));
    });
});

describe("highlightPlugin", () => {
    it("should highlight with loaded language", () => {
        const state = createState(`**Hello** _world_!`, "markdown");

        const pluginState: DecorationSet = getDecorationsFromPlugin(state);

        // the decorations should be loaded
        expect(pluginState).not.toBe(DecorationSet.empty);
    });

    it("should skip highlighting on invalid/not loaded language", () => {
        const state = createState(`**Hello** _world_!`, "fake_language");

        // TODO check all props?
        const pluginState: DecorationSet = getDecorationsFromPlugin(state);

        // the decorations should NOT be loaded
        expect(pluginState).toBe(DecorationSet.empty);
    });

    it("should highlight multiple nodes", () => {
        const state = createStateImpl([
            {
                code: `**Hello** _world_!`,
                language: "markdown",
            },
            {
                code: `console.log("Hello world!");`,
                language: "javascript",
            },
        ]);

        // TODO check all props?
        const pluginState: DecorationSet = getDecorationsFromPlugin(state);

        // the decorations should be loaded
        expect(pluginState).not.toBe(DecorationSet.empty);

        // TODO try and check the actual content of the decorations
    });

    it.skip("should reuse cached decorations on updates that don't change the doc", () => {
        let state = createStateImpl([
            {
                code: `**Hello** _world_!`,
                language: "javascript",
            },
            {
                code: `just some text`,
                language: "plaintext",
            },
            {
                code: `Debug.Log("hello world");`,
                language: "csharp",
            },
        ]);

        const initialPluginState = state.plugins[0].getState(state) as {
            cache: TreeFragmentCache;
            decorations: DecorationSet;
        };
        expect(initialPluginState.decorations).not.toBe(DecorationSet.empty);

        // add a transaction that doesn't alter the doc
        const tr = state.tr.setSelection(
            TextSelection.create(state.tr.doc, 1, 5)
        );
        state = state.apply(tr);

        // get the updated state and check that it matches the old
        const updatedPluginState = state.plugins[0].getState(state) as {
            cache: TreeFragmentCache;
            decorations: DecorationSet;
        };
        expect(updatedPluginState).toStrictEqual(initialPluginState);
    });

    it.skip("should update some cache decorations when a single node is updated", () => {
        const blockContents = [
            {
                code: `**Hello** _world_!`,
                language: "javascript",
            },
            {
                code: `print("hello world")`,
                language: "python",
            },
            {
                code: `Debug.Log("hello world");`,
                language: "csharp",
            },
            {
                code: `just some text`,
                language: "plaintext",
            },
        ];
        let state = createStateImpl(blockContents);

        const initialPluginState = state.plugins[0].getState(state) as {
            cache: TreeFragmentCache;
            decorations: DecorationSet;
        };
        expect(initialPluginState.decorations).not.toBe(DecorationSet.empty);

        // get the positions of the blocks from the cache
        const initialPositions = Object.keys(
            getCacheContents(initialPluginState.cache)
        )
            .map((k) => +k)
            .sort();

        // plaintext blocks don't get *any* decorations, so expect the cache to not include these
        expect(initialPositions).toHaveLength(blockContents.length - 1);

        // add a transaction that alters the doc
        const addedText = "asdf "; // NOTE: use nonsense text so the highlighter doesn't pick it up
        const tr = state.tr.insertText(addedText, initialPositions[1] + 1);
        state = state.apply(tr);

        // get the updated state and check that the positions are offset as expected and the decorations match
        const updatedPluginState = state.plugins[0].getState(state) as {
            cache: TreeFragmentCache;
            decorations: DecorationSet;
        };
        const updatedPositions = Object.keys(
            getCacheContents(updatedPluginState.cache)
        )
            .map((k) => +k)
            .sort();

        // content after this node was untouched, so the position and data hasn't changed
        expect(updatedPositions[0]).toBe(initialPositions[0]);
        expect(updatedPluginState.cache.get(updatedPositions[0])).toStrictEqual(
            initialPluginState.cache.get(initialPositions[0])
        );

        // this node was touched; the position should not have changed, but the nodes and decorations will have
        let initialContent = initialPluginState.cache.get(initialPositions[1]);
        let updatedContent = updatedPluginState.cache.get(updatedPositions[1]);
        expect(updatedPositions[1]).toBe(initialPositions[1]);
        expect(updatedContent.node).not.toStrictEqual(initialContent.node);
        expect(updatedContent.node.textContent).toBe(
            addedText + initialContent.node.textContent
        );

        // updatedContent.decorations.forEach((d, i) => {
        //     const initial = initialContent.decorations[i];
        //     expect(d.from).toBe(initial.from + addedText.length);
        //     expect(d.to).toBe(initial.to + addedText.length);
        // });

        // this node was not touched, but its position, along with all the decorations, have been shifted forward
        initialContent = initialPluginState.cache.get(initialPositions[2]);
        updatedContent = updatedPluginState.cache.get(updatedPositions[2]);
        expect(updatedPositions[2]).toBe(
            initialPositions[2] + addedText.length
        );
        expect(updatedContent.node).toStrictEqual(initialContent.node);

        // updatedContent.decorations.forEach((d, i) => {
        //     const initial = initialContent.decorations[i];
        //     expect(d.from).toBe(initial.from + addedText.length);
        //     expect(d.to).toBe(initial.to + addedText.length);
        // });
    });
});
