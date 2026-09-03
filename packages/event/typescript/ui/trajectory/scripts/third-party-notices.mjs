import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const outputFile = 'THIRD_PARTY_NOTICES.md'
const legalFileName = /^(?:licen[cs]e|copying|notices?|third[-_ ]party(?:[-_ ]notices?)?|patents?)(?:[._ -]|$)/i

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function packageRootForModule(moduleId) {
  const queryIndex = moduleId.indexOf('?')
  const cleanId = (queryIndex === -1 ? moduleId : moduleId.slice(0, queryIndex))
    .replaceAll('\0', '')
    .replaceAll('\\', '/')
  const marker = '/node_modules/'
  const markerIndex = cleanId.lastIndexOf(marker)
  if (markerIndex === -1) return undefined

  const packagePath = cleanId.slice(markerIndex + marker.length).split('/')
  const segmentCount = packagePath[0]?.startsWith('@') ? 2 : 1
  if (packagePath.length < segmentCount) return undefined

  return cleanId.slice(0, markerIndex + marker.length)
    + packagePath.slice(0, segmentCount).join('/')
}

function declaredLicense(manifest) {
  if (typeof manifest.license === 'string' && manifest.license.trim()) {
    return manifest.license.trim()
  }
  if (manifest.license && typeof manifest.license.type === 'string') {
    return manifest.license.type.trim()
  }
  return undefined
}

function escapeTableCell(value) {
  return value.replaceAll('|', '\\|').replace(/\r?\n/g, ' ')
}

function fencedText(value) {
  const longestRun = Math.max(0, ...Array.from(value.matchAll(/`+/g), match => match[0].length))
  const fence = '`'.repeat(Math.max(4, longestRun + 1))
  return `${fence}\n${value.trimEnd()}\n${fence}`
}

function readPackage(packageRoot, fail) {
  const manifestPath = join(packageRoot, 'package.json')
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    fail(`Cannot read bundled package metadata at ${manifestPath}: ${error.message}`)
  }

  const license = declaredLicense(manifest)
  if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string' || !license) {
    fail(`Bundled package at ${packageRoot} must declare name, version, and license metadata`)
  }

  const legalFiles = readdirSync(packageRoot, { withFileTypes: true })
    .filter(entry => (entry.isFile() || entry.isSymbolicLink()) && legalFileName.test(entry.name))
    .map(entry => ({
      name: entry.name,
      text: readFileSync(join(packageRoot, entry.name), 'utf8'),
    }))
    .sort((left, right) => compareText(left.name.toLowerCase(), right.name.toLowerCase()))

  if (legalFiles.length === 0) {
    fail(`Bundled package ${manifest.name}@${manifest.version} has no distributable license or notice file`)
  }

  return {
    name: manifest.name,
    version: manifest.version,
    license,
    legalFiles,
  }
}

function renderNotice(packages) {
  const lines = [
    '# Third-party software notices',
    '',
    'This file is generated at build time from the third-party packages whose',
    'modules are present in the emitted `@runfold/trajectory-ui` JavaScript',
    'chunks. Do not edit it by hand.',
    '',
    'The package names and declared license expressions below are informational.',
    'The complete license and notice files shipped by each package follow and',
    'remain authoritative for that package.',
    '',
    '## Bundled packages',
    '',
    '| Package | Version | Declared license | Included files |',
    '| --- | --- | --- | --- |',
  ]

  for (const item of packages) {
    lines.push(`| \`${escapeTableCell(item.name)}\` | \`${escapeTableCell(item.version)}\` | ${escapeTableCell(item.license)} | ${item.legalFiles.map(file => `\`${escapeTableCell(file.name)}\``).join(', ')} |`)
  }

  lines.push('', '## License and notice texts', '')
  for (const item of packages) {
    for (const file of item.legalFiles) {
      lines.push(
        `### \`${item.name}@${item.version}\` — \`${file.name}\``,
        '',
        fencedText(file.text),
        '',
      )
    }
  }

  return `${lines.join('\n').trimEnd()}\n`
}

/**
 * Emits the legal files for exactly the third-party modules Rollup placed in
 * the library chunks. React peers and build-only tools are therefore excluded.
 */
export function thirdPartyNotices() {
  return {
    name: 'runfold-third-party-notices',
    generateBundle(_options, bundle) {
      const packageRoots = new Set()
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        for (const moduleId of Object.keys(output.modules)) {
          const packageRoot = packageRootForModule(moduleId)
          if (packageRoot) packageRoots.add(packageRoot)
        }
      }

      const packages = Array.from(packageRoots, packageRoot => readPackage(
        packageRoot,
        message => this.error(message),
      )).sort((left, right) => compareText(left.name, right.name))

      if (packages.length === 0) {
        this.error('No bundled third-party packages were found; refusing to emit an empty notice')
      }

      this.emitFile({
        type: 'asset',
        fileName: outputFile,
        source: renderNotice(packages),
      })
    },
  }
}
