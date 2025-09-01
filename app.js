import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import {Hands} from 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
import {Camera} from 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';

const videoElement = document.getElementById('inputVideo');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');
const feedback = document.getElementById('feedback');
const langSelect = document.getElementById('languageSelect');

const translations = {
  en: {
    title: 'ASL Tutor',
    tutorial: 'Tutorial',
    practice: 'Practice',
    incorrect: 'Try Again'
  },
  ru: {
    title: 'Учебник ASL',
    tutorial: 'Обучение',
    practice: 'Практика',
    incorrect: 'Попробуй ещё раз'
  }
};

let currentLanguage = 'en';

function switchLanguage(lang) {
  currentLanguage = lang;
  document.getElementById('title').textContent = translations[lang].title;
  document.getElementById('tutorialBtn').textContent = translations[lang].tutorial;
  document.getElementById('practiceBtn').textContent = translations[lang].practice;
}

langSelect.addEventListener('change', e => switchLanguage(e.target.value));
switchLanguage('en');

function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = currentLanguage === 'ru' ? 'ru-RU' : 'en-US';
  speechSynthesis.speak(utter);
}

// Three.js scene with simple particles
const threeContainer = document.getElementById('threeContainer');
const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
threeContainer.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera3 = new THREE.PerspectiveCamera(70, threeContainer.clientWidth / threeContainer.clientHeight, 0.01, 10);
camera3.position.z = 1;
const particles = new THREE.Points(
  new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Array(300).fill(0).map(() => (Math.random() - 0.5)), 3)),
  new THREE.PointsMaterial({color: 0x00ff00, size: 0.02})
);
scene.add(particles);

function animate() {
  requestAnimationFrame(animate);
  particles.rotation.y += 0.002;
  renderer.render(scene, camera3);
}
animate();

function explode(correct) {
  particles.material.color.set(correct ? 0x00ff00 : 0xff0000);
}

// MediaPipe Hands setup
const hands = new Hands({locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({maxNumHands: 1, modelComplexity: 1, selfieMode: true});
hands.onResults(onResults);

const mpCamera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: 640,
  height: 480
});
mpCamera.start();

function drawLandmarks(landmarks) {
  canvasCtx.fillStyle = '#00ff00';
  for (const lm of landmarks) {
    canvasCtx.beginPath();
    canvasCtx.arc(lm.x * canvasElement.width, lm.y * canvasElement.height, 5, 0, 2 * Math.PI);
    canvasCtx.fill();
  }
}

const SIGN_MODELS = {
  A: [
    {x:0.5, y:0.8}, {x:0.55, y:0.7} // simplified for demo
  ],
  B: [
    {x:0.5, y:0.8}, {x:0.45, y:0.7}
  ]
};

function recognize(landmarks) {
  // naive recognition comparing first two landmarks only
  const lm0 = {x: landmarks[0].x, y: landmarks[0].y};
  const lm1 = {x: landmarks[5].x, y: landmarks[5].y};
  for (const [sign, model] of Object.entries(SIGN_MODELS)) {
    const d0 = Math.hypot(model[0].x - lm0.x, model[0].y - lm0.y);
    const d1 = Math.hypot(model[1].x - lm1.x, model[1].y - lm1.y);
    if (d0 < 0.1 && d1 < 0.1) return sign;
  }
  return null;
}

const learned = JSON.parse(localStorage.getItem('learned') || '[]');
function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0,0,canvasElement.width, canvasElement.height);
  if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
    const landmarks = results.multiHandLandmarks[0];
    drawLandmarks(landmarks);
    const sign = recognize(landmarks);
    if (sign) {
      feedback.textContent = sign;
      feedback.className = 'correct';
      speak(sign);
      explode(true);
      if (!learned.includes(sign)) {
        learned.push(sign);
        localStorage.setItem('learned', JSON.stringify(learned));
      }
    } else {
      feedback.textContent = translations[currentLanguage].incorrect;
      feedback.className = 'incorrect';
      explode(false);
    }
  }
  canvasCtx.restore();
}
