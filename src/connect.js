'use strict';

angular.module('sfObject', [])
  .factory('Connect', function($q, $rootScope, ForceTk, SfUrl, SfClientId, SfClientSecret, SfProxyUrl, SfUsername, SfPassword) {

    var conn;
    var defer = $q.defer();

    if (isForce > 0) {
      conn  = new remotetk.Client();
      defer.resolve(conn);

    } else {
      conn = new jsforce.Connection({
        oauth2 : {
          loginUrl : SfUrl,
          clientId : SfClientId,
          clientSecret : SfClientSecret,
          // redirectUri : '',
          proxyUrl: SfProxyUrl
        },
        proxyUrl: SfProxyUrl
      });

      conn.login(SfUsername, SfPassword,
        function(err,res) {

          if (err) {
            throw err;
            return console.error(err);
          }

          var client = ForceTk(conn.oauth2.clientId, conn.oauth2.loginUrl, null);
          client.setSessionToken(conn.accessToken, null, conn.instanceUrl);
          client.jsForce = conn;
          defer.resolve(client);
        }
      );
    }
    return defer.promise;
  });

  var isForce = window.location.host.indexOf("force.com");
  if (isForce > 0) {
    angular.module('sfObject')
      .constant('SfUrl', 'https://XXX.salesforce.com')
      .constant('SfClientId', 'XXXXXXX')
      .constant('SfClientSecret', 'XXXXXXXX')
      .constant('SfProxyUrl', 'XXXXXXXX')
      .constant('SfUsername', 'user@example.com')
      .constant('SfPassword', 'XXXXXXXX');
  }
