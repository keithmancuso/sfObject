ChangeMachine.factory('Connect', function($q, $rootScope) {

  var conn;

  var defer = $q.defer();

  if (isForce > 0) {

    conn  = new remotetk.Client();

    // moved this line into resolve - access level relies on currentContact.AccountId, w/o the resolve as a callback of the conn.retrieve, was erroring on trying to reference an undefined property.
    // defer.resolve(conn);


    conn.retrieve('Contact', currentContactId, 'Id, RecordTypeId,Account.Id,  AccountId, FirstName, LastName, Account.npo02__LastMembershipLevel__c, Account.Access_To_Leads__c, Phone, Name, email, Total_Progress__c',function(result) {
      currentContact = result;

      // isCoach =

      defer.resolve(conn);
    });
    // conn.retrieve('Contact',currentContactId,null, function (res) {
    //
    //   currentContact = res.record;
    //
    // });


  } else {

    conn = new jsforce.Connection({
      oauth2 : {
        loginUrl : 'https://test.salesforce.com',
        clientId : '',
        clientSecret : '',
        redirectUri : 'https://change-machine.org/api.html',
        proxyUrl: 'https://pure-bastion-9629.herokuapp.com/proxy'
      },
      proxyUrl: 'https://pure-bastion-9629.herokuapp.com/proxy'
    });

    conn.login('', '',
      function(err,res) {

        if (err) {
          throw err;
          return console.error(err);
        }
        currentUserId = conn.userInfo.id;

        //get "default coach" when logged in as admin.
        conn.query('Select Id, RecordTypeId,Account.Id,  AccountId, FirstName, LastName, Account.Access_To_Leads__c, Account.npo02__LastMembershipLevel__c, Phone, Name, email, Total_Progress__c from Contact where Id = \'\' limit 1', function (err, res) {
          currentContactId = res.records[0].Id;
          currentContact = res.records[0];

            isCoach = true;




          var client = new forcetk.Client(conn.oauth2.clientId, conn.oauth2.loginUrl, 'https://pure-bastion-9629.herokuapp.com/proxy');
          client.setSessionToken(conn.accessToken, null, conn.instanceUrl);

          client.jsForce = conn;

          defer.resolve(client);


        });




      }

    );


  }

  return defer.promise;
});
