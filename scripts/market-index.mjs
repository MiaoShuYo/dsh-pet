/**
 * Generate the DSH plugin-market index from git tags.
 *
 * Every `vX.Y.Z` tag becomes one installable version whose git source points
 * at the tagged commit. CI runs this on a release tag and deploys `site/` to
 * GitHub Pages; the index is also usable locally for review.
 *
 * Run with: npm run market:index
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = resolve(ROOT, 'site/index.json')
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))

/**
 * Run git and return trimmed stdout.
 * @param args - git arguments.
 * @returns stdout.
 */
function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

/**
 * Normalize a git remote URL to a browser URL.
 * @param remote - remote URL.
 * @returns https URL without `.git`.
 */
function normalizeRemote(remote) {
  let value = remote.trim().replace(/^git\+/, '').replace(/\.git$/, '')
  const scp = /^git@([^:]+):(.+)$/.exec(value)
  if (scp !== null) return `https://${scp[1]}/${scp[2]}`
  const ssh = /^ssh:\/\/git@([^/]+)\/(.+)$/.exec(value)
  if (ssh !== null) return `https://${ssh[1]}/${ssh[2]}`
  return value
}

/**
 * Compare two semver strings, descending-safe.
 * @param left - version.
 * @param right - version.
 * @returns negative when left is older.
 */
function compareVersions(left, right) {
  const parse = (value) => {
    const [core, pre = ''] = String(value).split('+')[0].split('-', 2)
    const numbers = core.split('.').map((part) => Number(part) || 0)
    return { numbers, pre }
  }
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index += 1) {
    const difference = (a.numbers[index] || 0) - (b.numbers[index] || 0)
    if (difference !== 0) return difference
  }
  if (a.pre === b.pre) return 0
  if (a.pre === '') return 1
  if (b.pre === '') return -1
  return a.pre < b.pre ? -1 : 1
}

/**
 * Read package.json at one git ref.
 * @param ref - tag or commit.
 * @returns parsed manifest.
 */
function packageAt(ref) {
  return JSON.parse(git(['show', `${ref}:package.json`]))
}

let repo = process.env.MARKET_REPO_URL || ''
if (repo === '' && process.env.GITHUB_REPOSITORY) {
  repo = `https://github.com/${process.env.GITHUB_REPOSITORY}`
}
if (repo === '') {
  try {
    repo = normalizeRemote(git(['remote', 'get-url', 'origin']))
  } catch (_error) {
    repo = ''
  }
}
if (repo === '') {
  repo = 'https://github.com/OWNER/dsh-pet'
  console.warn('warning: no origin remote or GITHUB_REPOSITORY; using ' + repo)
}

let tags = []
try {
  tags = git(['tag', '--list', 'v*', '--sort=creatordate']).split('\n').map((tag) => tag.trim()).filter(Boolean)
} catch (_error) {
  tags = []
}

const versions = []
if (tags.length === 0) {
  const commit = git(['rev-parse', 'HEAD'])
  const timestamp = Number(git(['log', '-1', '--format=%ct', 'HEAD']))
  console.warn('warning: no v* tags; publishing the current HEAD as ' + pkg.version)
  versions.push({
    version: pkg.version,
    publishTimestamp: Number.isFinite(timestamp) ? timestamp : Math.floor(Date.now() / 1000),
    source: { type: 'git', url: repo, commit },
    engines: { dsh: pkg.engines?.dsh || '>=0.2.0-rc.2 <0.3.0' },
  })
} else {
  for (const tag of tags) {
    let manifest
    try {
      manifest = packageAt(tag)
    } catch (error) {
      console.warn(`warning: skipping ${tag}: ${error.message}`)
      continue
    }
    const version = manifest.version
    if (typeof version !== 'string') {
      console.warn(`warning: skipping ${tag}: no version`)
      continue
    }
    let commit = ''
    let timestamp = 0
    try {
      commit = git(['rev-list', '-n', '1', tag])
      timestamp = Number(git(['log', '-1', '--format=%ct', tag]))
    } catch (error) {
      console.warn(`warning: skipping ${tag}: ${error.message}`)
      continue
    }
    if (!/^[0-9a-f]{40}$/.test(commit)) {
      console.warn(`warning: skipping ${tag}: bad commit`)
      continue
    }
    versions.push({
      version,
      publishTimestamp: Number.isFinite(timestamp) ? timestamp : Math.floor(Date.now() / 1000),
      source: { type: 'git', url: repo, commit },
      engines: { dsh: manifest.engines?.dsh || pkg.engines?.dsh || '>=0.2.0-rc.2 <0.3.0' },
    })
  }
}

versions.sort((left, right) => compareVersions(right.version, left.version))

const index = {
  format: 1,
  title: { en: 'DSH Pet', zh: 'DSH 桌宠' },
  description: {
    en: 'An in-app desktop pet with balance, token and context alerts.',
    zh: '应用内桌面宠物：余额、token、上下文占用提醒。',
  },
  metadata: {
    categories: {
      plugins: { title: { en: 'Plugins', zh: '插件' } },
    },
    labels: {
      pet: { title: { en: 'Pet', zh: '桌宠' } },
      tokens: { title: { en: 'Tokens', zh: 'Token' } },
      balance: { title: { en: 'Balance', zh: '余额' } },
    },
  },
  plugins: [{
    name: pkg.name,
    title: { en: 'DSH Pet', zh: 'DSH 桌宠' },
    description: {
      en: 'A draggable in-app pet that shows account balance, session tokens, context pressure and alerts.',
      zh: '可拖动的应用内桌宠：显示账户余额、本会话 token、上下文占用，并做提醒。',
    },
    icon: 'icons/pet.svg',
    author: pkg.author || 'DSH Pet contributors',
    homepage: repo + '#readme',
    repository: { url: repo },
    metadata: { category: 'plugins', labels: ['pet', 'tokens', 'balance'] },
    versions,
  }],
}

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, JSON.stringify(index, null, 2) + '\n', 'utf8')
console.log(`Wrote site/index.json (${versions.length} version${versions.length === 1 ? '' : 's'}, source ${repo})`)
