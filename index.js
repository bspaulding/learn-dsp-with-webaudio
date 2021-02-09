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
