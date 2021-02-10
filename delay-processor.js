const bufferLengthSeconds = 0.588;
// ceil is for when this divide doesn't come out to a clean integer,
// ie: 44100 * 0.7 = 30869.9999999...
// this does mean we can't _really_ rely on the buffer length for the delay time anymore :(
const bufferLength = Math.ceil(sampleRate * bufferLengthSeconds);

class DelayProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "feedback",
        defaultValue: 0.4,
        minValue: 0.0,
        maxValue: 1.0,
        automationRate: "a-rate"
      },
      {
        name: "mix",
        defaultValue: 0.3,
        minValue: 0.0,
        maxValue: 1.0,
        automationRate: "a-rate"
      }
    ];
  }

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
      let mix =
        parameters["mix"].length > 1
          ? parameters["mix"][s]
          : parameters["mix"][0];
      let feedback =
        parameters["feedback"].length > 1
          ? parameters["feedback"][s]
          : parameters["feedback"][0];

      let sampleL = inputs[0][0][s];
      let sampleR = inputs[0][1][s];

      // i think this should give us a wrap around buffer, the length of which corresponds to the delay time
      const bufferIndex = (sampleClock + s) % bufferLength;

      // write sample + buffer value
      outputs[0][0][s] = sampleL * (1 - mix) + buffers[0][bufferIndex] * mix;
      outputs[0][1][s] = sampleR * (1 - mix) + buffers[1][bufferIndex] * mix;

      // overwrite buffer value for next time
      buffers[0][bufferIndex] = sampleL + feedback * buffers[0][bufferIndex];
      buffers[1][bufferIndex] = sampleR + feedback * buffers[1][bufferIndex];
    }
    this.sampleClock += inputs[0][0].length;

    // return "isActivelyProcessing" TODO: figure out when the buffer is empty and return false maybe?
    return true;
  }
}

registerProcessor("delay-processor", DelayProcessor);
