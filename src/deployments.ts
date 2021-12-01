import * as core from '@actions/core'
import {Octokit} from '@octokit/action'

const octokit = new Octokit()
const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '?/?').split('/')

function environmentUrl(envName: string): string {
  const {VELOCITY_DOMAIN: velocityDomain, VELOCITY_SERVICE: velocityService} =
    process.env

  let url = ''
  if (velocityDomain && velocityService) {
    url = `https://${velocityService}-${envName}.${velocityDomain}`
    core.info(`Deployment url: ${url}`)
  }

  return url
}

export async function startDeployment(name: string): Promise<number> {
  const ref = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF || '?'
  const deployments = await octokit.repos.listDeployments({
    owner,
    repo,
    ref
  })

  for (const deployment of deployments.data) {
    await octokit.repos.createDeploymentStatus({
      owner,
      repo,
      deployment_id: deployment.id,
      state: 'inactive'
    })
  }

  const deployment = await octokit.repos.createDeployment({
    owner,
    repo,
    ref,
    environment: name,
    required_contexts: [],
    transient_environment: true,
    auto_merge: false
  })

  if (deployment.status === 202) {
    throw new Error(`unable to create deployment: ${deployment.data.message}`)
  }

  const deploymentId = deployment.data.id

  await octokit.repos.createDeploymentStatus({
    owner,
    repo,
    deployment_id: deploymentId,
    state: 'in_progress',
    environment_url: environmentUrl(name)
  })

  return deploymentId
}

export async function updateDeployment(
  deploymentId: number,
  envName: string,
  success: boolean
): Promise<void> {
  await octokit.repos.createDeploymentStatus({
    owner,
    repo,
    deployment_id: deploymentId,
    environment_url: environmentUrl(envName),
    state: success ? 'success' : 'failure',
    log_url: `${process.env.GITHUB_SERVER_URL}/${owner}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`
  })
}
