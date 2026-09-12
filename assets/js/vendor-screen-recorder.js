(function () {
  // Webcam mode: a single native getUserMedia stream already has video+audio
  // natively synced by the browser — no combining issue, one recorder is fine.
  const WEBCAM_MIME_CANDIDATES = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ];
  // Screen mode: video (screen) and audio (mic) are captured completely
  // independently — same principle as the desktop ScreenRecorder app
  // (recorder.py), which records video and audio on two separate native
  // threads to two separate files and only combines them at the very end
  // via a single ffmpeg mux pass. Every attempt to combine the two live in
  // one MediaRecorder (Web Audio graph re-clocking, constraint tuning, an
  // <audio>-element capture pipeline) produced an audio artifact specific
  // to Chrome despite being clean in Edge — recording them fully separately
  // sidesteps that combining step entirely, then ffmpeg.wasm muxes the two
  // finished files together the same way the desktop app's ffmpeg step does.
  const VIDEO_ONLY_MIME_CANDIDATES = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  const AUDIO_ONLY_MIME_CANDIDATES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];

  const MAX_DURATION_MS = 10 * 60 * 1000;
  // Standard/default Chrome audio processing (all three DSP stages on).
  // A pulsing "engine/motorboat" noise reported on one Windows 10 test
  // machine was chased for a long time here — ruled out ffmpeg's mux step,
  // video/CPU contention, screen vs webcam, extensions, and both DSP
  // extremes (all off vs all on made no difference) before confirming via a
  // Windows 11 machine that it's a Chrome-on-Windows-10 audio capture bug on
  // that specific OS, unrelated to these constraints or anything in this
  // file. Left on the standard settings since they're the most-exercised,
  // best-supported code path.
  const AUDIO_CONSTRAINTS = {
    echoCancellation: true, noiseSuppression: true, autoGainControl: true,
    // Mono only — no sampleRate constraint. USB headsets (e.g. Jabra devices)
    // often capture natively at 16kHz for voice, not 44.1kHz; forcing 44100
    // forces a resample the device doesn't actually support cleanly, which
    // produced a low rumbling "engine" artifact — removed, let the device's
    // own native rate pass through unconstrained instead.
    channelCount: 1,
  };
  // Opus/AAC default bitrate under MediaRecorder can land quite low, which
  // sounds exactly like static/compression artifacts, not raw mic noise.
  const AUDIO_BITS_PER_SECOND = 128000;
  // The first ~300-400ms of a freshly-opened mic track is often a pop/crackle
  // while the OS/browser's audio pipeline (AGC especially) settles — starting
  // the actual MediaRecorder after a short warm-up avoids capturing that burst.
  const AUDIO_WARMUP_MS = 400;

  // ffmpeg.wasm — loaded lazily, only the first time a screen recording with
  // mic audio actually needs muxing, not on every page load. Self-hosted
  // (frontend/assets/js/ffmpeg/) rather than pulled from a CDN at runtime —
  // every CDN-loading approach tried hit a different failure (cross-origin
  // Worker construction blocked, a resolved-but-unfetchable esm.sh path,
  // a silent hang from the multi-threaded core needing headers this site
  // doesn't send). Same-origin files sidestep all of that at once.
  const FFMPEG_BASE = '/assets/js/ffmpeg';
  let ffmpegInstance = null;

  const unsupportedEl = document.getElementById('rec-unsupported');
  const upsellEl      = document.getElementById('recorder-upsell');
  const toolEl        = document.getElementById('recorder-tool');

  const modeSelectEl  = document.getElementById('rec-mode-select');
  const screenBtn     = document.getElementById('rec-mode-screen');
  const webcamBtn     = document.getElementById('rec-mode-webcam');
  const micToggle     = document.getElementById('rec-mic-enabled');
  const permMsgEl     = document.getElementById('rec-permission-msg');

  const liveEl        = document.getElementById('rec-live');
  const liveVideoEl   = document.getElementById('rec-live-video');
  const timerEl       = document.getElementById('rec-timer');
  const pauseBtn      = document.getElementById('rec-pause-btn');
  const stopBtn       = document.getElementById('rec-stop-btn');
  const activateOverlay = document.getElementById('rec-activate-overlay');

  const processingEl  = document.getElementById('rec-processing');

  const reviewEl       = document.getElementById('rec-review');
  const reviewVideoEl  = document.getElementById('rec-review-video');
  const downloadBtn    = document.getElementById('rec-download-btn');
  const editBtn        = document.getElementById('rec-edit-btn');
  const rerecordBtn    = document.getElementById('rec-rerecord-btn');
  const discardBtn     = document.getElementById('rec-discard-btn');

  const editEl         = document.getElementById('rec-edit');
  const editVideoEl    = document.getElementById('rec-edit-video');
  const editMsgEl      = document.getElementById('rec-edit-msg');
  const editToolBtns   = Array.from(document.querySelectorAll('.rec-edit-tool-btn'));
  const editPanels     = {
    trim: document.getElementById('rec-edit-panel-trim'),
    remove: document.getElementById('rec-edit-panel-remove'),
    volume: document.getElementById('rec-edit-panel-volume'),
    text: document.getElementById('rec-edit-panel-text'),
  };
  const trimFilmstripEl = document.getElementById('rec-trim-filmstrip');
  const trimStartLabel  = document.getElementById('rec-trim-start-label');
  const trimEndLabel    = document.getElementById('rec-trim-end-label');
  const trimApplyBtn    = document.getElementById('rec-trim-apply');
  const removeFilmstripEl = document.getElementById('rec-remove-filmstrip');
  const markStartLabel  = document.getElementById('rec-mark-start-label');
  const markEndLabel    = document.getElementById('rec-mark-end-label');
  const removeApplyBtn  = document.getElementById('rec-remove-apply');
  const volumeSlider    = document.getElementById('rec-volume-slider');
  const volumeLabel     = document.getElementById('rec-volume-label');
  const volumeApplyBtn  = document.getElementById('rec-volume-apply');
  const textInput       = document.getElementById('rec-text-input');
  const textPosBtns     = Array.from(document.querySelectorAll('.rec-text-pos-btn'));
  const textFxBtns      = Array.from(document.querySelectorAll('.rec-text-fx-btn'));
  const textFontBtns    = Array.from(document.querySelectorAll('.rec-text-font-btn'));
  const textFilmstripEl = document.getElementById('rec-text-filmstrip');
  const textStartLabel  = document.getElementById('rec-text-start-label');
  const textEndLabel    = document.getElementById('rec-text-end-label');
  const textApplyBtn    = document.getElementById('rec-text-apply');
  const editRevertLink  = document.getElementById('rec-edit-revert');
  const editDoneBtn     = document.getElementById('rec-edit-done');

  // ── Webcam-mode state (single stream/recorder) ────────────
  let webcamStream = null;
  let webcamRecorder = null;
  let webcamChunks = [];
  let webcamMimeType = '';

  // ── Screen-mode state (two fully independent streams/recorders) ──
  let screenStream = null;
  let micStream = null;
  let videoRecorder = null;
  let audioRecorder = null;
  let videoChunks = [];
  let audioChunks = [];
  let videoMimeType = '';
  let audioMimeType = '';
  let stopsPending = 0; // how many of the two recorders' onstop we're still waiting for

  // ── Shared state ───────────────────────────────────────────
  let previewStream = null; // what the live <video> binds to
  let currentMode = null;   // 'screen' | 'webcam' — which state block is active
  let finalBlob = null;     // the blob actually shown in review / downloaded
  let finalMimeType = '';
  let reviewBlobUrl = null;
  let timerStart = 0;
  let pausedElapsed = 0;
  let timerInterval = null;
  let maxDurationTimeout = null;

  // ── Edit panel state ────────────────────────────────────────
  let editBlobUrl = null;
  let preEditBlob = null;      // snapshot taken the first time the edit panel opens this review
  let preEditMimeType = '';
  let trimStartSec = 0;
  let trimEndSec = 0;
  let cutMarkStart = 0;
  let cutMarkEnd = 0;
  let textStartSec = 0;
  let textEndSec = 0;
  let activeTextPosition = 'top';
  let activeTextEffect = 'none'; // 'none' | 'fade' | 'slide'
  let activeTextFont = 'clean';  // 'clean' | 'bold' | 'playful' — see TEXT_FONTS

  // ── Tier gate ─────────────────────────────────────────────
  function applyTierGate(type) {
    const rank = (TIER_RANK && TIER_RANK[type]) || 1;
    const ok = rank >= TIER_RANK.refurbished;
    upsellEl.style.display = ok ? 'none' : '';
    toolEl.style.display   = ok ? '' : 'none';
  }
  document.addEventListener('vendorLoaded', (e) => applyTierGate(e.detail?.type || 'casual'));
  const _cachedTier = localStorage.getItem('s4l_vendorType');
  if (_cachedTier) applyTierGate(_cachedTier);

  // ── Feature detection ────────────────────────────────────
  const hasMediaRecorder = !!window.MediaRecorder;
  const hasDisplayMedia  = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  const hasUserMedia     = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  if (!hasMediaRecorder || !hasUserMedia) {
    unsupportedEl.style.display = '';
    modeSelectEl.style.display = 'none';
  } else {
    webcamMimeType = WEBCAM_MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    videoMimeType  = VIDEO_ONLY_MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    audioMimeType  = AUDIO_ONLY_MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    if (!hasDisplayMedia) screenBtn.style.display = 'none';
  }

  // ── Helpers ───────────────────────────────────────────────
  function showPermissionMessage(msg) {
    permMsgEl.textContent = msg;
    permMsgEl.style.display = '';
  }
  function clearPermissionMessage() {
    permMsgEl.style.display = 'none';
  }

  // Picks a camera deviceId that isn't labeled as an IR/infrared sensor
  // (Windows Hello face-unlock cameras) — falls back to null (letting
  // facingMode handle it) if labels aren't available yet, which happens on
  // a page's very first-ever camera permission request before any grant.
  async function pickColorCameraDeviceId() {
    if (!navigator.mediaDevices.enumerateDevices) return null;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      const color = cameras.find((d) => !/ir\b|infrared/i.test(d.label));
      return color ? color.deviceId : null;
    } catch {
      return null;
    }
  }

  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function startTimer() {
    timerStart = Date.now();
    pausedElapsed = 0;
    timerInterval = setInterval(() => {
      timerEl.textContent = formatTime(Date.now() - timerStart);
    }, 250);
  }
  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function teardownStream() {
    if (webcamStream) {
      webcamStream.getTracks().forEach((t) => t.stop());
      webcamStream = null;
    }
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      screenStream = null;
    }
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
  }

  function resetToModeSelect() {
    stopTimer();
    if (maxDurationTimeout) { clearTimeout(maxDurationTimeout); maxDurationTimeout = null; }
    // Defensive: covers not just the normal Stop-button path (which already
    // tears the stream down before review appears) but any case where a
    // stream is somehow still live going into a reset — e.g. Re-record/
    // Discard, so a leftover screen-share (and its persistent native "Stop
    // Sharing" indicator) never survives back into mode-select.
    teardownStream();
    webcamRecorder = null;
    webcamChunks = [];
    videoRecorder = null;
    audioRecorder = null;
    videoChunks = [];
    audioChunks = [];
    stopsPending = 0;
    finalBlob = null;
    finalMimeType = '';
    currentMode = null;
    liveVideoEl.srcObject = null;
    previewStream = null;
    liveEl.style.display = 'none';
    activateOverlay.style.display = 'none';
    processingEl.style.display = 'none';
    if (reviewBlobUrl) { URL.revokeObjectURL(reviewBlobUrl); reviewBlobUrl = null; }
    reviewVideoEl.removeAttribute('src');
    reviewEl.style.display = 'none';
    modeSelectEl.style.display = '';
    pauseBtn.textContent = '⏸ Pause';
    pauseBtn.style.display = 'none';
  }

  // ── Start recording ──────────────────────────────────────
  async function startRecording(mode) {
    clearPermissionMessage();
    const micEnabled = micToggle.checked;
    currentMode = mode;

    try {
      if (mode === 'screen') {
        // Capped resolution/frameRate — uncapped getDisplayMedia captures the
        // monitor's full native resolution (confirmed 3804x1600 on an
        // ultrawide here), and encoding that much video in real time via VP9
        // is heavy enough to starve the simultaneous mic-audio capture of
        // CPU time, producing periodic dropouts that sound like a pulsing
        // engine/motorboat noise — present even in the raw pre-mux audio, so
        // it's a capture-time contention issue, not anything ffmpeg-related.
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { max: 1920 }, height: { max: 1080 }, frameRate: { max: 30 } },
          audio: false,
        });
        if (micEnabled) {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
          } catch {
            // Mic permission denied/cancelled — continue with screen-only, not a hard failure.
            micStream = null;
          }
        }
        previewStream = screenStream;
        screenStream.getVideoTracks()[0].addEventListener('ended', () => {
          if ((videoRecorder && videoRecorder.state !== 'inactive') || (audioRecorder && audioRecorder.state !== 'inactive')) {
            stopRecording();
          }
        });
      } else {
        // Confirmed fine in the Windows Camera app and Zoom, so the green
        // tint is specific to what getUserMedia negotiates here — laptops
        // with a Windows Hello IR camera expose it as a *separate* video
        // input alongside the real color camera, and an unconstrained
        // request can land on the IR one (not real RGB data, hence solid
        // green). Explicitly avoid any device labeled as IR/infrared, and
        // pin resolution/frameRate too (an unconstrained high-fps MJPEG mode
        // on some integrated cameras triggers a related decode bug).
        const colorDeviceId = await pickColorCameraDeviceId();
        const videoConstraints = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } };
        if (colorDeviceId) videoConstraints.deviceId = { exact: colorDeviceId };
        else videoConstraints.facingMode = 'user';
        webcamStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: micEnabled ? AUDIO_CONSTRAINTS : false,
        });
        previewStream = webcamStream; // a single native stream — no combination involved
      }
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        showPermissionMessage('Permission was cancelled — click a mode above to try again.');
      } else {
        showPermissionMessage('Could not start recording: ' + (err.message || err.name));
      }
      return;
    }

    // The native OS-level "choose what to share" picker doesn't reliably
    // hand keyboard/window focus back to this tab once it closes (confirmed
    // reproducing identically on both Firefox and Opera — different
    // rendering engines, so this isn't one browser's paint bug, it's a
    // focus-restoration gap after that picker dismisses) — the page's own
    // UI update below can sit un-rendered until the vendor clicks something
    // to manually refocus it. Explicitly request focus back right away…
    window.focus();

    liveVideoEl.srcObject = previewStream;
    liveVideoEl.classList.toggle('rec-mirror', mode === 'webcam');
    modeSelectEl.style.display = 'none';
    liveEl.style.display = '';
    timerEl.textContent = '00:00';

    // …but window.focus() from script can't always force real OS-level
    // focus back (browsers restrict this for anti-abuse reasons), and
    // without genuine focus the Stop/Pause buttons plainly don't respond
    // to clicks at all — confirmed on real hardware, buttons render fine
    // but do nothing. Rather than leave that invisible and confusing,
    // show an explicit "click to activate" overlay whenever focus
    // genuinely hasn't returned, and clear it the moment it has.
    if (!document.hasFocus()) {
      activateOverlay.style.display = '';
      window.addEventListener('focus', () => { activateOverlay.style.display = 'none'; }, { once: true });
    }

    // Let the audio pipeline settle before recording actually starts (see
    // AUDIO_WARMUP_MS above) — the preview is already live and visible
    // during this wait, so it doesn't feel like a delay to the vendor.
    const hasAudio = mode === 'screen' ? !!micStream : webcamStream.getAudioTracks().length > 0;
    await new Promise((resolve) => setTimeout(resolve, hasAudio ? AUDIO_WARMUP_MS : 0));

    if (mode === 'screen') {
      // Stream(s) could have been torn down (e.g. native "Stop sharing"
      // clicked) during the warm-up wait — bail out rather than recording
      // a dead stream.
      if (!screenStream || screenStream.getTracks().every((t) => t.readyState === 'ended')) return;

      videoChunks = [];
      const videoOpts = {};
      if (videoMimeType) videoOpts.mimeType = videoMimeType;
      videoRecorder = new MediaRecorder(screenStream, videoOpts);
      videoRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) videoChunks.push(e.data); };
      videoRecorder.onstop = onOneRecorderStopped;

      if (micStream) {
        audioChunks = [];
        const audioOpts = { audioBitsPerSecond: AUDIO_BITS_PER_SECOND };
        if (audioMimeType) audioOpts.mimeType = audioMimeType;
        audioRecorder = new MediaRecorder(micStream, audioOpts);
        audioRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunks.push(e.data); };
        audioRecorder.onstop = onOneRecorderStopped;
      } else {
        audioRecorder = null;
      }

      stopsPending = audioRecorder ? 2 : 1;
      videoRecorder.start();
      if (audioRecorder) audioRecorder.start();

      pauseBtn.style.display = (typeof videoRecorder.pause === 'function' && (!audioRecorder || typeof audioRecorder.pause === 'function')) ? '' : 'none';
    } else {
      if (!webcamStream || webcamStream.getTracks().every((t) => t.readyState === 'ended')) return;

      webcamChunks = [];
      const recorderOpts = { audioBitsPerSecond: AUDIO_BITS_PER_SECOND };
      if (webcamMimeType) recorderOpts.mimeType = webcamMimeType;
      webcamRecorder = new MediaRecorder(webcamStream, recorderOpts);
      webcamRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) webcamChunks.push(e.data); };
      webcamRecorder.onstop = onWebcamRecorderStopped;
      webcamRecorder.start();

      pauseBtn.style.display = typeof webcamRecorder.pause === 'function' ? '' : 'none';
    }

    startTimer();

    maxDurationTimeout = setTimeout(() => {
      stopRecording();
    }, MAX_DURATION_MS);
  }

  function stopRecording() {
    if (maxDurationTimeout) { clearTimeout(maxDurationTimeout); maxDurationTimeout = null; }
    stopTimer();
    if (currentMode === 'screen') {
      if (videoRecorder && videoRecorder.state !== 'inactive') videoRecorder.stop();
      if (audioRecorder && audioRecorder.state !== 'inactive') audioRecorder.stop();
      if (!videoRecorder && !audioRecorder) return; // never actually got recording started
    } else {
      if (webcamRecorder && webcamRecorder.state !== 'inactive') webcamRecorder.stop();
    }
    teardownStream();

    liveVideoEl.srcObject = null;
    previewStream = null;
    liveEl.style.display = 'none';
    activateOverlay.style.display = 'none';
  }

  // ── Webcam finish (single recorder, no muxing needed) ─────
  function onWebcamRecorderStopped() {
    finalBlob = new Blob(webcamChunks, { type: webcamMimeType || 'video/webm' });
    finalMimeType = webcamMimeType || 'video/webm';
    showReview();
  }

  // ── Screen finish (one or two recorders — mux if two) ─────
  async function onOneRecorderStopped() {
    stopsPending--;
    if (stopsPending > 0) return; // still waiting on the other recorder

    const videoBlob = new Blob(videoChunks, { type: videoMimeType || 'video/webm' });

    if (!audioChunks.length) {
      // Screen-only, no mic — nothing to mux, use the video recording directly.
      finalBlob = videoBlob;
      finalMimeType = videoMimeType || 'video/webm';
      showReview();
      return;
    }

    const audioBlob = new Blob(audioChunks, { type: audioMimeType || 'audio/webm' });

    processingEl.style.display = '';
    try {
      finalBlob = await muxVideoAudio(videoBlob, audioBlob);
      finalMimeType = 'video/mp4';
    } catch (err) {
      console.error('[screen-recorder] mux failed, falling back to video-only. Full error object:', err);
      console.error('[screen-recorder] error type:', typeof err, 'constructor:', err?.constructor?.name, 'stringified:', String(err));
      // Combining failed for some reason (e.g. ffmpeg.wasm couldn't load) —
      // still hand back a usable recording rather than nothing at all, just
      // without narration.
      finalBlob = videoBlob;
      finalMimeType = videoMimeType || 'video/webm';
      showPermissionMessage('Could not combine audio with the video — downloaded video has no narration. (' + String(err) + ')');
    }
    processingEl.style.display = 'none';
    showReview();
  }

  // Lazily loads ffmpeg.wasm (only the first time it's actually needed) —
  // shared by muxVideoAudio() and every edit-panel operation (trim, remove
  // part, volume, text overlay) below, so the load logic lives in one place.
  async function getFfmpeg() {
    if (ffmpegInstance) return ffmpegInstance;
    console.log('[screen-recorder] importing local ffmpeg modules...');
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import(`${FFMPEG_BASE}/ffmpeg/index.js`),
      import(`${FFMPEG_BASE}/util/index.js`),
    ]);
    console.log('[screen-recorder] modules imported ok');
    const ff = new FFmpeg();
    ff.on('log', ({ message }) => console.log('[ffmpeg]', message));
    // @ffmpeg/core (single-threaded build — no COOP/COEP headers needed,
    // no SharedArrayBuffer/pthread usage) ships only ffmpeg-core.js/.wasm,
    // no separate worker file, so there's no workerURL to pass here.
    const coreURL = await toBlobURL(`${FFMPEG_BASE}/core/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${FFMPEG_BASE}/core/ffmpeg-core.wasm`, 'application/wasm');
    // classWorkerURL is deliberately NOT blob-URL-wrapped, unlike
    // coreURL/wasmURL above — worker.js itself does `import ... from
    // "./const.js"` internally, a relative import that can only resolve
    // against a real URL's directory. A blob: URL has no real directory to
    // resolve against, so wrapping the worker script (only needed earlier
    // to dodge a cross-origin restriction that no longer applies now
    // everything's self-hosted) was silently breaking its own startup —
    // the worker "loaded" but could never resolve its own sibling imports,
    // hanging forever with no error ever reaching the main thread.
    const classWorkerURL = `${FFMPEG_BASE}/ffmpeg/worker.js`;
    console.log('[screen-recorder] calling ff.load()...');
    await ff.load({ coreURL, wasmURL, classWorkerURL });
    console.log('[screen-recorder] ff.load() completed');
    ffmpegInstance = ff;
    return ff;
  }

  // Muxes a video-only blob with an audio-only blob into one mp4 — the same
  // "record separately, combine once at the end via ffmpeg" principle the
  // desktop ScreenRecorder app uses (recorder.py's _mux()), just running in
  // the browser via a WebAssembly build of ffmpeg instead of a native binary.
  async function muxVideoAudio(videoBlob, audioBlob) {
    const ff = await getFfmpeg();
    console.log('[screen-recorder] video blob:', videoBlob.size, 'bytes, type=', videoBlob.type);
    console.log('[screen-recorder] audio blob:', audioBlob.size, 'bytes, type=', audioBlob.type);

    const videoExt = videoMimeType.includes('mp4') ? 'mp4' : 'webm';
    const audioExt = audioMimeType.includes('ogg') ? 'ogg' : 'webm';
    const videoName = `in_video.${videoExt}`;
    const audioName = `in_audio.${audioExt}`;
    const outName = 'out.mp4';

    await ff.writeFile(videoName, new Uint8Array(await videoBlob.arrayBuffer()));
    await ff.writeFile(audioName, new Uint8Array(await audioBlob.arrayBuffer()));
    console.log('[screen-recorder] files written to ffmpeg fs, running mux...');

    // Mirrors the desktop app's own mux command (recorder.py _mux()):
    // copy the video stream as-is, encode audio to AAC, trim to the
    // shorter of the two rather than padding/guessing at the gap.
    // Explicit -map is required with two separate inputs — without it,
    // ffmpeg's automatic stream selection isn't guaranteed to actually
    // pick the audio stream from the second input, which produced a
    // muxed file with real audio data going in but a silent result.
    await ff.exec([
      '-i', videoName, '-i', audioName,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-shortest', outName,
    ]);
    console.log('[screen-recorder] ff.exec() completed');

    const data = await ff.readFile(outName);
    console.log('[screen-recorder] muxed output:', data.length || data.byteLength, 'bytes');
    await ff.deleteFile(videoName).catch(() => {});
    await ff.deleteFile(audioName).catch(() => {});
    await ff.deleteFile(outName).catch(() => {});

    return new Blob([data.buffer], { type: 'video/mp4' });
  }

  // ── Edit panel operations ─────────────────────────────────
  // Each takes the current finalBlob + its mime type and returns a new Blob,
  // following the same write/exec/read/cleanup shape as muxVideoAudio()
  // above. Callers reassign finalBlob/finalMimeType and refresh the preview.
  function extFromMime(mimeType) {
    return (mimeType || '').includes('mp4') ? 'mp4' : 'webm';
  }

  const TEXT_FONTS = {
    clean:   { file: 'Roboto-Bold.ttf', label: 'Clean' },
    bold:    { file: 'Anton-Regular.ttf', label: 'Bold' },
    playful: { file: 'Pacifico-Regular.ttf', label: 'Playful' },
  };
  const fontsWritten = new Set();
  // Returns the ffmpeg virtual-FS filename for the chosen font, fetching +
  // writing it in only the first time each one is actually used.
  async function ensureDrawtextFont(ff, fontChoice) {
    const { file } = TEXT_FONTS[fontChoice] || TEXT_FONTS.clean;
    if (fontsWritten.has(file)) return file;
    const res = await fetch(`/assets/fonts/${file}`);
    const buf = await res.arrayBuffer();
    await ff.writeFile(file, new Uint8Array(buf));
    fontsWritten.add(file);
    return file;
  }

  // Escapes characters that would otherwise break ffmpeg's drawtext filter
  // argument syntax (colons separate filter options, quotes/backslashes are
  // the filter-string quoting characters).
  function escapeDrawtext(text) {
    return String(text).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
  }

  async function trimVideo(blob, mimeType, startSec, endSec) {
    const ff = await getFfmpeg();
    const ext = extFromMime(mimeType);
    const inName = `edit_in.${ext}`;
    const outName = `edit_out.${ext}`;
    await ff.writeFile(inName, new Uint8Array(await blob.arrayBuffer()));
    await ff.exec(['-ss', String(startSec), '-i', inName, '-t', String(endSec - startSec), '-c', 'copy', outName]);
    const data = await ff.readFile(outName);
    await ff.deleteFile(inName).catch(() => {});
    await ff.deleteFile(outName).catch(() => {});
    return new Blob([data.buffer], { type: mimeType || 'video/webm' });
  }

  async function removeSection(blob, mimeType, cutStart, cutEnd) {
    const ff = await getFfmpeg();
    const ext = extFromMime(mimeType);
    const inName = `edit_in.${ext}`;
    const partAName = `edit_partA.${ext}`;
    const partBName = `edit_partB.${ext}`;
    const listName = 'edit_concat.txt';
    const outName = `edit_out.${ext}`;
    await ff.writeFile(inName, new Uint8Array(await blob.arrayBuffer()));
    await ff.exec(['-i', inName, '-t', String(cutStart), '-c', 'copy', partAName]);
    await ff.exec(['-ss', String(cutEnd), '-i', inName, '-c', 'copy', partBName]);
    await ff.writeFile(listName, new TextEncoder().encode(`file '${partAName}'\nfile '${partBName}'\n`));
    await ff.exec(['-f', 'concat', '-safe', '0', '-i', listName, '-c', 'copy', outName]);
    const data = await ff.readFile(outName);
    await ff.deleteFile(inName).catch(() => {});
    await ff.deleteFile(partAName).catch(() => {});
    await ff.deleteFile(partBName).catch(() => {});
    await ff.deleteFile(listName).catch(() => {});
    await ff.deleteFile(outName).catch(() => {});
    return new Blob([data.buffer], { type: mimeType || 'video/webm' });
  }

  async function adjustVolume(blob, mimeType, factor) {
    const ff = await getFfmpeg();
    const inName = `edit_in.${extFromMime(mimeType)}`;
    const outName = 'edit_out.mp4';
    await ff.writeFile(inName, new Uint8Array(await blob.arrayBuffer()));
    await ff.exec(['-i', inName, '-c:v', 'copy', '-af', `volume=${factor}`, '-c:a', 'aac', '-b:a', '192k', outName]);
    const data = await ff.readFile(outName);
    await ff.deleteFile(inName).catch(() => {});
    await ff.deleteFile(outName).catch(() => {});
    return new Blob([data.buffer], { type: 'video/mp4' });
  }

  // Piecewise fade: 0 -> 1 over `dur`s after start, held at 1, then 1 -> 0
  // over `dur`s before end. `dur` shrinks automatically for a very short
  // on-screen window so the in/out ramps never overlap each other.
  function buildFadeAlpha(start, end) {
    const dur = Math.min(0.5, (end - start) / 2);
    if (dur <= 0) return '1';
    return `if(lt(t,${start}),0,if(lt(t,${start}+${dur}),(t-${start})/${dur},` +
      `if(lt(t,${end}-${dur}),1,if(lt(t,${end}),(${end}-t)/${dur},0))))`;
  }

  // Same idea but animates the y position: slides up from below the frame
  // into its resting spot (yFinalExpr), holds, then slides back down and
  // off-screen — same slide direction regardless of Top/Middle/Bottom, only
  // the resting position differs.
  function buildSlideY(yFinalExpr, start, end) {
    const dur = Math.min(0.4, (end - start) / 2);
    if (dur <= 0) return yFinalExpr;
    const yf = `(${yFinalExpr})`;
    return `if(lt(t,${start}+${dur}),h+(${yf}-h)*(t-${start})/${dur},` +
      `if(lt(t,${end}-${dur}),${yf},${yf}+(h-${yf})*(t-(${end}-${dur}))/${dur}))`;
  }

  async function addTextOverlay(blob, mimeType, text, position, startSec, endSec, effect, fontChoice) {
    const ff = await getFfmpeg();
    const fontFile = await ensureDrawtextFont(ff, fontChoice);
    const inName = `edit_in.${extFromMime(mimeType)}`;
    const outName = 'edit_out.mp4';
    const yFinal = position === 'top' ? '40' : position === 'bottom' ? 'h-text_h-40' : '(h-text_h)/2';
    const yExpr = effect === 'slide' ? buildSlideY(yFinal, startSec, endSec) : yFinal;
    const alphaPart = effect === 'fade' ? `:alpha='${buildFadeAlpha(startSec, endSec)}'` : '';
    const drawtext = `drawtext=fontfile=${fontFile}:text='${escapeDrawtext(text)}':fontsize=48:fontcolor=white:` +
      `x=(w-text_w)/2:y='${yExpr}':box=1:boxcolor=black@0.5:boxborderw=12:` +
      `enable='between(t,${startSec},${endSec})'${alphaPart}`;
    await ff.writeFile(inName, new Uint8Array(await blob.arrayBuffer()));
    await ff.exec(['-i', inName, '-vf', drawtext, '-c:v', 'libx264', '-c:a', 'aac', '-b:a', '192k', outName]);
    const data = await ff.readFile(outName);
    await ff.deleteFile(inName).catch(() => {});
    await ff.deleteFile(outName).catch(() => {});
    return new Blob([data.buffer], { type: 'video/mp4' });
  }

  function showReview() {
    if (reviewBlobUrl) URL.revokeObjectURL(reviewBlobUrl);
    reviewBlobUrl = URL.createObjectURL(finalBlob);
    reviewVideoEl.src = reviewBlobUrl;
    reviewEl.style.display = '';
  }

  // ── Controls ──────────────────────────────────────────────
  screenBtn.addEventListener('click', () => startRecording('screen'));
  webcamBtn.addEventListener('click', () => startRecording('webcam'));

  pauseBtn.addEventListener('click', () => {
    const recorders = currentMode === 'screen'
      ? [videoRecorder, audioRecorder].filter(Boolean)
      : [webcamRecorder].filter(Boolean);
    if (!recorders.length) return;

    if (recorders[0].state === 'recording') {
      recorders.forEach((r) => r.pause());
      pauseBtn.textContent = '▶ Resume';
      stopTimer();
      pausedElapsed = Date.now() - timerStart;
    } else if (recorders[0].state === 'paused') {
      recorders.forEach((r) => r.resume());
      pauseBtn.textContent = '⏸ Pause';
      timerStart = Date.now() - pausedElapsed;
      timerInterval = setInterval(() => {
        timerEl.textContent = formatTime(Date.now() - timerStart);
      }, 250);
    }
  });

  stopBtn.addEventListener('click', stopRecording);

  // A real click is a genuine user gesture — it restores focus reliably
  // even in the cases window.focus() alone couldn't, so this doubles as
  // both the visible instruction and the actual fix.
  activateOverlay.addEventListener('click', () => { activateOverlay.style.display = 'none'; });

  downloadBtn.addEventListener('click', () => {
    if (!finalBlob) return;
    const ext = finalMimeType.includes('mp4') ? 'mp4' : (finalMimeType.includes('ogg') ? 'ogg' : 'webm');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(finalBlob);
    a.download = `sell4life-recording-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  });

  rerecordBtn.addEventListener('click', resetToModeSelect);
  discardBtn.addEventListener('click', resetToModeSelect);

  // ── Edit panel ────────────────────────────────────────────
  const FILMSTRIP_THUMB_WIDTH = 70; // px — matches .rec-filmstrip-thumb width in vendor.css

  // One thumbnail per ~2s of clip, clamped so short clips still get a
  // reasonable strip and very long ones don't generate hundreds of frames.
  function thumbCountForDuration(duration) {
    return Math.max(12, Math.min(80, Math.round(duration / 2)));
  }

  // Fills a filmstrip's content area with fixed-width thumbnail frames wide
  // enough to overflow the visible viewport (so it's actually scrollable),
  // using an offscreen <video> (not editVideoEl itself) so generating
  // thumbnails never disturbs the visible preview's playback position.
  // Returns the clip's duration once done.
  async function generateFilmstrip(contentEl) {
    const trackEl = contentEl.querySelector('.rec-filmstrip-track');
    trackEl.innerHTML = '';
    if (!editBlobUrl) return 0;
    const probe = document.createElement('video');
    probe.src = editBlobUrl;
    probe.muted = true;
    probe.playsInline = true;
    await new Promise((resolve, reject) => {
      probe.addEventListener('loadedmetadata', resolve, { once: true });
      probe.addEventListener('error', reject, { once: true });
    });
    const duration = probe.duration || 0;
    const thumbCount = thumbCountForDuration(duration);
    contentEl.style.width = `${thumbCount * FILMSTRIP_THUMB_WIDTH}px`;
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < thumbCount; i++) {
      const t = duration * (i + 0.5) / thumbCount;
      await new Promise((resolve) => {
        probe.addEventListener('seeked', resolve, { once: true });
        probe.currentTime = t;
      });
      ctx.drawImage(probe, 0, 0, canvas.width, canvas.height);
      const img = document.createElement('img');
      img.className = 'rec-filmstrip-thumb';
      img.alt = '';
      img.src = canvas.toDataURL('image/jpeg', 0.6);
      trackEl.appendChild(img);
    }
    return duration;
  }

  // Generic two-handle drag scrubber over a filmstrip. Reused for both Trim
  // (handles mark what's KEPT — overlay dims everything outside them) and
  // Remove Part (handles mark what's CUT — overlay highlights between them).
  // Reports live [startSec, endSec] via onChange as the user drags, and
  // seeks editVideoEl so dragging doubles as a scrub-to-find-the-spot tool.
  function setupFilmstripHandles(filmstripEl, duration, initialStartFrac, initialEndFrac, onChange) {
    // Percentages below are relative to the scrollable content element
    // (the full-length filmstrip), not the clipped outer viewport, so
    // handles/overlays stay correctly positioned as the user scrolls.
    const contentEl = filmstripEl.querySelector('.rec-filmstrip-content');
    // Handle elements are static in the HTML and this runs again on every
    // regenerateFilmstrips() call — clone-replace them each time so the
    // pointerdown listener wired below never accumulates across edits.
    let startHandle = filmstripEl.querySelector('[data-handle="start"]');
    let endHandle = filmstripEl.querySelector('[data-handle="end"]');
    startHandle.replaceWith(startHandle = startHandle.cloneNode(true));
    endHandle.replaceWith(endHandle = endHandle.cloneNode(true));
    const dimLeft = filmstripEl.querySelector('.rec-filmstrip-dim-left');
    const dimRight = filmstripEl.querySelector('.rec-filmstrip-dim-right');
    const cut = filmstripEl.querySelector('.rec-filmstrip-cut');
    let startFrac = initialStartFrac;
    let endFrac = initialEndFrac;

    function render() {
      startHandle.style.left = `${startFrac * 100}%`;
      endHandle.style.left = `${endFrac * 100}%`;
      if (dimLeft) dimLeft.style.width = `${startFrac * 100}%`;
      if (dimRight) dimRight.style.width = `${(1 - endFrac) * 100}%`;
      if (cut) {
        cut.style.left = `${startFrac * 100}%`;
        cut.style.width = `${Math.max(0, endFrac - startFrac) * 100}%`;
      }
    }
    render();
    onChange(startFrac * duration, endFrac * duration);

    function wireHandle(handleEl, isStart) {
      handleEl.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); // don't also trigger the filmstrip's pan-to-scroll
        handleEl.setPointerCapture(e.pointerId);
        const move = (ev) => {
          const rect = contentEl.getBoundingClientRect();
          let frac = rect.width ? (ev.clientX - rect.left) / rect.width : 0;
          frac = Math.max(0, Math.min(1, frac));
          if (isStart) startFrac = Math.min(frac, endFrac - 0.01);
          else endFrac = Math.max(frac, startFrac + 0.01);
          render();
          const startSec = startFrac * duration;
          const endSec = endFrac * duration;
          editVideoEl.currentTime = isStart ? startSec : endSec;
          onChange(startSec, endSec);
        };
        const up = () => {
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      });
    }
    wireHandle(startHandle, true);
    wireHandle(endHandle, false);
  }

  // Click-and-drag panning for mice (touch/trackpad already scroll natively
  // via the container's overflow-x:auto — this just adds the same for a
  // plain mouse). Wired once per filmstrip element, since — unlike the
  // handles — the outer filmstrip element itself is never cloned/recreated.
  function setupFilmstripPanning(filmstripEl) {
    filmstripEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.rec-filmstrip-handle')) return; // handle has its own drag
      filmstripEl.setPointerCapture(e.pointerId);
      filmstripEl.classList.add('is-panning');
      const startX = e.clientX;
      const startScrollLeft = filmstripEl.scrollLeft;
      const move = (ev) => {
        filmstripEl.scrollLeft = startScrollLeft - (ev.clientX - startX);
      };
      const up = () => {
        filmstripEl.classList.remove('is-panning');
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
  }
  setupFilmstripPanning(trimFilmstripEl);
  setupFilmstripPanning(removeFilmstripEl);
  setupFilmstripPanning(textFilmstripEl);

  async function regenerateFilmstrips() {
    const [trimDuration, removeDuration, textDuration] = await Promise.all([
      generateFilmstrip(trimFilmstripEl.querySelector('.rec-filmstrip-content')),
      generateFilmstrip(removeFilmstripEl.querySelector('.rec-filmstrip-content')),
      generateFilmstrip(textFilmstripEl.querySelector('.rec-filmstrip-content')),
    ]);
    setupFilmstripHandles(trimFilmstripEl, trimDuration, 0, 1, (start, end) => {
      trimStartSec = start;
      trimEndSec = end;
      trimStartLabel.textContent = formatTime(start * 1000);
      trimEndLabel.textContent = formatTime(end * 1000);
    });
    setupFilmstripHandles(removeFilmstripEl, removeDuration, 0.25, 0.75, (start, end) => {
      cutMarkStart = start;
      cutMarkEnd = end;
      markStartLabel.textContent = formatTime(start * 1000);
      markEndLabel.textContent = formatTime(end * 1000);
    });
    // Text defaults to showing for its first ~5s (a title-card length) —
    // full clip if it's shorter than that.
    const defaultTextEndFrac = textDuration ? Math.min(1, 5 / textDuration) : 1;
    setupFilmstripHandles(textFilmstripEl, textDuration, 0, defaultTextEndFrac, (start, end) => {
      textStartSec = start;
      textEndSec = end;
      textStartLabel.textContent = formatTime(start * 1000);
      textEndLabel.textContent = formatTime(end * 1000);
    });
  }

  function showEditVideo() {
    if (editBlobUrl) URL.revokeObjectURL(editBlobUrl);
    editBlobUrl = URL.createObjectURL(finalBlob);
    editVideoEl.src = editBlobUrl;
    regenerateFilmstrips();
  }

  function showEditMsg(text, isError) {
    editMsgEl.textContent = text;
    editMsgEl.style.color = isError ? '#b45309' : '#0b6b6a';
    editMsgEl.style.display = '';
  }

  function setEditApplyButtonsDisabled(disabled) {
    [trimApplyBtn, removeApplyBtn, volumeApplyBtn, textApplyBtn].forEach((b) => { b.disabled = disabled; });
  }

  // Shared runner for all four edit operations — applies the ffmpeg result
  // as the new finalBlob on success, or leaves finalBlob untouched (same
  // "fall back rather than break the flow" pattern as the mux step) on
  // failure, surfacing the error inline instead of blocking the panel.
  async function runEditOperation(operationPromise, successMsg) {
    setEditApplyButtonsDisabled(true);
    showEditMsg('Working…', false);
    try {
      const result = await operationPromise;
      finalBlob = result;
      finalMimeType = result.type || finalMimeType;
      // Regenerates both filmstrips against the new clip and re-seeds
      // trimStartSec/trimEndSec/cutMarkStart/cutMarkEnd via their onChange
      // callbacks — any marks from before this edit no longer apply to the
      // new timeline, so there's nothing left to manually reset here.
      showEditVideo();
      showEditMsg(successMsg, false);
    } catch (err) {
      console.error('[screen-recorder] edit operation failed:', err);
      showEditMsg('Something went wrong applying that — your video is unchanged. (' + String(err) + ')', true);
    } finally {
      setEditApplyButtonsDisabled(false);
    }
  }

  editBtn.addEventListener('click', () => {
    preEditBlob = finalBlob;
    preEditMimeType = finalMimeType;
    editMsgEl.style.display = 'none';
    showEditVideo();
    reviewEl.style.display = 'none';
    editEl.style.display = '';
  });

  editToolBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      editToolBtns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      Object.entries(editPanels).forEach(([tool, panel]) => {
        panel.style.display = tool === btn.dataset.tool ? '' : 'none';
      });
      editMsgEl.style.display = 'none';
    });
  });

  trimApplyBtn.addEventListener('click', () => {
    if (trimEndSec <= trimStartSec) return;
    runEditOperation(trimVideo(finalBlob, finalMimeType, trimStartSec, trimEndSec), 'Trim applied.');
  });

  removeApplyBtn.addEventListener('click', () => {
    if (cutMarkEnd <= cutMarkStart) return;
    runEditOperation(removeSection(finalBlob, finalMimeType, cutMarkStart, cutMarkEnd), 'Part removed.');
  });

  volumeSlider.addEventListener('input', () => {
    volumeLabel.textContent = `${volumeSlider.value}%`;
  });
  volumeApplyBtn.addEventListener('click', () => {
    const factor = Number(volumeSlider.value) / 100;
    runEditOperation(adjustVolume(finalBlob, finalMimeType, factor), 'Volume adjusted.');
  });

  textPosBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      textPosBtns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activeTextPosition = btn.dataset.pos;
    });
  });
  textFxBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      textFxBtns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activeTextEffect = btn.dataset.fx;
    });
  });
  textFontBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      textFontBtns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activeTextFont = btn.dataset.font;
    });
  });
  textApplyBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (!text || textEndSec <= textStartSec) return;
    runEditOperation(
      addTextOverlay(
        finalBlob, finalMimeType, text, activeTextPosition, textStartSec, textEndSec, activeTextEffect, activeTextFont
      ),
      'Text added.'
    );
  });

  editRevertLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (!preEditBlob) return;
    finalBlob = preEditBlob;
    finalMimeType = preEditMimeType;
    showEditVideo();
    showEditMsg('Reverted to the original recording.', false);
  });

  editDoneBtn.addEventListener('click', () => {
    editEl.style.display = 'none';
    showReview();
  });
})();
