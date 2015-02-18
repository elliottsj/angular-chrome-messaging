'use strict';

var angular = require('exports?angular!angular');
require('angular-chrome-messaging');

// Declare AngularJS app
angular.module('ChromeMessagingExampleOptions', ['ChromeMessaging']);

function OptionsCtrl(ChromeBindings, ChromeMessaging) {
  var vm = this;

  vm.inputEmail = '';
  vm.inputName = '';

  vm.login = function () {
    ChromeMessaging.callMethod('ChromeMessagingExample', 'login', {
      email: vm.inputEmail,
      name: vm.inputName
    }).then(function (user) {
      console.log('Logged in as:', user);
    });
  };

  // Bind `ChromeMessagingExample.user` to `OptionsCtrl.user`
  vm.user = {};
  ChromeBindings
    .bindVariable('ChromeMessagingExample', 'user')
    .to(vm, 'user');

  vm.isLoggedIn = function () {
    return !angular.equals(vm.user, {});
  };
}
angular
  .module('ChromeMessagingExampleOptions')
  .controller('OptionsCtrl', OptionsCtrl);
