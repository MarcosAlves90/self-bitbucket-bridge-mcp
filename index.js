import dotenv from "dotenv";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as bb from "./bitbucket.js";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });

const REQUIRED_ENV = ["BITBUCKET_EMAIL", "BITBUCKET_TOKEN", "BITBUCKET_WORKSPACE"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

async function safeCall(fn) {
  try {
    const data = await fn();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    const message = err.response?.data
      ? JSON.stringify(err.response.data, null, 2)
      : err.message;
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
}

const MERGE_STRATEGY_MAP = {
  "merge-commit": "merge_commit",
  squash: "squash",
  "fast-forward": "fast_forward",
};

const server = new McpServer({ name: "bitbucket-bridge", version: "1.0.0" });

// --- Repositories ---

server.registerTool(
  "list_repositories",
  {
    description: "List all repositories in the configured Bitbucket workspace",
    inputSchema: {
      page: z.number().int().positive().optional().default(1).describe("Page number (50 items per page)"),
    },
  },
  ({ page }) => safeCall(() => bb.listRepositories(page))
);

server.registerTool(
  "list_branches",
  {
    description: "List branches for a repository",
    inputSchema: {
      repo: z.string().optional().describe("Repo slug (uses BITBUCKET_DEFAULT_REPO if omitted)"),
      page: z.number().int().positive().optional().default(1).describe("Page number"),
    },
  },
  ({ repo, page }) => safeCall(() => bb.listBranches(repo, page))
);

server.registerTool(
  "list_commits",
  {
    description: "List recent commits for a repository or branch",
    inputSchema: {
      repo: z.string().optional().describe("Repo slug (uses BITBUCKET_DEFAULT_REPO if omitted)"),
      branch: z.string().optional().describe("Branch name (default branch if omitted)"),
      page: z.number().int().positive().optional().default(1).describe("Page number"),
    },
  },
  ({ repo, branch, page }) => safeCall(() => bb.listCommits(repo, branch, page))
);

// --- Pull Requests ---

server.registerTool(
  "list_pull_requests",
  {
    description: "List pull requests for a repository",
    inputSchema: {
      repo: z.string().optional().describe("Repo slug (uses BITBUCKET_DEFAULT_REPO if omitted)"),
      state: z.enum(["open", "merged", "declined", "superseded"]).optional().default("open").describe("PR state filter"),
      page: z.number().int().positive().optional().default(1).describe("Page number"),
    },
  },
  ({ repo, state, page }) => safeCall(() => bb.listPullRequests(repo, state, page))
);

server.registerTool(
  "get_pull_request",
  {
    description: "Get full details of a pull request",
    inputSchema: {
      repo: z.string().optional().describe("Repo slug (uses BITBUCKET_DEFAULT_REPO if omitted)"),
      pr_id: z.number().int().positive().describe("Pull request ID"),
    },
  },
  ({ repo, pr_id }) => safeCall(() => bb.getPullRequest(repo, pr_id))
);

server.registerTool(
  "create_pull_request",
  {
    description: "Create a new pull request",
    inputSchema: {
      repo: z.string().optional().describe("Repo slug (uses BITBUCKET_DEFAULT_REPO if omitted)"),
      title: z.string().describe("PR title"),
      source_branch: z.string().describe("Branch to merge from"),
      destination_branch: z.string().describe("Branch to merge into"),
      description: z.string().optional().describe("PR description"),
    },
  },
  ({ repo, title, source_branch, destination_branch, description }) =>
    safeCall(() => bb.createPullRequest(repo, title, source_branch, destination_branch, description))
);

server.registerTool(
  "approve_pull_request",
  {
    description: "Approve a pull request as the authenticated user",
    inputSchema: {
      repo: z.string().optional().describe("Repo slug (uses BITBUCKET_DEFAULT_REPO if omitted)"),
      pr_id: z.number().int().positive().describe("Pull request ID"),
    },
  },
  ({ repo, pr_id }) => safeCall(() => bb.approvePullRequest(repo, pr_id))
);

server.registerTool(
  "merge_pull_request",
  {
    description: "Merge a pull request",
    inputSchema: {
      repo: z.string().optional().describe("Repo slug (uses BITBUCKET_DEFAULT_REPO if omitted)"),
      pr_id: z.number().int().positive().describe("Pull request ID"),
      merge_strategy: z
        .enum(["merge-commit", "squash", "fast-forward"])
        .optional()
        .default("merge-commit")
        .describe("Merge strategy"),
    },
  },
  ({ repo, pr_id, merge_strategy }) =>
    safeCall(() => bb.mergePullRequest(repo, pr_id, MERGE_STRATEGY_MAP[merge_strategy]))
);

// --- Pipelines ---

server.registerTool(
  "list_pipelines",
  {
    description: "List recent pipeline runs for a repository (sorted by newest first)",
    inputSchema: {
      repo: z.string().optional().describe("Repo slug (uses BITBUCKET_DEFAULT_REPO if omitted)"),
      page: z.number().int().positive().optional().default(1).describe("Page number"),
    },
  },
  ({ repo, page }) => safeCall(() => bb.listPipelines(repo, page))
);

server.registerTool(
  "get_pipeline",
  {
    description: "Get status and result of a specific pipeline run",
    inputSchema: {
      repo: z.string().optional().describe("Repo slug (uses BITBUCKET_DEFAULT_REPO if omitted)"),
      pipeline_uuid: z.string().describe("Pipeline UUID (e.g. {uuid-xxx})"),
    },
  },
  ({ repo, pipeline_uuid }) => safeCall(() => bb.getPipeline(repo, pipeline_uuid))
);

// --- Comments ---

server.registerTool(
  "list_pr_comments",
  {
    description: "List all comments on a pull request",
    inputSchema: {
      repo: z.string().optional().describe("Repo slug (uses BITBUCKET_DEFAULT_REPO if omitted)"),
      pr_id: z.number().int().positive().describe("Pull request ID"),
      page: z.number().int().positive().optional().default(1).describe("Page number"),
    },
  },
  ({ repo, pr_id, page }) => safeCall(() => bb.listPrComments(repo, pr_id, page))
);

server.registerTool(
  "add_pr_comment",
  {
    description: "Add a comment to a pull request",
    inputSchema: {
      repo: z.string().optional().describe("Repo slug (uses BITBUCKET_DEFAULT_REPO if omitted)"),
      pr_id: z.number().int().positive().describe("Pull request ID"),
      content: z.string().describe("Comment text"),
    },
  },
  ({ repo, pr_id, content }) => safeCall(() => bb.addPrComment(repo, pr_id, content))
);

server.registerTool(
  "add_pr_reply",
  {
    description: "Reply to an existing comment thread on a pull request",
    inputSchema: {
      repo: z.string().optional().describe("Repo slug (uses BITBUCKET_DEFAULT_REPO if omitted)"),
      pr_id: z.number().int().positive().describe("Pull request ID"),
      parent_comment_id: z.number().int().positive().describe("ID of the comment to reply to"),
      content: z.string().describe("Reply text"),
    },
  },
  ({ repo, pr_id, parent_comment_id, content }) =>
    safeCall(() => bb.replyPrComment(repo, pr_id, parent_comment_id, content))
);

const transport = new StdioServerTransport();
await server.connect(transport);
