import * as cp from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as process from 'process'
import {tmpdir} from 'os'
import {expect, test, beforeEach} from '@jest/globals'
import {download, latest} from '../src/download'

beforeEach(() => {
  process.env['RUNNER_TEMP'] = path.resolve(tmpdir(), 'env-create-action')
})

test('extracts specific veloctl version', async () => {
  const version = '0.3.8'

  const veloctl = await download(version)
  expect(fs.existsSync(veloctl))

  const versionOutput = cp.execFileSync(veloctl, ['-v']).toString()
  expect(versionOutput === `veloctl version ${version}`)
})

test('extracts the latest veloctl', async () => {
  const latestVersion = await latest()

  const veloctl = await download()
  expect(fs.existsSync(veloctl))

  const versionOutput = cp.execFileSync(veloctl, ['-v']).toString()
  expect(versionOutput === `veloctl version ${latestVersion}`)
})
