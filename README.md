# env-create-action

This is a GitHub Action to create/update an environment in [Velocity](https://velocity.tech/).

## Examples

Incorporate the following action in your workflow to create/update an environment in Velocity using an authentication token (can be obtained from your organization's account manager), a list of services (i.e. `frontend:verA,backend`), and an environment name:

```yml
steps:
  - uses: techvelocity/env-name-action@v1 # Generate a valid name based on the branch/PR
    id: env-name
  - uses: actions/checkout@v2 # Checkout
  - uses: docker/build-push-action@v2 # Build
    with:
      push: true
      tags: org/repo:${{ steps.env-name.outputs.name }}
  - uses: techvelocity/env-create-action@v1
    with:
      velocity-token: ${{ secrets.VELOCITY_TOKEN }}
      services: '${{ env.VELOCITY_SERVICE }}:${{ steps.env-name.outputs.name }}'
      name: ${{ steps.env-name.outputs.name }}
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      VELOCITY_DOMAIN: velodomain.com # Your velocity domain name
      VELOCITY_SERVICE: myservice # The name of the services that will show in Github Actions
```

If you don't want to use Github's Deployments API, use:

```yml
steps:
  - uses: techvelocity/env-create-action@v1
    with:
      velocity-token: ${{ secrets.VELOCITY_TOKEN }}
      services: '${{ env.VELOCITY_SERVICE }}:${{ env.IMAGE_NAME }}'
      name: ${{ env.ENV_NAME }}
      use-gh-deployments: 'false'
    env:
      VELOCITY_SERVICE: myservice
```

## Inputs

The following inputs are mandatory:

| Name             | Description                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `velocity-token` | Velocity's authentication token. It is strongly recommended that this value be retrieved from a GitHub secret. |
| `services`       | A list of one or more services (and their new tags). Format can be either `name:tag` or `name:image:tag`.      |
| `name`           | The environment name. It is strongly recommended to have a constant name for the same PR / branch.             |

The following inputs are optional:

| Name                 | Description                                                                                                                                                                               | Default  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `use-gh-deployments` | Enables the usage of [Github Deployments API](https://docs.github.com/en/rest/reference/repos#deployments). When set to `true`, make sure the `GITHUB_TOKEN` environment variable is set. | `true`   |
| `use-gh-names`       | Will create environments with the Github username of the user who invoked the action.                                                                                                     | `true`   |
| `use-gh-comments`    | Will post about the action's status on the relevant Pull Request. When set to `true`, make sure the `GITHUB_TOKEN` environment variable is set.                                                                                                        | `true`   |
| `version`            | Select a specific version of `veloctl` to use.                                                                                                                                            | `latest` |
