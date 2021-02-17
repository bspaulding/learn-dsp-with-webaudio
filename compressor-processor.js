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

const reduceMagByDb = (sample, reductionDb) =>
  (sample < 0 ? -1 : 1) * db2mag(mag2db(Math.abs(sample)) - reductionDb);

const rmsBufferLengthSeconds = 0.2;
const rmsBufferLength = Math.ceil(sampleRate * rmsBufferLengthSeconds);

class CompressorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "input-gain",
        defaultValue: 1,
        minValue: 0,
        maxValue: 5,
        automationRate: "a-rate"
      },
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
        name: "attack",
        defaultValue: 15,
        minValue: 0,
        maxValue: 200,
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
    let inputGain = parameters["input-gain"][0];
    let attackMs = parameters["attack"][0];
    const attackSamples = (attackMs / 1000) * sampleRate;

    const { rmsBuffers, sampleClock } = this;

    const metrics = [];

    const rmsDbByChannel = [];
    const reductionDbByChannel = [];

    inputs.forEach((channels, i) => {
      channels.forEach((samples, c) => {
        const srms = rms(rmsBuffers[c]);
        const rmsDb = mag2db(srms);
        const reductionDb = Math.max(rmsDb - threshold, 0) * (1 / ratio);

        rmsDbByChannel[c] = rmsDb;
        reductionDbByChannel[c] = reductionDb;

        samples.forEach((sampleRaw, s) => {
          const sample = inputGain * sampleRaw;
          // write sample to rmsBuffer
          const rmsBufferIndex = (sampleClock + s) % rmsBufferLength;
          rmsBuffers[c][s] = sample;

          const sampleCompressed = reduceMagByDb(
            sample,
            reductionDb * (s / attackSamples)
          );

          if (isNaN(sampleCompressed)) {
            console.warn("compressed sample value was NaN!");
          }

          metrics.push({
            sample,
            sampleCompressed
          });

          outputs[i][c][s] =
            bypass || isNaN(sampleCompressed) ? sample : sampleCompressed;
        });
      });

      if (channels.length) {
        this.sampleClock += channels[0].length;
      }
    });

    const reductionDb = reductionDbByChannel[0];
    const rmsDb = rmsDbByChannel[0];
    const samples = metrics.map(m => m.sample);
    const samplesCompressed = metrics.map(m => m.sampleCompressed);
    this.port.postMessage(
      JSON.stringify({ reductionDb, rmsDb, samples, samplesCompressed })
    );

    // TODO: can't seem to be able to return false here, even though docs say i should be able to?
    return true;
  }
}

registerProcessor("compressor-processor", CompressorProcessor);
