// logBase(10, y) => log base 10 of y
const logBase = (base, x) => Math.log(x) / Math.log(base);

// magnitude (0-1) to decibel conversion, ie:
//   mag2db(0) => -Infinity
//	 mag2db(1) => 0
const mag2db = y => 20 * logBase(10, y);

// rms is the root mean square
//	xs is an enumerable of numbers
const rms = xs =>
  Math.pow(xs.reduce((acc, x) => acc + Math.pow(x, 2), 0) / xs.length, 0.5);

let lastSrms = 0;
let calls = 0;
class CompressorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "threshold",
        defaultValue: -30,
        minValue: -80,
        maxValue: 0,
        automationRate: "a-rate"
      }
    ];
  }

  process(inputs, outputs, parameters) {
    calls += 1;
    if (calls < sampleRate / 128) {
      console.log(JSON.stringify({ lastSrms, db: mag2db(lastSrms) }));
    }
    inputs.forEach((channels, i) => {
      channels.forEach((samples, c) => {
        const srms = rms(samples);
        lastSrms = srms;
        samples.forEach((sample, s) => {
          let threshold =
            parameters["threshold"].length > 1
              ? parameters["threshold"][s]
              : parameters["threshold"][0];
          outputs[i][c][s] = mag2db(sample) > threshold ? sample * 0.5 : sample;
        });
      });
    });

    // TODO: can't seem to be able to return false here, even though docs say i should be able to?
    return true;
  }
}

registerProcessor("compressor-processor", CompressorProcessor);
