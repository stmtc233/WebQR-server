const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 中间件，用于解析 JSON 请求体
app.use(express.json());

// API 端点，用于接收 Android 应用上传的二维码数据
app.post('/upload_qr', (req, res) => {
    const qrData = req.body.data;
    if (qrData) {
        console.log(`Received QR data: ${qrData}`);
        // 通过 Socket.IO 将新数据广播给所有连接的客户端
        io.emit('new_qr_data', qrData);
        res.status(200).send('Data received');
    } else {
        res.status(400).send('No data provided');
    }
});

// 设置静态文件目录，用于托管网页
app.use(express.static('public'));

// 监听 Socket.IO 连接
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});