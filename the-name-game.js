////////////////////////////////////////////////////////////////////////////////
// Collections                                                                //
////////////////////////////////////////////////////////////////////////////////

Games = new Mongo.Collection('games');

////////////////////////////////////////////////////////////////////////////////
// Router                                                                     //
////////////////////////////////////////////////////////////////////////////////

Router.configure({
  layoutTemplate: 'layout',
  loadingTemplate: 'loading'
});

Router.route('/', function() {
  this.render('home');
}, {name: 'home'});

Router.route('/new', function() {
  Meteor.call('newGame', function(error, gameId) {
    if(!error) {
      Router.go('game', {id: gameId});
    }
  });
});

Router.route('/game/:id', function() {
  var gameId = this.params.id;
  Meteor.call('joinGame', gameId, function(error, result) {
    if(!error) {
      Session.set('currentGameId', gameId);
    }
  });
  this.render('game');
}, {name: 'game'});

Router.route('/about');

Router.onBeforeAction(function() {
  if(!Meteor.userId()) {
    if(Meteor.loggingIn()) {
      this.render('loading');
    } else {
      this.render('login');
    }
  } else {
    this.next();
  }
}, {
  except: ['home', 'about']
});

////////////////////////////////////////////////////////////////////////////////
// Client code                                                                //
////////////////////////////////////////////////////////////////////////////////

if (Meteor.isClient) {
  Tracker.autorun(function() {
    Meteor.subscribe('gameData', Session.get('currentGameId'));
  });

  Template.layout.helpers({
    currentGame: function() {
      var gameId = Session.get('currentGameId');
      return gameId ? {id: gameId} : null;
    },

    inGamePage: function() {
      return Router.current().route.getName() == 'game';
    },

    linkActiveClassFor: function(routeName) {
      console.log('linkActiveClassFor ' + routeName);
      console.log('current route name: ' + Router.current().route.getName());
      return Router.current().route.getName() == routeName ? 'active' : '';
    }
  });

  Template.home.events({
    'click #new-game': function() {
      Router.go('/new');
    }
  });

  Template.game.helpers({
    players: function() {
      var game = Games.findOne({_id: Session.get('currentGameId')})
      if(game) {
        var players = game.players.filter(function(p) {
          return Meteor.users
                       .find({_id: p.id, 'status.online': true})
                       .count() == 1;
        });
        var number = 1;
        players = players.map(function(p) {
          p.number = number++;
          return p;
        });
        return players;
      }
    },

    username: function(userId) {
      var user = Meteor.users.findOne({_id: userId});
      if(user) return user.username;
    },

    isCurrentUser: function(userId) {
      return Meteor.userId() == userId;
    }
  });

  Template.game.events({
    'input input': function(event) {
      Meteor.call('updateCard',
                  Session.get('currentGameId'),
                  this.id,
                  event.target.value);
    }
  })

  Accounts.ui.config({
    passwordSignupFields: 'USERNAME_ONLY'
  });
}

////////////////////////////////////////////////////////////////////////////////
// Server code                                                                //
////////////////////////////////////////////////////////////////////////////////

if (Meteor.isServer) {
  Meteor.publishComposite('gameData', function(gameId) {
    return {
      find: function() {
        return Games.find({_id: gameId});
      },
      children: [
        {
          find: function(game) {
            var playerIds = game.players.map(function(p) { return p.id; });
            return Meteor.users.find({_id: {$in: playerIds}});
          }
        }
      ]
    };
  });
}

////////////////////////////////////////////////////////////////////////////////
// Methods                                                                    //
////////////////////////////////////////////////////////////////////////////////

Meteor.methods({
  newGame: function() {
    console.log('Method "newGame" called.');
    if(!this.userId) {
      throw new Meteor.Error(
        'login-required',
        'You need to sign in before starting a new game.');
    }

    var gameId = Games.insert({players: []});

    return gameId;
  },

  joinGame: function(gameId) {
    console.log('Method "joinGame" called.');
    if(!this.userId) {
      throw new Meteor.Error(
        'login-required',
        'You need to sign in before joining a game.');
    }

    Games.update({
      _id: gameId,
      'players.id': {$ne: Meteor.userId()}
    }, {
      $push: {'players': {id: Meteor.userId(), card: ''}}
    });
  },

  updateCard: function(gameId, userId, card) {
    console.log('updateCard(' + gameId + ', ' + userId + ', ' + card + ')');
    Games.update({_id: gameId, 'players.id': userId},
                 {$set: {'players.$.card': card}});
  }
});
