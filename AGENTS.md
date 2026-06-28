# AGENTS.md

## Cursor Cloud specific instructions

Risuko is a Tauri v2 desktop download manager: a Vue 3 + Vite renderer plus a Rust
backend (`src-tauri/`) with an in-process download engine. See `README.md` and
`docs/CONTRIBUTING.md` for standard usage; the notes below cover only non-obvious,
cloud-environment caveats.

### Running the desktop app
- Run dev mode with `DISPLAY=:1 pnpm run dev`. A virtual X display is available at
  `:1`; the `DISPLAY` env var must be set or the Tauri window cannot open.
- `pnpm run dev` runs Vite on `127.0.0.1:9080` (via `beforeDevCommand`) and then
  compiles + launches the Rust shell, which embeds the download engine (JSON-RPC on
  `127.0.0.1:16800`). No separate database/services are needed for desktop dev.
- The first `tauri dev` cold-compiles the whole Rust workspace (several minutes on
  this VM's 4 cores). Subsequent incremental rebuilds are fast (~45s).
- Benign runtime noise to ignore: `libEGL ... DRI3` warnings (software rendering on
  the virtual display) and repeated `Gtk-WARNING ... no accelerator ... GtkMenuItem`
  lines. These do not affect functionality.

### Rust toolchain
- `src-tauri/Cargo.toml` declares `rust-version = "1.85"`, but the committed
  `Cargo.lock` pulls transitive deps (e.g. `time`, `zbus`, `serde_with`) that require
  `rustc >= 1.88`. Use the `stable` toolchain (`rustup default stable`); 1.85 will
  fail to resolve.

### Tests / lint / typecheck
- Rust tests: `cd src-tauri && cargo test --workspace` (the full suite passes; there
  is no `cargo test` step in CI). There is no JS/Vue test runner in this repo.
- JS/Vue lint+format: `pnpm fmt` (Biome, writes fixes; excludes `src-tauri/`).
- Typecheck: `pnpm typecheck` (`vue-tsc`).
- The Husky pre-commit hook runs `pnpm pre-commit` (= `pnpm typecheck` + `pnpm fmt`).
