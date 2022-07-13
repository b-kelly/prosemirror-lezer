import type { Parser } from "@lezer/common";
import { classHighlighter, highlightTree } from "@lezer/highlight";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Decoration } from "prosemirror-view";

/**
 * Gets all nodes with a type in nodeTypes from a document
 * @param doc The document to search
 * @param nodeTypes The types of nodes to get
 */
function getNodesOfType(
    doc: ProseMirrorNode,
    nodeTypes: string[]
): { node: ProseMirrorNode; pos: number }[] {
    const blocks: { node: ProseMirrorNode; pos: number }[] = [];

    if (nodeTypes.includes("doc")) {
        blocks.push({ node: doc, pos: -1 });
    }

    doc.descendants((child, pos) => {
        if (child.isBlock && nodeTypes.indexOf(child.type.name) > -1) {
            blocks.push({
                node: child,
                pos: pos,
            });

            return false;
        }

        return;
    });

    return blocks;
}

/**
 * Options to alter the behavior of getHighlightDecorations
 * @public
 */
interface GetHighlightDecorationsOptions {
    /**
     * A method that is called before the render process begins where any non-null return value cancels the render; useful for decoration caching on untouched nodes
     * @param block The node that is about to render
     * @param pos The position in the document of the node
     * @returns An array of the decorations that should be used instead of rendering; cancels the render if a non-null value is returned
     */
    preRenderer?: (block: ProseMirrorNode, pos: number) => Decoration[] | null;

    /**
     * A method that is called after the render process ends with the result of the node render passed; useful for decoration caching
     * @param block The node that was renderer
     * @param pos The position of the node in the document
     * @param decorations The decorations that were rendered for this node
     */
    postRenderer?: (
        block: ProseMirrorNode,
        pos: number,
        decorations: Decoration[]
    ) => void;
}

/**
 * A collection of lezer parsers keyed by language id or `*` as a fallback
 * @public
 */
export type ParserCollection = Record<string | "*", Parser>;

/**
 * Gets all highlighting decorations from a ProseMirror document
 * @param doc The doc to search applicable blocks to highlight
 * @param parsers An object containing pre-configured lezer parsers keyed by language; supports "*" as a fallback
 * @param nodeTypes An array containing all the node types to target for highlighting
 * @param languageExtractor A method that is passed a prosemirror node and returns the language string to use when highlighting that node
 * @param options The options to alter the behavior of getHighlightDecorations
 * @public
 */
export function getHighlightDecorations(
    doc: ProseMirrorNode,
    parsers: ParserCollection,
    nodeTypes: string[],
    languageExtractor: (node: ProseMirrorNode) => string | null,
    options?: GetHighlightDecorationsOptions
): Decoration[] {
    if (!doc || !doc.nodeSize || !nodeTypes?.length || !languageExtractor) {
        return [];
    }

    const blocks = getNodesOfType(doc, nodeTypes);

    let decorations: Decoration[] = [];

    blocks.forEach((b) => {
        // attempt to run the prerenderer if it exists
        if (options?.preRenderer) {
            const prerenderedDecorations = options.preRenderer(b.node, b.pos);

            // if the returned decorations are non-null, use them instead of rendering our own
            if (prerenderedDecorations) {
                decorations = [...decorations, ...prerenderedDecorations];
                return;
            }
        }

        const language = languageExtractor(b.node) || "*";
        const parser = parsers[language] || parsers["*"] || null;

        // if a parser is not found for this language, skip highlighting
        if (!parser) {
            return;
        }

        const result = parser.parse(b.node.textContent);

        const localDecorations: Decoration[] = [];

        highlightTree(result, classHighlighter, (from, to, classes) => {
            const decoration = Decoration.inline(
                from + b.pos + 1,
                to + b.pos + 1,
                {
                    class: classes,
                }
            );

            localDecorations.push(decoration);
        });

        // TODO Store the tree in the cache as well so we can do incremental parsing
        if (options?.postRenderer) {
            options.postRenderer(b.node, b.pos, localDecorations);
        }

        decorations = [...decorations, ...localDecorations];
    });

    return decorations;
}
