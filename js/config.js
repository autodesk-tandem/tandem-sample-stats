// Configuration for different environments

const prodEnvironment = {
  name: "prod",
  oxygenHost: "https://accounts.autodesk.com",
  forgeHost: "https://developer.api.autodesk.com",
  forgeKey: "GiedMKsyhXTTG34RZR9KSEGbAgjxSIJm45sJASP9EjOQSAX8", // TODO: Replace with your Forge Key to develop locally
  loginRedirect: "http://localhost:8000",
  tandemDbBaseURL: "https://developer.api.autodesk.com/tandem/v1",
  tandemAppBaseURL: "https://tandem.autodesk.com/app",
};

const stgEnvironment = {
  name: "stg",
  oxygenHost: "https://accounts-staging.autodesk.com",
  forgeHost: "https://developer-stg.api.autodesk.com",
  forgeKey: "", // TODO: Replace with your Forge Key to develop locally
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
