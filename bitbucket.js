import axios from "axios";

const { BITBUCKET_EMAIL, BITBUCKET_TOKEN, BITBUCKET_WORKSPACE } = process.env;

const api = axios.create({
  baseURL: "https://api.bitbucket.org/2.0",
  auth: { username: BITBUCKET_EMAIL, password: BITBUCKET_TOKEN },
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

function resolveRepo(repoParam) {
  const repo = repoParam || process.env.BITBUCKET_DEFAULT_REPO;
  if (!repo) throw new Error("repo parameter is required (or set BITBUCKET_DEFAULT_REPO)");
  return repo;
}

function paginated(data, filter) {
  return {
    values: data.values.map(filter),
    size: data.size,
    next: data.next ?? null,
  };
}

function filterRepo(raw) {
  return {
    slug: raw.slug,
    full_name: raw.full_name,
    description: raw.description,
    is_private: raw.is_private,
    updated_on: raw.updated_on,
  };
}

function filterBranch(raw) {
  return { name: raw.name, commit_hash: raw.target?.hash };
}

function filterCommit(raw) {
  return {
    hash: raw.hash,
    message: raw.message,
    author: raw.author?.raw,
    date: raw.date,
  };
}

function filterPR(raw) {
  return {
    id: raw.id,
    title: raw.title,
    state: raw.state,
    author: raw.author?.display_name,
    source_branch: raw.source?.branch?.name,
    destination_branch: raw.destination?.branch?.name,
    created_on: raw.created_on,
    description: raw.description,
  };
}

function filterPipeline(raw) {
  return {
    uuid: raw.uuid,
    state: raw.state?.name,
    result: raw.state?.result?.name,
    created_on: raw.created_on,
    completed_on: raw.completed_on,
  };
}

function filterComment(raw) {
  return {
    id: raw.id,
    content: raw.content?.raw,
    author: raw.author?.display_name,
    created_on: raw.created_on,
    parent_id: raw.parent?.id ?? null,
  };
}

function repoPath(repo) {
  return `/repositories/${BITBUCKET_WORKSPACE}/${resolveRepo(repo)}`;
}

export async function listRepositories(page = 1) {
  const res = await api.get(`/repositories/${BITBUCKET_WORKSPACE}`, {
    params: { pagelen: 50, page },
  });
  return paginated(res.data, filterRepo);
}

export async function listBranches(repo, page = 1) {
  const res = await api.get(`${repoPath(repo)}/refs/branches`, { params: { pagelen: 50, page } });
  return paginated(res.data, filterBranch);
}

export async function listCommits(repo, branch, page = 1) {
  const params = { pagelen: 50, page };
  if (branch) params.include = branch;
  const res = await api.get(`${repoPath(repo)}/commits`, { params });
  return paginated(res.data, filterCommit);
}

export async function listPullRequests(repo, state = "OPEN", page = 1) {
  const res = await api.get(`${repoPath(repo)}/pullrequests`, {
    params: { state: state.toUpperCase(), pagelen: 50, page },
  });
  return paginated(res.data, filterPR);
}

export async function getPullRequest(repo, prId) {
  const res = await api.get(`${repoPath(repo)}/pullrequests/${prId}`);
  return filterPR(res.data);
}

export async function createPullRequest(repo, title, sourceBranch, destinationBranch, description) {
  const res = await api.post(`${repoPath(repo)}/pullrequests`, {
    title,
    description: description ?? "",
    source: { branch: { name: sourceBranch } },
    destination: { branch: { name: destinationBranch } },
  });
  return filterPR(res.data);
}

export async function approvePullRequest(repo, prId) {
  const res = await api.post(`${repoPath(repo)}/pullrequests/${prId}/approve`);
  return { approved: true, user: res.data.user?.display_name };
}

export async function mergePullRequest(repo, prId, mergeStrategy = "merge_commit") {
  const res = await api.post(`${repoPath(repo)}/pullrequests/${prId}/merge`, {
    merge_strategy: mergeStrategy,
  });
  return filterPR(res.data);
}

export async function listPipelines(repo, page = 1) {
  const res = await api.get(`${repoPath(repo)}/pipelines/`, {
    params: { pagelen: 50, page, sort: "-created_on" },
  });
  return paginated(res.data, filterPipeline);
}

export async function getPipeline(repo, pipelineUuid) {
  const res = await api.get(`${repoPath(repo)}/pipelines/${pipelineUuid}`);
  return filterPipeline(res.data);
}

export async function listPrComments(repo, prId, page = 1) {
  const res = await api.get(`${repoPath(repo)}/pullrequests/${prId}/comments`, {
    params: { pagelen: 50, page },
  });
  return paginated(res.data, filterComment);
}

export async function addPrComment(repo, prId, content) {
  const res = await api.post(`${repoPath(repo)}/pullrequests/${prId}/comments`, {
    content: { raw: content },
  });
  return filterComment(res.data);
}

export async function replyPrComment(repo, prId, parentCommentId, content) {
  const res = await api.post(`${repoPath(repo)}/pullrequests/${prId}/comments`, {
    content: { raw: content },
    parent: { id: parentCommentId },
  });
  return filterComment(res.data);
}
