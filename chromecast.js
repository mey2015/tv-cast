

// ประกาศตัวแปรส่วนกลางที่ใช้ในการอ้างอิงถึงองค์ประกอบ HTML
const videoElement = document.getElementById('main-video');
const bundycastButton = document.getElementById('bundycast');


// ประกาศตัวแปรสำหรับจัดการสถานะการแคสต์
let castSession = null;
let remotePlayer = null;
let remotePlayerController = null;


// ฟังก์ชันหลักสำหรับเริ่มต้นการทำงานของ Chromecast
function initChromecast() {
  // ตรวจสอบว่า Cast API พร้อมใช้งานหรือไม่
  if (!window.chrome || !window.chrome.cast) {
    console.warn("Chromecast API not available. Make sure it's loaded and supported.");
    bundycastButton.setAttribute('data-cast-state', 'NO_DEVICES_AVAILABLE');
    return;
  }


  // ตั้งค่า Cast context เช่น แอปพลิเคชันที่ใช้และนโยบายการเชื่อมต่อ
  cast.framework.CastContext.getInstance().setOptions({
    receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID, // ใช้แอปพลิเคชันรับสื่อมาตรฐาน
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
  });


  // ฟังการเปลี่ยนแปลงสถานะการแคสต์ (เช่น เชื่อมต่อ, ตัดการเชื่อมต่อ)
  cast.framework.CastContext.getInstance().addEventListener(
    cast.framework.CastContextEventType.CAST_STATE_CHANGED,
    (event) => {
      updateCastButtonState(event.castState);
      // ถ้าตัดการเชื่อมต่อ ให้เล่นวิดีโอในหน้าเว็บต่อ
      if (event.castState === cast.framework.CastState.NOT_CONNECTED) {
        if (!videoElement.paused) {
          videoElement.play();
        }
      }
    }
  );


  // สร้างออบเจกต์สำหรับควบคุมการเล่นวิดีโอบนทีวี
  remotePlayer = new cast.framework.RemotePlayer();
  remotePlayerController = new cast.framework.RemotePlayerController(remotePlayer);


  // ฟังการเปลี่ยนแปลงสถานะของ Remote Player
  remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.IS_PAUSED_CHANGED,
    () => {
      console.log('Remote player paused status:', remotePlayer.isPaused);
    }
  );
  remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
    () => {
      console.log('Remote player connected status:', remotePlayer.isConnected);
      // ถ้า Remote Player ตัดการเชื่อมต่อ ให้เล่นวิดีโอในหน้าเว็บต่อ
      if (!remotePlayer.isConnected && castSession) {
        console.log('Chromecast session ended due to remote player disconnection.');
        if (videoElement.paused) {
          videoElement.play();
        }
      }
    }
  );


  // เพิ่ม Event Listener ให้กับปุ่ม Cast เมื่อกดแล้วจะเรียกฟังก์ชัน launchCastApp
  bundycastButton.addEventListener('click', launchCastApp);


  // อัปเดตสถานะของปุ่มครั้งแรกเมื่อเริ่มทำงาน
  updateCastButtonState(cast.framework.CastContext.getInstance().getCastState());
}


// ฟังก์ชันสำหรับอัปเดตสถานะของปุ่ม Cast (ซ่อน/แสดง)
function updateCastButtonState(castState) {
  bundycastButton.setAttribute('data-cast-state', castState);
  if (castState === cast.framework.CastState.NO_DEVICES_AVAILABLE) {
    bundycastButton.style.display = 'none'; // ซ่อนปุ่มเมื่อไม่มีอุปกรณ์
  } else {
    bundycastButton.style.display = 'block'; // แสดงปุ่มเมื่อมีอุปกรณ์
  }
}


// ฟังก์ชันสำหรับเชื่อมต่อกับ Cast Session
function connectToSession() {
  castSession = cast.framework.CastContext.getInstance().getCurrentSession();
  if (!castSession) {
    // ถ้าไม่มี session ให้ร้องขอการเชื่อมต่อใหม่
    return cast.framework.CastContext.getInstance().requestSession()
      .then((session) => {
        castSession = session;
        return session;
      });
  }
  return Promise.resolve(castSession);
}


// ฟังก์ชันสำหรับเริ่มต้นการแคสต์วิดีโอ
function launchCastApp() {
  connectToSession()
    .then((session) => {
      if (!session) {
        console.error('Failed to get Cast session.');
        return;
      }


      // หยุดวิดีโอในหน้าเว็บก่อนทำการแคสต์
      videoElement.pause();


      // ดึง URL ของวิดีโอจากแท็ก <video>
      const currentVideoSource = videoElement.querySelector('source') ?
        videoElement.querySelector('source').src : videoElement.src;


      if (!currentVideoSource) {
        console.error('No video source found to cast.');
        return;
      }


      // สร้าง MediaInfo object เพื่อบอกรายละเอียดของวิดีโอ
      const mediaInfo = new chrome.cast.media.MediaInfo(currentVideoSource);
      mediaInfo.contentType = 'video/mp4';


      // สร้าง Metadata สำหรับแสดงข้อมูลวิดีโอบนหน้าจอทีวี
      const metadata = new chrome.cast.media.GenericMediaMetadata();
      metadata.metadataType = chrome.cast.media.MetadataType.GENERIC;
      metadata.title = "Sintel Trailer";
      mediaInfo.metadata = metadata;


      // สร้าง LoadRequest เพื่อส่งคำขอให้ Chromecast เล่นวิดีโอ
      const loadRequest = new chrome.cast.media.LoadRequest(mediaInfo);
      loadRequest.autoplay = true;


      // ส่งคำขอไปให้ Cast Session เพื่อโหลดวิดีโอ
      return session.loadMedia(loadRequest);
    })
    .then(() => {
      console.log('Media loaded successfully on Chromecast.');
    })
    .catch((error) => {
      console.error('Error launching Cast app or loading media:', error);
      // ถ้าแคสต์ไม่สำเร็จ ให้เล่นวิดีโอในหน้าเว็บต่อ
      if (videoElement.paused) {
        videoElement.play();
      }
    });
}


// เมื่อ Cast API โหลดเสร็จแล้ว ให้เริ่มต้นการทำงานของ Chromecast
window.__onGCastApiAvailable = function(isAvailable) {
  if (isAvailable) {
    initChromecast();
  } else {
    console.warn("Chromecast API not available.");
    bundycastButton.setAttribute('data-cast-state', 'NO_DEVICES_AVAILABLE');
  }
};
