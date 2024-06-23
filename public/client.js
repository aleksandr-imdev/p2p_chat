// Функция для генерации случайного кода комнаты длиной 10 символов
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 12).toUpperCase();
}

const iceConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
}

const socket = io();
let peerConnection = null;
let srcTemp = null;
let localStream; // Локальный поток мультимедиа (наша камера и микрофон)
let currentRoom; // Текущая комната

// Получение доступа к камере и микрофону пользователя
async function getLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.srcObject = localStream;
        }
    } catch (error) {
        console.error('Ошибка при получении доступа к медиапотоку:', error);
    }
}

// Создание комнаты и присоединение пользователя к ней
function createRoom() {
    if (currentRoom) {
        alert('Вы уже в комнате.');
        return;
    }

    const roomCode = generateRoomCode();
    socket.emit('createRoom', roomCode, (response) => {
        if (response.success) {
            console.log('Код комнаты: ' + roomCode);

            // Показываем код комнаты пользователю
            const roomCodeDisplay = document.getElementById('roomCodeDisplay');
            roomCodeDisplay.innerText = `Код комнаты: ${roomCode}`;

            // Присоединяемся к созданной комнате
            joinRoomByCode(roomCode);
        } else {
            alert(response.message);
        }
    });
}

// Присоединение к комнате по коду
function joinRoom() {
    const roomCodeInput = document.getElementById('roomCodeInput').value;
    if (!roomCodeInput) {
        alert('Пожалуйста, введите код комнаты.');
        return;
    }
    if (currentRoom) {
        alert('Вы уже в комнате.');
        return;
    }
    joinRoomByCode(roomCodeInput);
}

function joinRoomByCode(roomCode) {
    socket.emit('joinRoom', roomCode, (response) => {
        if (response.success) {
            currentRoom = roomCode;

            // Получаем локальный медиапоток
            if (!localStream) {
                getLocalStream();
            }

            // Устанавливаем соединение WebRTC для видеозвонка
            
            peerConnection = new RTCPeerConnection(iceConfiguration);
            peerConnection.oniceconnectionstatechange = function(event) {
                console.log('ICE Connection State:', peerConnection.iceConnectionState);
            
                if (peerConnection.iceConnectionState === 'disconnected') {
                    videoElement = document.getElementById('remoteVideo');
                    videoElement.pause();  // Приостановить воспроизведение
                    videoElement.src = null; // Очистить src
                    videoElement.load();   // Перезагрузить элемент video
                }
            };

            // Добавляем локальный поток к соединению
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            // Обработчик ICE-кандидатов (Network traversal)
            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    socket.emit('candidate', currentRoom, event.candidate);
                }
            };

            // Обработчик удаленного потока медиаданных
            peerConnection.ontrack = event => {
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteVideo) {
                    remoteVideo.srcObject = event.streams[0];
                }
            };

            // Получаем SDP (Session Description Protocol) предложение от сервера
            peerConnection.onnegotiationneeded = async () => {
                try {
                    await peerConnection.setLocalDescription(await peerConnection.createOffer());
                    socket.emit('offer', currentRoom, peerConnection.localDescription);
                } catch (error) {
                    console.error('Ошибка при создании предложения:', error);
                }
            };

            // Обработчик ICE-кандидатов, полученных от других участников
            socket.on('candidate', (candidate) => {
                peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                    .catch(error => console.error('Ошибка при добавлении ICE-кандидата:', error));
            });

            // Обработчик предложений SDP (Session Description Protocol)
            socket.on('offer', async (offer) => {
                try {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    socket.emit('answer', currentRoom, answer);
                } catch (error) {
                    console.error('Ошибка при обработке предложения:', error);
                }
            });

            // Обработчик ответов SDP (Session Description Protocol)
            socket.on('answer', async (answer) => {
                try {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (error) {
                    console.error('Ошибка при обработке ответа:', error);
                }
            });

            // Добавляем кнопки управления и код комнаты
            var elements = document.querySelectorAll('.state-call');
            elements.forEach(function(element) {
                element.removeAttribute('style')
            });
            elements = document.querySelectorAll('.state-idle');
            elements.forEach(function(element) {
                element.setAttribute('style', 'display:none !important');
            });
        } else {
            alert(response.message);
        }
    });
}

function leaveRoom() {
    if (currentRoom) {
        socket.emit('leaveRoom', currentRoom, () => {
            console.log("Выход из комнаты");
        });
        currentRoom = null;
    }

    // Закрытие RTCPeerConnection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    // Отписка от событий сокета для текущей комнаты
    socket.off('offer');
    socket.off('answer');
    socket.off('candidate');
    
    // Возвращаем интерфейс ожидания
    var elements = document.querySelectorAll('.state-call');
    elements.forEach(function(element) {
        element.removeAttribute('style')
    });
    elements = document.querySelectorAll('.state-idle');
    elements.forEach(function(element) {
        element.removeAttribute('style')
    });
}

// Получение доступа к локальному медиапотоку при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    getLocalStream();
});
