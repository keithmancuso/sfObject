'use strict';

angular.module('changeMachineCoachApp')
  .service('SFObject', function ($q, Connect, $log, $rootScope) {


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

            $rootScope.$apply();
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
            $rootScope.$apply();
            defer.reject(err);

          });

        } else {

          conn.create(objectName, copy, function(ret) {

            record.Id = ret.id;
            record.edit = false;
            record.err = false;
            $rootScope.$apply();

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
            $rootScope.$apply();
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
