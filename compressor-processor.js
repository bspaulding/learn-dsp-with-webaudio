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

const rmsBufferLengthSeconds = 0.5;
const rmsBufferLength = Math.ceil(sampleRate * rmsBufferLengthSeconds);

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

  constructor() {
    super();
    this.sampleClock = 0;
    this.rmsBuffers = [
      new Float32Array(rmsBufferLength),
      new Float32Array(rmsBufferLength)
    ];
  }

  process(inputs, outputs, parameters) {
    let threshold = parameters["threshold"][0];
    let ratio = parameters["ratio"][0];
    let bypass = parameters["bypass"][0];

    const { rmsBuffers, sampleClock } = this;

    const metrics = [];

    inputs.forEach((channels, i) => {
      channels.forEach((samples, c) => {
        const srms = rms(rmsBuffers[c]);
        const rmsDb = mag2db(srms);
        const reductionDb = Math.max(rmsDb - threshold, 0) * ratio;

        samples.forEach((sample, s) => {
          // write sample to rmsBuffer
          const rmsBufferIndex = (sampleClock + s) % rmsBufferLength;
          rmsBuffers[c][s] = sample;

          const sampleCompressed =
            (sample < 0 ? -1 : 1) *
            db2mag(mag2db(Math.abs(sample)) - reductionDb);

          if (isNaN(sampleCompressed)) {
            console.warn("compressed sample value was NaN!");
          }

          metrics.push({ threshold, ratio, rmsDb, reductionDb });

          outputs[i][c][s] =
            bypass || isNaN(sampleCompressed) ? sample : sampleCompressed;
        });
      });

      this.sampleClock += channels[0].length;
    });

    const reductionDb =
      metrics.reduce((x, m) => x + m.reductionDb, 0) / metrics.length;
    const rmsDb = metrics.reduce((x, m) => x + m.rmsDb, 0) / metrics.length;
    this.port.postMessage(JSON.stringify({ reductionDb, rmsDb }));

    // TODO: can't seem to be able to return false here, even though docs say i should be able to?
    return true;
  }
}

registerProcessor("compressor-processor", CompressorProcessor);
