import * as core from '@actions/core'
import * as github from '@actions/github'
import {Octokit} from '@octokit/action'

const MESSAGE_PREFIX = '<!-- velocity -->'

async function findPRCommentId(): Promise<number | undefined> {
  const octokit = new Octokit()
  const comments = (
    await octokit.rest.issues.listComments({
      owner: github.context.issue.owner,
      repo: github.context.issue.repo,
      issue_number: github.context.issue.number
    })
  ).data

  const myComment = comments
    .filter(
      comment =>
        comment.user?.login === 'github-actions[bot]' &&
        comment.user?.type === 'Bot' &&
        comment.body?.startsWith(MESSAGE_PREFIX)
    )
    .at(0)

  if (core.isDebug()) {
    core.debug(`Found previous comment: ${myComment ? JSON.stringify(myComment) : '[none]'}`)
  }

  return myComment?.id
}

export function reportEnvironmentFailure(verb: String, stdout: String): void {
  const envStatus = stdout.match(/^Overall status: (.+)$/m)?.[1]
  const statusReason = stdout.match(/^Reason: (.+)$/m)?.[1]

  if (envStatus && statusReason) {
    const messageVerb = verb[0].toUpperCase() + verb.substring(1)
    const message = `${messageVerb} Velocity environment has ${envStatus.toLowerCase()} due to:\n`
    core.error(`${message}\n${statusReason}`)

    // Post an appropriate comment if so desired
    if (core.getBooleanInput('use-gh-comments') && github.context.issue?.number > 0) {
      const runHref = `${github.context.serverUrl}/${github.context.issue.owner}/${github.context.issue.repo}/actions/runs/${github.context.runId}`
      ;(async () => {
        try {
          await postFailureComment(verb, `${message}\`${statusReason}\`\n[See related run](${runHref})`)
        } catch (e) {
          core.debug(`Unable to post a comment: ${e}`)
        }
      })()
    }
  }
}

export function reportEnvironmentSuccess(): void {
  if (core.getBooleanInput('use-gh-comments') && github.context.issue?.number > 0) {
    ;(async () => {
      try {
        await deleteFailureCommentIfExists()
      } catch (e) {
        core.debug(`Unable to delete a comment: ${e}`)
      }
    })()
  }
}

export async function deleteFailureCommentIfExists(): Promise<void> {
  const commentId = await findPRCommentId()
  if (commentId) {
    const octokit = new Octokit()
    octokit.issues.deleteComment({
      owner: github.context.issue.owner,
      repo: github.context.issue.repo,
      comment_id: commentId
    })
  }
}

export async function postFailureComment(verb: String, message: String): Promise<void> {
  const octokit = new Octokit()
  const commentId = await findPRCommentId()
  if (commentId) {
    octokit.issues.updateComment({
      owner: github.context.issue.owner,
      repo: github.context.issue.repo,
      comment_id: commentId,
      body: `${MESSAGE_PREFIX}${message}`
    })
  } else {
    octokit.issues.createComment({
      owner: github.context.issue.owner,
      repo: github.context.issue.repo,
      issue_number: github.context.issue.number,
      body: `${MESSAGE_PREFIX}${message}`
    })
  }
}
