# mcp-bitbucket-bridge

![Node.js](https://img.shields.io/badge/Node.js-ESM-339933?logo=nodedotjs&logoColor=white)
![Bitbucket](https://img.shields.io/badge/Bitbucket-Cloud-0052CC?logo=bitbucket&logoColor=white)
![MCP SDK](https://img.shields.io/badge/MCP_SDK-1.29-6B46C1?logo=anthropic&logoColor=white)
![Tools](https://img.shields.io/badge/tools-13-orange)
![Tests](https://img.shields.io/badge/tests-14%20passing-brightgreen)
![Maintained](https://img.shields.io/badge/maintained-yes-brightgreen)

MCP server that exposes Bitbucket Cloud operations to AI agents.

## Table of Contents

- [Setup](#setup)
- [MCP Client Config](#mcp-client-config)
- [Tools](#tools)
  - [Repositories](#repositories)
  - [Pull Requests](#pull-requests)
  - [Pipelines](#pipelines)
  - [Comments](#comments)

## Setup

```bash
npm install
cp .env.example .env
# fill in .env
```

**.env**
```
BITBUCKET_USERNAME=your-username
BITBUCKET_APP_PASSWORD=ATBxxxxx
BITBUCKET_WORKSPACE=your-workspace-slug
BITBUCKET_DEFAULT_REPO=your-default-repo-slug   # optional
```

Generate an app password at **Bitbucket Settings → Personal settings → App passwords**. Required scopes: `Repositories:Read`, `Pull requests:Read/Write`, `Pipelines:Read`.

## MCP Client Config

```json
{
  "mcpServers": {
    "bitbucket-bridge": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-bitbucket-bridge/index.js"]
    }
  }
}
```

## Tools

All tools accept an optional `repo` parameter. When omitted, `BITBUCKET_DEFAULT_REPO` is used.

### Repositories

| Tool | Description |
|---|---|
| `list_repositories` | List all repos in the workspace |
| `list_branches` | List branches for a repo |
| `list_commits` | List recent commits for a repo or branch |

### Pull Requests

| Tool | Description |
|---|---|
| `list_pull_requests` | List PRs (filter by state: open/merged/declined/superseded) |
| `get_pull_request` | Get full details of a PR |
| `create_pull_request` | Open a new PR |
| `approve_pull_request` | Approve a PR as the authenticated user |
| `merge_pull_request` | Merge a PR (strategies: merge-commit/squash/fast-forward) |

### Pipelines

| Tool | Description |
|---|---|
| `list_pipelines` | List recent pipeline runs (newest first) |
| `get_pipeline` | Get status and result of a specific pipeline |

### Comments

| Tool | Description |
|---|---|
| `list_pr_comments` | List all comments on a PR |
| `add_pr_comment` | Add a comment to a PR |
| `add_pr_reply` | Reply to an existing comment thread |
