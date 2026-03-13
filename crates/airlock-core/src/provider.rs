//! Source control provider detection and CLI validation.
//!
//! Detects the SCM provider from a remote URL and checks whether the
//! corresponding CLI tool is installed and authenticated.

use crate::agent::subprocess::is_cli_available;

/// A source control management provider.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScmProvider {
    GitHub,
    GitLab,
    Bitbucket,
    AzureDevOps,
    Unknown,
}

impl ScmProvider {
    /// Human-readable name for the provider.
    pub fn display_name(&self) -> &str {
        match self {
            Self::GitHub => "GitHub",
            Self::GitLab => "GitLab",
            Self::Bitbucket => "Bitbucket",
            Self::AzureDevOps => "Azure DevOps",
            Self::Unknown => "Unknown",
        }
    }

    /// CLI tool name required for PR creation, if any.
    pub fn cli_tool(&self) -> Option<&str> {
        match self {
            Self::GitHub => Some("gh"),
            Self::GitLab => Some("glab"),
            Self::Bitbucket => Some("bb"),
            Self::AzureDevOps | Self::Unknown => None,
        }
    }

    /// Installation hint for the CLI tool.
    pub fn install_hint(&self) -> Option<&str> {
        match self {
            Self::GitHub => Some("https://cli.github.com"),
            Self::GitLab => Some("https://gitlab.com/gitlab-org/cli"),
            Self::Bitbucket => {
                Some("https://developer.atlassian.com/cloud/bitbucket/bitbucket-cli/")
            }
            Self::AzureDevOps | Self::Unknown => None,
        }
    }
}

/// Result of checking a provider's CLI setup.
#[derive(Debug, Clone)]
pub struct ProviderCheck {
    pub provider: ScmProvider,
    pub cli_installed: bool,
    pub cli_authenticated: bool,
    pub cli_name: Option<String>,
    pub api_checked: bool,
    pub api_authenticated: bool,
}

/// Detect the SCM provider from a remote URL.
pub fn detect_provider(url: &str) -> ScmProvider {
    let lower = url.to_lowercase();
    if lower.contains("github.com") {
        ScmProvider::GitHub
    } else if lower.contains("gitlab.com") || lower.contains("gitlab.") {
        ScmProvider::GitLab
    } else if lower.contains("bitbucket.org") {
        ScmProvider::Bitbucket
    } else if lower.contains("dev.azure.com") || lower.contains("visualstudio.com") {
        ScmProvider::AzureDevOps
    } else {
        ScmProvider::Unknown
    }
}

/// Check whether the CLI for a provider is installed and authenticated.
///
/// # Network Calls
///
/// This function makes a live HTTP request to validate API credentials for some
/// providers (currently Bitbucket). The request has a 5-second timeout. Callers
/// should be prepared for this blocking call and may want to show a progress
/// indicator in interactive contexts.
pub fn check_provider_setup(url: &str) -> ProviderCheck {
    let provider = detect_provider(url);
    let cli_name = provider.cli_tool().map(|s| s.to_string());

    let cli_installed = cli_name.as_deref().map(is_cli_available).unwrap_or(false);

    let cli_authenticated = if cli_installed {
        check_cli_authenticated(&provider)
    } else {
        false
    };

    let (api_checked, api_authenticated) = check_api_authenticated(&provider);

    ProviderCheck {
        provider,
        cli_installed,
        cli_authenticated,
        cli_name,
        api_checked,
        api_authenticated,
    }
}

