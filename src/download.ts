import * as core from '@actions/core'
import * as path from 'path'
import * as tc from '@actions/tool-cache'
import fetch from 'node-fetch'
import os from 'os'
import semver from 'semver'

const LATEST_URL = 'https://releases.velocity.tech/veloctl/latest'

export async function latest(): Promise<string> {
  const response = await fetch(LATEST_URL)
  return response.text()
}

const platformMapping: {[K in string]: string} = {
  win32: 'Windows',
  darwin: 'Darwin',
  linux: 'Linux'
}

const archMapping: {[K in string]: string} = {
  arm64: 'arm64',
  x64: 'x86_64'
}

function getUrl(version: string): string {
  const osPlatform = os.platform()
  const platform = platformMapping[osPlatform]
  if (!platform) {
    throw new Error(`Unsupported platform ${osPlatform}`)
  }

  const osArch = os.arch()
  const arch = archMapping[osArch]
  if (!arch) {
    throw new Error(`Unsupported architecture ${osArch}`)
  }

  return `https://releases.velocity.tech/veloctl/v${version}/veloctl_${version}_${platform}_${arch}.tar.gz`
}

export async function resolveVersion(requestedVersion?: string): Promise<string> {
  let version = requestedVersion
  if (!version || !semver.valid(version)) {
    version = await latest()
  }
  core.debug(`Resolved veloctl version ${version}`)

  return version
}

export async function download(resolvedVersion: string): Promise<string> {
  const toolUrl = getUrl(resolvedVersion)
  core.debug(`Download url: ${toolUrl}`)

  const archivePath = await tc.downloadTool(toolUrl)
  const extractedPath = await tc.extractTar(archivePath)

  core.addPath(extractedPath)
  return path.join(extractedPath, 'veloctl')
}
