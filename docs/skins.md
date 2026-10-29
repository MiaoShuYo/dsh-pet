# Skin packs

DSH Pet ships three original vector skins (`Kuro`, `Mochi`, `Pixel`) and lets
you import image skins as a single JSON file. The format is intentionally
small so a skin pack can live in a gist, a repository, or a chat message.

## Import / export

1. Open the pet panel (double-click the pet, or right-click it).
2. Go to **Look → Import skin** and choose a `.json` file.
3. The pack is validated, saved to `localStorage`, and selected immediately.
4. **Export skin** downloads the active custom pack; **Delete skin** removes it.

An invalid pack is rejected with a readable reason; the active skin does not
change.

## Format v1

```json
{
  "format": 1,
  "kind": "image",
  "id": "night-cat",
  "name": "Night Cat",
  "images": {
    "idle": "data:image/png;base64,iVBORw0KGgo...",
    "working": "data:image/png;base64,...",
    "waiting": "https://example.com/pet/waiting.png",
    "happy": "data:image/png;base64,...",
    "sad": "data:image/png;base64,...",
    "sleepy": "data:image/png;base64,...",
    "focusing": "data:image/png;base64,..."
  },
  "bubble": { "style": "light" }
}
```

| Field | Required | Rules |
|---|---|---|
| `format` | yes | Must be `1`. |
| `kind` | yes | Must be `image`; built-in vector skins are not importable packs. |
| `id` | yes | `[a-z0-9-]{1,40}`, unique, and not one of the built-in ids (`kuro`, `mochi`, `pixel`). |
| `name` | yes | 1–40 characters. |
| `images.idle` | yes | The fallback image for every state. |
| `images.working/waiting/happy/sad/sleepy/focusing` | no | Missing states use `idle`. |
| image value | — | `data:image/(png|jpeg|webp|gif);base64,...` or an `https:` URL. |
| `bubble.style` | no | `light` (default) or `dark`; reserved for future bubble tinting. |

### Limits

- One image: at most **512 KB** (decoded bytes, estimated from the base64
  payload).
- All images in one pack: at most **3 MB**.
- At most **20** custom packs.

### Security

- Only raster data URLs and `https:` image URLs are accepted. `http:`,
  `javascript:`, SVG data URLs and local file paths are rejected.
- SVG markup is never injected as HTML; the pet uses plain `<img>` elements.
- External `https:` images are fetched by the browser only when that skin is
  active. If you care about network privacy, use data URLs.
- Imported JSON is fully validated before it is stored.

## Built-in skins

| id | Name | Accessory | Palette |
|---|---|---|---|
| `kuro` | Kuro / 小黑 | scarf | midnight blue + cyan |
| `mochi` | Mochi / 奶团 | bow | cream + warm orange |
| `pixel` | Pixel / 像素 | headband | grey-blue + mint |

Built-ins are drawn as parameterized SVG in `src/client/mascot.js`; they adapt
to the DSH light/dark theme and never load external art.

## Sharing a pack

Open a pull request that adds a short entry to this document's **Community
packs** list with a link to the JSON (gist or repository) and a one-line
description. Do not submit art you do not have the right to distribute. The
project ships only original art and MIT-licensed code.
