// logBase(10, y) => log base 10 of y
const logBase = (base, x) => Math.log(x) / Math.log(base);

// magnitude (0-1) to decibel conversion, ie:
//   ydb = 20 (log base 10 of ymag)
//   mag2db(0) => -Infinity
//	 mag2db(1) => 0
const mag2db = mag => 20 * logBase(10, mag);
const db2mag = ydb => Math.pow(10, ydb / 20);

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
      },
      {
        name: "ratio",
        defaultValue: 2,
        minValue: 1,
        maxValue: 20,
        automationRate: "a-rate"
      },
      {
        name: "bypass",
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: "a-rate"
      }
    ];
  }

  process(inputs, outputs, parameters) {
    calls += 1;
    inputs.forEach((channels, i) => {
      channels.forEach((samples, c) => {
        const srms = rms(samples);
        const rmsDb = mag2db(srms);
        lastSrms = srms;
        samples.forEach((sample, s) => {
          let threshold =
            parameters["threshold"].length > 1
              ? parameters["threshold"][s]
              : parameters["threshold"][0];
          let ratio =
            parameters["ratio"].length > 1
              ? parameters["ratio"][s]
              : parameters["ratio"][0];
          let bypass =
            parameters["bypass"].length > 1
              ? parameters["bypass"][s]
              : parameters["bypass"][0];

          const reductionDb = Math.max(rmsDb - threshold, 0) * ratio;
          const sampleCompressed =
            (sample < 0 ? -1 : 1) *
            db2mag(mag2db(Math.abs(sample)) - reductionDb);
          if (calls > 5 && calls < 10) {
            console.log({
              rmsDb,
              threshold,
              ratio,
              reductionDb,
              sample,
              sampleCompressed
            });
          }

          outputs[i][c][s] =
            bypass || isNaN(sampleCompressed) ? sample : sampleCompressed;
        });
      });
    });

    // TODO: can't seem to be able to return false here, even though docs say i should be able to?
    return true;
  }
}

registerProcessor("compressor-processor", CompressorProcessor);
