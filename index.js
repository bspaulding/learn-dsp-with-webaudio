async function main() {
  document.getElementById("start").addEventListener("click", start);
}

let init = false;
let playing = false;
let bufferSource;
async function start() {
  if (playing) {
    bufferSource.stop();
    playing = false;
    document.getElementById("start").innerText = "start";
    return;
  } else if (init) {
    bufferSource.start(0);
    playing = true;
    document.getElementById("start").innerText = "stop";
    return;
  }

  playing = true;
  init = true;

  const audioContext = new AudioContext();

  const rawGuitarBuffer = await loadBuffer(
    audioContext,
    "audio/guitar-raw.wav"
  );
  let useWorkletBufferSource = true;
  let guitarBufferSource;
  if (!useWorkletBufferSource) {
    guitarBufferSource = audioContext.createBufferSource();
    guitarBufferSource.buffer = rawGuitarBuffer;
    guitarBufferSource.loop = true;
  } else {
    const bufferChannels = [
      ...Array(rawGuitarBuffer.numberOfChannels)
    ].map((_, i) => rawGuitarBuffer.getChannelData(i));
    await audioContext.audioWorklet.addModule("buffer-source-processor.js");
    guitarBufferSource = new AudioWorkletNode(
      audioContext,
      "buffer-source-processor",
      {
        outputChannelCount: [2],
        processorOptions: { bufferChannels }
      }
    );
    guitarBufferSource.start = ms => {
      guitarBufferSource.port.postMessage(
        JSON.stringify({ type: "start", payload: ms })
      );
    };
    guitarBufferSource.stop = ms => {
      guitarBufferSource.port.postMessage(JSON.stringify({ type: "stop" }));
    };
  }
  bufferSource = guitarBufferSource;

  await audioContext.audioWorklet.addModule("compressor-processor.js");
  const compressorNode = new AudioWorkletNode(
    audioContext,
    "compressor-processor"
  );
  const vizBuffersLength = 44100 * 2;
  const vizBuffers = {
    samplesBuffer: [],
    samplesCompressedBuffer: []
  };
  compressorNode.port.onmessage = event => {
    const { reductionDb, rmsDb, samples, samplesCompressed } = JSON.parse(
      event.data
    );
    document.querySelector("#compressor-rms-raw").innerText = Math.ceil(rmsDb);
    document.querySelector("progress[name=compressor-rms]").value = Math.abs(
      rmsDb / 100
    );
    document.querySelector("#compressor-reduction-raw").innerText = Math.ceil(
      reductionDb
    );
    document.querySelector(
      "progress[name=compressor-reduction]"
    ).value = Math.abs(reductionDb / 100);

    vizBuffers["samplesBuffer"] = samples.concat(
      vizBuffers["samplesBuffer"].slice(0, vizBuffersLength - samples.length)
    );
    vizBuffers["samplesCompressedBuffer"] = samplesCompressed.concat(
      vizBuffers["samplesCompressedBuffer"].slice(
        0,
        vizBuffersLength - samplesCompressed.length
      )
    );
  };

  drawWave(
    document.getElementById("compressor-input-wave"),
    vizBuffers,
    "samplesBuffer"
  );
  drawWave(
    document.getElementById("compressor-output-wave"),
    vizBuffers,
    "samplesCompressedBuffer"
  );

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
    "compressor-input-gain",
    "compressor-input-gain-value",
    "input-gain",
    compressorNode,
    asFloating(1),
    parseFloating
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
  document.getElementById("start").innerText = "stop";
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
const asFloating = precision => x =>
  x
    .toString()
    .split(".")
    .reduce(
      (str, part, i) =>
        i === 0 ? str + part : str + "." + part.slice(0, precision),
      ""
    );

const parsePercent = event => parseInt(event.target.value, 10) / 100;
const parseInteger = event => parseInt(event.target.value, 10);
const parseFloating = event => parseFloat(event.target.value);

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

function drawWave(canvas, vizBuffers, bufferName) {
  function draw() {
    requestAnimationFrame(draw);
    let data = vizBuffers[bufferName];
    let bufferLength = data.length;

    let context = canvas.getContext("2d");
    context.fillStyle = "rgb(235, 235, 235)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.lineWidth = 1;
    context.strokeStyle = "rgb(0,0,0)";

    context.beginPath();

    var sliceWidth = (canvas.width * 1.0) / bufferLength;
    var x = 0;
    for (var i = 0; i < bufferLength; i += 1) {
      var v = data[i] * 100;
      var y = canvas.height / 2 + v;
      i === 0 ? context.moveTo(x, y) : context.lineTo(x, y);
      x += sliceWidth;
    }

    context.lineTo(canvas.width, canvas.height / 2);
    context.stroke();
  }
  draw();
}
