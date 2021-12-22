import * as cp from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as process from 'process'
import {tmpdir} from 'os'
import {beforeAll, beforeEach, describe, expect, test} from '@jest/globals'
import {download, latest, resolveVersion} from '../src/download'

let latestVersion: string

beforeAll(async () => {
  latestVersion = await latest()
})

beforeEach(() => {
  process.env['RUNNER_TEMP'] = path.resolve(tmpdir(), 'env-create-action')
})

describe('resolveVersion', () => {
  test('returns the latest veloctl', async () => {
    const version = await resolveVersion()
    expect(version === latestVersion)
  })

  test('returns the latest veloctl if version is invalid', async () => {
    const requestedVersion = '1.2394X'

    const version = await resolveVersion(requestedVersion)
    expect(version === latestVersion)
  })

  test('returns the version if it is valid', async () => {
    const requestedVersion = '0.3.9'

    const version = await resolveVersion(requestedVersion)
    expect(version === requestedVersion)
  })
})

describe('download', () => {
  test('extracts the specific veloctl version', async () => {
    const version = '0.3.8'

    const veloctl = await download(version)
    expect(fs.existsSync(veloctl))

    const versionOutput = cp.execFileSync(veloctl, ['-v']).toString()
    expect(versionOutput === `veloctl version ${version}`)
  })
})
