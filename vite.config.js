import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
    build: {
        lib: {
            entry: resolve("src/index.ts"),
            name: "prosemirror-highlightjs",
            fileName: "index",
        },
        rollupOptions: {
            external: [
                "prosemirror-model",
                "prosemirror-state",
                "prosemirror-view",
                "@lezer/common",
                "@lezer/highlight",
            ],
            output: {
                globals: {},
            },
        },
    },
    plugins: [dts()],
});
