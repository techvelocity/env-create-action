import * as core from '@actions/core'
import * as github from '@actions/github'
import {createOrUpdate, download} from '@techvelocity/veloctl'
import {startDeployment, updateDeployment} from './deployments'

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
    if (process.env.GITHUB_TOKEN && core.getBooleanInput('use-gh-deployments')) {
      deploymentId = await startDeployment(envName)
    }

    const {path: veloctl, version: cliVersion} = await download(core.getInput('version'))
    core.debug(`veloctl available at: ${veloctl}`)

    let creator = undefined
    if (core.getBooleanInput('use-gh-names')) {
      creator = github.context.payload.sender?.login
    }

    try {
      await createOrUpdate(velocityToken, {
        envName,
        services,
        cliVersion,
        creator
      })
    } catch (e) {
      if (deploymentId) {
        await updateDeployment(deploymentId, envName, false)
      }
      throw e
    }

    if (deploymentId) {
      await updateDeployment(deploymentId, envName, true)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
    throw error
  }
}

run()
