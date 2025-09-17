import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;
const demosSection = document.getElementById("demos");
const imageBlendShapes = document.getElementById("image-blend-shapes");
const videoBlendShapes = document.getElementById("video-blend-shapes");

// Global face variables for access in drawBlendShapes and elsewhere
let faceVisible = 0;
let faceX = 0, faceY = 0, facePitch = 0, faceYaw = 0, faceRoll = 0, faceDistance = 0;
let mouthOpenness = 0, smile = 0;
let leftEyeOpenness = 0, rightEyeOpenness = 0;

let faceLandmarker;
let runningMode = "IMAGE";
let webcamRunning = false;
const videoWidth = 640;

// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
async function createFaceLandmarker() {
  const filesetResolver = await FilesetResolver.forVisionTasks( 
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode,
    numFaces: 1
  });
  demosSection.classList.remove("invisible");
  enableCam();
}
createFaceLandmarker();


const video = document.getElementById("webcam");
const canvasElement = document.getElementById(
  "output_canvas"
);

const canvasCtx = canvasElement.getContext("2d");

// Check if webcam access is supported.
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Enable the live webcam view and start detection.
function enableCam(event) {
  if (!faceLandmarker) {
    console.log("Wait! faceLandmarker not loaded yet.");
    return;
  }

  webcamRunning = true;

  // getUsermedia parameters.
  const constraints = {
    video: {
     // deviceId: { exact: "46b2e1ce273c32c9b9315d528a498af30589a00753901961ec047db4562ce573" }
    }
  };

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadeddata", predictWebcam);
      
      // Hide loading screen once the camera is ready
      const loadingScreen = document.getElementById("loading-screen");
      if (loadingScreen) {
        loadingScreen.style.display = "none";
      }
    })
    .catch((err) => {
      console.error("Camera access error: ", err);
      const errorMessage = document.createElement("div");
      errorMessage.textContent = "Error accessing the camera: " + err.message;
      errorMessage.style.color = "#e9521e";
      errorMessage.style.textAlign = "center";
      errorMessage.style.marginTop = "20px";
      document.body.appendChild(errorMessage);
    });
}

let lastVideoTime = -1;
let results = undefined;
const drawingUtils = new DrawingUtils(canvasCtx);
async function predictWebcam() {
  video.style.width = "100%";
  video.style.height = "100%";
  canvasElement.style.width = "100%";
  canvasElement.style.height = "100%";
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;
  // Now let's start detecting the stream.
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await faceLandmarker.setOptions({ runningMode: runningMode });
  }
  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = faceLandmarker.detectForVideo(video, startTimeMs);
  }
  if (results.faceLandmarks) {
    for (const landmarks of results.faceLandmarks) {
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_TESSELATION,
        { color: "#C0C0C070", lineWidth: 1 }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
        { color: "#f8c528" }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
        { color: "#f8c528" }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
        { color: "#66c2c6" }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
        { color: "#66c2c6" }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
        { color: "#E0E0E0" }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_LIPS,
        { color: "#e9521e" }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
        { color: "#7a2a18" }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
        { color: "#1d4f53" }
      );
    }
  }
  if (results.faceLandmarks.length > 0) {
    faceVisible = 1;
    const nose = results.faceLandmarks[0][1]; // landmark 1 = tip of nose
    faceX = Math.round(nose.x * 100);
    faceY = Math.round(nose.y * 100);
    let distanceRaw = -nose.z;
    faceDistance = Math.min(180, Math.max(0, Math.round(100-(distanceRaw)*500))) ;
    // Compute simple face orientation approximation from eye landmarks
    const rightEye = results.faceLandmarks[0][33];  // approx left eye outer
    const leftEye = results.faceLandmarks[0][263]; // approx right eye outer
    const chin = results.faceLandmarks[0][152];
    const forehead = results.faceLandmarks[0][10];

    // Yaw: 0 = looking 90° left, 99 = looking 90° right
    let yawRaw = (rightEye.z - leftEye.z); // positive if looking right
    // Pitch: 0 = looking down, 99 = looking up
    let pitchRaw = (forehead.z - chin.z); // positive if looking up
    // Scale and clamp values to 0-99
    faceYaw = Math.min(99, Math.max(0, Math.round((yawRaw + 0.12) * 440)));
    facePitch = Math.min(99, Math.max(0, Math.round((pitchRaw + 0.2) * 275)));
    faceRoll = Math.min(9, Math.max(0, Math.round((rightEye.y - leftEye.y + 0.2) * 27)));

    const upperLip = results.faceLandmarks[0][13];
    const lowerLip = results.faceLandmarks[0][14];
    const mouthOpennessRaw = Math.abs(lowerLip.y - upperLip.y);
    mouthOpenness = Math.min(99, Math.max(0, Math.round(mouthOpennessRaw * 1500)));

    const rightEyeTop = results.faceLandmarks[0][159];
    const rightEyeBottom = results.faceLandmarks[0][145];
    const rightEyeInner = results.faceLandmarks[0][133];
    const rightEyeOuter = results.faceLandmarks[0][33];
    const rightEyeHeight = Math.abs(rightEyeTop.y - rightEyeBottom.y);
    const rightEyeWidth = Math.abs(rightEyeInner.x - rightEyeOuter.x);
    const rightEyeRatio = rightEyeHeight / rightEyeWidth;
    rightEyeOpenness = Math.min(99, Math.max(0, Math.round(rightEyeRatio * 100)));

    const leftEyeTop = results.faceLandmarks[0][386];
    const leftEyeBottom = results.faceLandmarks[0][374];
    const leftEyeInner = results.faceLandmarks[0][362];
    const leftEyeOuter = results.faceLandmarks[0][263];
    const leftEyeHeight = Math.abs(leftEyeTop.y - leftEyeBottom.y);
    const leftEyeWidth = Math.abs(leftEyeInner.x - leftEyeOuter.x);
    const leftEyeRatio = leftEyeHeight / leftEyeWidth;
    leftEyeOpenness = Math.min(99, Math.max(0, Math.round(leftEyeRatio * 100)));

    const mouthLeft = results.faceLandmarks[0][61];
    const mouthRight = results.faceLandmarks[0][291];
    const smileRaw = Math.abs(mouthRight.x - mouthLeft.x);
    //smile = Math.min(99, Math.max(0, Math.round((smileRaw - 0.02) * 1000)));

    const eyeLeft = results.faceLandmarks[0][33];
const eyeRight = results.faceLandmarks[0][263];
const faceWidth = Math.abs(eyeRight.x - eyeLeft.x); // a proxy for face scale
const smileRatio = smileRaw / faceWidth;
smile = Math.min(9, Math.max(0, Math.round((smileRatio - 0.35) * 30)));

  } else {
    faceVisible = 0;
  }

  drawBlendShapes(videoBlendShapes, results.faceBlendshapes ?? []);

 

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

