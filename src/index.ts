import cluster from 'node:cluster';
import os from 'node:os';
import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import { setupMaster, setupWorker } from '@socket.io/sticky';
import { createAdapter, setupPrimary } from '@socket.io/cluster-adapter';

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
    socket.emit('connected-ok', process.pid);
    io.emit('socket-connected', socket.id);
    socket.on('disconnect', () => {
        io.emit('socket-disconnected', socket.id);
    });
});

app.get('/', (req, res) => {
    return res.status(200).json({ message: 'Hello World', pid: process.pid });
});

const PORT = process.env.PORT || 3000;

if (cluster.isPrimary) {
    const cpus = os.cpus().length;
    console.log(`Clustering to ${cpus} CPUs`);
    for (let i = 0; i < cpus; i++) {
        cluster.fork();
    }

    setupMaster(server, {
        loadBalancingMethod: 'least-connection',
    });
    setupPrimary();

    cluster.setupPrimary({
        serialization: 'advanced',
    });

    cluster.on('exit', (workerInfo, exitCode, signal) => {
        console.log(
            `Worker with id: ${workerInfo.process.pid} died with exit code: ${exitCode} and signal: ${signal}`,
        );
        cluster.fork();
    });
} else {
    io.adapter(createAdapter());
    setupWorker(io);

    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT} - ${process.pid}`);
    });
}
