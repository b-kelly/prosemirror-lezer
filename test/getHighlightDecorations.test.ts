import { parser } from "@lezer/markdown";
import { DOMParser, Schema } from "prosemirror-model";
import type { Decoration } from "prosemirror-view";
import { getHighlightDecorations } from "../src";
import { createDoc, escapeHtml } from "./helpers";

const parsers = {
    markdown: parser,
};

describe("getHighlightDecorations", () => {
    it("should do basic highlighting", () => {
        const doc = createDoc([
            { code: `**Hello** _world_!`, language: "markdown" },
        ]);
        const decorations = getHighlightDecorations(
            doc,
            parsers,
            ["code_block"],
            (node) => {
                expect(node).not.toBeNull();
                expect(node.type.name).toBe("code_block");
                return "markdown";
            }
        );

        expect(decorations).toBeTruthy();
        expect(decorations).not.toHaveLength(0);
    });

    it("should be resilient to bad params", () => {
        const doc = createDoc([
            { code: `**Hello** _world_!`, language: "markdown" },
        ]);

        // null doc
        // @ts-expect-error TS errors as we'd expect, but I want to simulate a JS consumer passing in bad vals
        let decorations = getHighlightDecorations(null, null, null, null);
        expect(decorations).toBeTruthy();
        expect(decorations).toHaveLength(0);

        // null parsers
        // @ts-expect-error More errors...
        decorations = getHighlightDecorations(doc, null, null, null);
        expect(decorations).toBeTruthy();
        expect(decorations).toHaveLength(0);

        // null nodeTypes
        // @ts-expect-error You guessed it...
        decorations = getHighlightDecorations(doc, parser, null, null);
        expect(decorations).toBeTruthy();
        expect(decorations).toHaveLength(0);

        // empty nodeTypes
        // @ts-expect-error Still...
        decorations = getHighlightDecorations(doc, parser, [], null);
        expect(decorations).toBeTruthy();
        expect(decorations).toHaveLength(0);

        // empty nodeTypes
        // @ts-expect-error Still...
        decorations = getHighlightDecorations(doc, parser, [], null);
        expect(decorations).toBeTruthy();
        expect(decorations).toHaveLength(0);

        // empty languageExtractor
        decorations = getHighlightDecorations(
            doc,
            parsers,
            ["markdown"],
            // @ts-expect-error Last one...
            null
        );
        expect(decorations).toBeTruthy();
        expect(decorations).toHaveLength(0);
    });

    it.skip("should not highlight on a missing language with no fallback", () => {
        const doc = createDoc([
            { code: `System.out.println("hello world!");` },
        ]);
        const decorations = getHighlightDecorations(
            doc,
            parsers,
            ["code_block"],
            () => null
        );

        expect(decorations).toBeTruthy();
        expect(decorations).not.toHaveLength(0);
    });

    it.skip("should highlight on a missing language when a fallback is set", () => {
        const doc = createDoc([
            { code: `System.out.println("hello world!");` },
        ]);
        const decorations = getHighlightDecorations(
            doc,
            parsers,
            ["code_block"],
            () => null
        );

        expect(decorations).toBeTruthy();
        expect(decorations).not.toHaveLength(0);
    });

    it("should cancel on non-null prerender", () => {
        const doc = createDoc([
            { code: `**Hello** _world_!`, language: "markdown" },
        ]);
        const decorations = getHighlightDecorations(
            doc,
            parsers,
            ["code_block"],
            () => "markdown",
            {
                preRenderer: (node, pos) => {
                    expect(node).not.toBeNull();
                    expect(node.type.name).toBe("code_block");
                    expect(typeof pos === "number").toBe(true);
                    return [];
                },
            }
        );

        expect(decorations).toBeTruthy();
        expect(decorations).toHaveLength(0);
    });

    it("should continue on null prerender", () => {
        const doc = createDoc([
            { code: `**Hello** _world_!`, language: "markdown" },
        ]);
        const decorations = getHighlightDecorations(
            doc,
            parsers,
            ["code_block"],
            () => "markdown",
            {
                preRenderer: () => null,
            }
        );

        expect(decorations).toBeTruthy();
        expect(decorations).not.toHaveLength(0);
    });

    it("should call postrender", () => {
        let renderedDecorations: Decoration[] = [];

        const doc = createDoc([
            { code: `**Hello** _world_!`, language: "markdown" },
        ]);
        const decorations = getHighlightDecorations(
            doc,
            parsers,
            ["code_block"],
            () => "markdown",
            {
                postRenderer: (node, pos, decos) => {
                    expect(node).not.toBeNull();
                    expect(node.type.name).toBe("code_block");
                    expect(typeof pos).toBe("number");

                    renderedDecorations = decos;
                },
            }
        );

        expect(decorations).toBeTruthy();
        expect(decorations).not.toHaveLength(0);
        expect(decorations).toEqual(renderedDecorations);
    });

    it("should support highlighting the doc node itself", () => {
        const schema = new Schema({
            nodes: {
                text: {
                    group: "inline",
                },
                doc: {
                    content: "text*",
                },
            },
        });
        const element = document.createElement("div");
        element.innerHTML = escapeHtml(`**Hello** _world_!`);

        const doc = DOMParser.fromSchema(schema).parse(element);
        const decorations = getHighlightDecorations(
            doc,
            parsers,
            ["doc"],
            () => "markdown"
        );

        expect(decorations).toBeTruthy();
        expect(Object.keys(decorations)).toHaveLength(6);
    });
});