function drawBlendShapes(el, blendShapes) {
  // Allow drawing even when blendShapes is empty so faceVisible can still update

  //console.log(blendShapes[0]);
  
  let htmlMaker = "";
  htmlMaker += `
    <li class="blend-shapes-item"><span class="blend-shapes-label">X</span><span class="blend-shapes-value" style="width: ${faceX*3}px">${faceX}</span></li>
    <li class="blend-shapes-item"><span class="blend-shapes-label">Y</span><span class="blend-shapes-value"style="width: ${faceY*3}px">${faceY}</span></li>
       <li class="blend-shapes-item"><span class="blend-shapes-label">Distance</span><span class="blend-shapes-value"style="width: ${faceDistance*3}px">${faceDistance}</span></li>
    <li class="blend-shapes-item"><span class="blend-shapes-label">Yaw</span><span class="blend-shapes-value"style="width: ${faceYaw*3}px">${faceYaw}</span></li>
    <li class="blend-shapes-item"><span class="blend-shapes-label">Pitch</span><span class="blend-shapes-value"style="width: ${facePitch*3}px">${facePitch}</span></li>
    <li class="blend-shapes-item"><span class="blend-shapes-label">Mouth</span><span class="blend-shapes-value" style="width: ${mouthOpenness*3}px">${mouthOpenness}</span></li>
    <li class="blend-shapes-item"><span class="blend-shapes-label">Left Eye</span><span class="blend-shapes-value" style="width: ${leftEyeOpenness*3}px">${leftEyeOpenness}</span></li>
    <li class="blend-shapes-item"><span class="blend-shapes-label">Right Eye</span><span class="blend-shapes-value" style="width: ${rightEyeOpenness*3}px">${rightEyeOpenness}</span></li>
        <li class="blend-shapes-item"><span class="blend-shapes-label">Roll</span><span class="blend-shapes-value"style="width: ${faceRoll*30}px">${faceRoll}</span></li>
    <li class="blend-shapes-item"><span class="blend-shapes-label">Smile/Kiss</span><span class="blend-shapes-value" style="width: ${smile*30}px">${smile}</span></li>
    <li class="blend-shapes-item"><span class="blend-shapes-label">Face Visible</span><span class="blend-shapes-value" style="width: ${faceVisible * 100}px">${faceVisible}</span></li>

    `;

  /*
  if (blendShapes[0] && blendShapes[0].categories) {
    blendShapes[0].categories.map((shape) => {
      htmlMaker += `
        <li class="blend-shapes-item">
          <span class="blend-shapes-label">${
            shape.displayName || shape.categoryName
          }</span>
          <span class="blend-shapes-value" style="width: calc(${
            +shape.score * 100
          }% - 120px)">${(+shape.score).toFixed(4)}</span>
        </li>
      `;
    });
  }
*/

  el.innerHTML = htmlMaker;
}


document.getElementById('fullscreenBtn').addEventListener('click', function () {
  toggleFullScreen();
});

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(err => {
        console.log(`Error attempting to disable full-screen mode: ${err.message} (${err.name})`);
      });
    }
  }
}

function formatAndTrim(value) {
  let trimmedValue = Math.max(0, Math.min(99, value));
  return trimmedValue.toString().padStart(2, '0');
}

setInterval(() => {
  if (typeof sendUART === 'function') {
    const data =
      formatAndTrim(faceX) +
      formatAndTrim(faceY) +
      formatAndTrim(faceDistance) +
      formatAndTrim(faceYaw) +
      formatAndTrim(facePitch) +
      formatAndTrim(mouthOpenness) +
      formatAndTrim(leftEyeOpenness) +
      formatAndTrim(rightEyeOpenness)+
      faceRoll+
      smile+
      faceVisible;

    sendUART(data);
   
  }
}, 100); // every 100ms = 10 times per second
