import * as core from '@actions/core'
import * as fs from 'fs'
import * as tmp from 'tmp'
import {ExecOutput, getExecOutput} from '@actions/exec'
import YAML from 'yaml'

const RMCUP_CHAR = '[?1049l'

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
    const [name, version] = service.split(':')
    prev[name] = version
    return prev
  }, {} as {[K in string]: string | undefined})

  const yamls = plan.map(blueprint => {
    const name = blueprint.ServiceDefinitionName

    const serviceVersion = servicesMap[name]
    if (serviceVersion !== undefined) {
      blueprint.Plugin.Image.Tag = serviceVersion
      blueprint.Plugin.Name = `${name}-${process.env['GITHUB_RUN_ID']}` // randomize the name to trigger an update
      blueprint.Plugin.Image.AlwaysPull = true // make sure it would pull
    }
    if (name in servicesMap) {
      delete servicesMap[name]
    }

    const document = new YAML.Document()
    document.contents = blueprint
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

export async function createOrUpdate(
  token: string,
  envName: string,
  services: string
): Promise<boolean> {
  const exists = await envExists(token, envName)
  const planPath = await generatePlan(token, exists, envName, services)

  let verb = 'create'
  if (exists) {
    verb = 'update'
  }

  const args = ['env', verb, '-d', 'full', '-f', planPath, envName]
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
