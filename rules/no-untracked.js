"use strict"
const resolve = require('eslint-module-utils/resolve').default
    , ModuleCache = require('eslint-module-utils/ModuleCache').default
    , moduleVisitor = require('eslint-module-utils/moduleVisitor')

const fs = require('fs')
    , path = require('path')
    , child = require('child_process')
    , os = require('os')

// todo:
// 1. find ancestral .git folder, cache
// 2. git status --porcelain -uall | grep '^??' (once per .git container? cache?)
// 3. check for resolved path in untracked set for relevant repo
//
// note: will return a non-zero exit code for files outside the repo

module.exports = function (context) {
  const cacheSettings = ModuleCache.getSettings(context.settings)

  return moduleVisitor.default(function checkGitStatus(source) {
    const resolvedPath = resolve(source.value, context)
    if (!resolvedPath) return

    const gitRoot = findGitRoot(path.dirname(resolvedPath), cacheSettings)
    if (gitRoot == null) return

    const untracked = getUntracked(gitRoot, cacheSettings)
    if (untracked.has(resolvedPath)) {
      context.report(source, `Imported module is currently untracked by Git.`)
    }
  })
}

const gitRootCache = new ModuleCache()
function findGitRoot(dirpath, cacheSettings) {
  let gitRoot = gitRootCache.get(dirpath, cacheSettings)
  if (gitRoot !== undefined) return gitRoot

  const siblings = fs.readdirSync(dirpath)

  if (siblings.indexOf('.git') >= 0) {
    gitRoot = dirpath
  } else if (isRootPath(dirpath)) {
    gitRoot = null
  } else {
    // and recurse
    gitRoot = findGitRoot(path.dirname(dirpath), cacheSettings)
  }

  gitRootCache.set(dirpath, gitRoot)
  return gitRoot
}

// todo: replace with a dependency
function isRootPath(path) {
  return (path === '/')
}

const untrackedCache = new ModuleCache()
function getUntracked(gitRoot, cacheSettings) {
  let untracked = untrackedCache.get(gitRoot, cacheSettings)
  if (untracked !== undefined) return untracked

  try {
    const results = child.execSync("git status --porcelain -uall | grep '^??'", { cwd: gitRoot })
    untracked = new Set(results.toString('utf8').split(os.EOL).map(l => path.resolve(gitRoot, l.slice(3))))
  } catch (err) {
    // no untracked
    untracked = new Set()
  }

  untrackedCache.set(gitRoot, untracked)
  return untracked
}

module.exports.schema = [ moduleVisitor.optionsSchema ]
