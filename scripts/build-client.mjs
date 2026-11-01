/**
 * Zero-dependency client bundler.
 *
 * The DSH web client loads a plugin bundle as a lazy CommonJS factory:
 *
 *   window.__ModuleLoader__.load({ id, factory: (require) => exports })
 *
 * This script inlines our ESM sources (relative imports only; `react-dom` is
 * kept as an optional loader require) into that factory, strips import/export
 * syntax, verifies top-level names are unique, and writes `lib/client.js`.
 * `--check` fails when the committed bundle is stale.
 *
 * Run with: node scripts/build-client.mjs [--check]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(ROOT, 'src')
const ENTRY = resolve(SRC, 'client/index.js')
const OUTPUT = resolve(ROOT, 'lib/client.js')
const CHECK = process.argv.includes('--check')

const IMPORT_RE = /^import\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm
const EXPORT_DECL_RE = /^export\s+(async\s+function|function|class|const|let|var)\s+/gm
const EXPORT_LIST_RE = /^export\s*\{[^}]*\}\s*;?\s*$/gm
const DECL_RE = /^(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm

/**
 * Read a source file.
 * @param file - absolute path.
 * @returns file text.
 */
function readSource(file) {
  return readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
}

/**
 * Resolve one relative import.
 * @param importer - absolute importer path.
 * @param specifier - import specifier.
 * @returns absolute target path.
 */
function resolveImport(importer, specifier) {
  if (!specifier.startsWith('.')) {
    throw new Error(`Only relative imports are supported, got "${specifier}" in ${relative(ROOT, importer)}`)
  }
  const target = resolve(dirname(importer), specifier)
  if (!target.startsWith(SRC + sep)) throw new Error(`Import escapes src/: ${specifier}`)
  if (!target.endsWith('.js')) throw new Error(`Import must end in .js: ${specifier}`)
  if (!existsSync(target)) throw new Error(`Missing import: ${relative(ROOT, target)} (from ${relative(ROOT, importer)})`)
  return target
}

/**
 * Strip import/export syntax from one module.
 * @param file - absolute path.
 * @param source - module text.
 * @returns stripped text and its dependency paths.
 */
function transformModule(file, source) {
  const dependencies = []
  let text = source.replace(IMPORT_RE, (_match, bindings, specifier) => {
    if (specifier === 'react-dom') {
      // ReactDOM is provided by the Web Client module loader. Keep the access
      // optional so a host without it still loads the pet without a portal.
      return 'const __dshpReactDom = (() => { try { return require("react-dom") } catch (_error) { return null } })();'
        + `\nconst { ${bindings.trim()} } = __dshpReactDom || {}`
    }
    dependencies.push(resolveImport(file, specifier))
    return ''
  })
  if (/^\s*export\s+\*/m.test(text) || /^\s*export\s+default/m.test(text)) {
    throw new Error(`Unsupported export form in ${relative(ROOT, file)}`)
  }
  text = text.replace(EXPORT_LIST_RE, '')
  text = text.replace(EXPORT_DECL_RE, '$1 ')
  return { text: text.trim() + '\n', dependencies }
}

/**
 * Collect every top-level declaration name in one transformed module.
 * @param text - transformed module text.
 * @param file - source path for errors.
 * @returns names.
 */
function topLevelNames(text, file) {
  const names = []
  DECL_RE.lastIndex = 0
  let match = DECL_RE.exec(text)
  while (match !== null) {
    const name = match[1] || match[2]
    if (name) names.push(name)
    match = DECL_RE.exec(text)
  }
  for (const name of names) {
    if (name === 'React') throw new Error(`Do not declare React in ${relative(ROOT, file)}; the factory provides it`)
  }
  return names
}

/**
 * Recursively inline the dependency graph, post-order.
 * @returns ordered module records.
 */
function bundleModules() {
  const order = []
  const visited = new Set()
  const visiting = new Set()
  const owners = new Map()

  /**
   * Visit one module.
   * @param file - absolute path.
   * @returns undefined
   */
  function visit(file) {
    if (visited.has(file)) return
    if (visiting.has(file)) throw new Error(`Import cycle at ${relative(ROOT, file)}`)
    visiting.add(file)
    const transformed = transformModule(file, readSource(file))
    for (const dependency of transformed.dependencies) visit(dependency)
    visiting.delete(file)
    visited.add(file)
    for (const name of topLevelNames(transformed.text, file)) {
      const previous = owners.get(name)
      if (previous !== undefined) {
        throw new Error(`Duplicate top-level name "${name}" in ${relative(ROOT, file)} and ${relative(ROOT, previous)}`)
      }
      owners.set(name, file)
    }
    order.push({ file, text: transformed.text })
  }

  visit(ENTRY)
  return order
}

/**
 * Build the loader wrapper.
 * @param modules - ordered module records.
 * @param id - package name.
 * @returns bundle text.
 */
function render(modules, id) {
  const chunks = []
  chunks.push('/* Generated by scripts/build-client.mjs - do not edit by hand. */')
  chunks.push('window.__ModuleLoader__.load({')
  chunks.push(`  id: ${JSON.stringify(id)},`)
  chunks.push('  factory: (require) => {')
  chunks.push('    var module = { exports: {} }')
  chunks.push('    var exports = module.exports')
  chunks.push('    const React = require("react")')
  for (const module of modules) {
    chunks.push('')
    chunks.push(`    /* ---- ${relative(ROOT, module.file).replace(/\\/g, '/')} ---- */`)
    for (const line of module.text.split('\n')) {
      chunks.push(line === '' ? '' : '    ' + line)
    }
  }
  chunks.push('')
  chunks.push('    exports.apply = apply')
  chunks.push('    exports.inject = inject')
  chunks.push('    return module.exports')
  chunks.push('  },')
  chunks.push('})')
  chunks.push(`//# sourceURL=${id}/client.js`)
  chunks.push('')
  return chunks.join('\n')
}

const packageJson = JSON.parse(readSource(resolve(ROOT, 'package.json')))
const modules = bundleModules()
const names = new Set()
for (const module of modules) {
  for (const name of topLevelNames(module.text, module.file)) names.add(name)
}
if (!names.has('apply')) throw new Error('The entry module must declare apply()')
if (!names.has('inject')) throw new Error('The entry module must declare inject')
const output = render(modules, packageJson.name)

if (CHECK) {
  if (!existsSync(OUTPUT)) {
    console.error('lib/client.js is missing. Run: npm run build')
    process.exit(1)
  }
  const current = readSource(OUTPUT)
  if (current !== output) {
    console.error('lib/client.js is stale. Run: npm run build')
    process.exit(1)
  }
  console.log(`lib/client.js is up to date (${modules.length} modules)`)
} else {
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, output, 'utf8')
  console.log(`Wrote ${relative(ROOT, OUTPUT)} (${modules.length} modules, ${output.length} bytes)`)
}
