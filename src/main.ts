import * as core from '@actions/core'
import {startDeployment, updateDeployment} from './deployments'
import {createOrUpdate} from './veloctl'
import {download} from './download'

async function run(): Promise<void> {
  try {
    const velocityToken = core.getInput('velocity-token')
    if (!velocityToken) {
      throw new Error('Missing velocity-token')
    }

    const services = core.getInput('services')
    if (!services) {
      throw new Error('Missing services')
    }

    const envName = core.getInput('name').toLowerCase()
    if (!envName) {
      throw new Error('Missing environment name')
    }

    let deploymentId
    if (core.getBooleanInput('use-gh-deployments')) {
      deploymentId = await startDeployment(envName)
    }

    const veloctl = await download(core.getInput('version'))
    core.debug(`veloctl available at: ${veloctl}`)

    try {
      await createOrUpdate(velocityToken, envName, services)
    } catch (e) {
      if (deploymentId) {
        await updateDeployment(deploymentId, false)
      }
      throw e
    }

    if (deploymentId) {
      await updateDeployment(deploymentId, true)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
    throw error
  }
}

run()
