var Hapi = require('hapi');

var querystring = require('querystring');
var http = require('http');
var fs = require('fs');

var wit = require('node-wit');
var fs = require('fs');
var request_r = require('request');

var wit_token = "YP6I6ELEENTY7FGFCW3VFAGWNMHRMLKA";

var users = [
    {
        id: '219',
        password: '123456',
        name: null,
    }
];

var home = function (request, reply) {

    reply('<html><head><title>Login page</title></head><body><h3>Welcome '
      + request.auth.credentials.name
      + '!</h3><br/><form method="get" action="/logout">'
      + '<input type="submit" value="Logout">'
      + '</form></body></html>');
};

var witamin = function (request, reply) {
    console.log('vitamin');
    if (request.method === 'post') {
        var message = request.payload.message;

        wit.captureTextIntent(wit_token, message, function (err, res) {
            console.log("Response from Wit for text input: ");
            if (err) console.log("Error: ", err);
            console.log(JSON.stringify(res, null, " "));

            switch (res.outcomes[0].intent) {
                case "greetings":
                        var resp = greetings[Math.floor(Math.random()*greetings.length)];
                        break;
                case "in_out":
                        // get operations
                        if ( res.outcomes[0].confidence < 0.5) {
                            nilesResponse = "When I'll learn I'll answer to that";
                            break;
                        }
                        var operations = {
                            'money_in': false,
                            'money_out': false,
                            'avg': false,
                            'chart': false
                        };
                        if ('out' in res.outcomes[0].entities) {
                            operations.money_out = true;
                        }

                        if ('in' in res.outcomes[0].entities) {
                            operations.money_in = true;
                        }

                        if ('avg' in res.outcomes[0].entities) {
                            operations.avg = true;
                        }

                        if ('chart' in res.outcomes[0].entities) {
                            operations.chart = true;
                            var dt = new Date();
                            var period = {
                                                    'type': 'month',
                                                    'start': new Date(dt.getFullYear(), dt.getMonth()-1, dt.getDate(), 0).toISOString(),
                                                    'end': dt.toISOString()
                                                };
                        }

                        // get time
                        if ('datetime' in res.outcomes[0].entities) {
                            var period = {'start': '', 'end': ''};
                            if (res.outcomes[0].entities.datetime[0].type == "value") {
                                var dt = new Date(res.outcomes[0].entities.datetime[0].value);

                                switch (res.outcomes[0].entities.datetime[0].grain) {
                                    case "week":
                                        var end_date = dt.setTime(dt.getTime() + (6 * 24 * 60 * 60 * 1000));
                                        break;
                                    case "month":
                                        var end_date = new Date(dt.getFullYear(), dt.getMonth()+1, 1).toISOString();
                                        break;
                                    case "day":
                                        var end_date = res.outcomes[0].entities.datetime[0].value;
                                        break;
                                }

                                var period = {
                                                        'type': res.outcomes[0].entities.datetime[0].grain,
                                                        'start': new Date(res.outcomes[0].entities.datetime[0].value).toISOString(),
                                                        'end': new Date(end_date).toISOString()
                                                    };

                            }

                            if (res.outcomes[0].entities.datetime[0].type == "interval") {
                                var start_date = res.outcomes[0].entities.datetime[0].from.value;
                                var end_date = res.outcomes[0].entities.datetime[0].to.value

                                var period = {
                                    'type': res.outcomes[0].entities.datetime[0].from.grain,
                                    'start': new Date(start_date).toISOString(),
                                    'end': new Date(end_date).toISOString()
                                }
                            }
                        }

                        //console.log(operations);
                        //console.log(period);

                        var data = {
                            "operations": {
                              "money_in": operations.money_in,
                              "money_out": operations.money_out,
                              "avg": operations.avg,
                              "chart": operations.chart
                            },
                            "type": period.type,
                            "from": period.start,
                            "to": period.end
                          };

                            // ING request
                            console.log("data to sent " + JSON.stringify(data));
                            var options = {
                                uri: 'http://6aad7896.ngrok.io/niles-response',
                                method: 'POST',
                                json: data
                                };

                            request_r(options, function (error, response, body) {

                               if (!error && response.statusCode == 200) {

                                   var nilesResponse = "It looks that you ";
                                   var income_total = '';
                                   var outcome_total = '';

                                   console.log('Server response: ', body);
                                   if ('income' in body) {
                                   var income_currency = body.income.currency;
                                   income_total = body.income.value;

                                   nilesResponse += "got " + income_currency+""+income_total;

                                   if ('avg' in body.income) {
                                   var income_avg = body.income.avg;
                                   nilesResponse += " with an average of "+income_currency+income_avg;
                                   }



                               }

                               if ('outcome' in body) {
                                   if (income_total !== '') {
                                        nilesResponse += " and ";
                                   }
                                   
                                   var outcome_currency = body.outcome.currency;
                                   outcome_total = body.outcome.value;

                                   nilesResponse += "spent " + outcome_currency+""+outcome_total;

                                   if ('avg' in body.outcome) {
                                    var outcome_avg = body.outcome.avg;
                                    nilesResponse += " with an average of "+outcome_currency+outcome_avg;
                                   }

                               }
                                nilesResponseChart = null;
                               if ('graphUrl' in body) {
                                    nilesResponse += "\n\nhttp://"+body.host+body.graphUrl;
                                    nilesResponseChart = "http://"+body.host+body.graphUrl;
                                }

                               return reply({message: nilesResponse, chart: nilesResponseChart, success: true}).code( 200 );
                               //bot.sendMessage(chatId, nilesResponse);
                               
                               //return;
                               }
                              });


                        var nilesResponse = "I'm looking for: " + JSON.stringify(operations) + " operations in this: " + JSON.stringify(period) + " period.";
                    break;
                default:
                    break;
            }

    // work with the response
    // bot.sendMessage(chatId, nilesResponse);
  });


    }

    
    //return reply({message: ''}).code( 200 );
};

