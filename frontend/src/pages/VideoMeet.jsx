import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketProvider";
import ReactPlayer from "react-player";
import peer from "../services/peer";

const VideoCall = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenTrackRef = useRef(null);

  const handleUserJoined = (id) => {
    console.log("User joined:", id);
    setRemoteSocketId(id);
  };

  const handleCallUser = async () => {
    if (!remoteSocketId || !myStream) return;
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
  };

  const handleIncomingCall = async ({ from, offer }) => {
    setRemoteSocketId(from);
    const ans = await peer.getAnswer(offer);
    socket.emit("call:accepted", { to: from, ans });
  };

  const sendStream = () => {
    for (const track of myStream.getTracks()) {
      peer.peer.addTrack(track, myStream);
    }
  };

  const handleCallAccepted = async ({ ans }) => {
    await peer.setRemoteAns(ans);
    sendStream();
  };

  const handleNegotiationNeeded = async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  };

  const handleNegoIncoming = async ({ from, offer }) => {
    const ans = await peer.getAnswer(offer);
    socket.emit("peer:nego:done", { to: from, ans });
  };

  const handleNegoFinal = async ({ ans }) => {
    await peer.setRemoteAns(ans);
  };

  useEffect(() => {
    const startStream = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMyStream(stream);
    };

    startStream();

    socket.on("user:joined", handleUserJoined);
    socket.on("incoming:call", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegotiationNeeded);
    socket.on("peer:nego:final", handleNegoFinal);
    socket.on("peer:nego:incoming", handleNegoIncoming);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incoming:call", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegotiationNeeded);
      socket.off("peer:nego:final", handleNegoFinal);
      socket.off("peer:nego:incoming", handleNegoIncoming);
    };
  }, [socket, remoteSocketId, myStream]);

  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams[0];
      setRemoteStream(remoteStream);
    });
  }, []);

  const toggleMute = () => {
    const enabled = !isMuted;
    myStream.getAudioTracks().forEach((track) => (track.enabled = enabled));
    setIsMuted(!isMuted);
  };

  const toggleCamera = () => {
    const enabled = !isCameraOff;
    myStream.getVideoTracks().forEach((track) => (track.enabled = enabled));
    setIsCameraOff(!isCameraOff);
  };

  const toggleScreenSharing = async () => {
    if (!isScreenSharing) {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = stream.getVideoTracks()[0];

      screenTrack.onended = () => {
        stopScreenSharing();
      };

      const sender = peer.peer.getSenders().find((s) => s.track.kind === "video");
      sender.replaceTrack(screenTrack);
      screenTrackRef.current = screenTrack;
      setIsScreenSharing(true);
    } else {
      stopScreenSharing();
    }
  };

  const stopScreenSharing = async () => {
    const screenTrack = screenTrackRef.current;
    if (screenTrack) screenTrack.stop();

    const videoTrack = myStream.getVideoTracks()[0];
    const sender = peer.peer.getSenders().find((s) => s.track.kind === "video");
    if (sender && videoTrack) {
      sender.replaceTrack(videoTrack);
    }

    setIsScreenSharing(false);
  };

  return (
    <div className="video-container">
      <h1>Video Call</h1>
      <div className="buttons">
        {remoteSocketId && <button onClick={handleCallUser}>Call</button>}
        <button onClick={toggleMute}>{isMuted ? "Unmute" : "Mute"}</button>
        <button onClick={toggleCamera}>{isCameraOff ? "Turn On Camera" : "Turn Off Camera"}</button>
        <button onClick={toggleScreenSharing}>{isScreenSharing ? "Stop Sharing" : "Share Screen"}</button>
      </div>

      <div className="videos">
        {myStream && (
          <div>
            <h3>You</h3>
            <ReactPlayer playing muted height="300px" width="500px" url={myStream} />
          </div>
        )}
        {remoteStream && (
          <div>
            <h3>Remote</h3>
            <ReactPlayer playing height="300px" width="500px" url={remoteStream} />
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCall;
