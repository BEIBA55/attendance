const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  date: { type: Date, required: true },
  attendance: [
    {
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
      isPresent: { type: Boolean, required: true },
    },
  ],
});

module.exports = mongoose.model('Attendance', attendanceSchema);
