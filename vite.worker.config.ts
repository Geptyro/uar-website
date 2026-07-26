import { defineConfig } from 'vite';

/**
 * Second build pass: the replay parsing worker, bundled next to the server
 * output as `build/replay-worker.mjs`.
 *
 * SvelteKit's build emits hashed chunks with no stable entry we could point
 * a Worker at, and the runtime image ships only `build/` — so the worker
 * needs its own self-contained file. `emptyOutDir` stays off because
 * adapter-node has already written the server into the same directory.
 */
export default defineConfig({
	build: {
		ssr: true,
		outDir: 'build',
		emptyOutDir: false,
		minify: false,
		target: 'node22',
		rollupOptions: {
			input: 'src/lib/server/replay/worker.ts',
			output: { entryFileNames: 'replay-worker.mjs', format: 'esm' }
		}
	}
});
