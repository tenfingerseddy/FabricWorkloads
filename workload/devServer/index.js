/**
 * DevServer APIs index file
 * Exports all API routers for the dev server
 */

const manifestApi = require('./manifestApi');

/**
 * Register all dev server APIs with an Express application
 * @param {object} app Express application
 */
function registerDevServerApis(app) {
  console.log('*** Mounting Manifest API ***');
  app.use('/', manifestApi);
}

function registerDevServerComponents() {
  console.log("*********************************************************************");
  console.log('***                Mounting Dev Server Components                ***');

  // Log playground availability
  const workloadName = process.env.WORKLOAD_NAME || 'unknown-workload';
  if (process.env.ENABLE_PLAYGROUND === 'true') {
    console.log('Playgrounds are enabled in development mode:');
    console.log(`  Client-SDK Playground: https://app.fabric.microsoft.com/workloads/${workloadName}/playground-client-sdk`);
    console.log(`  Data Playground: https://app.fabric.microsoft.com/workloads/${workloadName}/playground-data`);
  } else {
    console.log('Playgrounds are disabled. Set ENABLE_PLAYGROUND=true to enable.');
  }
  console.log("*********************************************************************");
}

module.exports = {
  manifestApi,
  registerDevServerApis,
  registerDevServerComponents
};
