
let castSession = null;
let remotePlayer = null;
let remotePlayerController = null;

/**
 * Initializes the Chromecast API.
 */
function initChromecast() {
  // Check if the Cast API is available
  if (!window.chrome || !window.chrome.cast) {
    console.warn("Chromecast API not available. Make sure it's loaded and supported.");
    chromecastButton.setAttribute('data-cast-state', 'NO_DEVICES_AVAILABLE');
    return;
  }

  // Set up the Cast context options
  cast.framework.CastContext.getInstance().setOptions({
    receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
  });

  // Listen for Cast state changes (e.g., connected, disconnected)
  cast.framework.CastContext.getInstance().addEventListener(
    cast.framework.CastContextEventType.CAST_STATE_CHANGED,
    (event) => {
      updateCastButtonState(event.castState);
      if (event.castState === cast.framework.CastState.NOT_CONNECTED) {
        if (!videoElement.paused) {
          videoElement.play();
        }
      }
    }
  );

  // Initialize remote player for controlling media on the receiver
  remotePlayer = new cast.framework.RemotePlayer();
  remotePlayerController = new cast.framework.RemotePlayerController(remotePlayer);

  // Listen to changes in the remote player state
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
      if (!remotePlayer.isConnected && castSession) {
        console.log('Chromecast session ended due to remote player disconnection.');
        if (videoElement.paused) {
          videoElement.play();
        }
      }
    }
  );

  // Add event listener to the Chromecast button
  chromecastButton.addEventListener('click', launchCastApp);

  // Initial update of the button state
  updateCastButtonState(cast.framework.CastContext.getInstance().getCastState());
}

/**
 * Updates the UI state of the Chromecast button based on the cast state.
 * @param {cast.framework.CastState} castState The current Cast state.
 */
function updateCastButtonState(castState) {
  chromecastButton.setAttribute('data-cast-state', castState);
  if (castState === cast.framework.CastState.NO_DEVICES_AVAILABLE) {
    chromecastButton.style.display = 'none';
  } else {
    chromecastButton.style.display = 'block';
  }
}

/**
 * Connects to a Cast session or requests a new one.
 * @returns {Promise<cast.framework.CastSession>} A promise that resolves with the current Cast session.
 */
function connectToSession() {
  castSession = cast.framework.CastContext.getInstance().getCurrentSession();
  if (!castSession) {
    return cast.framework.CastContext.getInstance().requestSession()
      .then((session) => {
        castSession = session;
        return session;
      });
  }
  return Promise.resolve(castSession);
}

/**
 * Launches the Cast app and loads the media.
 */
function launchCastApp() {
  connectToSession()
    .then((session) => {
      if (!session) {
        console.error('Failed to get Cast session.');
        return;
      }

      videoElement.pause();

      const currentVideoSource = videoElement.querySelector('source') ?
        videoElement.querySelector('source').src : videoElement.src;

      if (!currentVideoSource) {
        console.error('No video source found to cast.');
        return;
      }

      const mediaInfo = new chrome.cast.media.MediaInfo(currentVideoSource);
      mediaInfo.contentType = 'video/mp4';
      const metadata = new chrome.cast.media.GenericMediaMetadata();
      metadata.metadataType = chrome.cast.media.MetadataType.GENERIC;
      metadata.title = "Sintel Trailer";
      mediaInfo.metadata = metadata;

      const loadRequest = new chrome.cast.media.LoadRequest(mediaInfo);
      loadRequest.autoplay = true;

      return session.loadMedia(loadRequest);
    })
    .then(() => {
      console.log('Media loaded successfully on Chromecast.');
    })
    .catch((error) => {
      console.error('Error launching Cast app or loading media:', error);
      if (videoElement.paused) {
        videoElement.play();
      }
    });
}

// Initialize Chromecast when the page is fully loaded
window.__onGCastApiAvailable = function(isAvailable) {
  if (isAvailable) {
    initChromecast();
  } else {
    console.warn("Chromecast API not available.");
    chromecastButton.setAttribute('data-cast-state', 'NO_DEVICES_AVAILABLE');
  }

};
