# captcha-kit

> Codename: **Capsule** — a modular, self-hosted CAPTCHA toolkit.

Modular, open-source CAPTCHA library with multiple challenge types. Pick and combine only the modules you need — text, math, image selection, slider, rotate, odd-one-out, drag-drop, and behavioral challenges — all with mandatory server-side validation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE.md)
[![npm version](https://img.shields.io/npm/v/captcha-kit.svg)](https://www.npmjs.com/package/captcha-kit)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

---

## Why captcha-kit?

Most open-source CAPTCHA libraries force you into one challenge type. **captcha-kit** is modular — install only what you need, self-host it, and combine challenge types for stronger bot resistance without vendor lock-in.

- 🧩 **Modular** — use one module or all eight
- 🔒 **Server-side validation is mandatory** — never trust the frontend
- 📦 **Lightweight** — framework-agnostic core, zero-dependency by default
- ♿ **Accessible** — ARIA support and keyboard-friendly challenges
- 🛠️ **Easy to integrate** — npm install + a few lines of code

---

## Challenge Modules

| Module | Description | Bot Resistance |
|---|---|---|
| `text` | Distorted text with noise/lines | Low–Medium |
| `math` | Simple arithmetic | Very Low |
| `image-select` | "Select all images containing X" | Medium |
| `slider` | Drag puzzle piece to correct position | Medium–High |
| `rotate` | Rotate image to correct orientation | Medium |
| `odd-one-out` | Click the image that doesn't belong | Medium |
| `drag-drop` | Drag items to correct categories | Medium–High |
| `behavioral` | Mouse movement, timing, fingerprinting | High |

> **Coming later:** a separate [Opposite/Reverse CAPTCHA](https://github.com/JOKER-53/opposite-captcha) project, built on the same core.

---

## Installation

```bash
npm install captcha-kit
```

## Quick Start

```js
import { Captcha } from "captcha-kit/core";
import { MathChallenge } from "captcha-kit/math";

const captcha = new Captcha({ type: MathChallenge });
const challenge = await captcha.generate();

// send challenge to client, validate response server-side
const isValid = await captcha.validate(challenge.token, userResponse);
```

Full docs and framework examples are in [`/docs`](./docs) and [`/examples`](./examples).

---

## Project Status

🚧 Early development — following a phased roadmap (core → challenge modules → frontend → docs → v0.1.0 release). See [open issues](../../issues) for progress.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.

## Security

Found a vulnerability? Please **do not** open a public issue. See [SECURITY.md](./SECURITY.md) for responsible disclosure.

## License

MIT © [KADHIRAVANEG](https://github.com/JOKER-53) — see [LICENSE.md](./LICENSE.md)
