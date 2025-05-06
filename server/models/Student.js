const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  enrolledSubjects: [
    {
      subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
      attendance: [Boolean], 
    },
  ],
});

module.exports = mongoose.model('Student', studentSchema);
