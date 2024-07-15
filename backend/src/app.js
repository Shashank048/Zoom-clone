import express from "express";
import { createServer } from "node:http";

import mongoose from "mongoose";

import { Server } from 'socket.io';

import cors from "cors";
import userRoutes from "./routes/users.routes.js";

import { connectToSocket } from "./controllers/socketManager.js";

const app = express();

const server = createServer(app);
const io = connectToSocket(server);    

app.set("port",(process.env.PORT || 8000))
app.use(cors());
app.use(express.json({limit:"40kb"}));
app.use(express.urlencoded({limit:"40kb",extended: true}));

app.use("/api/v1/users", userRoutes);


const start = async() => {
    const connectionDb = await mongoose.connect("mongodb+srv://choureshashank21:21shashankchoure@zoom.gqrq697.mongodb.net/?retryWrites=true&w=majority&appName=Zoom")
    console.log(`MONGO Connected DB Host: ${connectionDb.connection.host}`)
   server.listen(app.get("port"), () => {
        console.log("LISTEN ON PORT 8080")
    });

}

start();
