Stockfish.js 19.0.1 / Stockfish 19
================================

Boss gameplay uses the unmodified `stockfish-19-lite-single.js` and matching
WebAssembly binary from the pinned `stockfish@19.0.1` npm package.
The Vite plugin serves these files locally in development and includes them in
production output under `/stockfish/`, along with the GPL v3 license (`Copying.txt`).

Copyright 2026 Chess.com, LLC, the Stockfish developers, and other contributors.
Stockfish.js engine code is licensed under GPL v3.

Package and corresponding source:
- https://www.npmjs.com/package/stockfish/v/19.0.1
- https://github.com/nmrugg/stockfish.js/tree/v19.0.1
- https://github.com/nmrugg/stockfish.js/archive/refs/tags/v19.0.1.tar.gz

Build instructions are in the upstream README and `build.js`. This application
does not modify the distributed engine or its neural network.
