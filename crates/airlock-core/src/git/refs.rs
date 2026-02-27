//! Ref update parsing utilities for Airlock.

use super::cmd::{run_git, run_git_unchecked};
use crate::error::{AirlockError, Result};
use crate::types::RefUpdate;
use std::path::Path;

/// Parse ref updates from the standard format used by git hooks.
///
/// Each line should be in the format: `<old-sha> <new-sha> <ref-name>`
/// This is the format provided to pre-receive and post-receive hooks.
pub fn parse_ref_updates(input: &str) -> Result<Vec<RefUpdate>> {
    let mut updates = Vec::new();

    for line in input.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() != 3 {
            return Err(AirlockError::Git(format!(
                "Invalid ref update format: '{}'",
                line
            )));
        }

        updates.push(RefUpdate {
            ref_name: parts[2].to_string(),
            old_sha: parts[0].to_string(),
            new_sha: parts[1].to_string(),
        });
    }

    Ok(updates)
}

/// Check if a SHA represents a null/zero ref (branch deletion or creation).
pub fn is_null_sha(sha: &str) -> bool {
    sha == "0000000000000000000000000000000000000000"
}

/// Determine the type of ref update.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RefUpdateType {
    /// New branch/ref created
    Create,
    /// Existing branch/ref deleted
    Delete,
    /// Existing branch/ref updated
    Update,
}

/// Classification of a ref for Airlock's processing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RefClass {
    /// Branch create/update - goes through pipeline
    BranchUpdate,
    /// Branch deletion - passthrough to upstream
    BranchDeletion,
    /// Tag (create/update/delete) - passthrough to upstream
    Tag,
    /// Other refs (notes, etc.) - passthrough to upstream
    Other,
}

/// Classify a ref update for processing.
pub fn classify_ref(update: &RefUpdate) -> RefClass {
    let is_deletion = is_null_sha(&update.new_sha);

    if update.ref_name.starts_with("refs/heads/") {
        if is_deletion {
            RefClass::BranchDeletion
        } else {
            RefClass::BranchUpdate
        }
    } else if update.ref_name.starts_with("refs/tags/") {
        RefClass::Tag
    } else {
        RefClass::Other
    }
}

/// Check if a ref should go through the pipeline.
pub fn is_pipeline_ref(update: &RefUpdate) -> bool {
    matches!(classify_ref(update), RefClass::BranchUpdate)
}

/// Get the type of a ref update based on old and new SHAs.
pub fn get_ref_update_type(update: &RefUpdate) -> RefUpdateType {
    if is_null_sha(&update.old_sha) {
        RefUpdateType::Create
    } else if is_null_sha(&update.new_sha) {
        RefUpdateType::Delete
    } else {
        RefUpdateType::Update
    }
}

/// Get the HEAD commit SHA from a path (worktree or repo).
pub fn rev_parse_head(path: &Path) -> Result<String> {
    let output = run_git(path, &["rev-parse", "HEAD"], "rev-parse HEAD")?;
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Resolve a ref to its commit SHA. Returns None if the ref doesn't exist.
pub fn resolve_ref(repo_path: &Path, ref_name: &str) -> Result<Option<String>> {
    let output = run_git_unchecked(repo_path, &["rev-parse", "--verify", ref_name], "rev-parse")?;

    if !output.status.success() {
        // Ref doesn't exist — not an error, just return None
        return Ok(None);
    }

    let sha = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if sha.is_empty() {
        return Ok(None);
    }
    Ok(Some(sha))
}

/// Update a ref to point to a new SHA.
pub fn update_ref(repo_path: &Path, ref_name: &str, new_sha: &str) -> Result<()> {
    run_git(repo_path, &["update-ref", ref_name, new_sha], "update-ref")?;
    Ok(())
}

/// Delete a ref from a repository.
pub fn delete_ref(repo_path: &Path, ref_name: &str) -> Result<()> {
    run_git(repo_path, &["update-ref", "-d", ref_name], "update-ref -d")?;
    Ok(())
}

/// Get the protective ref name for a run.
///
/// Returns `refs/airlock/runs/{run_id}` which prevents GC of run commits
/// regardless of what happens to branch refs.
pub fn run_ref(run_id: &str) -> String {
    format!("refs/airlock/runs/{}", run_id)
}

/// Check if `ancestor` is an ancestor of `descendant` in the given repo.
pub fn is_ancestor_of(repo_path: &Path, ancestor: &str, descendant: &str) -> Result<bool> {
    let output = run_git_unchecked(
        repo_path,
        &["merge-base", "--is-ancestor", ancestor, descendant],
        "merge-base --is-ancestor",
    )?;
    Ok(output.status.success())
}

/// Get the push marker ref name for a branch.
///
/// Returns `refs/airlock/pushed/<branch>` which tracks that a user pushed
/// this branch through the gate's post-receive hook.
pub fn push_marker_ref(branch: &str) -> String {
    format!("refs/airlock/pushed/{}", branch)
}

/// List all push marker refs in a gate repo.
///
/// Returns `Vec<(branch_name, sha)>` for each `refs/airlock/pushed/*` ref.
pub fn list_push_markers(gate_path: &Path) -> Result<Vec<(String, String)>> {
    let output = run_git_unchecked(
        gate_path,
        &[
            "for-each-ref",
            "--format=%(refname) %(objectname)",
            "refs/airlock/pushed/",
        ],
        "for-each-ref refs/airlock/pushed/",
    )?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut markers = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.splitn(2, ' ').collect();
        if parts.len() != 2 {
            continue;
        }
        if let Some(branch) = parts[0].strip_prefix("refs/airlock/pushed/") {
            markers.push((branch.to_string(), parts[1].to_string()));
        }
    }

    Ok(markers)
}

/// Delete push marker refs for the given branches.
pub fn cleanup_push_markers(gate_path: &Path, branches: &[&str]) {
    for branch in branches {
        let ref_name = push_marker_ref(branch);
        if let Err(e) = delete_ref(gate_path, &ref_name) {
            tracing::warn!("Failed to clean up push marker ref {}: {}", ref_name, e);
        } else {
            tracing::debug!("Cleaned up push marker ref: {}", ref_name);
        }
    }
}
