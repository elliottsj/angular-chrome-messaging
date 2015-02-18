angular-chrome-messaging
========================

AngularJS interface for chrome.runtime messaging. Allows for remote procedure calls and data binding.

_NOTE: With Facebook's introduction of the [Flux Architecture](https://facebook.github.io/flux/), the two-way
data binding provided by this module has become poor practice, so I wouldn't recommend it for most situations._

## Overview

[Google Chrome Extensions](https://developer.chrome.com/extensions/overview) usually consist of:
 - A [background script](https://developer.chrome.com/extensions/background_pages) that continuously runs in the background
 - A [content script]() that's loaded on pages you visit
 - A browser action or page action popup
 - An options page

angular-chrome-messaging allows:
 - Synchronizing data between separate scripts via two-way variable binding
 - Remote procedure calls

## Usage:

#### Two-way binding

In the background script, publish the variable to be bound:

```js
// background.js
/**
 * A service to hold global state and methods for the extension
 *
 * @param ChromeBindings
 * @constructor
 */
function BackgroundService(ChromeBindings) {
  this.user = {};
  // Publish the `user` object so it can be read & modified by other scripts
  ChromeBindings.publishVariable(this, 'user');
}
angular
  .module('ChromeMessagingExample')
  .service('BackgroundService', BackgroundService);
```

In another script (options/popup/contentscript), bind to the variable:

```js
// options.js

function OptionsCtrl(ChromeBindings, ChromeMessaging) {
  // Bind `ChromeMessagingExample.user` to `OptionsCtrl.user`
  this.user = {};
  ChromeBindings
    .bindVariable('ChromeMessagingExample', 'user')
    .to(this, 'user');
}
angular
  .module('ChromeMessagingExampleOptions')
  .controller('OptionsCtrl', OptionsCtrl);
```

#### Remote procedure calls

Publish methods using [`angular.Module.run`](https://docs.angularjs.org/api/ng/type/angular.Module):

```js
// background.js

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
```

Call them in from other scripts:

```js
// options.js

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
}
angular
  .module('ChromeMessagingExampleOptions')
  .controller('OptionsCtrl', OptionsCtrl);
```

## Example

To run the example:

1. Clone this repository.
2. Build the example:

    ```shell
    cd example
    npm install
    gulp build
    ```

3. In Chrome, load `example/build/` as an unpacked extension.
