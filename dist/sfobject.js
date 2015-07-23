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

angular.module('sfObject')
  .directive('sfArray', function() {
    return {
      restrict: 'A',
      require: 'ngModel',
      link: function(scope, element, attrs, controller) {

        function toView(val) {
          if (val) return val.split(';');
        }

        function toModel(val) {
          if (val) return val.join(';');
        }

        controller.$formatters.push(toView);
        controller.$parsers.push(toModel);
      }
    };
  });

angular.module('sfObject')
  .directive('sfDate', function() {
    return {
      restrict: 'A',
      require: 'ngModel',
      link: function(element, scope, attrs, dateCtrl) {
        function dateFromSF(val) {
          if (val) return new Date(val)
        }

        function dateToSF(val) {
          if (val) return val.getTime();
        }

        dateCtrl.$formatters.push(dateFromSF);
        dateCtrl.$parsers.push(dateToSF);
      }
    };
  });

'use strict';

angular.module('sfObject')
  .factory('ForceTk', function ($http) {

    return function(clientId, loginUrl, proxyUrl) {

      var forcetk = window.forcetk;

      if (forcetk === undefined) {
          forcetk = {};
      }

      if (forcetk.Client === undefined) {

          /**
           * The Client provides a convenient wrapper for the Force.com REST API,
           * allowing JavaScript in Visualforce pages to use the API via the Ajax
           * Proxy.
           * @param [clientId=null] 'Consumer Key' in the Remote Access app settings
           * @param [loginUrl='https://login.salesforce.com/'] Login endpoint
           * @param [proxyUrl=null] Proxy URL. Omit if running on Visualforce or
           *                  Cordova etc
           * @constructor
           */
          forcetk.Client = function(clientId, loginUrl, proxyUrl) {
              this.clientId = clientId;
              this.loginUrl = loginUrl || 'https://login.salesforce.com/';
              this.proxyUrl = this.loginUrl;
              // if (typeof proxyUrl === 'undefined' || proxyUrl === null) {
              //     if (location.protocol === 'file:') {
              //         // In Cordova
              //         this.proxyUrl = null;
              //     } else {
              //         // In Visualforce
              //         this.proxyUrl = location.protocol + "//" + location.hostname
              //             + "/services/proxy";
              //     }
              // } else {
              //     // On a server outside VF
              //     this.proxyUrl = proxyUrl;
              //     this.authzHeader = "X-Authorization";
              // }

              this.authzHeader = "Authorization";

              this.refreshToken = null;
              this.sessionId = null;
              this.apiVersion = null;
              this.instanceUrl = null;
              this.asyncAjax = true;
              this.userAgentString = null;
          }

          /**
           * Set a User-Agent to use in the client.
           * @param uaString A User-Agent string to use for all requests.
           */
          forcetk.Client.prototype.setUserAgentString = function(uaString) {
              this.userAgentString = uaString;
          }

          /**
           * Set a refresh token in the client.
           * @param refreshToken an OAuth refresh token
           */
          forcetk.Client.prototype.setRefreshToken = function(refreshToken) {
              this.refreshToken = refreshToken;
          }

          /**
           * Refresh the access token.
           * @param callback function to call on success
           * @param error function to call on failure
           */
          forcetk.Client.prototype.refreshAccessToken = function(callback, error) {
              var that = this;
              var url = this.loginUrl + '/services/oauth2/token';
              // return $j.ajax({
                return $http({
                  method: 'POST',
                  url: (this.proxyUrl !== null) ? this.proxyUrl: url,
                  cache: false,
                  processData: false,
                  data: 'grant_type=refresh_token&client_id=' + this.clientId + '&refresh_token=' + this.refreshToken,
                  success: callback,
                  error: error,
                  dataType: "json",
                  beforeSend: function(xhr) {
                      if (that.proxyUrl !== null) {
                          xhr.setRequestHeader('SalesforceProxy-Endpoint', url);
                      }
                  }
              });
          }

          /**
           * Set a session token and the associated metadata in the client.
           * @param sessionId a salesforce.com session ID. In a Visualforce page,
           *                   use '{!$Api.sessionId}' to obtain a session ID.
           * @param [apiVersion="21.0"] Force.com API version
           * @param [instanceUrl] Omit this if running on Visualforce; otherwise
           *                   use the value from the OAuth token.
           */
          forcetk.Client.prototype.setSessionToken = function(sessionId, apiVersion, instanceUrl) {
              this.sessionId = sessionId;
              this.apiVersion = (typeof apiVersion === 'undefined' || apiVersion === null)
                  ? 'v27.0': apiVersion;
              if (typeof instanceUrl === 'undefined' || instanceUrl == null) {
                  // location.hostname can be of the form 'abc.na1.visual.force.com',
                  // 'na1.salesforce.com' or 'abc.my.salesforce.com' (custom domains).
                  // Split on '.', and take the [1] or [0] element as appropriate
                  var elements = location.hostname.split(".");
                  var instance = null;
                  if(elements.length == 4 && elements[1] === 'my') {
                      instance = elements[0] + '.' + elements[1];
                  } else if(elements.length == 3){
                      instance = elements[0];
                  } else {
                      instance = elements[1];
                  }
                  this.instanceUrl = "https://" + instance + ".salesforce.com";
              } else {
                  this.instanceUrl = instanceUrl;
              }
          }

          /*
           * Low level utility function to call the Salesforce endpoint.
           * @param path resource path relative to /services/data
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           * @param [method="GET"] HTTP method for call
           * @param [payload=null] payload for POST/PATCH etc
           */
          forcetk.Client.prototype.ajax = function(path, callback, error, method, payload, retry) {
              var that = this;
              var url = this.instanceUrl + '/services/data' + path;
              // return $j.ajax({
              return $http({
                  method: method || "GET",
                  async: this.asyncAjax,
                  url: url,
                  contentType: method == "DELETE" || method == "GET" ? null : 'application/json',
                  cache: false,
                  processData: false,
                  data: payload,
                  headers: {
                    'Authorization': "Bearer " + that.sessionId
                  },
                  // error: (!this.refreshToken || retry ) ? error : function(jqXHR, textStatus, errorThrown) {
                  //     if (jqXHR.status === 401) {
                  //         that.refreshAccessToken(function(oauthResponse) {
                  //             that.setSessionToken(oauthResponse.access_token, null,
                  //                 oauthResponse.instance_url);
                  //             that.ajax(path, callback, error, method, payload, true);
                  //         }, error);
                  //     } else {
                  //         error(jqXHR, textStatus, errorThrown);
                  //     }
                  // },
                  dataType: "json"
                  // beforeSend: function(xhr) {
                  //     // if (that.proxyUrl !== null) {
                  //     //     xhr.setRequestHeader('SalesforceProxy-Endpoint', url);
                  //     // }
                  //     xhr.setRequestHeader(that.authzHeader, "Bearer " + that.sessionId);
                  //     var forceTkAgent = 'salesforce-toolkit-rest-javascript/' + that.apiVersion;
                  //     if (that.userAgentString !== null) {
                  //       //  xhr.setRequestHeader('X-User-Agent', that.userAgentString + " " + forceTkAgent);
                  //         xhr.setRequestHeader('User-Agent', that.userAgentString); // XXX this line might be useless
                  //     }
                  //     else {
                  //       //  xhr.setRequestHeader('X-User-Agent', forceTkAgent);
                  //     }
                  // }
              }).success(callback).error(error);
          }

          /**
           * Utility function to query the Chatter API and download a file
           * Note, raw XMLHttpRequest because JQuery mangles the arraybuffer
           * This should work on any browser that supports XMLHttpRequest 2 because arraybuffer is required.
           * For mobile, that means iOS >= 5 and Android >= Honeycomb
           * @author Tom Gersic
           * @param path resource path relative to /services/data
           * @param mimetype of the file
           * @param callback function to which response will be passed
           * @param [error=null] function to which request will be passed in case of error
           * @param rety true if we've already tried refresh token flow once
           **/
          forcetk.Client.prototype.getChatterFile = function(path,mimeType,callback,error,retry) {
              var that = this;
              var url = this.instanceUrl + path;
              var request = new XMLHttpRequest();
              request.open("GET",  (this.proxyUrl !== null) ? this.proxyUrl: url, true);
              request.responseType = "arraybuffer";
              request.setRequestHeader(that.authzHeader, "Bearer " + that.sessionId);
              //request.setRequestHeader('X-User-Agent', 'salesforce-toolkit-rest-javascript/' + that.apiVersion);
              if (that.userAgentString !== null) {
                  xhr.setRequestHeader('User-Agent', that.userAgentString);
              }
              if (this.proxyUrl !== null) {
                  request.setRequestHeader('SalesforceProxy-Endpoint', url);
              }
              request.onreadystatechange = function() {
                  // continue if the process is completed
                  if (request.readyState == 4) {
                      // continue only if HTTP status is "OK"
                      if (request.status == 200) {
                          try {
                              // retrieve the response
                              callback(request.response);
                          } catch(e) {
                              // display error message
                              alert("Error reading the response: " + e.toString());
                          }
                      }
                      //refresh token in 401
                      else if(request.status == 401 && !retry) {
                          that.refreshAccessToken(function(oauthResponse) {
                              that.setSessionToken(oauthResponse.access_token, null, oauthResponse.instance_url);
                              that.getChatterFile(path, mimeType, callback, error, true);
                          }, error);
                      } else {
                          // display status message
                          error(request,request.statusText,request.response);
                      }
                  }
              }
              request.send();
          }

          /*
           * Low level utility function to call the Salesforce endpoint specific for Apex REST API.
           * @param path resource path relative to /services/apexrest
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           * @param [method="GET"] HTTP method for call
           * @param [payload=null] payload for POST/PATCH etc
           * @param [paramMap={}] parameters to send as header values for POST/PATCH etc
           * @param [retry] specifies whether to retry on error
           */
          forcetk.Client.prototype.apexrest = function(path, callback, error, method, payload, paramMap, retry) {
              var that = this;
              var url = this.instanceUrl + '/services/apexrest' + path;
              // return $j.ajax({
                return $http({
                  type: method || "GET",
                  async: this.asyncAjax,
                  url: (this.proxyUrl !== null) ? this.proxyUrl: url,
                  contentType: 'application/json',
                  cache: false,
                  processData: false,
                  data: payload,
                  success: callback,
                  error: (!this.refreshToken || retry ) ? error : function(jqXHR, textStatus, errorThrown) {
                      if (jqXHR.status === 401) {
                          that.refreshAccessToken(function(oauthResponse) {
                                  that.setSessionToken(oauthResponse.access_token, null,
                                      oauthResponse.instance_url);
                                  that.apexrest(path, callback, error, method, payload, paramMap, true);
                              },
                              error);
                      } else {
                          error(jqXHR, textStatus, errorThrown);
                      }
                  },
                  dataType: "json",
                  beforeSend: function(xhr) {
                      if (that.proxyUrl !== null) {
                          xhr.setRequestHeader('SalesforceProxy-Endpoint', url);
                      }
                      //Add any custom headers
                      if (paramMap === null) {
                          paramMap = {};
                      }
                      for (paramName in paramMap) {
                          xhr.setRequestHeader(paramName, paramMap[paramName]);
                      }
                      xhr.setRequestHeader(that.authzHeader, "Bearer " + that.sessionId);
                      //xhr.setRequestHeader('X-User-Agent', 'salesforce-toolkit-rest-javascript/' + that.apiVersion);
                      if (that.userAgentString !== null) {
                          xhr.setRequestHeader('User-Agent', that.userAgentString);
                      }
                  }
              });
          }

          /*
           * Lists summary information about each Salesforce.com version currently
           * available, including the version, label, and a link to each version's
           * root.
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           */
          forcetk.Client.prototype.versions = function(callback, error) {
              return this.ajax('/', callback, error);
          }

          /*
           * Lists available resources for the client's API version, including
           * resource name and URI.
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           */
          forcetk.Client.prototype.resources = function(callback, error) {
              return this.ajax('/' + this.apiVersion + '/', callback, error);
          }

          /*
           * Lists the available objects and their metadata for your organization's
           * data.
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           */
          forcetk.Client.prototype.describeGlobal = function(callback, error) {
              return this.ajax('/' + this.apiVersion + '/sobjects/', callback, error);
          }

          /*
           * Describes the individual metadata for the specified object.
           * @param objtype object type; e.g. "Account"
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           */
          forcetk.Client.prototype.metadata = function(objtype, callback, error) {
              return this.ajax('/' + this.apiVersion + '/sobjects/' + objtype + '/'
                  , callback, error);
          }

          /*
           * Completely describes the individual metadata at all levels for the
           * specified object.
           * @param objtype object type; e.g. "Account"
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           */
          forcetk.Client.prototype.describe = function(objtype,selectedFields, callback, error) {
              return this.ajax('/' + this.apiVersion + '/sobjects/' + objtype
                  + '/describe/', callback, error);
          }

          /*
           * Creates a new record of the given type.
           * @param objtype object type; e.g. "Account"
           * @param fields an object containing initial field names and values for
           *               the record, e.g. {:Name "salesforce.com", :TickerSymbol
           *               "CRM"}
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           */
          forcetk.Client.prototype.create = function(objtype, fields, callback, error) {
              return this.ajax('/' + this.apiVersion + '/sobjects/' + objtype + '/'
                  , callback, error, "POST", JSON.stringify(fields));
          }

          /*
           * Retrieves field values for a record of the given type.
           * @param objtype object type; e.g. "Account"
           * @param id the record's object ID
           * @param [fields=null] optional comma-separated list of fields for which
           *               to return values; e.g. Name,Industry,TickerSymbol
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           */
          forcetk.Client.prototype.retrieve = function(objtype, id, fieldlist, callback, error) {
              if (arguments.length == 4) {
                  error = callback;
                  callback = fieldlist;
                  fieldlist = null;
              }
              var fields = fieldlist ? '?fields=' + fieldlist : '';
              this.ajax('/' + this.apiVersion + '/sobjects/' + objtype + '/' + id
                  + fields, callback, error);
          }

          /*
           * Upsert - creates or updates record of the given type, based on the
           * given external Id.
           * @param objtype object type; e.g. "Account"
           * @param externalIdField external ID field name; e.g. "accountMaster__c"
           * @param externalId the record's external ID value
           * @param fields an object containing field names and values for
           *               the record, e.g. {:Name "salesforce.com", :TickerSymbol
           *               "CRM"}
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           */
          forcetk.Client.prototype.upsert = function(objtype, externalIdField, externalId, fields, callback, error) {
              return this.ajax('/' + this.apiVersion + '/sobjects/' + objtype + '/' + externalIdField + '/' + externalId
                  + '?_HttpMethod=PATCH', callback, error, "POST", JSON.stringify(fields));
          }

          /*
           * Updates field values on a record of the given type.
           * @param objtype object type; e.g. "Account"
           * @param id the record's object ID
           * @param fields an object containing initial field names and values for
           *               the record, e.g. {:Name "salesforce.com", :TickerSymbol
           *               "CRM"}
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           */
          forcetk.Client.prototype.update = function(objtype, id, fields, callback, error) {
              return this.ajax('/' + this.apiVersion + '/sobjects/' + objtype + '/' + id
                  + '?_HttpMethod=PATCH', callback, error, "POST", JSON.stringify(fields));
          }

          /*
           * Deletes a record of the given type. Unfortunately, 'delete' is a
           * reserved word in JavaScript.
           * @param objtype object type; e.g. "Account"
           * @param id the record's object ID
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           */
          forcetk.Client.prototype.del = function(objtype, id, callback, error) {
              return this.ajax('/' + this.apiVersion + '/sobjects/' + objtype + '/' + id
                  , callback, error, "DELETE");
          }

          /*
           * Executes the specified SOQL query.
           * @param soql a string containing the query to execute - e.g. "SELECT Id,
           *             Name from Account ORDER BY Name LIMIT 20"
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           */
          forcetk.Client.prototype.query = function(soql, callback, error) {
              return this.ajax('/' + this.apiVersion + '/query?q=' + escape(soql)
                  , callback, error);
          }

          /*
           * Queries the next set of records based on pagination.
           * <p>This should be used if performing a query that retrieves more than can be returned
           * in accordance with http://www.salesforce.com/us/developer/docs/api_rest/Content/dome_query.htm</p>
           * <p>Ex: forcetkClient.queryMore( successResponse.nextRecordsUrl, successHandler, failureHandler )</p>
           *
           * @param url - the url retrieved from nextRecordsUrl or prevRecordsUrl
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           */
          forcetk.Client.prototype.queryMore = function( url, callback, error ){
              //-- ajax call adds on services/data to the url call, so only send the url after
              var serviceData = "services/data";
              var index = url.indexOf( serviceData );
              if( index > -1 ){
                  url = url.substr( index + serviceData.length );
              } else {
                  //-- leave alone
              }
              return this.ajax( url, callback, error );
          }

          /*
           * Executes the specified SOSL search.
           * @param sosl a string containing the search to execute - e.g. "FIND
           *             {needle}"
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           */
          forcetk.Client.prototype.search = function(sosl, callback, error) {
              return this.ajax('/' + this.apiVersion + '/search?q=' + escape(sosl)
                  , callback, error);
          }

          /*
           * Executes the specified SOSL search.
           * @param sosl a string containing the search to execute - e.g. "FIND
           *             {needle}"
           * @param callback function to which response will be passed
           * @param [error=null] function to which jqXHR will be passed in case of error
           */
          forcetk.Client.prototype.getFieldSet = function(sosl, callback, error) {
              return this.ajax('/' + this.apiVersion + '/search?q=' + escape(sosl)
                  , callback, error);
          }

      } //end of if forceTK client is undefined

      return new forcetk.Client(clientId, loginUrl, proxyUrl);;

    }; //end of service return


  });

