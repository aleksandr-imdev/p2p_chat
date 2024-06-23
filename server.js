const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let activeRooms = new Map(); // Карта активных комнат и их участников

// Подключаем статические файлы (например, HTML, CSS)
app.use(express.static(__dirname + '/public'));

// Роут для отображения страницы с видеозвонкой
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Обработчик события подключения нового пользователя
io.on('connection', socket => {
    console.log('Новое соединение: ' + socket.id);

    // Обработчик события создания комнаты
    socket.on('createRoom', (roomCode, callback) => {
        if (activeRooms.has(roomCode)) {
            callback({ success: false, message: 'Комната уже существует.' });
            return;
        }
        activeRooms.set(roomCode, [socket.id]);
        socket.join(roomCode);
        console.log(`Пользователь ${socket.id} создал комнату ${roomCode}`);
        callback({ success: true });
    });

    // Обработчик события присоединения к комнате
    socket.on('joinRoom', (roomCode, callback) => {
        if (!activeRooms.has(roomCode)) {
            callback({ success: false, message: 'Комната не существует.' });
            return;
        }
        const participants = activeRooms.get(roomCode);
        if (participants.length > 2) {
            callback({ success: false, message: 'Комната уже заполнена.' });
            return;
        }
        participants.push(socket.id);
        socket.join(roomCode);
        console.log(`Пользователь ${socket.id} присоединился к комнате ${roomCode}`);
        //console.log(`В комнате ${roomCode} ${participants.length} пользователей`);
        callback({ success: true });
    });
    
    // Обработчик события выхода из комнаты
    socket.on('leaveRoom', (roomCode, callback) => {
        leaveRoom(socket, roomCode);
        callback({ success: true });
    });

    // Обработчик события отключения пользователя
    socket.on('disconnect', () => {
        console.log('Пользователь отключился: ' + socket.id);
    
        // Пройдемся по всем комнатам и удалим пользователя из них
        activeRooms.forEach((participants, roomCode) => {
            const index = participants.indexOf(socket.id);
            if (index !== -1) {
                participants.splice(index, 1);
                socket.leave(roomCode);
                console.log(`Пользователь ${socket.id} покинул комнату ${roomCode}`);
    
                // Если в комнате больше нет пользователей, удалим её
                if (participants.length <= 1) {
                    activeRooms.delete(roomCode);
                    console.log(`Комната ${roomCode} удалена`);
                }
    
                // Отправляем сообщение о том, что пользователь покинул комнату
                socket.to(roomCode).emit('userLeft', { userId: socket.id });
            }
        });
    });

    // Обработчик события обмена ICE-кандидатами
    socket.on('candidate', (room, candidate) => {
        socket.to(room).emit('candidate', candidate);
    });

    // Обработчик события обмена SDP предложением
    socket.on('offer', (room, offer) => {
        socket.to(room).emit('offer', offer);
    });

    // Обработчик события обмена SDP ответом
    socket.on('answer', (room, answer) => {
        socket.to(room).emit('answer', answer);
    });

    function leaveRoom(socket, roomCode) {
        if (activeRooms.has(roomCode)) {
            const participants = activeRooms.get(roomCode);
            const index = participants.indexOf(socket.id);
            if (index !== -1) {
                participants.splice(index, 1);
                socket.leave(roomCode);
                console.log(`Пользователь ${socket.id} покинул комнату ${roomCode}`);
                if (participants.length <= 1) {
                    activeRooms.delete(roomCode);
                    console.log(`Комната ${roomCode} удалена`);
                }
            }
        }
    }
});

// Запуск сервера на порте 3000
server.listen(3000, () => {
    console.log('Сервер запущен на http://localhost:3000');
});
