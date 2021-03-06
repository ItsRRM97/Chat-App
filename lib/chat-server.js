var socketio = require('socket.io');
var db = require('./chat-db');
var io;
// maps socket.id to user's nickname
var nicknames = {}; //Object
// list of socket ids
var clients = [];
var namesUsed = []; //Array

exports.listen = function(server){
  io = socketio.listen(server);
  io.set('log level', 2);
  io.sockets.on('connection', function(socket){
    initializeConnection(socket);
    handleChoosingNicknames(socket);
    handleClientDisconnections(socket);
    handleMessageBroadcasting(socket);
    handlePrivateMessaging(socket);
  });
}

function initializeConnection(socket){
  showActiveUsers(socket);
  showOldMsgs(socket);
}

function showActiveUsers(socket){
  var activeNames = [];
  var usersInRoom = io.sockets.clients();
  for (var index in usersInRoom){
    var userSocketId = usersInRoom[index].id;
    if (userSocketId !== socket.id && nicknames[userSocketId]){
      var name = nicknames[userSocketId];
      activeNames.push({id: namesUsed.indexOf(name), nick: name});
    }
  }
  socket.emit('names', activeNames);
}

function showOldMsgs(socket){
  db.getOldMsgs(5, function(err, docs){
    socket.emit('load old msgs', docs);
  });
}

function handleChoosingNicknames(socket){ //Same nickname cannot be chosen
  socket.on('choose nickname', function(nick, cb) {
    if (namesUsed.indexOf(nick) !== -1) {
      cb('That name is already taken!  Please choose another one.');
      return;
    }
    var ind = namesUsed.push(nick) - 1; //pushing nickname intto the array
    clients[ind] = socket;
    nicknames[socket.id] = nick;
    cb(null);
    io.sockets.emit('new user', {id: ind, nick: nick});
  });
}

function handleMessageBroadcasting(socket){
  socket.on('message', function(msg){
    var nick = nicknames[socket.id];
    db.saveMsg({nick: nick, msg: msg}, // function saves the message to MongoDB Database
     function(err){
      if(err) throw err;
      io.sockets.emit('message', {nick: nick, msg: msg}); //message is sent to the server
    });
  });
}

function handlePrivateMessaging(socket){
  socket.on('private message', function(data){
    var from = nicknames[socket.id]; //Gets the name of the sender
    clients[data.userToPM].emit('private message', {from: from, msg: data.msg});
    //emits only to the receiver
  });
}

function handleClientDisconnections(socket){
  socket.on('disconnect', function(){
    var ind = namesUsed.indexOf(nicknames[socket.id]);
    delete namesUsed[ind]; //deletes nicknames from the list
    delete clients[ind]; //deletes socket ID of the user
    delete nicknames[socket.id];
    io.sockets.emit('user disconnect', ind);
  });
}