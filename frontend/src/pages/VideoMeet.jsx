import React, { useEffect, useRef, useState } from "react";
import styles from "../styles/videoComponent.module.css";
import {
  TextField,
  Button,
  IconButton,
  Badge
} from "@mui/material";
import io from "socket.io-client";
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import server from "../environment";
import { useNavigate } from "react-router-dom";

const serverUrl = server;

let connections = {};

const peerConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export default function VideoMeetComponent() {
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoRef = useRef();

  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState();
  const [screenSharing, setScreenSharing] = useState();
  const [showModal, setShowModal] = useState(true);
  const [screenAvailable, setScreenAvailable] = useState();
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(3);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");

  const videoRef = useRef([]);
  const [videos, setVideos] = useState([]);

  const getDisplayMedia = () => {
    if (screenSharing) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then(handleDisplayMediaSuccess)
          .catch((e) => console.log(e));
      }
    }
  };

  const getPermissions = async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setVideoAvailable(!!videoStream);

      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioAvailable(!!audioStream);

      setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);

      if (videoAvailable || audioAvailable) {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable
        });

        if (userMediaStream) {
          window.localStream = userMediaStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = userMediaStream;
          }
        }
      }
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    getPermissions();
  }, []);

  const handleUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {}

    window.localStream = stream;
    localVideoRef.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      connections[id].addStream(window.localStream);
      connections[id]
        .createOffer()
        .then((desc) => {
          connections[id]
            .setLocalDescription(desc)
            .then(() => {
              socketRef.current.emit("signal", id, JSON.stringify({ sdp: desc }));
            });
        });
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setVideoEnabled(false);
        setAudioEnabled(false);

        try {
          let tracks = localVideoRef.current.srcObject.getTracks();
          tracks.forEach((track) => track.stop());
        } catch (e) {}

        let blackSilence = (...args) =>
          new MediaStream([createBlackVideo(...args), createSilentAudio()]);
        window.localStream = blackSilence();
        localVideoRef.current.srcObject = window.localStream;

        for (let id in connections) {
          connections[id].addStream(window.localStream);
          connections[id]
            .createOffer()
            .then((desc) => {
              connections[id]
                .setLocalDescription(desc)
                .then(() => {
                  socketRef.current.emit("signal", id, JSON.stringify({ sdp: desc }));
                });
            });
        }
      };
    });
  };

  const handleDisplayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {}

    window.localStream = stream;
    localVideoRef.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      connections[id].addStream(window.localStream);
      connections[id]
        .createOffer()
        .then((desc) => {
          connections[id]
            .setLocalDescription(desc)
            .then(() => {
              socketRef.current.emit("signal", id, JSON.stringify({ sdp: desc }));
            });
        });
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setScreenSharing(false);
        try {
          localVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
        } catch (e) {}
        window.localStream = new MediaStream([createBlackVideo(), createSilentAudio()]);
        localVideoRef.current.srcObject = window.localStream;
        getUserMedia();
      };
    });
  };

  const createSilentAudio = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  const createBlackVideo = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement("canvas"), { width, height });
    canvas.getContext("2d").fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  const getUserMedia = () => {
    if ((videoEnabled && videoAvailable) || (audioEnabled && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: videoEnabled, audio: audioEnabled })
        .then(handleUserMediaSuccess)
        .catch((e) => console.log(e));
    } else {
      try {
        let tracks = localVideoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      } catch (e) {}
    }
  };

  useEffect(() => {
    if (videoEnabled !== undefined && audioEnabled !== undefined) {
      getUserMedia();
    }
  }, [videoEnabled, audioEnabled]);

  const gotMessageFromServer = (fromId, message) => {
    const signal = JSON.parse(message);
    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((desc) => {
                  connections[fromId]
                    .setLocalDescription(desc)
                    .then(() => {
                      socketRef.current.emit("signal", fromId, JSON.stringify({ sdp: desc }));
                    });
                });
            }
          });
      }

      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e));
      }
    }
  };

  const addMessage = (data, sender, socketIdSender) => {
    setMessages((prev) => [...prev, { sender, data }]);
    if (socketIdSender !== socketIdRef.current) {
      setNewMessages((prev) => prev + 1);
    }
  };

  const connectToSocketServer = () => {
    socketRef.current = io.connect(serverUrl, { secure: false });
    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-call", window.location.href);
      socketIdRef.current = socketRef.current.id;
      socketRef.current.on("chat-message", addMessage);
      socketRef.current.on("user-left", (id) => {
        setVideos((prev) => prev.filter((video) => video.socketId !== id));
      });

      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((clientId) => {
          connections[clientId] = new RTCPeerConnection(peerConfig);

          connections[clientId].onicecandidate = (e) => {
            if (e.candidate) {
              socketRef.current.emit("signal", clientId, JSON.stringify({ ice: e.candidate }));
            }
          };

          connections[clientId].onaddstream = (e) => {
            const exists = videoRef.current.find((v) => v.socketId === clientId);
            if (exists) {
              setVideos((prev) => {
                const updated = prev.map((v) =>
                  v.socketId === clientId ? { ...v, stream: e.stream } : v
                );
                videoRef.current = updated;
                return updated;
              });
            } else {
              const newVideo = {
                socketId: clientId,
                stream: e.stream,
                autoPlay: true,
                playsinline: true
              };
              setVideos((prev) => {
                const updated = [...prev, newVideo];
                videoRef.current = updated;
                return updated;
              });
            }
          };

          if (window.localStream) {
            connections[clientId].addStream(window.localStream);
          } else {
            const fallbackStream = new MediaStream([
              createBlackVideo(),
              createSilentAudio()
            ]);
            window.localStream = fallbackStream;
            connections[clientId].addStream(window.localStream);
          }
        });

        if (id === socketIdRef.current) {
          for (let peerId in connections) {
            if (peerId === socketIdRef.current) continue;
            connections[peerId].addStream(window.localStream);
            connections[peerId]
              .createOffer()
              .then((desc) => {
                connections[peerId]
                  .setLocalDescription(desc)
                  .then(() => {
                    socketRef.current.emit("signal", peerId, JSON.stringify({ sdp: desc }));
                  });
              });
          }
        }
      });
    });
  };

  const routeTo = useNavigate();

  const connect = () => {
    setAskForUsername(false);
    setVideoEnabled(videoAvailable);
    setAudioEnabled(audioAvailable);
    connectToSocketServer();
  };

  const handleVideoToggle = () => setVideoEnabled(!videoEnabled);
  const handleAudioToggle = () => setAudioEnabled(!audioEnabled);
  const handleScreenToggle = () => setScreenSharing(!screenSharing);

  useEffect(() => {
    if (screenSharing !== undefined) {
      getDisplayMedia();
    }
  });

  const sendMessage = () => {
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  };

  const handleEndCall = () => {
    try {
      localVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    } catch (e) {}
    routeTo("/home");
  };

  return (
    <div>
      {askForUsername ? (
        <div>
          <h2>Enter into Lobby</h2>
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            variant="outlined"
          />
          <Button variant="contained" onClick={connect}>Connect</Button>
          <div><video ref={localVideoRef} autoPlay muted /></div>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          {showModal && (
            <div className={styles.chatRoom}>
              <div className={styles.chatContainer}>
                <h1>Chat</h1>
                <div className={styles.chattingDisplay}>
                  {messages.length > 0
                    ? messages.map((item, index) => (
                        <div style={{ marginBottom: "20px" }} key={index}>
                          <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                          <p>{item.data}</p>
                        </div>
                      ))
                    : <p>No Messages Yet</p>}
                </div>
                <div className={styles.chattingArea}>
                  <TextField value={message} onChange={(e) => setMessage(e.target.value)} label="Enter your chat" variant="outlined" />
                  <Button variant="contained" onClick={sendMessage}>Send</Button>
                </div>
              </div>
            </div>
          )}

          <div className={styles.buttonContainers}>
            <IconButton onClick={handleVideoToggle} style={{ color: "white" }}>
              {videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
            <IconButton onClick={handleEndCall} style={{ color: "red" }}>
              <CallEndIcon />
            </IconButton>
            <IconButton onClick={handleAudioToggle} style={{ color: "white" }}>
              {audioEnabled ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
            {screenAvailable && (
              <IconButton onClick={handleScreenToggle} style={{ color: "white" }}>
                {screenSharing ? <ScreenShareIcon /> : <StopScreenShareIcon />}
              </IconButton>
            )}
            <Badge badgeContent={newMessages} max={999} color="orange">
              <IconButton onClick={() => setShowModal(!showModal)} style={{ color: "white" }}>
                <ChatIcon />
              </IconButton>
            </Badge>
          </div>

          <video className={styles.meetUserVideo} ref={localVideoRef} autoPlay muted />
          <div className={styles.conferenceView}>
            {videos.map((video) => (
              <div key={video.socketId}>
                <video
                  data-socket={video.socketId}
                  ref={(ref) => ref && video.stream && (ref.srcObject = video.stream)}
                  autoPlay
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
