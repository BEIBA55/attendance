const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  lectures: [{ type: Date }], 
});

module.exports = mongoose.model('Subject', subjectSchema);
