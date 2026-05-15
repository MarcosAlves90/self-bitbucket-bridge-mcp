import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveRepo, filterRepo, filterBranch, filterCommit, filterPR, filterPipeline, filterComment } from "./bitbucket.js";

describe("resolveRepo", () => {
  it("returns the param when provided", () => {
    assert.equal(resolveRepo("my-repo"), "my-repo");
  });

  it("falls back to BITBUCKET_DEFAULT_REPO env var", () => {
    process.env.BITBUCKET_DEFAULT_REPO = "env-repo";
    assert.equal(resolveRepo(undefined), "env-repo");
    delete process.env.BITBUCKET_DEFAULT_REPO;
  });

  it("throws when neither param nor env var is set", () => {
    delete process.env.BITBUCKET_DEFAULT_REPO;
    assert.throws(() => resolveRepo(undefined), /repo parameter is required/);
  });
});

describe("filterRepo", () => {
  it("extracts useful fields from a raw Bitbucket repo response", () => {
    const raw = {
      slug: "my-repo",
      full_name: "workspace/my-repo",
      description: "A repo",
      is_private: true,
      updated_on: "2026-05-15T00:00:00Z",
      links: { self: { href: "..." } },
      owner: { type: "team", display_name: "Team" },
    };
    const result = filterRepo(raw);
    assert.deepEqual(result, {
      slug: "my-repo",
      full_name: "workspace/my-repo",
      description: "A repo",
      is_private: true,
      updated_on: "2026-05-15T00:00:00Z",
    });
  });
});

describe("filterBranch", () => {
  it("extracts name and commit hash", () => {
    const raw = { name: "main", target: { hash: "abc123", date: "2026-05-15" }, links: {} };
    assert.deepEqual(filterBranch(raw), { name: "main", commit_hash: "abc123" });
  });
});

describe("filterCommit", () => {
  it("extracts hash, message, author, date", () => {
    const raw = {
      hash: "abc123",
      message: "fix: something",
      author: { raw: "Marcos <marcos@example.com>" },
      date: "2026-05-15T00:00:00Z",
      parents: [],
      links: {},
    };
    assert.deepEqual(filterCommit(raw), {
      hash: "abc123",
      message: "fix: something",
      author: "Marcos <marcos@example.com>",
      date: "2026-05-15T00:00:00Z",
    });
  });
});

describe("filterPR", () => {
  it("extracts PR fields", () => {
    const raw = {
      id: 42,
      title: "My PR",
      state: "OPEN",
      author: { display_name: "Marcos" },
      source: { branch: { name: "feature/foo" } },
      destination: { branch: { name: "main" } },
      created_on: "2026-05-15T00:00:00Z",
      description: "Some changes",
      links: {},
    };
    assert.deepEqual(filterPR(raw), {
      id: 42,
      title: "My PR",
      state: "OPEN",
      author: "Marcos",
      source_branch: "feature/foo",
      destination_branch: "main",
      created_on: "2026-05-15T00:00:00Z",
      description: "Some changes",
    });
  });
});

describe("filterPipeline", () => {
  it("extracts pipeline fields", () => {
    const raw = {
      uuid: "{uuid-123}",
      state: { name: "COMPLETED", result: { name: "SUCCESSFUL" } },
      created_on: "2026-05-15T00:00:00Z",
      completed_on: "2026-05-15T00:05:00Z",
      target: {},
    };
    assert.deepEqual(filterPipeline(raw), {
      uuid: "{uuid-123}",
      state: "COMPLETED",
      result: "SUCCESSFUL",
      created_on: "2026-05-15T00:00:00Z",
      completed_on: "2026-05-15T00:05:00Z",
    });
  });
});

describe("filterComment", () => {
  it("extracts comment fields including parent id", () => {
    const raw = {
      id: 1,
      content: { raw: "Looks good!" },
      author: { display_name: "Marcos" },
      created_on: "2026-05-15T00:00:00Z",
      parent: { id: 5 },
      links: {},
    };
    assert.deepEqual(filterComment(raw), {
      id: 1,
      content: "Looks good!",
      author: "Marcos",
      created_on: "2026-05-15T00:00:00Z",
      parent_id: 5,
    });
  });

  it("sets parent_id to null when no parent", () => {
    const raw = {
      id: 2,
      content: { raw: "First comment" },
      author: { display_name: "Marcos" },
      created_on: "2026-05-15T00:00:00Z",
      links: {},
    };
    const result = filterComment(raw);
    assert.equal(result.parent_id, null);
  });
});

describe("filterBranch — missing fields", () => {
  it("returns undefined commit_hash when target is absent", () => {
    const result = filterBranch({ name: "main" });
    assert.deepEqual(result, { name: "main", commit_hash: undefined });
  });
});

describe("filterPR — missing optional fields", () => {
  it("returns undefined for author, source_branch, destination_branch when absent", () => {
    const raw = {
      id: 1,
      title: "PR",
      state: "OPEN",
      created_on: "2026-05-15T00:00:00Z",
      description: "",
    };
    assert.deepEqual(filterPR(raw), {
      id: 1,
      title: "PR",
      state: "OPEN",
      author: undefined,
      source_branch: undefined,
      destination_branch: undefined,
      created_on: "2026-05-15T00:00:00Z",
      description: "",
    });
  });
});

describe("filterPipeline — in-progress pipeline (no result yet)", () => {
  it("returns undefined result when pipeline has no result", () => {
    const raw = {
      uuid: "{uuid-456}",
      state: { name: "IN_PROGRESS" },
      created_on: "2026-05-15T00:00:00Z",
      completed_on: null,
    };
    assert.deepEqual(filterPipeline(raw), {
      uuid: "{uuid-456}",
      state: "IN_PROGRESS",
      result: undefined,
      created_on: "2026-05-15T00:00:00Z",
      completed_on: null,
    });
  });
});

describe("filterRepo — nullable description", () => {
  it("passes through null description", () => {
    const raw = {
      slug: "my-repo",
      full_name: "workspace/my-repo",
      description: null,
      is_private: false,
      updated_on: "2026-05-15T00:00:00Z",
    };
    assert.deepEqual(filterRepo(raw), {
      slug: "my-repo",
      full_name: "workspace/my-repo",
      description: null,
      is_private: false,
      updated_on: "2026-05-15T00:00:00Z",
    });
  });
});
