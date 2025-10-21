// Configuration for different environments

const prodEnvironment = {
  name: "prod",
  oxygenHost: "https://accounts.autodesk.com",
  apsHost: "https://developer.api.autodesk.com",
  apsKey: "GiedMKsyhXTTG34RZR9KSEGbAgjxSIJm45sJASP9EjOQSAX8", // Safe to commit - this app uses PKCE (see README for details)
  loginRedirect: "http://localhost:8000",
  tandemDbBaseURL: "https://developer.api.autodesk.com/tandem/v1",
  tandemAppBaseURL: "https://tandem.autodesk.com/app",
};

const stgEnvironment = {
  name: "stg",
  oxygenHost: "https://accounts-staging.autodesk.com",
  apsHost: "https://developer-stg.api.autodesk.com",
  apsKey: "", // TODO: Replace with your APS Client ID to develop locally
  loginRedirect: "http://localhost:8000",
  tandemDbBaseURL: "https://tandem-stg.autodesk.com/api/v1",
  tandemAppBaseURL: "https://tandem-stg.autodesk.com/app",
};

/**
 * Get the current environment configuration
 * @returns {object} Environment configuration
 */
export function getEnv() {
  // Auto-detect redirect URL based on current location
  const isGitHubPages = window.location.hostname.includes('github.io');
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  let loginRedirect;
  if (isGitHubPages) {
    loginRedirect = window.location.origin + window.location.pathname;
  } else if (isLocalhost) {
    loginRedirect = `http://localhost:${window.location.port || 8000}`;
  } else {
    // Default to current origin for other deployments
    loginRedirect = window.location.origin;
  }
  
  // Return production environment with dynamic redirect
  return {
    ...prodEnvironment,
    loginRedirect: loginRedirect
  };
  
  // Uncomment to use staging
  // return stgEnvironment;
}
