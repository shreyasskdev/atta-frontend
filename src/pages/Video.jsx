import { useEffect, useRef, useState } from "react";
import styles from "../styles/Video.module.css";

function Video() {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");

  const localVideo = useRef();
  const localStream = useRef();
  const remoteStream = useRef();
  const remoteVideo = useRef();
  const peerRef = useRef();
  const webSocketRef = useRef();
  const msgRef = useRef(null);
  const userId = useRef();
  const connectedUserId = useRef();
  const [isChatToggled, setIsChatToggled] = useState(false);

  useEffect(() => {
    webSocketRef.current = new WebSocket("wss://webrtc.vaishakhgk.com/ws/start");

    if (webSocketRef.current) {
      webSocketRef.current.addEventListener("message", (event) => {
        let data = JSON.parse(event.data);
        if (data.messageType == "ID") {
          userId.current = data.content;
        } else if (data.messageType == "CHAT") {
          setMessages((msg) => [...msg, data]);
        } else if (data.messageType == "SIGNAL") {
          if (data.category == "CONNECT_SIGNAL") {
            connectedUserId.current = data.content;
            offerConnection(data.content);
          } else if (data.category == "DISCONNECT_SIGNAL") {
            setMessage("");
            setMessages([]);

            connectedUserId.current = "";
            peerRef.current.close();

            remoteStream.current = new MediaStream();
            remoteVideo.current.srcObject = remoteStream.current;
            setMessages([]);
          } else if (data.category == "ICE_SIGNAL") {
            try {
              const candidate = new RTCIceCandidate(data.content);
              peerRef.current.addIceCandidate(candidate);
            } catch (err) {
              console.log(err);
            }
          }
        } else if (data.messageType == "OFFER") {
          if (data.category == "OFFER_REQ") {
            connectedUserId.current = data.from;
            handleOffer(data.from, data.content);
          } else if (data.category == "OFFER_ACC") {
            handleAnswer(data.content);
          }
        }
      });

      /* webSocketRef.current.onopen = connectWs; */
    }

    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
    };
  }, []);

  function connectWs() {
    var msg = {
      messageType: "SIGNAL",
      category: "CONNECT_REQ",
    };

    try {
      webSocketRef.current.send(JSON.stringify(msg));
    } catch (e) {
      webSocketRef.onopen = function () {
        webSocketRef.current.send(JSON.stringify(msg));
      };
    }
  }

  const createPeer = () => {
    const configuration = {
      iceServers: [
        {
          urls: [
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
          ],
        },
      ],
      iceCandidatePoolSize: 10,
    };

    peerRef.current = new RTCPeerConnection(configuration);

    localStream.current.getTracks().forEach((track) => {
      peerRef.current.addTrack(track, localStream.current);
    });

    peerRef.current.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.current.addTrack(track);
      });

      remoteVideo.current.srcObject = remoteStream.current;
    };
  };

  const setupStream = async () => {
    localStream.current = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    remoteStream.current = new MediaStream();

    localVideo.current.srcObject = localStream.current;
    remoteVideo.current.srcObject = remoteStream.current;

    if (webSocketRef.current) {
      connectWs();
    }
  };

  useEffect(() => {
    setupStream();
  }, []);

  const offerConnection = async (id) => {
    createPeer();
    const offer = await peerRef.current.createOffer();
    await peerRef.current.setLocalDescription(offer);
    const msg = {
      from: userId.current,
      to: id,
      messageType: "OFFER",
      category: "OFFER_REQ",
      content: offer,
    };

    webSocketRef.current.send(JSON.stringify(msg));

    peerRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        const msg = {
          to: id,
          messageType: "SIGNAL",
          category: "ICE_SIGNAL",
          content: event.candidate,
        };
        webSocketRef.current.send(JSON.stringify(msg));
      }
    };
  };

  const handleAnswer = (answer) => {
    const answerDescription = new RTCSessionDescription(answer);
    peerRef.current.setRemoteDescription(answerDescription);
  };

  const handleOffer = async (from, offer) => {
    createPeer();
    await peerRef.current.setRemoteDescription(
      new RTCSessionDescription(offer),
    );

    const answer = await peerRef.current.createAnswer();
    await peerRef.current.setLocalDescription(answer);

    const msg = {
      to: from,
      messageType: "OFFER",
      category: "OFFER_ACC",
      content: answer,
    };
    webSocketRef.current.send(JSON.stringify(msg));

    peerRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        const msg = {
          to: from,
          messageType: "SIGNAL",
          category: "ICE_SIGNAL",
          content: event.candidate.toJSON(),
        };
        webSocketRef.current.send(JSON.stringify(msg));
      }
    };
  };

  // message scroll to bottom when updating
  useEffect(() => {
    msgRef.current.scrollTop = msgRef.current.scrollHeight;
  }, [messages]);

  function toggleChat() {
    setIsChatToggled(!isChatToggled);
  }

  function sendMsg() {
    if (message == "") return;

    var msg = {
      to: connectedUserId.current,
      messageType: "CHAT",
      content: message,
    };

    webSocketRef.current.send(JSON.stringify(msg));
    setMessage("");
    setMessages((m) => [...m, msg]);
  }

  function skip() {
    if (connectedUserId.current) {
      var msg = {
        from: userId.current,
        messageType: "SIGNAL",
        category: "SKIP_REQ",
      };

      webSocketRef.current.send(JSON.stringify(msg));
    }
  }

  return (
    <>
      <div className={styles.main}>
        <header>
          <h3>Entha Mone</h3>
        </header>
        <div className={styles.content}>
          {/* Video */}
          <div
            className={[
              styles.video,
              isChatToggled ? styles.hide : styles.show,
            ].join(" ")}
          >
            {/* Big Video */}
            <video
              id="remoteVideo"
              ref={remoteVideo}
              autoPlay
              controls={false}
            />
            {/* Small video */}
            <div className={styles.videoSmall}>
              <video
                ref={localVideo}
                id="localVideo"
                muted
                autoPlay
                controls={false}
              />
            </div>
          </div>

          <div
            className={[
              styles.chat,
              isChatToggled ? styles.show : styles.hide,
            ].join(" ")}
          >
            {/* message container */}
            <div className={styles.msg} ref={msgRef}>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={
                    message.to == connectedUserId.current
                      ? styles.sent
                      : styles.received
                  }
                >
                  {message.content}
                </div>
              ))}
            </div>

            <div className={styles.textArea}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message"
              ></textarea>
              <button onClick={sendMsg}>send</button>
            </div>
          </div>
        </div>
        <footer>
          <button className={styles.toggle} onClick={toggleChat}>
            {isChatToggled ? "video" : "chat"}
          </button>
          <button className={styles.skip} onClick={skip}>
            Skip
          </button>
        </footer>
      </div>
    </>
  );
}

export default Video;
