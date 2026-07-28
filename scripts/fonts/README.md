# Card fonts

The two typefaces the site uses, as static TTFs, for `scripts/build-og.ts`.

They are vendored rather than read from `node_modules` because the renderer
cannot use what is there. resvg loads fonts through fontdb, which reads TTF and
OTF but **not woff2** — and woff2 is the only format
`@fontsource-variable/*` ships. A woff2 passed to resvg is not an error: it is
ignored, and every card renders with the text silently missing. The Docker
builder (`node:22-alpine`) has no system fonts to fall back on either, so the
generator turns system-font lookup off and passes these files explicitly.

They are also *instanced*: resvg's variable-font support does not reliably honour
`font-weight`, so each weight is baked into its own static file.

Derived from the `@fontsource-variable/inter` and
`@fontsource-variable/jetbrains-mono` latin subsets already in
`package.json`. Both are SIL OFL 1.1; the licences sit next to the files.

## Regenerating

Only needed when those packages are upgraded.

```sh
cd scripts/fonts
cp ../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2 .
cp ../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2 .
woff2_decompress inter-latin-wght-normal.woff2
woff2_decompress jetbrains-mono-latin-wght-normal.woff2
python3 instance.py          # writes Inter-Regular/Bold and JetBrainsMono-Medium
rm ./*.woff2 ./*-wght-normal.ttf
```

`instance.py` sits beside this file. It needs `fonttools`; the coverage it
subsets to is Latin-1 plus the punctuation the cards use, which is wider than
any unit name, role or clan tag in the data.
