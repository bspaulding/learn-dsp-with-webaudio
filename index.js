async function main() {
  document.getElementById("start").addEventListener("click", start);
}

let playing = false;
let bufferSource;
async function start() {
  if (playing) {
    bufferSource.stop();
    return;
  }
  playing = true;

  const audioContext = new AudioContext();

  const rawGuitarBuffer = await loadBuffer(
    audioContext,
    "audio/guitar-raw.wav"
  );
  const guitarBufferSource = audioContext.createBufferSource();
  guitarBufferSource.buffer = rawGuitarBuffer;
  guitarBufferSource.loop = true;
  bufferSource = guitarBufferSource;

  await audioContext.audioWorklet.addModule("compressor-processor.js");
  const compressorNode = new AudioWorkletNode(
    audioContext,
    "compressor-processor"
  );
  compressorNode.port.onmessage = event => {
    const { reductionDb, rmsDb } = JSON.parse(event.data);
    document.querySelector("progress[name=compressor-rms]").value = Math.abs(
      rmsDb / 100
    );
    document.querySelector(
      "progress[name=compressor-reduction]"
    ).value = Math.abs(reductionDb / 100);
  };

  await audioContext.audioWorklet.addModule("delay-processor.js");
  const delayNode = new AudioWorkletNode(audioContext, "delay-processor");

  guitarBufferSource.connect(compressorNode);
  compressorNode.connect(delayNode);
  delayNode.connect(audioContext.destination);

  // update delay param ui
  wireParam(
    "mix",
    "mix-value",
    "mix",
    delayNode,
    asPercent,
    parsePercent,
    (el, x) => (el.value = x * 100)
  );
  wireParam(
    "feedback",
    "feedback-value",
    "feedback",
    delayNode,
    asPercent,
    parsePercent,
    (el, x) => (el.value = x * 100)
  );
  wireParam(
    "threshold",
    "threshold-value",
    "threshold",
    compressorNode,
    asDb,
    parseInteger
  );
  wireParam(
    "ratio",
    "ratio-value",
    "ratio",
    compressorNode,
    x => `${x}:1`,
    parseInteger
  );
  wireParam(
    "compressor-bypass",
    "compressor-bypass-value",
    "bypass",
    compressorNode,
    // labeltransform
    x => (x ? "Bypassed" : "Engaged"),
    // parseValueTransform
    e => (e.target.checked ? 1 : 0),
    // updateValue
    (el, v) => (el.checked = !!v)
  );

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

const identity = x => x;
const asPercent = x => `${Math.floor(x * 100)}%`;
const asDb = x => `${x}dB`;

const parsePercent = event => parseInt(event.target.value, 10) / 100;
const parseInteger = event => parseInt(event.target.value, 10);

function wireParam(
  inputId,
  valueId,
  paramName,
  node,
  labelTransform = identity,
  parseValueTransform = identity,
  updateInput = (el, v) => (el.value = v)
) {
  const control = document.getElementById(inputId);
  const valueLabel = document.getElementById(valueId);
  updateInput(control, (control.value = node.parameters.get(paramName).value));
  valueLabel.innerText = labelTransform(node.parameters.get(paramName).value);
  control.addEventListener("input", event => {
    node.parameters.get(paramName).value = parseValueTransform(event);
    valueLabel.innerText = labelTransform(node.parameters.get(paramName).value);
  });
  control.removeAttribute("disabled");
}
