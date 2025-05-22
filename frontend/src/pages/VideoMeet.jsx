import React, { useEffect, useRef, useState } from 'react';
import io from "socket.io-client";
import { Badge, IconButton, TextField, Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import styles from "../styles/videoComponent.module.css";
import server from '../environment';

const server_url = server;

export default function VideoMeetComponent() {
    const socketRef = useRef();
    const socketIdRef = useRef();
    const localVideoref = useRef();
    const videoRef = useRef([]);

    const [videoAvailable, setVideoAvailable] = useState(true);
    const [audioAvailable, setAudioAvailable] = useState(true);
    const [video, setVideo] = useState([]);
    const [audio, setAudio] = useState();
    const [screen, setScreen] = useState();
    const [showModal, setModal] = useState(true);
    const [screenAvailable, setScreenAvailable] = useState();
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [newMessages, setNewMessages] = useState(3);
    const [askForUsername, setAskForUsername] = useState(true);
    const [username, setUsername] = useState("");
    const [videos, setVideos] = useState([]);

    const peerConfigConnections = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    };

    const connections = useRef({});

    useEffect(() => {
        console.log("HELLO");
        getPermissions();
    }, []);

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            setVideoAvailable(!!videoPermission);
            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            setAudioAvailable(!!audioPermission);
            setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);

            if (videoPermission || audioPermission) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: videoPermission, audio: audioPermission });
                window.localStream = stream;
                if (localVideoref.current) localVideoref.current.srcObject = stream;
            }
        } catch (error) {
            console.error("Permissions error:", error);
        }
    };

    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();
        }
    }, [video, audio]);

    const getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video, audio })
                .then(stream => {
                    window.localStream = stream;
                    localVideoref.current.srcObject = stream;
                })
                .catch(console.log);
        } else {
            stopTracks();
        }
    };

    const stopTracks = () => {
        try {
            let tracks = localVideoref.current?.srcObject?.getTracks() || [];
            tracks.forEach(track => track.stop());
        } catch (e) { console.error(e); }
    };

    const getDisplayMedia = () => {
        if (screen) {
            navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                .then(getDisplayMediaSuccess)
                .catch(console.log);
        }
    };

    useEffect(() => {
        if (screen !== undefined) {
            getDisplayMedia();
        }
    }, [screen]);

    const getDisplayMediaSuccess = (stream) => {
        stopTracks();
        window.localStream = stream;
        localVideoref.current.srcObject = stream;
    };

    const handleVideo = () => setVideo(prev => !prev);
    const handleAudio = () => setAudio(prev => !prev);
    const handleScreen = () => setScreen(prev => !prev);
    const handleEndCall = () => {
        stopTracks();
        window.location.href = "/";
    };

    const openChat = () => {
        setModal(true);
        setNewMessages(0);
    };

    const closeChat = () => setModal(false);

    const handleMessage = (e) => setMessage(e.target.value);

    const addMessage = (data, sender, socketIdSender) => {
        setMessages(prev => [...prev, { sender, data }]);
        if (socketIdSender !== socketIdRef.current) setNewMessages(prev => prev + 1);
    };

    const sendMessage = () => {
        socketRef.current.emit('chat-message', message, username);
        setMessage("");
    };

    const connect = () => {
        setAskForUsername(false);
        setVideo(videoAvailable);
        setAudio(audioAvailable);
    };

    return (
        <div>
            {askForUsername ? (
                <div>
                    <h2>Enter into Lobby</h2>
                    <TextField label="Username" value={username} onChange={e => setUsername(e.target.value)} variant="outlined" />
                    <Button variant="contained" onClick={connect}>Connect</Button>
                    <div>
                        <video ref={localVideoref} autoPlay muted className={styles.localVideo}></video>
                    </div>
                </div>
            ) : (
                <div className={styles.meetingRoom}>Video Meeting UI will be rendered here</div>
            )}
        </div>
    );
}
