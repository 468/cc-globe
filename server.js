var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
const { RateLimiterMemory } = require('rate-limiter-flexible');

app.use(express.static('public'));

const rateLimiter = new RateLimiterMemory(
    {
      points: 2, // 5 points
      duration: 1, // per second
    }
);

app.get('/', function(req, res){
  res.sendFile(__dirname + './public/index.html');
});

const PORT = process.env.PORT || 3000;

http.listen(PORT, function(){
  console.log(`listening on ${PORT}`);
});

let connected = {};

io.on('connection', function(socket){

    io.sockets.connected[socket.id].emit('connections', connected);

    socket.on('user', async (msg) => {
        try {
            await rateLimiter.consume(socket.handshake.address);
            let user = { coords: msg.coords, colour: msg.colour, user_id: socket.id };
            connected[socket.id] = user;
            io.emit('user', user);
        } catch(rejRes) {
            console.log('rejected socket')
        }
    });

    socket.on('light', async (msg) => {
        try {
            await rateLimiter.consume(socket.handshake.address);
            io.emit('light', msg);
        } catch(rejRes) {
            console.log('rejected socket')
        }
    });

    socket.on('disconnect', async (msg) => {
        try {
            await rateLimiter.consume(socket.handshake.address);
            delete connected[socket.id];
            io.emit('disconnect', socket.id);
        } catch(rejRes) {
            console.log('rejected socket')
        }
    });
});