/// Run the provider-specific auth status command.
fn check_cli_authenticated(provider: &ScmProvider) -> bool {
    let (cmd, args) = match provider {
        ScmProvider::GitHub => ("gh", vec!["auth", "status"]),
        ScmProvider::GitLab => ("glab", vec!["auth", "status"]),
        ScmProvider::Bitbucket => ("bb", vec!["auth", "status"]),
        _ => return false,
    };

    std::process::Command::new(cmd)
        .args(&args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Check provider API credentials from environment variables, when supported.
///
/// Returns `(api_checked, api_authenticated)` where `api_checked` indicates whether
/// any credentials were found to validate, and `api_authenticated` indicates whether
/// the validation succeeded.
fn check_api_authenticated(provider: &ScmProvider) -> (bool, bool) {
    match provider {
        ScmProvider::Bitbucket => check_bitbucket_api_authenticated(),
        _ => (false, false),
    }
}

/// Check Bitbucket API credentials from environment variables.
///
/// Checks credentials in order of preference:
/// 1. `BITBUCKET_TOKEN` (Bearer token)
/// 2. `BITBUCKET_USERNAME` + `BITBUCKET_APP_PASSWORD` (Basic auth)
///
/// Returns `(api_checked, api_authenticated)`. If one credential pair is set but
/// empty or invalid, falls through to check the next pair rather than failing
/// immediately.
fn check_bitbucket_api_authenticated() -> (bool, bool) {
    let token = std::env::var("BITBUCKET_TOKEN").ok();
    let username = std::env::var("BITBUCKET_USERNAME").ok();
    let app_password = std::env::var("BITBUCKET_APP_PASSWORD").ok();

    // Try BITBUCKET_TOKEN first (if set and non-empty)
    if let Some(token) = token {
        if !token.trim().is_empty() {
            match validate_bitbucket_bearer_token(&token) {
                Ok(true) => return (true, true),
                Ok(false) => return (true, false),
                Err(_) => {
                    // Validation failed, fall through to try username/password
                }
            }
        }
        // Token was empty or validation errored, continue to next method
    }

    // Try BITBUCKET_USERNAME + BITBUCKET_APP_PASSWORD (if both set and non-empty)
    if let (Some(username), Some(app_password)) = (username, app_password) {
        if !username.trim().is_empty() && !app_password.trim().is_empty() {
            match validate_bitbucket_basic_auth(&username, &app_password) {
                Ok(true) => return (true, true),
                Ok(false) => return (true, false),
                Err(_) => {
                    // Validation failed
                }
            }
        }
    }

    (false, false)
}

/// Validate a Bitbucket Bearer token by making an API request.
///
/// Uses ureq to avoid exposing the token in the process argument list.
/// Returns `Ok(true)` if authenticated, `Ok(false)` if credentials are invalid,
/// or `Err` if the request failed due to network/timeout issues.
fn validate_bitbucket_bearer_token(token: &str) -> Result<bool, ureq::Error> {
    let response = ureq::get("https://api.bitbucket.org/2.0/user")
        .header("Authorization", format!("Bearer {token}"))
        .call()?;

    Ok(response.status().is_success())
}

/// Validate Bitbucket Basic auth credentials by making an API request.
///
/// Uses ureq to avoid exposing credentials in the process argument list.
/// Returns `Ok(true)` if authenticated, `Ok(false)` if credentials are invalid,
/// or `Err` if the request failed due to network/timeout issues.
fn validate_bitbucket_basic_auth(username: &str, app_password: &str) -> Result<bool, ureq::Error> {
    let response = ureq::get("https://api.bitbucket.org/2.0/user")
        .header(
            "Authorization",
            format!(
                "Basic {}",
                base64_encode(&format!("{username}:{app_password}"))
            ),
        )
        .call()?;

    Ok(response.status().is_success())
}

/// Base64 encode a string for HTTP Basic auth.
fn base64_encode(s: &str) -> String {
    use base64::prelude::*;
    BASE64_STANDARD.encode(s.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- detect_provider ---

    #[test]
    fn detect_github_https() {
        assert_eq!(
            detect_provider("https://github.com/user/repo.git"),
            ScmProvider::GitHub,
        );
    }

    #[test]
    fn detect_github_ssh() {
        assert_eq!(
            detect_provider("git@github.com:user/repo.git"),
            ScmProvider::GitHub,
        );
    }

    #[test]
    fn detect_gitlab_https() {
        assert_eq!(
            detect_provider("https://gitlab.com/user/repo.git"),
            ScmProvider::GitLab,
        );
    }

    #[test]
    fn detect_gitlab_selfhosted() {
        assert_eq!(
            detect_provider("https://gitlab.mycompany.com/user/repo"),
            ScmProvider::GitLab,
        );
    }

    #[test]
    fn detect_bitbucket() {
        assert_eq!(
            detect_provider("https://bitbucket.org/user/repo.git"),
            ScmProvider::Bitbucket,
        );
    }

    #[test]
    fn detect_azure_devops() {
        assert_eq!(
            detect_provider("https://dev.azure.com/org/project/_git/repo"),
            ScmProvider::AzureDevOps,
        );
    }

    #[test]
    fn detect_azure_visualstudio() {
        assert_eq!(
            detect_provider("https://org.visualstudio.com/project/_git/repo"),
            ScmProvider::AzureDevOps,
        );
    }

    #[test]
    fn detect_unknown() {
        assert_eq!(
            detect_provider("https://sr.ht/~user/repo"),
            ScmProvider::Unknown,
        );
    }

    #[test]
    fn detect_case_insensitive() {
        assert_eq!(
            detect_provider("https://GITHUB.COM/user/repo"),
            ScmProvider::GitHub,
        );
    }

    // --- ScmProvider methods ---

    #[test]
    fn display_names() {
        assert_eq!(ScmProvider::GitHub.display_name(), "GitHub");
        assert_eq!(ScmProvider::GitLab.display_name(), "GitLab");
        assert_eq!(ScmProvider::Bitbucket.display_name(), "Bitbucket");
        assert_eq!(ScmProvider::AzureDevOps.display_name(), "Azure DevOps");
        assert_eq!(ScmProvider::Unknown.display_name(), "Unknown");
    }

    #[test]
    fn cli_tools() {
        assert_eq!(ScmProvider::GitHub.cli_tool(), Some("gh"));
        assert_eq!(ScmProvider::GitLab.cli_tool(), Some("glab"));
        assert_eq!(ScmProvider::Bitbucket.cli_tool(), Some("bb"));
        assert_eq!(ScmProvider::AzureDevOps.cli_tool(), None);
        assert_eq!(ScmProvider::Unknown.cli_tool(), None);
    }

    #[test]
    fn install_hints() {
        assert_eq!(
            ScmProvider::GitHub.install_hint(),
            Some("https://cli.github.com"),
        );
        assert_eq!(
            ScmProvider::GitLab.install_hint(),
            Some("https://gitlab.com/gitlab-org/cli"),
        );
        assert_eq!(
            ScmProvider::Bitbucket.install_hint(),
            Some("https://developer.atlassian.com/cloud/bitbucket/bitbucket-cli/"),
        );
    }

    // --- check_provider_setup ---

    #[test]
    fn check_setup_unknown_provider() {
        let check = check_provider_setup("https://sr.ht/~user/repo");
        assert_eq!(check.provider, ScmProvider::Unknown);
        assert!(!check.cli_installed);
        assert!(!check.cli_authenticated);
        assert!(check.cli_name.is_none());
        assert!(!check.api_checked);
        assert!(!check.api_authenticated);
    }

    #[test]
    fn check_setup_bitbucket_no_cli() {
        let check = check_provider_setup("https://bitbucket.org/user/repo");
        assert_eq!(check.provider, ScmProvider::Bitbucket);
        assert!(!check.cli_installed);
        assert!(!check.cli_authenticated);
        assert_eq!(check.cli_name.as_deref(), Some("bb"));
        assert!(!check.api_checked);
        assert!(!check.api_authenticated);
    }
}
