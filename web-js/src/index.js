/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as tf from '@tensorflow/tfjs';

import {IMAGENET_CLASSES} from './imagenet_classes';

const MOBILENET_MODEL_PATH =
    // tslint:disable-next-line:max-line-length
    'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json';

const IMAGE_SIZE = 64;
const TOPK_PREDICTIONS = 10;

let mobilenet;
const mobilenetDemo = async () => {
  console.log('Loading model...');

  // Pretrained model
  // mobilenet = await tf.loadLayersModel(MOBILENET_MODEL_PATH);

  // Load your own model
  const modelurl = 'https://storage.googleapis.com/foodai/model2_5.json';
  mobilenet = await tf.loadLayersModel(modelurl, false);
  console.log('loaded custom model');

  // Warmup the model. This isn't necessary, but makes the first prediction
  // faster. Call `dispose` to release the WebGL memory allocated for the return
  // value of `predict`.
  mobilenet.predict(tf.zeros([1, IMAGE_SIZE, IMAGE_SIZE, 3])).dispose();

  // Make a prediction through the locally hosted cat.jpg.
  const catElement = document.getElementById('img');
  console.log(catElement)
  if (catElement.complete && catElement.naturalHeight !== 0) {
    predict(catElement);
    catElement.style.display = '';
  } else {
    catElement.onload = () => {
      predict(catElement);
      catElement.style.display = '';
    }
  }
};

/**
 * Given an image element, makes a prediction through mobilenet returning the
 * probabilities of the top K classes.
 */
async function predict(imgElement) {
  console.log('Predicting...');

  // The first start time includes the time it takes to extract the image
  // from the HTML and preprocess it, in additon to the predict() call.
  const startTime1 = performance.now();
  // The second start time excludes the extraction and preprocessing and
  // includes only the predict() call.
  let startTime2;
  const logits = tf.tidy(() => {
    // tf.browser.fromPixels() returns a Tensor from an image element.
    const img = tf.browser.fromPixels(imgElement).toFloat();

    const offset = tf.scalar(127.5);
    // Normalize the image from [0, 255] to [-1, 1].
    const normalized = img.sub(offset).div(offset);

    // Reshape to a single-element batch so we can pass it to predict.
    // const batched = normalized.reshape([1, IMAGE_SIZE, IMAGE_SIZE, 3]);
    let resized = normalized;
    if (img.shape[0] !== IMAGE_SIZE || img.shape[1] !== IMAGE_SIZE) {
      const alignCorners = true;
      resized = tf.image.resizeBilinear(
          normalized, [IMAGE_SIZE, IMAGE_SIZE], alignCorners);
    }    
    const batched = resized.reshape([-1, IMAGE_SIZE, IMAGE_SIZE, 3]);

    startTime2 = performance.now();
    // Make a prediction through mobilenet.
    return mobilenet.predict(batched);
  });

  // Convert logits to probabilities and class names.
  const predictions = await getTopKClasses(logits, TOPK_PREDICTIONS);

  console.log(predictions);
  const predictionsElement = document.getElementById('predictions');
  predictions.forEach(prediction => {
    const elem = document.createElement('tr');
    elem.innerHTML = `<th>${prediction.className}</th><th>${prediction.probability}</th>`;
    predictionsElement.appendChild(elem);
  });    
}

/**
 * Computes the probabilities of the topK classes given logits by computing
 * softmax to get probabilities and then sorting the probabilities.
 * @param logits Tensor representing the logits from MobileNet.
 * @param topK The number of top predictions to show.
 */
export async function getTopKClasses(logits, topK) {
  const values = await logits.data();

  const valuesAndIndices = [];
  for (let i = 0; i < values.length; i++) {
    valuesAndIndices.push({value: values[i], index: i});
  }
  valuesAndIndices.sort((a, b) => {
    return b.value - a.value;
  });
  const topkValues = new Float32Array(topK);
  const topkIndices = new Int32Array(topK);
  for (let i = 0; i < topK; i++) {
    topkValues[i] = valuesAndIndices[i].value;
    topkIndices[i] = valuesAndIndices[i].index;
  }

  const topClassesAndProbs = [];
  for (let i = 0; i < topkIndices.length; i++) {
    topClassesAndProbs.push({
      className: IMAGENET_CLASSES[topkIndices[i]],
      probability: topkValues[i]
    })
  }
  return topClassesAndProbs;
}

const predictionsElement = document.getElementById('predictions');

window.onload = (e) => {
  mobilenetDemo();
}
