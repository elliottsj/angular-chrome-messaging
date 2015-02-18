'use strict';

var angular = require('exports?angular!angular');
require('angular-chrome-messaging');

// Declare AngularJS app
angular.module('ChromeMessagingExample', ['ChromeMessaging']);

/*
 * Provider configuration
 */
angular
  .module('ChromeMessagingExample')
  .config(function (ChromeMessagingProvider) {
    // Set module name used to publish methods; callers must use this name
    ChromeMessagingProvider.moduleName = 'ChromeMessagingExample';
  });

// Declare `run` method to run once all modules are loaded
angular.module('ChromeMessagingExample')
  .run(function (ChromeMessaging, BackgroundService) {
    /* Publish `BackgroundService.login` so it can be called from other scripts:
     *   ChromeMessaging.callMethod(
     *     'ChromeMessagingExample',
     *     'login',
     *     {email: 'test@example.com', name: 'Alice'}
     *   ).then(function (user) {
     *     console.log(user);
     *   });
     */
    ChromeMessaging.publish(
      'login',
      BackgroundService.login
    );

    ChromeMessaging.publish(
      'logout',
      BackgroundService.logout
    );
  });

/**
 * A service to hold global state and methods for the extension
 *
 * @param ChromeBindings
 * @constructor
 */
function BackgroundService(ChromeBindings) {
  var s = this;

  s.user = {};
  // Publish the `user` object so it can be read & modified by other scripts
  ChromeBindings.publishVariable(s, 'user');

  s.login = function (user) {
    s.user = user;
    console.log('Logged in as:', s.user);
    return s.user;
  };

  s.logout = function () {
    s.user = {};
    console.log('Logged out');
  };
}
angular
  .module('ChromeMessagingExample')
  .service('BackgroundService', BackgroundService);
