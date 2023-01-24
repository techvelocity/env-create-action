import * as core from '@actions/core'
import {ExecOutput, getExecOutput} from '@actions/exec'
import {reportEnvironmentFailure, reportEnvironmentSuccess} from './error-reporting'
import semver from 'semver'

// The scroll character
const RMCUP_CHAR = '[?1049l'
const CREATOR_FLAG_MIN_VERSION = '0.4.0'

async function execVeloctl(token: string, args: string[]): Promise<ExecOutput> {
  const output = await getExecOutput('veloctl', args, {
    env: {
      VELOCITY_TOKEN: token,
      NO_COLOR: '1',
      ...process.env
    },
    ignoreReturnCode: true,
    silent: true
  })

  return output
}

export async function envExists(token: string, envName: string): Promise<boolean> {
  try {
    const output = await execVeloctl(token, ['env', 'status', envName])
    return output.exitCode === 0 || !output.stdout.includes('not found')
  } catch (e) {
    return false
  }
}

interface CreateOrUpdateParams {
  cliVersion: string
  envName: string
  services: string
  creator?: string
}

export async function createOrUpdate(token: string, params: CreateOrUpdateParams): Promise<boolean> {
  const {cliVersion, envName, services} = params
  const exists = await envExists(token, envName)

  const flags = ['-d', 'full', '-s', services, '--confirm']
  let verb = 'update'
  if (!exists) {
    verb = 'create'

    if (params.creator && semver.gte(cliVersion, CREATOR_FLAG_MIN_VERSION)) {
      flags.push('--creator', params.creator)
    }
  }

  const args = ['env', verb, ...flags, envName]
  const output = await execVeloctl(token, args)
  const splitOutput = output.stdout.split(RMCUP_CHAR)
  const filteredStdout = splitOutput[splitOutput.length - 1]

  if (output.exitCode !== 0) {
    core.startGroup('Complete output')
    core.info(splitOutput.toString())
    core.endGroup()

    await reportEnvironmentFailure(verb, filteredStdout)

    throw new Error(`failed to ${verb} (args=${args}): ${filteredStdout}`)
  } else {
    await reportEnvironmentSuccess()
  }

  core.info(`${verb} output:\n${filteredStdout}`)
  return true
}
