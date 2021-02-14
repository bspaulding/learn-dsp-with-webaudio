class BufferSourceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleClock = 0;
    this.started = false;
    this.playing = false;
    this.bufferChannels = [];
    this.port.onmessage = event => {
      const action = JSON.parse(event.data);
      console.log("buffersource received: ", action);
      switch (action.type) {
        case "buffer":
          this.bufferChannels = action.payload.channels.map(
            c => new Float32Array(Object.values(c))
          );
          break;
        case "start":
          this.started = true;
          this.playing = true;
          break;
        case "stop":
          this.playing = false;
          break;
        default:
          console.warn("buffersource received unhandled action: ", action);
          break;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const { sampleClock, bufferChannels } = this;

    if (!this.started) {
      return true;
    }

    for (let o = 0; o < outputs.length; o += 1) {
      const channels = outputs[o];
      for (let c = 0; c < channels.length; c += 1) {
        if (bufferChannels.length < c) {
          continue;
        }

        const samples = channels[c];
        const bufferSamples = bufferChannels[c];
        for (let s = 0; s < samples.length; s += 1) {
          const bufferIndex = (sampleClock + s) % bufferSamples.length;
          outputs[o][c][s] = this.playing ? bufferSamples[bufferIndex] : 0;
        }
      }
    }

    this.sampleClock += outputs[0][0].length;

    return true;
  }
}

registerProcessor("buffer-source-processor", BufferSourceProcessor);
