# Welcome to Velocity contributing guide <!-- omit in toc -->

## Getting started

1. Login to Github Packages using the [following guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages).

  ```sh
  npm login --scope=@techvelocity --registry=https://npm.pkg.github.com

  > Username: USERNAME
  > Password: TOKEN
  > Email: PUBLIC-EMAIL-ADDRESS
  ```

1. Install [nvm](https://github.com/nvm-sh/nvm) or the specific Node.JS version specified in the [`.node-version` file](.node_version).

1. Run `npm install`

## Publishing Changes

An automated Github Action will run on the pull request to verify everything is in order.

Once merged, make sure to tag a new version, and also alias the current major version (e.g., `v1`).
