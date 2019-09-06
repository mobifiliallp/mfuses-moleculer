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
 *   "mfuses": {
 *     "logger": {
 *       "level": "info"
 *     },
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
 * mfuses.logger.level - Logger level for service logging. Defaults to 'info'.
 * mfuses.config.namespace - Unique namespace for related services/modules. Defaults to 'mol-default'.
 * mfuses.config.transporter - The underlying transporter configuration, refer moleculer docs for details. Defaults to TCP (not recommended).
 * mfuses.config.registry - optional - registry settings, refer moleculer docs for details. Defaults to 'Random' strategy.
 * mfuses.enableWebApi - true/false - Enable/disable the web API module. Defaults to false.
 * mfuses.webApiSettings.port - port for the web API module. Defaults to 8080.
 * mfuses.webApiSettings.path - path prefix for the web API module. All APIs will begin with this prefix. Defaults to '/srvapi'
 */

const Moleculer = require('moleculer')
const config = require('config')
const lodash = require('lodash')
const isStream = require('is-stream')
const MfLogger = require('mf-logger')

const logger = MfLogger.getContextLogger('mfuses-moleculer')

// The default service configuration
let serviceConfig = {
  namespace: 'MFuSes-default',
  transporter: 'TCP',
  registry: {
    strategy: 'Random'
  }
}

// Defaut moleculer-web settings
let webApiSettings = {
  port: 8080,
  path: '/srvapi'
}

// Default logger config
let loggerSettings = {}
if (config.has('mfuses')) {
  // Merge service configuration from application config
  if (config.has('mfuses.config')) {
    const appServiceConfig = config.get('mfuses.config')
    serviceConfig = lodash.mergeWith(serviceConfig, appServiceConfig)
  }

  // Merge logger configuration from application config
  if (config.has('mfuses.logger')) {
    const appLoggerSettings = config.get('mfuses.logger')
    loggerSettings = lodash.mergeWith(loggerSettings, appLoggerSettings)
  }
  const serviceLogger = MfLogger.getContextLogger('mfuses').getCoreLogger()
  serviceConfig.logger = (bindings) => {
    const bindingsWithLoggerSettings = lodash.mergeWith(bindings, loggerSettings)
    return serviceLogger.child(bindingsWithLoggerSettings)
  }
} else if (config.has('usMoleculer')) {
  logger.warn('The \'usMoleculer\' configuration entry is deprecated, use \'mfuses\' instead')
  // Merge service configuration from application config
  if (config.has('usMoleculer.config')) {
    const appServiceConfig = config.get('usMoleculer.config')
    serviceConfig = lodash.mergeWith(serviceConfig, appServiceConfig)
  }

  // Merge logger configuration from application config
  if (config.has('usMoleculer.logger')) {
    const appLoggerSettings = config.get('usMoleculer.logger')
    loggerSettings = lodash.mergeWith(loggerSettings, appLoggerSettings)
  }
  const serviceLogger = MfLogger.getContextLogger('usMoleculer').getCoreLogger()
  serviceConfig.logger = (bindings) => {
    const bindingsWithLoggerSettings = lodash.mergeWith(bindings, loggerSettings)
    return serviceLogger.child(bindingsWithLoggerSettings)
  }
} else {
  logger.warn('The \'mol-service\' configuration entry is deprecated, use \'mfuses\' instead')
  // Merge service configuration from application config
  if (config.has('mol-service.config')) {
    const appServiceConfig = config.get('mol-service.config')
    serviceConfig = lodash.mergeWith(serviceConfig, appServiceConfig)
  }

  // Merge logger configuration from application config
  if (config.has('mol-service.logger')) {
    const appLoggerSettings = config.get('mol-service.logger')
    loggerSettings = lodash.mergeWith(loggerSettings, appLoggerSettings)
  }
  const serviceLogger = MfLogger.getContextLogger('mol-service').getCoreLogger()
  serviceConfig.logger = (bindings) => {
    const bindingsWithLoggerSettings = lodash.mergeWith(bindings, loggerSettings)
    return serviceLogger.child(bindingsWithLoggerSettings)
  }
}
logger.trace(serviceConfig, 'Configuring moleculer service')

// Create and start the broker
const broker = new Moleculer.ServiceBroker(serviceConfig)
broker.start()

// moleculer-web is disabled by default, check if application config overrides it
if ((config.has('usMoleculer.enableWebApi') && config.get('usMoleculer.enableWebApi')) ||
  (config.has('mol-service.enableWebApi') && config.get('mol-service.enableWebApi'))) {
  // Merge web API configuration from application config
  if (config.has('usMoleculer.webApiSettings')) {
    const appWebApiSettings = config.get('usMoleculer.webApiSettings')
    webApiSettings = lodash.mergeWith(webApiSettings, appWebApiSettings)
  } else if (config.has('mol-service.webApiSettings')) {
    const appWebApiSettings = config.get('mol-service.webApiSettings')
    webApiSettings = lodash.mergeWith(webApiSettings, appWebApiSettings)
  }

  try {
    const ApiService = require('moleculer-web') // eslint-disable-line global-require, import/no-unresolved

    broker.createService({
      mixins: [ApiService],
      settings: webApiSettings
    })
  } catch (e) {
    logger.error(e, 'Failed to start moleculer web module, ensure it is added to your main project as a dependency')
  }
}

/**
 * Moleculer service broker.
 * @deprecated
 */
module.exports.serviceBroker = broker

/**
 * MFuSes service broker.
 */
module.exports.mfusesBroker = broker

/**
 * Calls a service.
 * @param {String} actionName The service action to call.
 * @param {Object|stream} callParams Parameters for the call, can be a stream.
 * @param {Object} callOptions Options for the call.
 * @returns Promise
 */
function call (actionName, callParams, callOptions) {
  logger.traceF('call', { actionName, callOptions })

  let finalCallParams
  if (isStream(callParams)) {
    finalCallParams = callParams
  } else {
    finalCallParams = Object.assign({}, callParams)
  }

  const finalCallOptions = Object.assign({}, callOptions)

  const callResult = broker.call(actionName, finalCallParams, finalCallOptions)
  callResult.catch((e) => {
    logger.error(e, `Error calling ${actionName}`)
  })

  return callResult
}

/**
 * Emit an event.
 * @param {string} eventName The event name.
 * @param {Object} payload The event data / payload.
 * @param {string|string[]} groups The groups to send the event to.
 */
function emit (eventName, payload, groups) {
  logger.traceF('emit', { eventName, groups })

  broker.emit(eventName, payload, groups)
}

/**
 * Broadcast an event.
 * @param {string} eventName The event name.
 * @param {Object} payload The event data / payload.
 * @param {string|string[]} groups The groups to send the event to.
 */
function broadcast (eventName, payload, groups) {
  logger.traceF('broadcast', { eventName, groups })

  broker.broadcast(eventName, payload, groups)
}

/**
 * MFuSes Helper.
 */
const mfusesHelper = {
  call,
  emit,
  broadcast
}
module.exports.mfusesHelper = mfusesHelper

/**
 * @type Moleculer
 */
module.exports.Moleculer = Moleculer
