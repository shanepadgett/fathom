// Makes "ph-#{ICON}" classes from Phosphor's regular icons. Icons size to the
// current font size. FATHOM_PHOSPHOR_ICONS names the directory of SVGs: the
// phosphor_icons dependency when the host builds, the copy shipped in the
// release when Fathom builds local plugin CSS.
const plugin = require("tailwindcss/plugin")
const fs = require("fs")
const path = require("path")

module.exports = plugin(function({matchComponents}) {
  let iconsDir = process.env.FATHOM_PHOSPHOR_ICONS
  if (!iconsDir) throw new Error("FATHOM_PHOSPHOR_ICONS is not set")
  let values = {}
  fs.readdirSync(iconsDir).forEach(file => {
    let name = path.basename(file, ".svg")
    values[name] = {name, fullPath: path.join(iconsDir, file)}
  })
  matchComponents({
    "ph": ({name, fullPath}) => {
      let content = fs.readFileSync(fullPath).toString().replace(/\r?\n|\r/g, "")
      content = encodeURIComponent(content)
      return {
        [`--ph-${name}`]: `url('data:image/svg+xml;utf8,${content}')`,
        "-webkit-mask": `var(--ph-${name})`,
        "mask": `var(--ph-${name})`,
        "mask-repeat": "no-repeat",
        "mask-size": "100% 100%",
        "background-color": "currentColor",
        "vertical-align": "middle",
        "display": "inline-block",
        "width": "1em",
        "height": "1em"
      }
    }
  }, {values})
})