var login = function (request, reply) {

    var message = '';
    var account = null;
    var response = null;

    if (request.method === 'post') {

        if (!request.payload.phone ||
            !request.payload.password) {

            message = 'Missing username or password';
            response = {
                'message': message,
                success: false
            };
        }
        else {
            account = users[0];
            //console.log(account.password);
            if (!account ||
                account.password !== request.payload.password) {

                message = 'Invalid username or password';

                response = {
                    'message': message,
                    success: false
                };
            }
        }

        /*var options = {
          host: 'http://427d4bdd.ngrok.io',
          path: '/get/' + account.id + '/me'
        };

        callback = function(response) {
          var str = '';

          //another chunk of data has been recieved, so append it to `str`
          response.on('data', function (chunk) {
            str += chunk;
          });

          //the whole response has been recieved, so we just print it out here
          response.on('end', function () {
            console.log(str);
            account.name = users[0].name = 'Octavian Voicila';
          });
        }; */

        account.name = users[0].name = 'Octavian Voicila';

        //http.request(options, callback).end();

    }

    request.auth.session.set(account);

    if (!response) {
        response = {
            message: null,
            name: account.name,
            success: true
        };
    }
    return reply(response).code( 200 );

};

var logout = function (request, reply) {

    request.auth.session.clear();
    return reply.redirect('/');
};

var server = new Hapi.Server({
  connections: {
    routes: {
      cors: true
    }
  }
});

server.connection({ host:'localhost', port: 8000 });

server.register(require('hapi-auth-cookie'), function (err) {

    server.auth.strategy('session', 'cookie', {
        password: 'secret',
        cookie: 'sid-example',
        redirectTo: '/login',
        isSecure: false
    });

});

server.route([
    {
        method: 'GET',
        path: '/',
        config: {
            handler: home,
            auth: 'session'
        }
    },
    {
        method: ['GET', 'POST'],
        path: '/login',
        config: {
            handler: login,
            auth: {
                mode: 'try',
                strategy: 'session'
            },
            plugins: {
                'hapi-auth-cookie': {
                    redirectTo: false
                }
            }
        }
    },
    {
        method: ['GET','POST'],
        path: '/wit',
        config: {
            handler: witamin
        }
    },
    {
        method: 'GET',
        path: '/logout',
        config: {
            handler: logout,
            auth: 'session'
        }
    }
]);

server.start(function (err) {

    if (err) {
        throw err;
    }
    console.log('Server started at: ' + server.info.uri);
});