let shouldLog = true;
const log = (...args) => {
  shouldLog ? console.info(...args) : undefined;
};

const bufferLengthSeconds = 0.6;
const bufferLength = sampleRate * bufferLengthSeconds;

class DelayProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleClock = 0;
    this.buffers = [
      new Float32Array(bufferLength),
      new Float32Array(bufferLength)
    ];
  }

  process(inputs, outputs, parameters) {
    const buffers = this.buffers;
    const sampleClock = this.sampleClock;
    inputs[0].forEach((samples, c) => {
      samples.forEach((sample, s) => {
        // i think this should give us a wrap around buffer, the length of which corresponds to the delay time
        const bufferIndex = (sampleClock + s) % bufferLength;

        // write sample + buffer value
        outputs[0][c][s] = sample + buffers[c][bufferIndex];

        // overwrite buffer value for next time
        buffers[c][bufferIndex] = sample;
      });
    });
    this.sampleClock += inputs[0][0].length;
    shouldLog = false;

    // return "isActivelyProcessing" TODO: figure out when the buffer is empty and return false maybe?
    return true;
  }
}

registerProcessor("delay-processor", DelayProcessor);
console.info({ sampleRate });
