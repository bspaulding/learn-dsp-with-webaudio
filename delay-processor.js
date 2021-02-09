let shouldLog = true;
const log = (...args) => {
  shouldLog ? console.info(...args) : undefined;
};

const bufferLengthSeconds = 0.588;
// ceil is for when this divide doesn't come out to a clean integer,
// ie: 44100 * 0.7 = 30869.9999999...
// this does mean we can't _really_ rely on the buffer length for the delay time anymore :(
const bufferLength = Math.ceil(sampleRate * bufferLengthSeconds);

// 0.2 == 20%
const feedback = 0.2;

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
    for (let s = 0; s < inputs[0][0].length; s++) {
      let sampleL = inputs[0][0][s];
      let sampleR = inputs[0][1][s];

      // i think this should give us a wrap around buffer, the length of which corresponds to the delay time
      const bufferIndex = (sampleClock + s) % bufferLength;

      // write sample + buffer value
      outputs[0][0][s] = sampleL + buffers[0][bufferIndex];
      outputs[0][1][s] = sampleR + buffers[1][bufferIndex];

      // overwrite buffer value for next time
      buffers[0][bufferIndex] = sampleL + feedback * buffers[0][bufferIndex];
      buffers[1][bufferIndex] = sampleR + feedback * buffers[1][bufferIndex];
    }
    this.sampleClock += inputs[0][0].length;
    shouldLog = false;

    // return "isActivelyProcessing" TODO: figure out when the buffer is empty and return false maybe?
    return true;
  }
}

registerProcessor("delay-processor", DelayProcessor);
console.info({ sampleRate });
