'use strict';

(function () {
  /**
   * Return a function which can only be executed once.
   *
   * Stolen from {@link http://davidwalsh.name/javascript-once}
   *
   * @param {Function} fn
   * @returns {Function}
   */
  function once(fn) {
    var result;

    return function() {
      if (fn) {
        result = fn.apply(this, arguments);
        fn = null;
      }
      return result;
    };
  }

  /*
   * angular-chrome-messaging uses `chrome.runtime.connect` to allow
   * separate sandboxed scripts to pass data between each other.
   */
  angular.module('ChromeMessaging', []);

  function PublicationFactory($rootScope, $q) {
    /**
     * A method published by a sandboxed Chrome script.
     *
     * @constructor
     */
    function Publication(moduleName, methodName, method, options) {
      // Keep model reference
      var m = this;

      // Set default parameter values
      options = options || {};

      m.moduleName = moduleName;
      m.methodName = methodName;
      m.method = method;

      /*
       * If the publication can be subscribed to,
       * keep a list of subscriber ports and notify them via $rootScope.$watch
       *
       * Note: `method` must not take any parameters
       */
      if (options.canSubscribe) {
        m.subscribers = [];
        $rootScope.$watch(m.method, function (newValue) {
          m.notifySubscribers(m.subscribers, newValue);
        }, true);
      }

      /*
       * Upon client connection, call `method` and return the result to the client.
       */
      chrome.runtime.onConnect.addListener(function (port) {
        // Client is connecting through `port`
        if (port.name !== moduleName + '.' + methodName) {
          // Client isn't trying to call this publication's method; abort
          return;
        }

        // When client calls the method, return the method result
        port.onMessage.addListener(function (internalRequest) {
          // Keep a port reference if the method can be subscribed to
          if (options.canSubscribe && internalRequest.watch) {
            // Add the port to the list of subscribers if it doesn't already exist
            if (m.subscribers.indexOf(port) === -1) {
              m.subscribers.push(port);

              // When client disconnects, remove the subscription if necessary
              port.onDisconnect.addListener(function () {
                m.subscribers.splice(m.subscribers.indexOf(port), 1);
              });
            }
          }

          // Call `method` and immediately notify the client
          var result =  m.method(internalRequest.params);
          m.notifyClient(port, result);
        });
      });
    }

    /**
     * Notify the given client port of the result.
     *
     * @param clientPort
     * @param result
     */
    Publication.prototype.notifyClient = function (clientPort, result) {
      $q.when(result).then(function success(result) {
        clientPort.postMessage({
          status: 'resolved',
          data: result
        });
      }, function failure(reason) {
        clientPort.postMessage({
          status: 'rejected',
          data: reason
        });
      });
    };

    /**
     * Notify subscribers of the new result.
     */
    Publication.prototype.notifySubscribers = function (subscribers, result) {
      var m = this;
      angular.forEach(subscribers, function (subscriberPort) {
        m.notifyClient(subscriberPort, result);
      });
    };

    return Publication;
  }
  angular
    .module('ChromeMessaging')
    .factory('Publication', PublicationFactory);


  function ChromeMessaging($q, Publication, moduleName) {
    /**
     * Publish a method to be accessible from any script.
     * Subscribers are updated when the result changes.
     *
     * Usage:
     *
     *   ChromeMessaging.publish(
     *     'getDocuments',
     *     SherlockeService.getDocuments
     *   );
     *
     * @param methodName
     * @param method
     * @param [options]
     */
    this.publish = function (methodName, method, options) {
      if (!moduleName) {
        throw new Error('You must configure ChromeMessagingProvider with a moduleName');
      }

      return new Publication(moduleName, methodName, method, options).method;
    };

    /**
     * Call a method on an external script. The returned promise is resolved if
     * the remote method returns a value or a resolved promise, or rejected if
     * the remote method returns a rejected promise.
     *
     * If `watch == true`, then notify the promise every time someone calls the same method.
     * The returned promise is never resolved, only notified or rejected.
     * If the promise is rejected, no additional notifications are made.
     *
     * @param moduleName  App identifier which has published `methodName`
     * @param methodName  A published method
     * @param [params]    JSON-serializable parameters to pass to the method
     * @param watch       true if the returned promise should be notified when the value changes
     * @returns {Promise} Resolves with the result
     */
    var _callMethod = function (moduleName, methodName, params, watch) {
      var deferred = $q.defer();

      var port = chrome.runtime.connect({
        name: moduleName + '.' + methodName
      });

      // TODO: reject the deferred if the port is not valid

      // Send the method parameters, and don't watch the result
      port.postMessage({
        watch: watch,
        params: params
      });
      port.onMessage.addListener(function (internalResult) {
        if (internalResult.status === 'resolved') {
          if (watch) {
            deferred.notify(internalResult.data);
          } else {
            deferred.resolve(internalResult.data);
          }
        } else {
          deferred.reject(internalResult.data);
        }
      });

      return deferred.promise;
    };

    /**
     * Call a method on an external script.
     *
     * @param moduleName  App identifier which has published `methodName`
     * @param methodName  A published method
     * @param [params]    JSON-serializable parameters to pass to the method
     * @returns {Promise} Resolves with the result
     */
    this.callMethod = function (moduleName, methodName, params) {
      return _callMethod(moduleName, methodName, params, false);
    };

    /**
     * Call a method on an external script, and notify the promise every time
     * someone calls the same method.
     *
     * The returned promise is never resolved, only notified or rejected.
     * If the promise is rejected, no additional notifications are made.
     *
     * @param moduleName  App identifier which has published `methodName`
     * @param methodName  A published method
     * @param [params]    JSON-serializable parameters to pass to the method
     * @returns {Promise} Resolves with the result
     */
    this.subscribe = function (moduleName, methodName, params) {
      return _callMethod(moduleName, methodName, params, true);
    };
  }

  /**
   * Service that allows sandboxed Chrome scripts to publish and call each others
   * methods
   *
   * Internal message schema:
   *   Request:
   *     {
 *       watch: true|false,
 *       params: <any>
 *     }
   *
   *   Response:
   *     {
 *       type: "data"|"promise",
 *       status: null|"resolved"|"rejected",
 *       data: <any>
 *     }
   *
   * @constructor
   */
  function ChromeMessagingProvider() {
    var p = this;

    p.moduleName = null;

    this.$get = function ($q, Publication) {
      return new ChromeMessaging($q, Publication, p.moduleName);
    };
  }
  angular
    .module('ChromeMessaging')
    .provider('ChromeMessaging', ChromeMessagingProvider);


  /**
   * Service that allows a host script to publish variables to be bound by client scripts.
   *
   * @constructor
   */
  function ChromeBindings($q, $rootScope, ChromeMessaging) {
    var checkKeyExists = function (controller, variableName) {
      if (!(variableName in controller)) {
        throw new Error('ChromeBindings could not find variable', variableName);
      }
    };

    /**
     * Publishes a variable to be bound by a client
     *
     * @param controller The object with member `variableName`
     * @param {string} variableName The name of the variable on the given `controller`
     */
    this.publishVariable = function (controller, variableName) {
      ChromeMessaging.publish('__cm_get_' + variableName, function getHostValue() {
        return controller[variableName];
      }, {
        canSubscribe: true
      });

      ChromeMessaging.publish('__cm_set_' + variableName, function setHostValue(value) {
        controller[variableName] = value;
      });
    };

    /**
     * Bind the remote variable to the local controller and variable.
     * Return a promise which is resolved when variable has bound successfully.
     *
     * @param moduleName
     * @param hostVariableName
     * @returns {{to: Function}}
     */
    this.bindVariable = function (moduleName, hostVariableName) {
      var bindToAccessors = function (getter, setter) {
        // Return a promise that's resolved when binding has completed with a non-null, non-undefined value
        return $q(function (resolve) {
          var bindLocalToHost = once(function () {
            // Set the remote variable when the local one changes
            $rootScope.$watch(function () {
              return getter();
            }, function (value) {
              ChromeMessaging.callMethod(moduleName, '__cm_set_' + hostVariableName, value);
            });
          });

          var resolveOnce = once(resolve);

          // Subscribe to the getter method on the host
          ChromeMessaging.subscribe(moduleName, '__cm_get_' + hostVariableName).then(null, null, function notified(newValue) {
            setter(newValue);

            // When the local variable has been set the first time, bind the local variable to the host
            // by attaching a `$watch` listener.
            bindLocalToHost();

            // Once the local variable is assigned a non-null, non-undefined value, resolve the promise
            if (newValue !== null && newValue !== undefined) {
              resolveOnce(newValue);
            }
          });
        });
      };

      return {
        to: function (controller, localVariableName) {
          checkKeyExists(controller, localVariableName);

          var getter = function () {
            return controller[localVariableName];
          };

          var setter = function (newValue) {
            controller[localVariableName] = newValue;
          };

          return bindToAccessors(getter, setter);
        },
        toAccessors: bindToAccessors
      };
    };
  }
  angular
    .module('ChromeMessaging')
    .service('ChromeBindings', ChromeBindings);

}());