'use strict';

angular.module('sfObject')

  .service('SFObject', function ($q, Connect, $log) {

    // instantiate our initial object
    var SFObject = function(objectName, selectFields, calculatedFields) {
        this.objectName = objectName;
        this.selectFields = selectFields;
        this.calculatedFields = calculatedFields;
    };

    SFObject.prototype.retrieve = function (id) {
      var defer = $q.defer();
      var objectName = this.objectName;
      var selectFields = this.selectFields;

      Connect.then(function(conn) {
        // remove Id from retrieve
        selectFields = selectFields.replace("Id,", "");

        conn.retrieve(objectName, id, selectFields,function(result) {
          //cache.put('customer', res.records[0]);

          defer.resolve(result);

        }, function (err) {
          throw err;
          return console.error(err);
        });
      });

      return defer.promise;

    }

    SFObject.prototype.query = function (filter) {

      var defer = $q.defer();
      var selectFields = this.selectFields;
      var objectName = this.objectName;

      if (filter != '' && filter != null) {
        filter = ' where '+ filter;
      } else {
        filter = '';
      }

      Connect.then(function(conn) {
        conn.query('Select '+selectFields+' from '+objectName+filter , function (res) {


            defer.resolve(res.records);



        }, function (err) {
          throw err;
          return defer.reject(err);
        });

      });

      return defer.promise;

    }


    SFObject.prototype.getPicklists = function() {
      var defer = $q.defer();
      var objectName = this.objectName;

      var picklists = {};

      Connect.then(function (conn) {
        // get all the picklists
        conn.describe(objectName, null, function(meta) {
          angular.forEach(meta.fields, function(value, key){
            if (value.picklistValues.length > 0){
              picklists[value.name]  = value.picklistValues;
            }
          });

          defer.resolve(picklists);

        });
      });
      return defer.promise;
    };

    SFObject.prototype.getInlineHelpText = function () {
      var defer = $q.defer();
      var objectName = this.objectName;

      var helpTexts = {};

      Connect.then( function (conn) {
        conn.describe(objectName, null, function (meta) {
          angular.forEach(meta.fields, function (value, key) {
            if (value.inlineHelpText) {
              helpTexts[value.name] = value.inlineHelpText;
            }
          });

          defer.resolve(helpTexts);
        })

      });

      return defer.promise;

    };

    SFObject.prototype.describe = function () {
      var defer = $q.defer();
      var objectName = this.objectName;

      Connect.then(function (conn) {
        conn.describe(objectName, null, function (result) {
          defer.resolve(result);
        });
      });

      return defer.promise;
    };

    SFObject.prototype.getFieldSets = function() {
      var defer = $q.defer();
      var objectName = this.objectName;
      var picklists = {};

      Connect.then(function (conn) {

        // apexrest call instead

        conn.apexrest('/fieldsets', function (res) {
          defer.resolve(res);
        })


        // metadata api calls
        //
        // conn.jsForce.metadata.read('CustomObject', objectName, function(err, metadata) {
        //   if (err) { console.error(err); }
        //   defer.resolve(metadata);
        // });
      });
      return defer.promise;
    }

     SFObject.prototype.getFields = function() {
      var defer = $q.defer();
      var objectName = this.objectName;

      var fields = [];

      Connect.then(function (conn) {
        // get all the picklists
        conn.describe(objectName, null, function(meta) {
           angular.forEach(meta.fields, function(value, key){
              fields[value.name]  = value;
          });
          defer.resolve(fields);

        });
      });
      return defer.promise;
    };

    SFObject.prototype.sendEmail = function (body) {
      var defer = $q.defer(),
          payload = JSON.stringify(body);

      Connect.then(function (conn) {
        conn.apexrest('/sendEmail', function (res) {
          defer.resolve();
        }, function (err) {
          defer.reject(err);
        }, 'POST', payload);
      });

      return defer.promise;
    };

    SFObject.prototype.getRecordTypes = function() {
      var defer = $q.defer();
      var objectName = this.objectName;

      Connect.then(function (conn) {

        conn.query('SELECT Id, Name FROM RecordType WHERE SobjectType = \''+objectName+'\'', function(res) {
            defer.resolve(res.records);
        },function (err) {
          throw err;
          return $log.error(err);
        });

      });

      return defer.promise;
    }

    SFObject.prototype.delete = function (id) {
      var defer = $q.defer();
      var objectName = this.objectName;


      Connect.then( function (conn) {
        conn.del(objectName, id, function (ret){
          defer.resolve(ret);
        }, function (err) {

          throw err;
          defer.reject(err);
        })
      })

      return defer.promise;
    }


    SFObject.prototype.deleteRecord = function (record) {
      var defer = $q.defer();
      var objectName = this.objectName;
      var id = record.Id;

      Connect.then( function (conn) {
        conn.del(objectName, id, function (ret){
          defer.resolve(ret);
        }, function (err) {
          record.err = true;
          throw err;
          defer.reject(err);
        })
      })

      return defer.promise;
    }

    SFObject.prototype.save = function (record, fieldsToRemove) {

      var defer = $q.defer();
      var objectName = this.objectName;
      var calculatedFields = this.calculatedFields;
      var selectFields = this.selectFields;

      var isForce = window.location.host.indexOf("force.com");

      var Id = record.Id;

      var copy = angular.copy(record);


      // sanitize object
      delete copy['Id'];
      delete copy['edit'];
      delete copy['err'];
      delete copy['attributes'];
      delete copy['CreatedDate'];
      delete copy['RecordType'];

      delete copy['LastModifiedDate'];


      // automatically removes all the related objects before saving
      angular.forEach(copy, function(value, key) {
        if (key.indexOf('__r') > 0) {
          delete copy[key];
        }

        if (isForce>0){
          if (value instanceof Date ) {

            copy[key] = SFObject.prototype.formatDateTime(value);

          } else if (key =='Date_Time__c') {

            copy[key] = SFObject.prototype.formatDateTime(new Date(value));

          }
        }
      });

      angular.forEach(calculatedFields, function(field) {
        delete copy[field];
      });

      angular.forEach(fieldsToRemove, function(field) {
        delete copy[field];
      });

      // $log.log('this is the original record', record);
      // $log.log('this is the cleaned copy', copy);

      Connect.then(function (conn) {

        if (record.Id) {
          conn.update(objectName, Id, copy, function(ret) {

            record.edit = false;
            record.err = false;

            defer.resolve(ret);

            // conn.retrieve(objectName, Id, selectFields, function (result) {
            //   defer.resolve(result);
            // }, function (err) {
            //   throw err;
            // });


          }, function (err) {

            record.err = angular.fromJson(err.responseText);
            record.edit = true;
            $log.error('wont update', err);
            defer.reject(err);

          });

        } else {

          conn.create(objectName, copy, function(ret) {

            record.Id = ret.id;
            record.edit = false;
            record.err = false;

            defer.resolve(ret);
            // conn.retrieve(objectName, ret.id, selectFields, function (result) {
            //
            //   defer.resolve(result);
            // }, function (err) {
            //   throw err;
            // });

          }, function (err) {

            record.err =  angular.toJson(err.responseText);
            record.edit = true;
            $log.error('wont update', err);
            defer.reject(record);

          });

        }

      });

      return defer.promise;


    }

    SFObject.prototype.formatDateTime = function(jsDateObject) {
         var output = jsDateObject.getFullYear() + '-';

         if(jsDateObject.getMonth() + 1 < 10) output += '0';
         output += jsDateObject.getMonth() + 1 + '-';
         if(jsDateObject.getDate() < 10) output += '0';
         output += jsDateObject.getDate() + ' ';
         if(jsDateObject.getHours() < 10) output += '0';
         output += jsDateObject.getHours() + ':';
         if(jsDateObject.getMinutes() < 10) output += '0';
         output += jsDateObject.getMinutes() + ':';
         if(jsDateObject.getSeconds() < 10) output += '0';
         output += jsDateObject.getSeconds();
         return output;
    }

    return SFObject;

  });
