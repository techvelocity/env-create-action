import * as core from '@actions/core'
import * as fs from 'fs'
import * as tmp from 'tmp'
import {ExecOutput, getExecOutput} from '@actions/exec'
import YAML from 'yaml'
import semver from 'semver'

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

export async function envExists(
  token: string,
  envName: string
): Promise<boolean> {
  try {
    const output = await execVeloctl(token, ['env', 'status', envName])
    return output.exitCode === 0 || !output.stdout.includes('was not found')
  } catch (e) {
    return false
  }
}

interface Plugin {
  _type: 'container.BasicPlugin' | string
  Name: string
  Image: {
    AlwaysPull: boolean
    Image: string
    Tag: string
  }
}

interface Blueprint {
  Plugin: Plugin
  ServiceDefinitionName: string
}

async function getPlan(
  token: string,
  exists: boolean,
  envName: string,
  services: string
): Promise<Blueprint[]> {
  let args
  if (exists) {
    args = ['env', 'export', '-f', '-', envName]
  } else {
    args = ['env', 'plan', '-s', services, '-f', '-']
  }

  const output = await execVeloctl(token, args)
  if (output.exitCode !== 0) {
    throw new Error(
      `Error planning (exitcode=${output.exitCode}): ${output.stdout}`
    )
  }

  return YAML.parseAllDocuments(output.stdout).map(document =>
    document.toJSON()
  )
}

async function generatePlan(
  token: string,
  exists: boolean,
  envName: string,
  services: string
): Promise<string> {
  const plan = await getPlan(token, exists, envName, services)

  const servicesMap = services.split(',').reduce((prev, service) => {
    // make it a map for easier access
    // each service can be either "name:tag" or "name:image:tag"
    const [name, image, version] = service.split(':')

    // if no version is supplied (we got "name:tag"), then we need to do a switch:
    // the image variable is holding the version
    if (!version) {
      prev[name] = [undefined, image]
    } else {
      prev[name] = [image, version]
    }
    return prev
  }, {} as {[K in string]: [string | undefined, string | undefined]})

  const yamls = plan.map(blueprint => {
    const name = blueprint.ServiceDefinitionName

    const serviceVersion = servicesMap[name]
    if (serviceVersion !== undefined) {
      const [image, version] = serviceVersion
      if (version !== undefined) {
        blueprint.Plugin.Image.Tag = version
        blueprint.Plugin.Name = `${name}-${process.env['GITHUB_RUN_ID']}` // randomize the name to trigger an update
        blueprint.Plugin.Image.AlwaysPull = true // make sure it would pull

        if (image !== undefined) {
          blueprint.Plugin.Image.Image = image
        }
      }

      delete servicesMap[name]
    }

    const document = new YAML.Document(blueprint)
    return document.toString()
  })

  const notInMap = Object.keys(servicesMap)
  if (notInMap.length > 0) {
    throw new Error(
      `some services do not appear in the plan: ${notInMap.join(', ')}`
    )
  }

  const tmpFile = tmp.fileSync({
    discardDescriptor: true
  })
  fs.writeFileSync(tmpFile.name, yamls.join('---\n'))
  return tmpFile.name
}

interface CreateOrUpdateParams {
  cliVersion: string
  envName: string
  services: string
  creator?: string
}

export async function createOrUpdate(
  token: string,
  params: CreateOrUpdateParams
): Promise<boolean> {
  const {cliVersion, envName, services} = params
  const exists = await envExists(token, envName)
  const planPath = await generatePlan(token, exists, envName, services)

  const flags = ['-d', 'full', '-f', planPath]
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
    throw new Error(
      `failed to ${verb} (exitCode=${output.exitCode}, args=${args}): ${splitOutput}`
    )
  }

  core.info(`${verb} output:\n${filteredStdout}`)
  return true
}
