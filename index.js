/**
 * Mobifilia uServices (MFuSes) - Moleculer service wrapper.
 *
 * Wraps service broker configuration and initialization with suitable defaults.
 * If you enable the web API in your configuration, you will need to include 'moleculer-web' in your dependencies.
 * You will also need to include dependencies for you configured transport layer.
 * Please refer the moleculer documentation for details -
 * https://moleculer.services/0.12/docs/transporters.html
 *
 * Configuration -
 *   "usMoleculer": {
 *     "config": {
 *       "namespace": "mol-default",
 *       "transporter": "nats://localhost:4222"
 *     },
 *     "enableWebApi": true,
 *     "webApiSettings": {
 *       "port": 8000,
 *       "path": "/srvapi"
 *     }
 *   }
 * usMolecular.config.namespace - Unique namespace for related services/modules. Defaults to 'mol-default'.
 * usMolecular.config.transporter - The underlying transporter configuration, refer moleculer docs for details. Defaults to TCP (not recommended).
 * usMolecular.config.registry - optional - registry settings, refer moleculer docs for details. Defaults to 'Random' strategy.
 * usMolecular.enableWebApi - true/false - Enable/disable the web API module. Defaults to false.
 * usMolecular.webApiSettings.port - port for the web API module. Defaults to 8080.
 * usMolecular.webApiSettings.path - path prefix for the web API module. All APIs will begin with this prefix. Defaults to '/srvapi'
 *
 */
const { ServiceBroker } = require('moleculer');
const config = require('config');
const _ = require('lodash');
const logWrapper = require('mf-logwrapper');

const logger = logWrapper.getContextLogger('mfuses-moleculer');

// The default service configuration
let serviceConfig = {
  namespace: 'mol-default',
  transporter: 'TCP',
  registry: {
    strategy: 'Random',
  },
};

// Defaut moleculer-web settings
let webApiSettings = {
  port: 8080,
  path: '/srvapi',
};

// Merge service configuration from application config
if (config.has('usMoleculer.config')) {
  const localServiceConfig = config.get('usMoleculer.config');
  serviceConfig = _.mergeWith(serviceConfig, localServiceConfig);
}

const serviceLogger = logWrapper.getLogger('usMoleculer');
serviceConfig.logger = bindings => serviceLogger.child(bindings);

logger.trace(serviceConfig, 'Configuring moleculer service');

// Create and start the broker
const broker = new ServiceBroker(serviceConfig);
broker.start();

// moleculer-web is disabled by default, check if application config overrides it
if (config.has('usMoleculer.enableWebApi') && config.get('usMoleculer.enableWebApi')) {
  if (config.has('usMoleculer.webApiSettings')) {
    const localWebApiSettings = config.get('usMoleculer.webApiSettings');
    webApiSettings = _.mergeWith(webApiSettings, localWebApiSettings);
  }

  try {
    const ApiService = require('moleculer-web'); // eslint-disable-line global-require, import/no-unresolved

    broker.createService({
      mixins: [ApiService],
      settings: webApiSettings,
    });
  } catch (e) {
    logger.error(e, 'Failed to start moleculer web module, ensure it is added to your main project as a dependency');
  }
}

/**
 * Moleculer service broker.
 */
module.exports.serviceBroker = broker;
