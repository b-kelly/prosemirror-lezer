import { ChangedRange, TreeFragment } from "@lezer/common";
import { Highlighter } from "@lezer/highlight";
import { Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin, PluginKey, Transaction } from "prosemirror-state";
import { DecorationSet } from "prosemirror-view";
import {
    getHighlightDecorations,
    ParserCollection,
} from "./getHighlightDecorations";

/**
 * Describes the current state of the highlightPlugin
 * @internal
 */
export interface HighlightPluginState {
    cache: TreeFragmentCache;
    decorations: DecorationSet;
}

/**
 * Represents a cache of doc positions to the node and parsed tree fragments
 * @internal
 */
export class TreeFragmentCache {
    private cache: {
        [pos: number]: {
            node: ProseMirrorNode;
            fragments: readonly TreeFragment[];
        };
    };

    constructor(cache: {
        [pos: number]: {
            node: ProseMirrorNode;
            fragments: readonly TreeFragment[];
        };
    }) {
        this.cache = { ...cache };
    }

    /**
     * Gets the cache entry at the given doc position, or null if it doesn't exist
     * @param pos The doc position of the node you want the cache for
     */
    get(pos: number): {
        node: ProseMirrorNode;
        fragments: readonly TreeFragment[];
    } {
        return this.cache[pos] || null;
    }

    /**
     * Sets the cache entry at the given position with the give node/decoration values
     * @param pos The doc position of the node to set the cache for
     * @param node The node to place in cache
     * @param fragments The decorations to place in cache
     */
    set(
        pos: number,
        node: ProseMirrorNode,
        fragments: readonly TreeFragment[]
    ): void {
        if (pos < 0) {
            return;
        }

        this.cache[pos] = { node, fragments };
    }

    /**
     * Removes the value at the oldPos (if it exists) and sets the new position to the given values
     * @param oldPos The old node position to overwrite
     * @param newPos The new node position to set the cache for
     * @param node The new node to place in cache
     * @param decorations The new decorations to place in cache
     */
    replace(
        oldPos: number,
        newPos: number,
        node: ProseMirrorNode,
        fragments: readonly TreeFragment[]
    ): void {
        this.remove(oldPos);
        this.set(newPos, node, fragments);
    }

    /**
     * Removes the cache entry at the given position
     * @param pos The doc position to remove from cache
     */
    remove(pos: number): void {
        delete this.cache[pos];
    }

    /**
     * Invalidates the cache by annotating entries on nodes that have changed,
     * updating the positions of the nodes that haven't and removing all the entries that have been deleted;
     * NOTE: this does not affect the current cache, but returns an entirely new one
     * @param tr A transaction to map the current cache to
     */
    invalidate(tr: Transaction): TreeFragmentCache {
        const returnCache = new TreeFragmentCache(this.cache);
        const mapping = tr.mapping;
        Object.keys(this.cache).forEach((k) => {
            const pos = +k;

            if (pos < 0) {
                return;
            }

            const result = mapping.mapResult(pos);
            const mappedNode = tr.doc.nodeAt(result.pos);
            const { node, fragments } = this.get(pos);

            const changes = tr.mapping.maps.flatMap((s) => {
                const changes: ChangedRange[] = [];
                s.forEach(
                    (
                        oldStart: number,
                        oldEnd: number,
                        newStart: number,
                        newEnd: number
                    ) => {
                        changes.push({
                            fromA: oldStart,
                            toA: oldEnd,
                            fromB: newStart,
                            toB: newEnd,
                        });
                    }
                );
                return changes;
            });

            if (result.deleted || !mappedNode?.eq(node)) {
                returnCache.remove(pos);
            } else if (pos !== result.pos) {
                returnCache.replace(
                    pos,
                    result.pos,
                    mappedNode,
                    TreeFragment.applyChanges(fragments, changes)
                );
            }
        });

        return returnCache;
    }
}

/**
 * Creates a plugin that highlights the contents of all nodes (via Decorations) with a type passed in blockTypes
 * @param parsers An object containing pre-configured lezer parsers keyed by language; supports "*" as a fallback
 * @param nodeTypes An array containing all the node types to target for highlighting
 * @param languageExtractor A method that is passed a prosemirror node and returns the language string to use when highlighting that node; defaults to using `node.attrs.params`
 * @param highlighter The highlighter to use when highlighting the tree; defaults to {@link @lezer/highlight.classHighlighter} if unset
 * @public
 */
export function highlightPlugin(
    parsers: ParserCollection,
    nodeTypes: string[] = ["code_block"],
    languageExtractor?: (node: ProseMirrorNode) => string,
    highlighter?: Highlighter
): Plugin<HighlightPluginState> {
    const extractor =
        languageExtractor ||
        function (node: ProseMirrorNode) {
            const detectedLanguage = node.attrs
                .detectedHighlightLanguage as string;
            const params = node.attrs.params as string;
            return detectedLanguage || params?.split(" ")[0] || "";
        };

    const getDecos = (doc: ProseMirrorNode, cache: TreeFragmentCache) => {
        const content = getHighlightDecorations(
            doc,
            parsers,
            nodeTypes,
            extractor,
            {
                preRenderer: (_, pos) => cache.get(pos)?.fragments,
                postRenderer: (b, pos, decorations) => {
                    cache.set(pos, b, decorations);
                },
                highlighter,
            }
        );

        return { content };
    };

    // key the plugin so we can easily find it in the state later
    const key = new PluginKey<HighlightPluginState>();

    return new Plugin<HighlightPluginState>({
        key,
        state: {
            init(_, instance) {
                const cache = new TreeFragmentCache({});
                const result = getDecos(instance.doc, cache);
                return {
                    cache: cache,
                    decorations: DecorationSet.create(
                        instance.doc,
                        result.content
                    ),
                };
            },
            apply(tr, data) {
                const updatedCache = data.cache.invalidate(tr);
                if (!tr.docChanged) {
                    return {
                        cache: updatedCache,
                        decorations: data.decorations.map(tr.mapping, tr.doc),
                    };
                }

                const result = getDecos(tr.doc, updatedCache);

                return {
                    cache: updatedCache,
                    decorations: DecorationSet.create(tr.doc, result.content),
                };
            },
        },
        props: {
            decorations(this: Plugin<HighlightPluginState>, state) {
                return this.getState(state)?.decorations;
            },
        },
    });
}
