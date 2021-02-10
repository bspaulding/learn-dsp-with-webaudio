async function main() {
  document.getElementById("start").addEventListener("click", start);
}

async function start() {
  const audioContext = new AudioContext();

  const rawGuitarBuffer = await loadBuffer(
    audioContext,
    "audio/guitar-raw.wav"
  );
  const guitarBufferSource = audioContext.createBufferSource();
  guitarBufferSource.buffer = rawGuitarBuffer;
  guitarBufferSource.loop = true;

  await audioContext.audioWorklet.addModule("delay-processor.js");
  const delayNode = new AudioWorkletNode(audioContext, "delay-processor");

  guitarBufferSource.connect(delayNode);
  delayNode.connect(audioContext.destination);

  // update delay param ui
  const mixSlider = document.getElementById("mix");
  const mixValue = document.getElementById("mix-value");
  mixSlider.value = delayNode.parameters.get("mix").value * 100;
  mixValue.innerText = `${Math.floor(
    delayNode.parameters.get("mix").value * 100
  )}%`;
  mixSlider.addEventListener("input", event => {
    delayNode.parameters.get("mix").value =
      parseInt(event.target.value, 10) / 100;
    mixValue.innerText = `${Math.floor(
      delayNode.parameters.get("mix").value * 100
    )}%`;
  });
  mixSlider.removeAttribute("disabled");

  const feedbackSlider = document.getElementById("feedback");
  const feedbackValue = document.getElementById("feedback-value");
  feedbackSlider.value = delayNode.parameters.get("feedback").value * 100;
  feedbackValue.innerText = `${Math.floor(
    delayNode.parameters.get("feedback").value * 100
  )}%`;
  feedbackSlider.addEventListener("input", event => {
    delayNode.parameters.get("feedback").value =
      parseInt(event.target.value, 10) / 100;
    feedbackValue.innerText = `${Math.floor(
      delayNode.parameters.get("feedback").value * 100
    )}%`;
  });
  feedbackSlider.removeAttribute("disabled");

  guitarBufferSource.start(0);
}

main()
  .then(() => console.log("done"))
  .catch(err => console.error("main errored: ", err));

function loadBuffer(audioContext, url) {
  return new Promise(resolve => {
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    request.onload = function() {
      audioContext.decodeAudioData(request.response, function(buffer) {
        resolve(buffer);
      });
    };
    request.send();
  });
}
