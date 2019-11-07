'use strict';
const { Storage } = require('@google-cloud/storage');
const speech = require('@google-cloud/speech')
const client = new speech.SpeechClient();

/**
 * 
 */
exports.http = async (data, context) => {
  const file = {
    eventId: context.eventId,
    eventType: context.eventType,
    bucket: data.bucket,
    name: data.name,
    metageneration: data.metageneration,
    created: data.timeCreated,
    updated: data.updated

  }
  // console.log(`File: ${file}`);

  if (file.name) {
    // console.log('file Exists!');
    
    const gcsUri = `gs://${file.bucket}/${file.name}` // Audio del bucket

    const audio = {
      uri: gcsUri
    };

    const config = {
      encoding: 'LINEAR16',
      sampleRateHertz: 8000,
      languageCode: "es-CL",
      enableWordTimeOffsets: false
    }
    const request = {
      audio: audio,
      config: config
    };

    /**
     * Trancribe el archivo con las configuraciones previamente seteadas
     */
    const [operation] = await client.longRunningRecognize(request);
    const [response] = await operation.promise();
    const transcription = await response.results.map(result => result.alternatives[0].transcript).join('\n');
    // console.log(`Transcription: ${transcription}`);

    if (transcription) {

      /**
       * Funcion para limpiar las tildes
       * @param {} cadena 
       */
      const transformTranscription = async function (cadena) {
        var chars = {
          "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u",
          "à": "a", "è": "e", "ì": "i", "ò": "o", "ù": "u", "ñ": "n",
          "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U",
          "À": "A", "È": "E", "Ì": "I", "Ò": "O", "Ù": "U", "Ñ": "N"
        }
        var expr = /[áàéèíìóòúùñ]/ig;
        var res = await cadena.toString().replace(expr, function (e) { return chars[e] });
        return res;
      }

      /**
       * Limpiar el texto trancripto quitando las tildes
       */
      var cleanTranscription = "";
      await transformTranscription(transcription).then(res => {
        // console.log(res);
        cleanTranscription = res;
      }).catch(err => {
        console.error(err);
      });
      
      const storage = new Storage();
      const fs = require('fs');

      const cleanName = file.name.split("output/");
      const filename = await `${file.eventId}_${cleanName[1].toString().replace(".wav", ".csv")}`;


      /**
       * Crear y guardar el archivo en temp
       */
      await fs.writeFile('/tmp/' + filename, cleanTranscription, { encoding: 'utf8' }, (err) => {
        if (err) throw err;
        console.log('The file has been saved!');
      });

      /**
       * Funcion para mover el archivo de temp/ a to_nlp/
       */
      const destination = await 'to_nlp/' + filename;
      await storage.bucket(file.bucket).upload('/tmp/' + filename, { destination: destination })
        .then(() => {
          console.log(`${filename} uploaded to ${file.bucket}/${destination}`);
        })
        .catch(err => {
          console.error('ERROR:', err);
        });
    }
  }

}

exports.event = (event, callback) => {
  callback();
};
