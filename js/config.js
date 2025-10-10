// Configuration for different environments

const prodEnvironment = {
  name: "prod",
  oxygenHost: "https://accounts.autodesk.com",
  apsHost: "https://developer.api.autodesk.com",
  apsKey: "GiedMKsyhXTTG34RZR9KSEGbAgjxSIJm45sJASP9EjOQSAX8", // TODO: Replace with your APS Client ID to develop locally
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
  // Use production by default
  return prodEnvironment;
  
  // Uncomment to use staging
  // return stgEnvironment;
}
